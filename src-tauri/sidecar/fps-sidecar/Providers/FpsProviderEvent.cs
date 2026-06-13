using FpsSidecar.Models;

namespace FpsSidecar.Providers;

public enum FpsProviderEventType
{
    FpsData,
    NoGame,
    Error
}

public sealed record FpsProviderEvent(
    FpsProviderEventType Type,
    FpsData? Data = null,
    string? Error = null,
    bool PresentMonInstalled = true
);
