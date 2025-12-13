import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="p-10 bg-base-200 min-h-screen">
          <div className="card bg-error text-error-content shadow-xl max-w-2xl mx-auto">
            <div className="card-body">
              <h2 className="card-title">Something went wrong.</h2>
              <p className="font-bold">{this.state.error && this.state.error.toString()}</p>
              <pre className="text-xs bg-black text-white p-4 rounded overflow-auto mt-4 max-h-96">
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
              <div className="card-actions justify-end mt-4">
                <button className="btn" onClick={() => window.location.reload()}>Reload Page</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
