import React, { useCallback, useEffect, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

const MeetingHomePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAuthenticated, loginWithGoogle } = useAuth();

  const [meetingCode, setMeetingCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [error, setError] = useState('');

  const hasGoogleClientId = Boolean(process.env.REACT_APP_GOOGLE_CLIENT_ID);

  const showError = (message) => {
    setError(message);
    setTimeout(() => setError(''), 5000);
  };

  const createMeeting = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch('/api/meetings/create', {
        method: 'POST',
        body: JSON.stringify({ title: `${user?.name || 'Guest'}'s Meeting` }),
      });

      navigate(`/meeting/${data.meetingId}`);
    } catch (err) {
      showError(err.message || 'Failed to create meeting');
    } finally {
      setIsLoading(false);
    }
  }, [navigate, user]);

  const joinMeeting = useCallback(
    async (normalizedCode) => {
      try {
        setIsLoading(true);
        await apiFetch(`/api/meetings/${normalizedCode}`, { method: 'GET' });
        navigate(`/meeting/${normalizedCode}`);
      } catch (err) {
        showError(err.message || 'Meeting not found');
      } finally {
        setIsLoading(false);
      }
    },
    [navigate]
  );

  const requireAuthFor = (action) => {
    if (isAuthenticated) {
      return true;
    }

    if (!hasGoogleClientId) {
      showError('Google sign-in is not configured. Please set REACT_APP_GOOGLE_CLIENT_ID.');
      return false;
    }

    setPendingAction(action);
    setShowAuthPrompt(true);
    return false;
  };

  const handleCreateInstantMeeting = async () => {
    if (!requireAuthFor('create')) {
      return;
    }
    await createMeeting();
  };

  const handleJoinByCode = async (event) => {
    event.preventDefault();
    const normalizedCode = meetingCode.trim().toUpperCase();

    if (!normalizedCode) {
      showError('Please enter a meeting code');
      return;
    }

    if (!requireAuthFor('join')) {
      return;
    }

    await joinMeeting(normalizedCode);
  };

  const handleLogout = async () => {
    await logout();
    setPendingAction(null);
    setShowAuthPrompt(false);
    navigate('/', { replace: true });
  };

  const handleGoogleSuccess = useCallback(
    async (credentialResponse) => {
      try {
        setError('');
        setIsSigningIn(true);

        if (!credentialResponse?.credential) {
          throw new Error('Google authentication failed');
        }

        await loginWithGoogle(credentialResponse.credential);
        setShowAuthPrompt(false);

        if (pendingAction === 'create') {
          await createMeeting();
        } else if (pendingAction === 'join') {
          const normalizedCode = meetingCode.trim().toUpperCase();
          if (normalizedCode) {
            await joinMeeting(normalizedCode);
          }
        }

        const params = new URLSearchParams(location.search);
        const redirect = params.get('redirect');
        if (redirect && redirect.startsWith('/meeting/')) {
          navigate(decodeURIComponent(redirect), { replace: true });
        }

        setPendingAction(null);
      } catch (err) {
        showError(err.message || 'Google sign-in failed');
      } finally {
        setIsSigningIn(false);
      }
    },
    [createMeeting, joinMeeting, location.search, loginWithGoogle, meetingCode, navigate, pendingAction]
  );

  const handleGoogleError = () => {
    setIsSigningIn(false);
    showError('Google sign-in failed');
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldPromptAuth = params.get('auth') === '1';
    if (shouldPromptAuth && !isAuthenticated && hasGoogleClientId) {
      setShowAuthPrompt(true);
    }
  }, [hasGoogleClientId, isAuthenticated, location.search]);

  return (
    <div className="app-container">
      {showAuthPrompt && !isAuthenticated && (
        <div className="auth-prompt-popover" role="dialog" aria-label="Sign up with Google">
          <div className="auth-prompt-header">
            <strong>Sign up to continue</strong>
            <button
              type="button"
              className="auth-prompt-close"
              onClick={() => {
                if (!isSigningIn) {
                  setShowAuthPrompt(false);
                  setPendingAction(null);
                }
              }}
              aria-label="Close sign-up prompt"
            >
              x
            </button>
          </div>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            text="signin_with"
            shape="pill"
            width="310"
            useOneTap={false}
          />
          <p className="auth-prompt-note">Use your Google account to create or join meetings.</p>
        </div>
      )}

      <div className="lobby-container clean-landing clean-flat-surface">
        <div className="clean-landing-content" style={{ maxWidth: '700px' }}>
          <div className="hero-landing">
            <div className="hero-content">
              <h1>Run Smarter, More Productive Meetings</h1>
              <p className="hero-sub">AI-powered summaries, smart presence detection, real-time collaboration.</p>

              <div className="hero-cta">
                <button className="btn-primary btn-hero" onClick={handleCreateInstantMeeting} disabled={isLoading}>
                  Create Meeting
                </button>
                <button
                  className="btn-secondary btn-hero"
                  onClick={() => {
                    const el = document.getElementById('meetingCode');
                    if (el) {
                      el.focus();
                      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
                    }
                  }}
                >
                  Join Meeting ID...
                </button>
              </div>
            </div>
          </div>

          <section className="features-section">
            <h3 className="features-title">Unique Features</h3>
            <div className="features-list">
              <div className="feature-card">
                <div className="feature-icon">1</div>
                <h4>Adaptive AI Summary</h4>
                <p>Instantly get the key points and action items from any meeting.</p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">2</div>
                <h4>Smart Presence Detection</h4>
                <p>Know who's engaged and paying attention during the meeting.</p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">3</div>
                <h4>AI Meeting Assistant</h4>
                <p>An intelligent assistant that drafts summaries, suggests follow-ups, and helps moderate.</p>
              </div>
            </div>
          </section>

          <form onSubmit={handleJoinByCode} style={{ marginTop: '20px' }}>
            <div className="form-group">
              <label htmlFor="meetingCode">Join with Meeting Code</label>
              <input
                id="meetingCode"
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value.toUpperCase())}
                placeholder="Enter meeting code"
              />
            </div>
            <button className="btn-secondary" type="submit" disabled={isLoading} style={{ width: '100%' }}>
              <i className="fas fa-sign-in-alt"></i>
              Join Meeting
            </button>
          </form>

          {isAuthenticated && (
            <button
              className="btn-secondary"
              type="button"
              onClick={handleLogout}
              style={{ width: '100%', marginTop: '12px' }}
            >
              <i className="fas fa-sign-out-alt"></i>
              Logout
            </button>
          )}

          {error && (
            <div className="error-message" style={{ position: 'relative', marginTop: '14px' }}>
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingHomePage;
