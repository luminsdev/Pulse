using System.Runtime.Versioning;
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
}
