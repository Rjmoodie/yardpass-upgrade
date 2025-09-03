import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import Navigation from '@/components/Navigation';
import AuthPage from '@/pages/AuthPage';
import EventsPage from '@/pages/EventsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return user ? <>{children}</> : <Navigate to="/auth" replace />;
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">YP</span>
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {user && <Navigation />}
      <Routes>
        <Route 
          path="/auth" 
          element={user ? <Navigate to="/" replace /> : <AuthPage />} 
        />
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <EventsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/my-events" 
          element={
            <ProtectedRoute>
              <div className="container mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold">My Events</h1>
                <p className="text-muted-foreground">Coming soon...</p>
              </div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/create-event" 
          element={
            <ProtectedRoute>
              <div className="container mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold">Create Event</h1>
                <p className="text-muted-foreground">Coming soon...</p>
              </div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <div className="container mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold">Profile</h1>
                <p className="text-muted-foreground">Coming soon...</p>
              </div>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <div className="container mx-auto px-4 py-8">
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground">Coming soon...</p>
              </div>
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}