import { Component, type ErrorInfo, type ReactNode } from "react";
import { Card } from "./ui/Card";
import { ErrorState } from "./ui/States";

interface State {
  error: Error | null;
}

/** Catches rendering errors in a page so the rest of the app (sidebar, navigation) keeps working. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Only the message and component stack: no request data is logged.
    console.error("Page crashed:", error.message, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <Card>
          <ErrorState
            message={`This page hit an unexpected error: ${this.state.error.message}`}
            onRetry={() => this.setState({ error: null })}
          />
        </Card>
      );
    }
    return this.props.children;
  }
}
