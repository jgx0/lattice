import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Reader error", error, info.componentStack);
  }
  render() {
    return this.state.error ? (
      <main className="empty-vault">
        <h1>Unable to display this page.</h1>
        <p>{this.state.error}</p>
        <button onClick={() => location.reload()}>Reload the reader</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
