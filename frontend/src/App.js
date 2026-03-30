import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import MeetingHomePage from './pages/MeetingHomePage';
import MeetingRoomPage from './pages/MeetingRoomPage';
import ProtectedRoute from './components/ProtectedRoute';

const LoginRedirect = () => {
  const location = useLocation();
  const query = location.search || '';
  return <Navigate to={`/${query}`} replace />;
};

import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<MeetingHomePage />} />
        <Route path="/login" element={<LoginRedirect />} />
        <Route
          path="/meeting/:meetingId"
          element={
            <ProtectedRoute>
              <MeetingRoomPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
