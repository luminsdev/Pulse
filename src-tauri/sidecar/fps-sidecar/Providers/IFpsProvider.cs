namespace FpsSidecar.Providers;

public interface IFpsProvider
{
    string Name { get; }

    IAsyncEnumerable<FpsProviderEvent> RunAsync(CancellationToken cancellationToken);
}
