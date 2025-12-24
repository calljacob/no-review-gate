import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ReviewPage from './pages/ReviewPage';
import AdminDashboard from './pages/AdminDashboard';
import './styles/index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
