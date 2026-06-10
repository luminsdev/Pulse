using System.Diagnostics;
using System.Text.Json;
using FpsSidecar.Models;

namespace FpsSidecar.Services;

/// <summary>
/// Service to manage PresentMon process and parse its CSV output
/// </summary>
public class PresentMonService
{
    private Process? _process;
    private const int RestartDelayMs = 2000;
    private const int MaxRestartDelayMs = 15000;
    
    private readonly string[] _defaultInstallPaths =
    [
        @"C:\Program Files\Intel\PresentMon\PresentMonConsoleApplication",
        @"C:\Program Files (x86)\Intel\PresentMon\PresentMonConsoleApplication"
    ];

    /// <summary>
    /// Find PresentMon executable (handles versioned filenames like PresentMon-2.4.1-x64.exe)
    /// </summary>
    public string? FindPresentMonExe()
    {
        foreach (var dir in _defaultInstallPaths)
        {
            if (!Directory.Exists(dir)) continue;
            
            // Look for versioned exe: PresentMon-*.exe
            var exe = Directory.GetFiles(dir, "PresentMon-*.exe").FirstOrDefault();
            if (exe != null) return exe;
        }
        return null;
    }

    /// <summary>
    /// Start monitoring and output FPS stats as JSON to stdout
    /// </summary>
    public async Task StartAsync(CancellationToken ct)
    {
        var exePath = FindPresentMonExe();
        
        if (exePath == null)
        {
            var output = new FpsOutput
            {
                Type = "error",
                Error = "PresentMon not installed. Download from: https://game.intel.com/story/intel-presentmon/",
                PresentMonInstalled = false
            };
            Console.WriteLine(JsonSerializer.Serialize(output, FpsJsonContext.Default.FpsOutput));
            Console.Out.Flush();
            
            // Keep running but output "not installed" periodically
            while (!ct.IsCancellationRequested)
            {
                await Task.Delay(5000, ct);
                Console.WriteLine(JsonSerializer.Serialize(output, FpsJsonContext.Default.FpsOutput));
                Console.Out.Flush();
            }
            return;
        }

        Console.Error.WriteLine($"[fps-sidecar] Found PresentMon: {exePath}");

        var restartDelayMs = RestartDelayMs;

        while (!ct.IsCancellationRequested)
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = exePath,
                Arguments = "--output_stdout --no_console_stats",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };

            _process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };

            try
            {
                _process.Start();
                _process.ErrorDataReceived += OnPresentMonError;
                _process.BeginErrorReadLine();
                Console.Error.WriteLine("[fps-sidecar] PresentMon started");
            }
            catch (Exception ex)
            {
                var output = new FpsOutput
                {
                    Type = "error",
                    Error = $"Failed to start PresentMon: {ex.Message}",
                    PresentMonInstalled = true
                };
                Console.WriteLine(JsonSerializer.Serialize(output, FpsJsonContext.Default.FpsOutput));
                Console.Out.Flush();

                await Task.Delay(restartDelayMs, ct);
                restartDelayMs = Math.Min(restartDelayMs * 2, MaxRestartDelayMs);
                continue;
            }

            // Parse CSV from stdout
            var hadData = await ParseCsvOutputAsync(ct);

            if (ct.IsCancellationRequested)
            {
                break;
            }

            if (hadData)
            {
                restartDelayMs = RestartDelayMs;
            }

            var noGameOutput = new FpsOutput
            {
                Type = "no-game",
                PresentMonInstalled = true
            };
            Console.WriteLine(JsonSerializer.Serialize(noGameOutput, FpsJsonContext.Default.FpsOutput));
            Console.Out.Flush();

            Console.Error.WriteLine("[fps-sidecar] PresentMon stopped. Waiting for activity...");
            await Task.Delay(restartDelayMs, ct);
            restartDelayMs = Math.Min(restartDelayMs * 2, MaxRestartDelayMs);
        }
    }

    private async Task<bool> ParseCsvOutputAsync(CancellationToken ct)
    {
        if (_process == null) return false;

        var buffer = new List<CsvRow>();
        var lastEmit = DateTime.Now;
        var hadData = false;
        
        using var reader = _process.StandardOutput;
        string? line;
        bool headerParsed = false;
        string[] headers = [];
        Dictionary<string, int>? headerIndex = null;

        try
        {
            while (!ct.IsCancellationRequested && (line = await reader.ReadLineAsync(ct)) != null)
            {
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
                    var output = new FpsOutput
                    {
                        Type = "fps-data",
                        Data = aggregated
                    };
                    Console.WriteLine(JsonSerializer.Serialize(output, FpsJsonContext.Default.FpsOutput));
                    Console.Out.Flush();
                    hadData = true;
                    
                    buffer.Clear();
                    lastEmit = DateTime.Now;
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Normal cancellation
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[fps-sidecar] Parse error: {ex.Message}");
        }

        // Exit parsing loop; StartAsync handles no-game + restart
        return hadData;
    }

    private static void OnPresentMonError(object sender, DataReceivedEventArgs e)
    {
        if (string.IsNullOrWhiteSpace(e.Data)) return;
        Console.Error.WriteLine($"[fps-sidecar] PresentMon: {e.Data}");
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
