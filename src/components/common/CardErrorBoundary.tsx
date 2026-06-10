import { Component, type ErrorInfo, type ReactNode } from "react";

interface CardErrorBoundaryProps {
  children: ReactNode;
}

interface CardErrorBoundaryState {
  hasError: boolean;
}

export class CardErrorBoundary extends Component<
  CardErrorBoundaryProps,
  CardErrorBoundaryState
> {
  state: CardErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): CardErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Monitoring card failed to render", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <button
          type="button"
          onClick={this.handleRetry}
          className="min-h-[260px] w-full rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15"
        >
          Error loading data — click to retry
        </button>
      );
    }

    return this.props.children;
  }
}
