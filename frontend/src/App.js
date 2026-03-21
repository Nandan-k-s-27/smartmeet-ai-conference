import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import './App.css';

import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import MeetingHomePage from './pages/MeetingHomePage';
import MeetingRoomPage from './pages/MeetingRoomPage';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MeetingHomePage />
          </ProtectedRoute>
        }
      />

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
  );
}

export default App;
