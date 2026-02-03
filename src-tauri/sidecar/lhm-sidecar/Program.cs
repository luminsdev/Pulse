using System.Runtime.Versioning;
using System.Text.Json;
using System.Text.Json.Serialization;
using LibreHardwareMonitor.Hardware;

[assembly: SupportedOSPlatform("windows")]

namespace LhmSidecar;

/// <summary>
/// Hardware data output structure
/// </summary>
public class HardwareData
{
    [JsonPropertyName("cpu")]
    public CpuData? Cpu { get; set; }

    [JsonPropertyName("gpu")]
    public List<GpuData> Gpus { get; set; } = [];

    [JsonPropertyName("timestamp")]
    public long Timestamp { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }
}

public class CpuData
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("temperature")]
    public float? Temperature { get; set; }

    [JsonPropertyName("package_temperature")]
    public float? PackageTemperature { get; set; }

    [JsonPropertyName("core_temperatures")]
    public List<float?> CoreTemperatures { get; set; } = [];

    [JsonPropertyName("max_temperature")]
    public float? MaxTemperature { get; set; }

    [JsonPropertyName("power")]
    public float? Power { get; set; }

    [JsonPropertyName("core_powers")]
    public List<float?> CorePowers { get; set; } = [];
}

public class GpuData
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("vendor")]
    public string Vendor { get; set; } = "";

    [JsonPropertyName("temperature")]
    public float? Temperature { get; set; }

    [JsonPropertyName("hot_spot_temperature")]
    public float? HotSpotTemperature { get; set; }

    [JsonPropertyName("power")]
    public float? Power { get; set; }

    [JsonPropertyName("core_clock")]
    public float? CoreClock { get; set; }

    [JsonPropertyName("memory_clock")]
    public float? MemoryClock { get; set; }

    [JsonPropertyName("fan_speed")]
    public float? FanSpeed { get; set; }

    [JsonPropertyName("load")]
    public float? Load { get; set; }
}

/// <summary>
/// Source-generated JSON context for trimming-safe serialization
/// </summary>
[JsonSourceGenerationOptions(
    WriteIndented = false,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull)]
[JsonSerializable(typeof(HardwareData))]
internal partial class AppJsonContext : JsonSerializerContext { }

/// <summary>
/// Custom visitor to update all hardware sensors
/// </summary>
public class UpdateVisitor : IVisitor
{
    public void VisitComputer(IComputer computer)
    {
        computer.Traverse(this);
    }

    public void VisitHardware(IHardware hardware)
    {
        hardware.Update();
        foreach (var subHardware in hardware.SubHardware)
        {
            subHardware.Accept(this);
        }
    }

    public void VisitSensor(ISensor sensor) { }
    public void VisitParameter(IParameter parameter) { }
}

class Program
{
    static void Main(string[] args)
    {
        // Parse arguments
        int intervalMs = 1000; // Default 1 second
        bool singleShot = false;

        for (int i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--interval" or "-i" when i + 1 < args.Length:
                    if (int.TryParse(args[++i], out int parsed))
                        intervalMs = Math.Max(100, parsed); // Minimum 100ms
                    break;
                case "--single" or "-s":
                    singleShot = true;
                    break;
                case "--help" or "-h":
                    PrintHelp();
                    return;
            }
        }

        // Check for admin rights
        if (!IsAdministrator())
        {
            OutputError("Admin rights required: This application requires administrator privileges to access hardware sensors.");
            return;
        }

        try
        {
            RunMonitor(intervalMs, singleShot);
        }
        catch (Exception ex)
        {
            OutputError($"Fatal error: {ex.Message}");
        }
    }

    static void RunMonitor(int intervalMs, bool singleShot)
    {
        var computer = new Computer
        {
            IsCpuEnabled = true,
            IsGpuEnabled = true,
            IsMemoryEnabled = false,  // We get this from sysinfo
            IsMotherboardEnabled = false,
            IsStorageEnabled = false,
            IsNetworkEnabled = false,
            IsBatteryEnabled = false,
            IsControllerEnabled = false,
            IsPsuEnabled = false
        };

        try
        {
            computer.Open();
            var updateVisitor = new UpdateVisitor();

            // Handle Ctrl+C gracefully
            Console.CancelKeyPress += (_, e) =>
            {
                e.Cancel = false;
                computer.Close();
            };

            do
            {
                try
                {
                    computer.Accept(updateVisitor);
                    var data = CollectData(computer);
                    OutputJson(data);
                }
                catch (Exception ex)
                {
                    OutputError($"Collection error: {ex.Message}");
                }

                if (!singleShot)
                {
                    Thread.Sleep(intervalMs);
                }
            } while (!singleShot);
        }
        finally
        {
            computer.Close();
        }
    }

    static HardwareData CollectData(IComputer computer)
    {
        var data = new HardwareData
        {
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        };

        foreach (var hardware in computer.Hardware)
        {
            switch (hardware.HardwareType)
            {
                case HardwareType.Cpu:
                    data.Cpu = CollectCpuData(hardware);
                    break;

                case HardwareType.GpuNvidia:
                case HardwareType.GpuAmd:
                case HardwareType.GpuIntel:
                    data.Gpus.Add(CollectGpuData(hardware));
                    break;
            }
        }

        return data;
    }

    static CpuData CollectCpuData(IHardware hardware)
    {
        var cpu = new CpuData { Name = hardware.Name };
        var coreTemps = new SortedDictionary<int, float?>();
        var corePowers = new SortedDictionary<int, float?>();

        foreach (var sensor in hardware.Sensors)
        {
            var name = sensor.Name.ToLowerInvariant();

            switch (sensor.SensorType)
            {
                case SensorType.Temperature:
                    if (name.Contains("package") || name.Contains("cpu total"))
                    {
                        cpu.PackageTemperature = sensor.Value;
                    }
                    else if (name.Contains("max"))
                    {
                        cpu.MaxTemperature = sensor.Value;
                    }
                    else if (name.StartsWith("cpu core") || name.StartsWith("core"))
                    {
                        // Extract core number
                        var parts = name.Split(' ', '#');
                        foreach (var part in parts)
                        {
                            if (int.TryParse(part, out int coreNum))
                            {
                                coreTemps[coreNum] = sensor.Value;
                                break;
                            }
                        }
                    }
                    break;

                case SensorType.Power:
                    if (name.Contains("package") || name.Contains("cpu total"))
                    {
                        cpu.Power = sensor.Value;
                    }
                    else if (name.StartsWith("cpu core") || name.StartsWith("core"))
                    {
                        var parts = name.Split(' ', '#');
                        foreach (var part in parts)
                        {
                            if (int.TryParse(part, out int coreNum))
                            {
                                corePowers[coreNum] = sensor.Value;
                                break;
                            }
                        }
                    }
                    break;
            }
        }

        // Set primary temperature (package or max of cores)
        cpu.Temperature = cpu.PackageTemperature
            ?? cpu.MaxTemperature
            ?? coreTemps.Values.Where(t => t.HasValue).Select(t => t!.Value).DefaultIfEmpty().Max();

        // Convert to lists
        if (coreTemps.Count > 0)
        {
            int maxCore = coreTemps.Keys.Max();
            cpu.CoreTemperatures = Enumerable.Range(0, maxCore + 1)
                .Select(i => coreTemps.GetValueOrDefault(i))
                .ToList();
        }

        if (corePowers.Count > 0)
        {
            int maxCore = corePowers.Keys.Max();
            cpu.CorePowers = Enumerable.Range(0, maxCore + 1)
                .Select(i => corePowers.GetValueOrDefault(i))
                .ToList();
        }

        return cpu;
    }

    static GpuData CollectGpuData(IHardware hardware)
    {
        var gpu = new GpuData
        {
            Name = hardware.Name,
            Vendor = hardware.HardwareType switch
            {
                HardwareType.GpuNvidia => "NVIDIA",
                HardwareType.GpuAmd => "AMD",
                HardwareType.GpuIntel => "Intel",
                _ => "Unknown"
            }
        };

        foreach (var sensor in hardware.Sensors)
        {
            var name = sensor.Name.ToLowerInvariant();

            switch (sensor.SensorType)
            {
                case SensorType.Temperature:
                    if (name.Contains("hot spot") || name.Contains("hotspot"))
                        gpu.HotSpotTemperature = sensor.Value;
                    else if (name == "gpu core" || name == "gpu" || name == "temperature")
                        gpu.Temperature = sensor.Value;
                    // Only set if not already set by a more specific sensor
                    else if (gpu.Temperature is null && name.Contains("gpu") && !name.Contains("memory") && !name.Contains("junction"))
                        gpu.Temperature = sensor.Value;
                    break;

                case SensorType.Power:
                    if (name.Contains("gpu") || name.Contains("total") || name == "power")
                        gpu.Power = sensor.Value;
                    break;

                case SensorType.Clock:
                    if (name.Contains("core") || name == "gpu")
                        gpu.CoreClock = sensor.Value;
                    else if (name.Contains("memory"))
                        gpu.MemoryClock = sensor.Value;
                    break;

                case SensorType.Fan:
                    gpu.FanSpeed = sensor.Value;
                    break;

                case SensorType.Load:
                    if (name.Contains("core") || name == "gpu")
                        gpu.Load = sensor.Value;
                    break;
            }
        }

        return gpu;
    }

    static bool IsAdministrator()
    {
        using var identity = System.Security.Principal.WindowsIdentity.GetCurrent();
        var principal = new System.Security.Principal.WindowsPrincipal(identity);
        return principal.IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);
    }

    static void OutputJson(HardwareData data)
    {
        var json = JsonSerializer.Serialize(data, AppJsonContext.Default.HardwareData);
        Console.WriteLine(json);
        Console.Out.Flush();
    }

    static void OutputError(string message)
    {
        var data = new HardwareData
        {
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            Error = message
        };
        OutputJson(data);
    }

    static void PrintHelp()
    {
        Console.WriteLine("""
            LHM Sidecar - Hardware monitoring using LibreHardwareMonitor
            
            Usage: lhm-sidecar [options]
            
            Options:
              -i, --interval <ms>   Update interval in milliseconds (default: 1000, min: 100)
              -s, --single          Single shot mode - output once and exit
              -h, --help            Show this help message
            
            Output: JSON lines to stdout with CPU and GPU temperature/power data
            
            Note: Requires administrator privileges to access hardware sensors.
            """);
    }
}
