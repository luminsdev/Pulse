using System.Runtime.CompilerServices;

namespace FpsSidecar.Providers;

public sealed class PresentMonConsoleProvider(Func<string?> findPresentMonExe) : IFpsProvider
{
    public string Name => "presentmon-console";

    public async IAsyncEnumerable<FpsProviderEvent> RunAsync(
        [EnumeratorCancellation] CancellationToken cancellationToken)
    {
        var service = new Services.PresentMonService(findPresentMonExe);
        await foreach (var providerEvent in service.RunConsoleProviderAsync(cancellationToken))
        {
            yield return providerEvent;
        }
    }
}
