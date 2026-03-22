import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import MeetingHomePage from './pages/MeetingHomePage';
import MeetingRoomPage from './pages/MeetingRoomPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route
        path="/"
        element={<MeetingHomePage />}
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
