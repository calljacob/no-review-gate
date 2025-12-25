import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ReviewPage from './pages/ReviewPage';
import AdminDashboard from './pages/AdminDashboard';
import ReviewsOnlyDashboard from './pages/ReviewsOnlyDashboard';
import LoginPage from './pages/LoginPage';
import CampaignReviews from './pages/CampaignReviews';
import ProtectedRoute from './components/ProtectedRoute';
import './styles/index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute requireAdmin={true}>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/reviews" 
          element={
            <ProtectedRoute requireAdmin={true}>
              <CampaignReviews />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/reviews" 
          element={
            <ProtectedRoute>
              <ReviewsOnlyDashboard />
            </ProtectedRoute>
          } 
        />
        <Route path="/" element={<Navigate to="/reviews" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

