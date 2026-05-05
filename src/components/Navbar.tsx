import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, User as UserIcon, ShieldCheck, LayoutDashboard, Settings } from 'lucide-react';
import { motion } from 'motion/react';

interface NavbarProps {
  onNavigate: (view: 'dashboard' | 'profile') => void;
  activeView: 'dashboard' | 'profile';
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate, activeView }) => {
  const { profile, logout } = useAuth();

  if (!profile) return null;

  return (
    <motion.nav 
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 20, stiffness: 100 }}
      className="h-16 glass px-4 md:px-8 flex items-center justify-between sticky top-4 left-4 right-4 z-50 rounded-2xl mx-4 shadow-xl border border-white/40"
    >
      <div className="flex items-center gap-6">
        <button 
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-10 h-10 bg-brand-accent rounded-xl flex items-center justify-center text-white">
            <ShieldCheck size={24} />
          </div>
          <div className="text-left">
            <h1 className="text-lg font-bold tracking-tight">Interviewmate-ai</h1>
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-medium whitespace-nowrap">
              {profile.role === 'ADMIN' ? 'Admin Console' : profile.role === 'INTERVIEWER' ? 'Recruiter Dashboard' : 'Interview Room'}
            </p>
          </div>
        </button>

        <div className="hidden md:flex items-center gap-1 bg-neutral-100 p-1 rounded-xl relative">
          <button
            onClick={() => onNavigate('dashboard')}
            className={`relative flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all z-10 ${
              activeView === 'dashboard' ? 'text-blue-600' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {activeView === 'dashboard' && (
              <motion.div 
                layoutId="nav-pill"
                className="absolute inset-0 bg-white rounded-lg shadow-sm"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-20 flex items-center gap-2">
              <LayoutDashboard size={14} />
              Dashboard
            </span>
          </button>
          <button
            onClick={() => onNavigate('profile')}
            className={`relative flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all z-10 ${
              activeView === 'profile' ? 'text-blue-600' : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {activeView === 'profile' && (
              <motion.div 
                layoutId="nav-pill"
                className="absolute inset-0 bg-white rounded-lg shadow-sm"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-20 flex items-center gap-2">
              <Settings size={14} />
              Settings
            </span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end hidden sm:flex">
          <span className="text-sm font-semibold">{profile.displayName}</span>
          <span className="text-[10px] text-blue-600 font-bold px-1.5 py-0.5 bg-blue-50 rounded-md">
            {profile.role}
          </span>
        </div>
        
        <div className="h-8 w-[1px] bg-neutral-200 hidden sm:block mx-1" />

        <button
          onClick={() => onNavigate('profile')}
          className={`p-2 rounded-full transition-colors ${
            activeView === 'profile' ? 'bg-blue-50 text-blue-600' : 'hover:bg-neutral-100 text-neutral-600'
          }`}
          title="Profile"
        >
          <UserIcon size={20} />
        </button>

        <button 
          onClick={logout}
          className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-neutral-600"
          title="Logout"
        >
          <LogOut size={20} />
        </button>
      </div>
    </motion.nav>
  );
};
