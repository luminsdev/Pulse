using System.Runtime.Versioning;
using FpsSidecar.Services;
using FpsSidecar.Models;
using System.Text.Json;

[assembly: SupportedOSPlatform("windows")]

namespace FpsSidecar;

class Program
{
    static async Task Main(string[] args)
    {
        Console.Error.WriteLine("[fps-sidecar] Starting FPS monitoring...");

        using var cts = new CancellationTokenSource();

        // Handle Ctrl+C gracefully
        Console.CancelKeyPress += (s, e) =>
        {
            e.Cancel = true;
            Console.Error.WriteLine("[fps-sidecar] Shutdown requested");
            cts.Cancel();
        };

        var service = new PresentMonService();

        try
        {
            await service.StartAsync(cts.Token);
        }
        catch (OperationCanceledException)
        {
            // Normal shutdown
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[fps-sidecar] Fatal error: {ex.Message}");
            
            var output = new FpsOutput
            {
                Type = "error",
                Error = ex.Message
            };
            Console.WriteLine(JsonSerializer.Serialize(output, FpsJsonContext.Default.FpsOutput));
            Console.Out.Flush();
        }
        finally
        {
            service.Stop();
            Console.Error.WriteLine("[fps-sidecar] Stopped");
        }
    }
}
