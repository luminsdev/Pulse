using System.Runtime.Versioning;
using FpsSidecar.Providers;
using FpsSidecar.Services;
using Xunit;

[assembly: SupportedOSPlatform("windows")]

namespace FpsSidecar.Tests;

public sealed class PresentMonServiceTests
{
    [Fact]
    public void GetPresentMonCandidates_ListsBundledBinaryBeforeLegacySibling()
    {
        var service = new PresentMonService("C:\\Pulse\\bin");

        var candidates = service.GetPresentMonCandidates().Take(3).ToArray();

        Assert.Equal("C:\\Pulse\\bin\\presentmon-x86_64-pc-windows-msvc.exe", candidates[0]);
        Assert.Equal("C:\\Pulse\\bin\\presentmon.exe", candidates[1]);
        Assert.Equal("C:\\Pulse\\bin\\PresentMon.exe", candidates[2]);
    }

    [Fact]
    public void ToOutput_MapsNoGameWithoutChangingContract()
    {
        var output = PresentMonService.ToOutput(new FpsProviderEvent(FpsProviderEventType.NoGame));

        Assert.Equal("no-game", output.Type);
        Assert.Null(output.Data);
        Assert.Null(output.Error);
        Assert.True(output.PresentMonInstalled);
    }

    [Fact]
    public void ToOutput_MapsMissingPresentMonToExistingErrorShape()
    {
        var output = PresentMonService.ToOutput(new FpsProviderEvent(
            FpsProviderEventType.Error,
            Error: "missing",
            PresentMonInstalled: false
        ));

        Assert.Equal("error", output.Type);
        Assert.Equal("missing", output.Error);
        Assert.False(output.PresentMonInstalled);
    }

    [Fact]
    public async Task RunConsoleProviderAsync_EmitsMissingPresentMonWithoutCompletingImmediately()
    {
        using var cts = new CancellationTokenSource(TimeSpan.FromMilliseconds(50));
        var service = new PresentMonService(() => null);

        await using var enumerator = service.RunConsoleProviderAsync(cts.Token).GetAsyncEnumerator();

        Assert.True(await enumerator.MoveNextAsync());
        Assert.Equal(FpsProviderEventType.Error, enumerator.Current.Type);
        Assert.False(enumerator.Current.PresentMonInstalled);
    }
}
