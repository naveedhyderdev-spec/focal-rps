import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

/** Catches render errors in a page so one broken view doesn't white-screen the app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('Page error:', error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="page-container">
          <div className="card"><div className="card-body">
            <div className="empty-state">
              <i className="ti ti-bug" />
              <h3>Something went wrong on this page</h3>
              <p>{this.state.error.message}</p>
              <button className="btn btn-primary" onClick={this.reset}><i className="ti ti-refresh" /> Try again</button>
            </div>
          </div></div>
        </div>
      );
    }
    return this.props.children;
  }
}
