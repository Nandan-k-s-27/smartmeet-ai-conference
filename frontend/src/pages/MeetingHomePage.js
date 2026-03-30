import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { ThemeSwitch } from '../components/ui/theme-switch-button';

const MeetingHomePage = () => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated, loginWithGoogle } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [pendingJoinCode, setPendingJoinCode] = useState('');
  const [scheduleDraft, setScheduleDraft] = useState({
    title: 'Scheduled SmartMeet Meeting',
    startAt: '',
    durationMinutes: 30,
    description: '',
  });
  const [error, setError] = useState('');
  const accountMenuRef = useRef(null);

  const showError = (message) => {
    setError(message);
    setTimeout(() => setError(''), 5000);
  };

  const getDefaultScheduleTime = () => {
    const date = new Date(Date.now() + 60 * 60 * 1000);
    date.setMinutes(0, 0, 0);
    return date.toISOString().slice(0, 16);
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
    if (isAuthenticated) return true;
    setPendingAction(action);
    setShowAuthPrompt(true);
    return false;
  };

  const normalizeMeetingInput = (rawValue) => {
    const value = (rawValue || '').trim();
    if (!value) return '';

    try {
      const hasProtocol = /^https?:\/\//i.test(value);
      if (hasProtocol) {
        const url = new URL(value);
        const parts = url.pathname.split('/').filter(Boolean);
        const meetingIndex = parts.findIndex((part) => part.toLowerCase() === 'meeting');
        if (meetingIndex >= 0 && parts[meetingIndex + 1]) {
          return parts[meetingIndex + 1].toUpperCase();
        }
      }
    } catch (err) {
      // Not a URL, continue with raw text.
    }

    return value.toUpperCase();
  };

  const handleCreateInstantMeeting = async () => {
    if (!requireAuthFor('create')) return;
    await createMeeting();
  };

  const handleJoinMeetingClick = async () => {
    const normalizedCode = normalizeMeetingInput(joinInput);
    if (!normalizedCode) {
      showError('Please enter a meeting ID or paste a meeting link');
      return;
    }

    setPendingJoinCode(normalizedCode);
    if (!requireAuthFor('join')) return;
    await joinMeeting(normalizedCode);
  };

  const handleSwitchAccount = async () => {
    await logout({ switchAccount: true });
    setShowAccountMenu(false);
  };

  const handleLogout = async () => {
    await logout({ revokeEmail: user?.email });
    setPendingAction(null);
    setPendingJoinCode('');
    setShowAuthPrompt(false);
    setShowAccountMenu(false);
    setShowScheduleModal(false);
    navigate('/', { replace: true });
  };

  const handleOpenScheduleModal = () => {
    if (!requireAuthFor('schedule')) return;
    setShowScheduleModal(true);
  };

  const buildGoogleCalendarUrl = ({ title, startAt, durationMinutes, description, meetingId }) => {
    const start = new Date(startAt);
    const end = new Date(start.getTime() + Number(durationMinutes) * 60 * 1000);

    const toGoogleDate = (date) => {
      const pad = (value) => String(value).padStart(2, '0');
      return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
    };

    const meetingUrl = `${window.location.origin}/meeting/${meetingId}`;
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${toGoogleDate(start)}/${toGoogleDate(end)}`,
      details: `${description || 'SmartMeet scheduled meeting'}\n\nJoin link: ${meetingUrl}`,
      location: 'SmartMeet Online Meeting',
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };

  const handleScheduleMeeting = async (event) => {
    event.preventDefault();

    if (!scheduleDraft.startAt) {
      showError('Please select meeting date and time');
      return;
    }

    try {
      setIsLoading(true);
      const data = await apiFetch('/api/meetings/create', {
        method: 'POST',
        body: JSON.stringify({ title: scheduleDraft.title || `${user?.name || 'Guest'}'s Scheduled Meeting` }),
      });

      const calendarUrl = buildGoogleCalendarUrl({
        title: scheduleDraft.title || `${user?.name || 'Guest'}'s Meeting`,
        startAt: scheduleDraft.startAt,
        durationMinutes: scheduleDraft.durationMinutes,
        description: `${scheduleDraft.description || ''}\n\nSmartMeet Meeting: ${data.meetingId}`,
        meetingId: data.meetingId,
      });

      window.open(calendarUrl, '_blank', 'noopener,noreferrer');
      setShowScheduleModal(false);
      setScheduleDraft({
        title: 'Scheduled SmartMeet Meeting',
        startAt: getDefaultScheduleTime(),
        durationMinutes: 30,
        description: '',
      });
    } catch (err) {
      showError(err.message || 'Failed to schedule meeting');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthPromptAction = () => {
    loginWithGoogle(pendingAction === 'switch' ? 'select_account' : undefined);
  };

  useEffect(() => {
    setScheduleDraft((prev) => {
      if (prev.startAt) return prev;
      return { ...prev, startAt: getDefaultScheduleTime() };
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!showAccountMenu || !accountMenuRef.current) return;
      if (!accountMenuRef.current.contains(event.target)) {
        setShowAccountMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAccountMenu]);

  return (
    <div className="app-container">
      {showAuthPrompt && (
        <div className="auth-prompt-popover" role="dialog" aria-label="Sign in with Google">
          <div className="auth-prompt-header">
            <strong>{pendingAction === 'switch' ? 'Switch Google account' : 'Sign in to continue'}</strong>
            <button
              type="button"
              className="auth-prompt-close"
              onClick={() => {
                setShowAuthPrompt(false);
                setPendingAction(null);
                setPendingJoinCode('');
              }}
              aria-label="Close sign-in prompt"
            >
              x
            </button>
          </div>
          <button
            type="button"
            className="landing-signin-btn"
            onClick={handleAuthPromptAction}
            disabled={isLoading}
          >
            <i className="fab fa-google"></i>
            {pendingAction === 'switch' ? 'Switch account' : 'Sign in with Google'}
          </button>
          <p className="auth-prompt-note">Use your Google account to create or join meetings.</p>
        </div>
      )}

      <div className="lobby-container clean-landing clean-flat-surface">
        <div className="clean-landing-content landing-v2">
          <header className="landing-v2-topbar">
            <div className="landing-v2-brand">
              <span className="landing-v2-brand-text">smartmeet</span>
            </div>

            <div className="landing-v2-top-actions">
              {isAuthenticated ? (
                <div className="landing-account" ref={accountMenuRef}>
                  <button
                    className="landing-account-trigger"
                    type="button"
                    onClick={() => setShowAccountMenu((prev) => !prev)}
                  >
                    {user?.avatar ? (
                      <img className="landing-account-avatar" src={user.avatar} alt={user.name} />
                    ) : (
                      <span className="landing-account-initial">{(user?.name || 'U').slice(0, 1).toUpperCase()}</span>
                    )}
                    <span className="landing-account-name">{user?.name || 'Account'}</span>
                    <i className="fas fa-chevron-down"></i>
                  </button>

                  {showAccountMenu && (
                    <div className="landing-account-menu">
                      <div className="landing-account-menu-header">
                        <strong>{user?.email}</strong>
                      </div>

                      <a
                        href="https://myaccount.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="landing-account-menu-item"
                      >
                        <i className="fas fa-user-cog"></i>
                        Google account settings
                      </a>

                      <button type="button" className="landing-account-menu-item" onClick={handleSwitchAccount}>
                        <i className="fas fa-exchange-alt"></i>
                        Switch account
                      </button>

                      <button type="button" className="landing-account-menu-item logout" onClick={handleLogout}>
                        <i className="fas fa-sign-out-alt"></i>
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="landing-signin-btn"
                  onClick={() => {
                    setPendingAction('signin');
                    setShowAuthPrompt(true);
                  }}
                >
                  Sign in
                </button>
              )}

              <button className="landing-icon-btn" type="button" onClick={handleOpenScheduleModal} title="Schedule meeting">
                <i className="fas fa-calendar-alt"></i>
              </button>

              <ThemeSwitch className="landing-v2-switch" />
            </div>
          </header>

          <div className="hero-landing hero-landing-v2">
            <div className="hero-content">
              <h1>Run Smarter, More Productive Meetings</h1>
              <p className="hero-sub">AI-powered summaries, smart presence detection, real-time collaboration.</p>

              <div className="hero-cta">
                <button className="btn-primary btn-hero" onClick={handleCreateInstantMeeting} disabled={isLoading}>
                  Create Meeting
                </button>
                <div className="hero-join-group">
                  <input
                    className="hero-join-input"
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value)}
                    placeholder="Enter meeting ID or paste meeting link"
                    aria-label="Meeting ID or link"
                  />
                  <button className="btn-secondary btn-hero" onClick={handleJoinMeetingClick} type="button">
                    Join
                    <i className="fas fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <section className="features-section">
            <h3 className="features-title">Unique Features</h3>
            <div className="features-list">
              <div className="feature-card">
                <div className="feature-icon">1</div>
                <i className="fas fa-file-alt feature-card-main-icon"></i>
                <h4>Adaptive AI Summary</h4>
                <p>Instantly get the key points and action items from any meeting.</p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">2</div>
                <i className="fas fa-users feature-card-main-icon"></i>
                <h4>Smart Presence Detection</h4>
                <p>Know who's engaged and paying attention during the meeting.</p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">3</div>
                <i className="fas fa-robot feature-card-main-icon"></i>
                <h4>AI Meeting Assistant</h4>
                <p>An intelligent assistant that drafts summaries, suggests follow-ups, and helps moderate.</p>
              </div>
            </div>
          </section>

          {error && (
            <div className="error-message" style={{ position: 'relative', marginTop: '14px' }}>
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}
        </div>
      </div>

      {showScheduleModal && (
        <div className="schedule-modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <form className="schedule-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleScheduleMeeting}>
            <div className="schedule-modal-header">
              <h3>
                <i className="fas fa-calendar-check"></i>
                Schedule Meeting
              </h3>
              <button type="button" className="schedule-modal-close" onClick={() => setShowScheduleModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="schedule-modal-body">
              <label htmlFor="schedule-title">Meeting title</label>
              <input
                id="schedule-title"
                value={scheduleDraft.title}
                onChange={(e) => setScheduleDraft((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Team sync"
              />

              <label htmlFor="schedule-start">Date and time</label>
              <input
                id="schedule-start"
                type="datetime-local"
                value={scheduleDraft.startAt}
                onChange={(e) => setScheduleDraft((prev) => ({ ...prev, startAt: e.target.value }))}
                required
              />

              <label htmlFor="schedule-duration">Duration</label>
              <select
                id="schedule-duration"
                value={scheduleDraft.durationMinutes}
                onChange={(e) => setScheduleDraft((prev) => ({ ...prev, durationMinutes: Number(e.target.value) }))}
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1 hour 30 minutes</option>
              </select>

              <label htmlFor="schedule-description">Description (optional)</label>
              <textarea
                id="schedule-description"
                rows={3}
                value={scheduleDraft.description}
                onChange={(e) => setScheduleDraft((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Agenda, goals, and notes"
              />
            </div>

            <div className="schedule-modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setShowScheduleModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={isLoading}>
                <i className="fas fa-calendar-plus"></i>
                Create in Google Calendar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default MeetingHomePage;
