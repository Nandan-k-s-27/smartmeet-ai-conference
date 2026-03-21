import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ThemeSwitch } from '../components/ui/theme-switch-button';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithGoogle, loginWithEmail, registerWithEmail } = useAuth();

  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const hasGoogleClientId = Boolean(process.env.REACT_APP_GOOGLE_CLIENT_ID);

  const params = new URLSearchParams(location.search);
  const redirect = params.get('redirect') || '/';

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setError('');
      setLoading(true);
      if (!credentialResponse?.credential) {
        throw new Error('Google authentication failed');
      }
      await loginWithGoogle(credentialResponse.credential);
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    try {
      setError('');
      setLoading(true);

      if (mode === 'register') {
        await registerWithEmail({ name, email, password });
      } else {
        await loginWithEmail({ email, password });
      }

      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="lobby-container">
        <div className="starfield" aria-hidden="true">
          <div className="stars-layer stars-small"></div>
          <div className="stars-layer stars-medium"></div>
          <div className="stars-layer stars-large"></div>
        </div>

        <div className="lobby-card" style={{ maxWidth: '520px' }}>
          <div className="lobby-theme-switch-wrap">
            <ThemeSwitch className="lobby-theme-switch" />
          </div>

          <div className="lobby-header">
            <i className="fas fa-lock"></i>
            <h1>Sign In to SmartMeet</h1>
            <p>Secure access for creating and joining meetings</p>
          </div>

          {error && (
            <div className="error-message" style={{ position: 'relative', marginBottom: '16px' }}>
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}

          {hasGoogleClientId && (
            <>
              <div style={{ display: 'grid', gap: '12px', marginBottom: '20px' }}>
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google login failed')}
                  useOneTap={false}
                  text="signin_with"
                  shape="pill"
                  width="320"
                />
              </div>

              <div style={{ textAlign: 'center', margin: '16px 0', color: '#94a3b8' }}>
                <span>or continue with email</span>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              type="button"
              className={mode === 'login' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setMode('login')}
              style={{ flex: 1 }}
            >
              Login
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setMode('register')}
              style={{ flex: 1 }}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleEmailSubmit} style={{ display: 'grid', gap: '12px' }}>
            {mode === 'register' && (
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={8}
                required
              />
            </div>

            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Please wait...' : mode === 'register' ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
