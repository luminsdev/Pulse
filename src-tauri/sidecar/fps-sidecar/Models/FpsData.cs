using System.Text.Json.Serialization;

namespace FpsSidecar.Models;

/// <summary>
/// FPS statistics for a game/application
/// </summary>
public class FpsData
{
    [JsonPropertyName("process_name")]
    public string ProcessName { get; set; } = "";

    [JsonPropertyName("process_id")]
    public int ProcessId { get; set; }

    [JsonPropertyName("fps")]
    public double Fps { get; set; }

    [JsonPropertyName("frame_time")]
    public double FrameTime { get; set; } // ms

    [JsonPropertyName("fps_1_percent_low")]
    public double Fps1PercentLow { get; set; }

    [JsonPropertyName("fps_01_percent_low")]
    public double Fps01PercentLow { get; set; }

    [JsonPropertyName("timestamp")]
    public long Timestamp { get; set; } = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
}

/// <summary>
/// Output structure sent to Rust backend
/// </summary>
public class FpsOutput
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = "fps-data";

    [JsonPropertyName("data")]
    public FpsData? Data { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }

    [JsonPropertyName("present_mon_installed")]
    public bool PresentMonInstalled { get; set; } = true;
}

/// <summary>
/// Source-generated JSON context for trimming-safe serialization
/// </summary>
[JsonSourceGenerationOptions(
    WriteIndented = false,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull)]
[JsonSerializable(typeof(FpsOutput))]
[JsonSerializable(typeof(FpsData))]
internal partial class FpsJsonContext : JsonSerializerContext { }
