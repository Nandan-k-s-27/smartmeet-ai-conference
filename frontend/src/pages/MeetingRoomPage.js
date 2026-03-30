import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import VideoCall from '../components/VideoCall';
import Chat from '../components/Chat';
import Settings from '../components/Settings';
import ConfirmModal from '../components/ConfirmModal';
import MeetingSummary from '../components/MeetingSummary';
import MissedSpeech from '../components/MissedSpeech';
import { ThemeSwitch } from '../components/ui/theme-switch-button';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

const MeetingRoomPage = () => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const normalizedUserId = String(user?.id || user?._id || '').trim();
  const normalizedUserName = String(user?.name || user?.email || 'User').trim();

  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [videoCallSocket, setVideoCallSocket] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [appliedSettings, setAppliedSettings] = useState({});

  const [isHost, setIsHost] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState(null);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const [showMissedSpeech, setShowMissedSpeech] = useState(false);
  const [missedSpeechData, setMissedSpeechData] = useState({ transcripts: [], awayDuration: 0 });
  const missedTranscriptsRef = useRef([]);
  const isAwayRef = useRef(false);
  const videoCallCleanupRef = useRef(null);

  useEffect(() => {
    const joinMeeting = async () => {
      try {
        setIsLoading(true);
        const data = await apiFetch(`/api/meetings/${meetingId}/join`, {
          method: 'POST',
          body: JSON.stringify({}),
        });

        setIsHost(Boolean(data.isHost));
      } catch (err) {
        setError(err.message || 'Unable to join this meeting');
      } finally {
        setIsLoading(false);
      }
    };

    joinMeeting();
  }, [meetingId]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    const darkMode = savedTheme === 'dark';
    document.documentElement.classList.toggle('dark', darkMode);
    if (darkMode) {
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    } else {
      document.body.classList.remove('dark-mode');
      document.body.classList.add('light-mode');
    }
  }, []);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleUserAway = () => {
    isAwayRef.current = true;
    missedTranscriptsRef.current = [];

    if (videoCallSocket) {
      videoCallSocket.emit('request-transcription', {
        meetingId,
        requestedBy: user.name,
      });
    }
  };

  const handleUserReturn = ({ awayDuration }) => {
    if (!isAwayRef.current) {
      isAwayRef.current = false;
      return;
    }

    setMissedSpeechData({
      transcripts: [...missedTranscriptsRef.current],
      awayDuration,
    });
    setShowMissedSpeech(true);

    isAwayRef.current = false;
    missedTranscriptsRef.current = [];
  };

  useEffect(() => {
    if (!videoCallSocket) return;

    const handleTranscript = (data) => {
      if (isAwayRef.current && data.userId !== normalizedUserId && data.isFinal) {
        missedTranscriptsRef.current.push({
          speakerId: data.userId,
          speakerName: data.username,
          text: data.text || '',
          timestamp: data.timestamp || new Date().toISOString(),
        });
      }
    };

    videoCallSocket.on('transcript-update', handleTranscript);
    return () => videoCallSocket.off('transcript-update', handleTranscript);
  }, [videoCallSocket, normalizedUserId]);

  const handleSummarizeMissedSpeech = async (transcripts) => {
    const response = await apiFetch('/api/summary/missed-speech', {
      method: 'POST',
      body: JSON.stringify({ transcripts }),
    });

    if (!response.success) {
      throw new Error(response.message || 'Failed to generate missed speech summary');
    }

    return response.summary;
  };

  const confirmLeaveMeeting = async () => {
    try {
      if (videoCallCleanupRef.current) {
        videoCallCleanupRef.current();
        videoCallCleanupRef.current = null;
      }

      if (isHost) {
        await apiFetch(`/api/meetings/${meetingId}/end`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
      } else {
        await apiFetch(`/api/meetings/${meetingId}/leave`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
      }
    } catch (err) {
      // Ignore network errors while leaving.
    } finally {
      setShowConfirmLeave(false);
      navigate('/');
    }
  };

  const copyMeetingId = () => {
    navigator.clipboard
      .writeText(meetingId)
      .then(() => showNotification('Meeting ID copied to clipboard', 'success'))
      .catch(() => setError('Failed to copy meeting ID'));
  };

  if (isLoading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner"></div>
        <div className="loading-text">Joining meeting...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <div className="lobby-container">
          <div className="lobby-card" style={{ maxWidth: '520px' }}>
            <div className="lobby-header">
              <i className="fas fa-exclamation-triangle"></i>
              <h1>Unable to Join Meeting</h1>
              <p>{error}</p>
            </div>
            <button className="btn-primary" onClick={() => navigate('/')}>
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="meeting-container">
        <header className="meeting-header">
          <div className="meeting-info">
            <h2>
              <i className="fas fa-video meeting-icon"></i>
              Meeting: {meetingId}
              <button className="copy-btn" onClick={copyMeetingId}>
                <i className="fas fa-copy"></i>
              </button>
            </h2>
            <span className="user-badge">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={normalizedUserName}
                  style={{ width: '20px', height: '20px', borderRadius: '999px', marginRight: '6px', objectFit: 'cover' }}
                />
              ) : (
                <i className="fas fa-user"></i>
              )}
              {normalizedUserName} {isHost && '(Host)'}
            </span>
          </div>

          <div className="meeting-controls">
            <ThemeSwitch className="workspace-theme-switch" />
            <button className="control-btn" onClick={() => setShowSettings(true)}>
              <i className="fas fa-cog"></i>
              <span>Settings</span>
            </button>
            <button className="control-btn" onClick={() => setShowChat(true)}>
              <i className="fas fa-comments"></i>
              <span>Chat</span>
            </button>
            <button className="control-btn" onClick={() => setShowSummary(true)}>
              <i className="fas fa-file-alt"></i>
              <span>Summary</span>
            </button>
            <button className="control-btn end-call" onClick={() => setShowConfirmLeave(true)}>
              <i className="fas fa-phone-slash"></i>
              <span>Leave</span>
            </button>
          </div>
        </header>

        <div className="meeting-content">
          <div className="video-section">
            <VideoCall
              meetingId={meetingId}
              username={normalizedUserName}
              userId={normalizedUserId}
              avatar={user.avatar}
              isHost={isHost}
              setSocket={setVideoCallSocket}
              onError={(error) => setError(error)}
              onStreamChange={setLocalStream}
              appliedSettings={appliedSettings}
              onUserAway={handleUserAway}
              onUserReturn={handleUserReturn}
              onCleanup={(cleanup) => {
                videoCallCleanupRef.current = cleanup;
              }}
            />
          </div>

          <Chat
            socket={videoCallSocket}
            meetingId={meetingId}
            username={normalizedUserName}
            userId={normalizedUserId}
            isOpen={showChat}
            onClose={() => setShowChat(false)}
          />

          {showSettings && (
            <Settings socket={videoCallSocket} localStream={localStream} onApplySettings={setAppliedSettings} onClose={() => setShowSettings(false)} />
          )}

          {showSummary && (
            <MeetingSummary meetingId={meetingId} socket={videoCallSocket} onClose={() => setShowSummary(false)} />
          )}

          {showMissedSpeech && (
            <MissedSpeech data={missedSpeechData} onSummarize={handleSummarizeMissedSpeech} onClose={() => setShowMissedSpeech(false)} />
          )}
        </div>

        {showConfirmLeave && (
          <ConfirmModal
            isOpen={showConfirmLeave}
            title={isHost ? 'End Meeting' : 'Leave Meeting'}
            message={isHost ? 'This will end the meeting for everyone.' : 'Are you sure you want to leave?'}
            isHost={isHost}
            onConfirm={confirmLeaveMeeting}
            onClose={() => setShowConfirmLeave(false)}
          />
        )}

        {notification && (
          <div className={`notification notification-${notification.type}`}>
            {notification.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingRoomPage;
