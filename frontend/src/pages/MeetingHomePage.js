import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

const MeetingHomePage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [meetingCode, setMeetingCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const showError = (message) => {
    setError(message);
    setTimeout(() => setError(''), 5000);
  };

  const handleCreateInstantMeeting = async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch('/api/meetings/create', {
        method: 'POST',
        body: JSON.stringify({ title: `${user.name}'s Meeting` }),
      });

      navigate(`/meeting/${data.meetingId}`);
    } catch (err) {
      showError(err.message || 'Failed to create meeting');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinByCode = async (event) => {
    event.preventDefault();
    const normalizedCode = meetingCode.trim().toUpperCase();

    if (!normalizedCode) {
      showError('Please enter a meeting code');
      return;
    }

    try {
      setIsLoading(true);
      await apiFetch(`/api/meetings/${normalizedCode}`, { method: 'GET' });
      navigate(`/meeting/${normalizedCode}`);
    } catch (err) {
      showError(err.message || 'Meeting not found');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-container">
      <div className="lobby-container clean-landing clean-flat-surface">
        <div className="clean-landing-content" style={{ maxWidth: '700px' }}>
          <div className="lobby-header">
            <i className="fas fa-video"></i>
            <h1>SmartMeet</h1>
            <p>Welcome back, {user?.name}</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '18px' }}>
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '999px',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <i className="fas fa-user-circle" style={{ fontSize: '42px' }}></i>
            )}
            <span>{user?.email}</span>
          </div>

          <div className="lobby-actions">
            <button className="btn-primary" onClick={handleCreateInstantMeeting} disabled={isLoading}>
              <i className="fas fa-bolt"></i>
              Create Instant Meeting
            </button>
          </div>

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

          <button
            className="btn-secondary"
            type="button"
            onClick={handleLogout}
            style={{ width: '100%', marginTop: '12px' }}
          >
            <i className="fas fa-sign-out-alt"></i>
            Logout
          </button>

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
