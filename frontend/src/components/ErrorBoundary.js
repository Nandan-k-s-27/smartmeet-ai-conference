import React from 'react';

/**
 * React Error Boundary — catches render-time crashes and shows
 * a recovery UI instead of a blank screen.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          background: 'var(--bg-primary, #f5f7ff)',
          color: 'var(--text-primary, #1a1a2e)',
          textAlign: 'center',
        }}>
          <div style={{
            background: 'var(--bg-secondary, #fff)',
            borderRadius: '16px',
            padding: '2.5rem',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.5rem' }}>
              Something went wrong
            </h2>
            <p style={{ color: 'var(--text-secondary, #666)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              SmartMeet encountered an unexpected error. This is usually temporary.
            </p>
            <button
              onClick={this.handleReload}
              style={{
                background: 'var(--primary, #4361ee)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 32px',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseOver={(e) => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 4px 16px rgba(67,97,238,0.3)'; }}
              onMouseOut={(e) => { e.target.style.transform = 'none'; e.target.style.boxShadow = 'none'; }}
            >
              Return to Home
            </button>
            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <pre style={{
                marginTop: '1.5rem',
                textAlign: 'left',
                fontSize: '0.75rem',
                background: '#f8f9fa',
                padding: '1rem',
                borderRadius: '8px',
                overflow: 'auto',
                maxHeight: '200px',
                color: '#d63384',
              }}>
                {this.state.error.toString()}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
