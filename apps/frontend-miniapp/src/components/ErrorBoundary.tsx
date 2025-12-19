import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary to catch React render errors
 * Prevents Telegram WebView crashes from killing the entire app
 * Must NOT throw - always renders something
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    console.error('[ErrorBoundary] React render error caught:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    
    this.setState({
      error,
      errorInfo,
    });

    // DO NOT throw - this would kill the app
    // DO NOT reset auth state - preserve user session
  }

  handleReset = () => {
    // Reset error state but preserve auth/session
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Render fallback UI - minimal, safe, never throws
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backgroundColor: '#1a1a1a',
            color: '#fff',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ marginBottom: '12px', fontSize: '18px' }}>Something went wrong</h2>
          <p style={{ marginBottom: '20px', fontSize: '14px', color: '#999', textAlign: 'center', maxWidth: '400px' }}>
            The app encountered an error, but your session is safe. Try refreshing the page.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '10px 20px',
              backgroundColor: '#007AFF',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Try Again
          </button>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details style={{ marginTop: '20px', fontSize: '12px', color: '#666', maxWidth: '600px' }}>
              <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>Error Details (Dev Only)</summary>
              <pre
                style={{
                  padding: '12px',
                  backgroundColor: '#2a2a2a',
                  borderRadius: '4px',
                  overflow: 'auto',
                  fontSize: '11px',
                }}
              >
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

