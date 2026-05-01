/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './components/LoginPage';
import { Navbar } from './components/Navbar';
import { CandidateDashboard } from './components/CandidateDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { InterviewRoom } from './components/InterviewRoom';
import { ProfileSettings } from './components/ProfileSettings';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return sessionStorage.getItem('active_session_id');
  });
  const [currentView, setCurrentView] = useState<'dashboard' | 'profile'>('dashboard');

  useEffect(() => {
    if (activeSessionId) {
      sessionStorage.setItem('active_session_id', activeSessionId);
    } else {
      sessionStorage.removeItem('active_session_id');
    }
  }, [activeSessionId]);

  // Handle invite links
  React.useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/invite/')) {
      const id = path.split('/invite/')[1];
      if (id) {
        setActiveSessionId(id);
        // Clear the URL without full reload
        window.history.replaceState({}, '', '/');
      }
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="w-8 h-8 border-3 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginPage />;
  }

  // If candidate is in an active session
  if (activeSessionId) {
    return (
      <InterviewRoom 
        sessionId={activeSessionId} 
        onClose={() => setActiveSessionId(null)} 
      />
    );
  }

  const renderContent = () => {
    if (currentView === 'profile') {
      return <ProfileSettings />;
    }

    if (profile.role === 'ADMIN') {
      return <AdminDashboard />;
    }

    return (
      <CandidateDashboard onStartSession={(id) => setActiveSessionId(id)} />
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50 font-sans selection:bg-blue-100 selection:text-blue-900 overflow-hidden">
      <div className="noise" />
      <Navbar onNavigate={(view) => setCurrentView(view)} activeView={currentView} />
      <main className="flex-1 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSessionId ? 'interview' : currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
