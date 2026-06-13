using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text.Json;
using FpsSidecar.Models;
using FpsSidecar.Providers;

namespace FpsSidecar.Services;

/// <summary>
/// Service to manage PresentMon process and parse its CSV output
/// </summary>
public class PresentMonService
{
    private Process? _process;
    private const int RestartDelayMs = 2000;
    private const int MaxRestartDelayMs = 15000;
    private const string PresentMonOverrideEnv = "PULSE_PRESENTMON_PATH";
    private const string BundledPresentMonFileName = "presentmon-x86_64-pc-windows-msvc.exe";
    private const string TauriPresentMonFileName = "presentmon.exe";
    private readonly string _baseDirectory;
    private readonly Func<string?> _findPresentMonExe;

    /// Captured critical error from PresentMon stderr (access denied, etc.)
    private volatile string? _lastCriticalError;
    
    private readonly string[] _defaultInstallPaths =
    [
        @"C:\Program Files\Intel\PresentMon\PresentMonConsoleApplication",
        @"C:\Program Files (x86)\Intel\PresentMon\PresentMonConsoleApplication"
    ];

    public PresentMonService() : this(AppContext.BaseDirectory)
    {
    }

    public PresentMonService(string baseDirectory)
    {
        _baseDirectory = baseDirectory;
        _findPresentMonExe = FindPresentMonExe;
    }

    public PresentMonService(Func<string?> findPresentMonExe)
    {
        ArgumentNullException.ThrowIfNull(findPresentMonExe);

        _baseDirectory = AppContext.BaseDirectory;
        _findPresentMonExe = findPresentMonExe;
    }

    /// Processes to exclude from FPS tracking (system compositors, browsers, Tauri WebView)
    private static readonly HashSet<string> ExcludedProcesses = new(StringComparer.OrdinalIgnoreCase)
    {
        // Tauri / Electron WebView
        "msedgewebview2.exe",
        // Windows system compositors
        "dwm.exe",
        "csrss.exe",
        "explorer.exe",
        // Browsers
        "chrome.exe",
        "msedge.exe",
        "firefox.exe",
        "brave.exe",
        "opera.exe",
        // System
        "SearchHost.exe",
        "ShellExperienceHost.exe",
        "StartMenuExperienceHost.exe",
        "TextInputHost.exe",
        "SystemSettings.exe",
        "WindowsTerminal.exe",
        "wt.exe",
        // Self
        "Pulse.exe",
    };

    /// <summary>
    /// Find PresentMon executable candidates in deterministic preference order.
    /// </summary>
    public IEnumerable<string> GetPresentMonCandidates()
    {
        var overridePath = Environment.GetEnvironmentVariable(PresentMonOverrideEnv);
        if (!string.IsNullOrWhiteSpace(overridePath))
        {
            yield return overridePath;
        }

        var baseDirectory = _baseDirectory;
        yield return Path.Combine(baseDirectory, BundledPresentMonFileName);
        yield return Path.Combine(baseDirectory, TauriPresentMonFileName);
        yield return Path.Combine(baseDirectory, "PresentMon.exe");

        foreach (var dir in _defaultInstallPaths)
        {
            if (!Directory.Exists(dir)) continue;

            foreach (var exe in Directory.GetFiles(dir, "PresentMon-*.exe"))
            {
                yield return exe;
            }
        }
    }

    /// <summary>
    /// Find PresentMon executable (handles bundled, sibling, and versioned installed filenames).
    /// </summary>
    public string? FindPresentMonExe()
    {
        foreach (var candidate in GetPresentMonCandidates())
        {
            if (File.Exists(candidate))
            {
                return candidate;
            }
        }

        return null;
    }

    /// <summary>
    /// Start monitoring and output FPS stats as JSON to stdout
    /// </summary>
    public async Task StartAsync(CancellationToken ct)
    {
        var provider = new PresentMonConsoleProvider(FindPresentMonExe);

        await foreach (var providerEvent in provider.RunAsync(ct))
        {
            var output = ToOutput(providerEvent);
            Console.WriteLine(JsonSerializer.Serialize(output, FpsJsonContext.Default.FpsOutput));
            Console.Out.Flush();
        }
    }

    public async IAsyncEnumerable<FpsProviderEvent> RunConsoleProviderAsync(
        [EnumeratorCancellation] CancellationToken ct)
    {
        var restartDelayMs = RestartDelayMs;

        try
        {
            while (!ct.IsCancellationRequested)
            {
                var exePath = _findPresentMonExe();

                if (exePath == null)
                {
                    yield return new FpsProviderEvent(
                        FpsProviderEventType.Error,
                        Error: "PresentMon is unavailable. Pulse could not find its bundled PresentMon binary or an installed Intel PresentMon.",
                        PresentMonInstalled: false
                    );

                    try
                    {
                        await Task.Delay(TimeSpan.FromSeconds(5), ct);
                    }
                    catch (OperationCanceledException) when (ct.IsCancellationRequested)
                    {
                        yield break;
                    }

                    continue;
                }

                Console.Error.WriteLine($"[fps-sidecar] Found PresentMon: {exePath}");

                var startInfo = new ProcessStartInfo
                {
                    FileName = exePath,
                    Arguments = "--output_stdout --no_console_stats --stop_existing_session --session_name PulseFPS",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                };

                _process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
                _lastCriticalError = null;

                Exception? startException = null;
                try
                {
                    _process.Start();
                    _process.ErrorDataReceived += OnPresentMonError;
                    _process.BeginErrorReadLine();
                    Console.Error.WriteLine("[fps-sidecar] PresentMon started");
                }
                catch (Exception ex)
                {
                    startException = ex;
                }

                if (startException != null)
                {
                    yield return new FpsProviderEvent(
                        FpsProviderEventType.Error,
                        Error: $"Failed to start PresentMon: {startException.Message}",
                        PresentMonInstalled: true
                    );

                    try
                    {
                        await Task.Delay(restartDelayMs, ct);
                    }
                    catch (OperationCanceledException) when (ct.IsCancellationRequested)
                    {
                        yield break;
                    }

                    restartDelayMs = Math.Min(restartDelayMs * 2, MaxRestartDelayMs);
                    continue;
                }

                // Parse CSV from stdout
                var hadData = false;
                await foreach (var providerEvent in ParseCsvOutputAsync(ct))
                {
                    if (providerEvent.Type == FpsProviderEventType.FpsData)
                    {
                        hadData = true;
                    }

                    yield return providerEvent;
                }

                if (ct.IsCancellationRequested)
                {
                    yield break;
                }

                if (hadData)
                {
                    restartDelayMs = RestartDelayMs;
                }

                // Classify why PresentMon exited: critical error vs no game
                if (_lastCriticalError != null)
                {
                    yield return new FpsProviderEvent(
                        FpsProviderEventType.Error,
                        Error: _lastCriticalError,
                        PresentMonInstalled: true
                    );
                    Console.Error.WriteLine($"[fps-sidecar] PresentMon critical error: {_lastCriticalError}");
                }
                else
                {
                    yield return new FpsProviderEvent(FpsProviderEventType.NoGame);
                    Console.Error.WriteLine("[fps-sidecar] PresentMon stopped. No game detected.");
                }

                try
                {
                    await Task.Delay(restartDelayMs, ct);
                }
                catch (OperationCanceledException) when (ct.IsCancellationRequested)
                {
                    yield break;
                }

                restartDelayMs = Math.Min(restartDelayMs * 2, MaxRestartDelayMs);
            }
        }
        finally
        {
            Stop();
        }
    }

    public static FpsOutput ToOutput(FpsProviderEvent providerEvent)
    {
        return providerEvent.Type switch
        {
            FpsProviderEventType.FpsData => new FpsOutput
            {
                Type = "fps-data",
                Data = providerEvent.Data,
                PresentMonInstalled = providerEvent.PresentMonInstalled
            },
            FpsProviderEventType.NoGame => new FpsOutput
            {
                Type = "no-game",
                PresentMonInstalled = providerEvent.PresentMonInstalled
            },
            FpsProviderEventType.Error => new FpsOutput
            {
                Type = "error",
                Error = providerEvent.Error,
                PresentMonInstalled = providerEvent.PresentMonInstalled
            },
            _ => throw new ArgumentOutOfRangeException(nameof(providerEvent))
        };
    }

    private async IAsyncEnumerable<FpsProviderEvent> ParseCsvOutputAsync(
        [EnumeratorCancellation] CancellationToken ct)
    {
        if (_process == null) yield break;

        var buffer = new List<CsvRow>();
        var lastEmit = DateTime.Now;
        
        using var reader = _process.StandardOutput;
        string? line;
        bool headerParsed = false;
        string[] headers = [];
        Dictionary<string, int>? headerIndex = null;

        while (!ct.IsCancellationRequested)
        {
            try
            {
                line = await reader.ReadLineAsync(ct);
            }
            catch (OperationCanceledException)
            {
                yield break;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[fps-sidecar] Parse error: {ex.Message}");
                yield break;
            }

            if (line == null) yield break;
            if (string.IsNullOrWhiteSpace(line)) continue;

            if (!headerParsed)
            {
                headers = line.Split(',');
                headerIndex = BuildHeaderIndex(headers);
                headerParsed = true;
                Console.Error.WriteLine($"[fps-sidecar] CSV headers parsed: {headers.Length} columns");
                continue;
            }

            if (headerIndex == null) continue;

            // Parse CSV row
            var row = ParseCsvRow(headerIndex, line);
            if (row != null)
            {
                buffer.Add(row);
            }

            // Emit aggregated data every ~1 second
            if ((DateTime.Now - lastEmit).TotalSeconds >= 1 && buffer.Count > 0)
            {
                var aggregated = AggregateBuffer(buffer);
                yield return new FpsProviderEvent(FpsProviderEventType.FpsData, Data: aggregated);

                buffer.Clear();
                lastEmit = DateTime.Now;
            }
        }
    }

    private void OnPresentMonError(object sender, DataReceivedEventArgs e)
    {
        if (string.IsNullOrWhiteSpace(e.Data)) return;
        Console.Error.WriteLine($"[fps-sidecar] PresentMon: {e.Data}");

        // Detect critical errors that prevent PresentMon from functioning
        var line = e.Data;
        if (line.Contains("access denied", StringComparison.OrdinalIgnoreCase))
        {
            _lastCriticalError = "PresentMon requires administrator privileges or the user must be in the 'Performance Log Users' group.";
        }
        else if (line.Contains("trace session", StringComparison.OrdinalIgnoreCase)
                 && line.Contains("already running", StringComparison.OrdinalIgnoreCase))
        {
            _lastCriticalError = "Another PresentMon trace session is already running.";
        }
    }

    /// <summary>
    /// Build header name -> column index mapping
    /// </summary>
    private static Dictionary<string, int> BuildHeaderIndex(string[] headers)
    {
        var index = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < headers.Length; i++)
        {
            var name = headers[i].Trim();
            if (!string.IsNullOrEmpty(name))
            {
                index[name] = i;
            }
        }
        return index;
    }

    /// <summary>
    /// Parse a single CSV row into CsvRow object
    /// Key columns: Application, ProcessID, msBetweenPresents
    /// </summary>
    private static CsvRow? ParseCsvRow(Dictionary<string, int> headerIndex, string line)
    {
        try
        {
            var values = line.Split(',');
            
            // Get column indices - handle different column names in PresentMon versions
            var appIdx = headerIndex.GetValueOrDefault("Application", -1);
            var pidIdx = headerIndex.GetValueOrDefault("ProcessID", 
                         headerIndex.GetValueOrDefault("Process ID", -1));
            var msIdx = headerIndex.GetValueOrDefault("msBetweenPresents",
                        headerIndex.GetValueOrDefault("MsBetweenPresents", -1));

            if (appIdx < 0 || pidIdx < 0 || msIdx < 0) return null;
            if (values.Length <= Math.Max(appIdx, Math.Max(pidIdx, msIdx))) return null;

            var app = values[appIdx].Trim();
            if (string.IsNullOrEmpty(app)) return null;

            // Skip non-game processes (system compositors, browsers, Tauri WebView)
            if (ExcludedProcesses.Contains(app)) return null;

            if (!int.TryParse(values[pidIdx], out int pid)) return null;
            if (!double.TryParse(values[msIdx], out double ms)) return null;
            if (ms <= 0) return null; // Invalid frame time

            return new CsvRow
            {
                Application = app,
                ProcessId = pid,
                MsBetweenPresents = ms
            };
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Aggregate buffer into FpsData with average FPS, 1% low, 0.1% low
    /// </summary>
    private static FpsData AggregateBuffer(List<CsvRow> buffer)
    {
        if (buffer.Count == 0)
        {
            return new FpsData();
        }

        // Group by process - use the most active one (most frames)
        var grouped = buffer
            .GroupBy(r => r.ProcessId)
            .OrderByDescending(g => g.Count())
            .First();

        var frames = grouped.ToList();
        var processName = frames.First().Application;
        var processId = grouped.Key;

        // Frame times in ms
        var frameTimes = frames.Select(f => f.MsBetweenPresents).OrderBy(t => t).ToList();
        
        // Average frame time and FPS
        var avgFrameTime = frameTimes.Average();
        var avgFps = 1000.0 / avgFrameTime;

        // 1% low: average of the worst 1% frames
        var onePercentCount = Math.Max(1, (int)(frameTimes.Count * 0.01));
        var worstOnePercent = frameTimes.TakeLast(onePercentCount);
        var fps1PercentLow = 1000.0 / worstOnePercent.Average();

        // 0.1% low: average of the worst 0.1% frames
        var pointOnePercentCount = Math.Max(1, (int)(frameTimes.Count * 0.001));
        var worstPointOnePercent = frameTimes.TakeLast(pointOnePercentCount);
        var fps01PercentLow = 1000.0 / worstPointOnePercent.Average();

        return new FpsData
        {
            ProcessName = processName,
            ProcessId = processId,
            Fps = Math.Round(avgFps, 1),
            FrameTime = Math.Round(avgFrameTime, 2),
            Fps1PercentLow = Math.Round(fps1PercentLow, 1),
            Fps01PercentLow = Math.Round(fps01PercentLow, 1),
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        };
    }

    public void Stop()
    {
        if (_process != null && !_process.HasExited)
        {
            try
            {
                _process.Kill(entireProcessTree: true);
            }
            catch { }
            finally
            {
                _process.Dispose();
                _process = null;
            }
        }
    }

    /// <summary>
    /// Internal CSV row representation
    /// </summary>
    private class CsvRow
    {
        public string Application { get; set; } = "";
        public int ProcessId { get; set; }
        public double MsBetweenPresents { get; set; }
    }
}
