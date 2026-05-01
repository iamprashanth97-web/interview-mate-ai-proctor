import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AnimatePresence, motion } from 'motion/react';
import { User, Settings, Bell, Shield, Mail, CheckCircle2, AlertCircle, Save } from 'lucide-react';

export const ProfileSettings: React.FC = () => {
  const { profile, updateProfileData } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security' | 'preferences'>('profile');
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [prefs, setPrefs] = useState({
    desktopNotify: profile?.settings?.desktopNotify ?? true,
    emailSummary: profile?.settings?.emailSummary ?? false,
    autoAnalyze: profile?.settings?.autoAnalyze ?? true,
    highPrivacy: profile?.settings?.highPrivacy ?? false
  });

  const handleUpdateProfile = async (field: string, value: any) => {
    setIsSaving(true);
    setMessage(null);
    try {
      if (field === 'profile') {
        if (!displayName.trim()) return;
        await updateProfileData({ displayName });
      } else if (field === 'settings') {
        await updateProfileData({ settings: { ...prefs, ...value } });
        setPrefs(p => ({ ...p, ...value }));
      }
      setMessage({ type: 'success', text: 'Settings updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to update settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile) return null;

  const NavButton = ({ id, icon: Icon, label }: { id: typeof activeTab, icon: any, label: string }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${
        activeTab === id 
          ? 'bg-blue-50 text-blue-600 shadow-sm' 
          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
      }`}
    >
      <Icon size={18} />
      {label}
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8">
        <header>
          <h2 className="text-2xl font-bold text-neutral-900">Account Settings</h2>
          <p className="text-neutral-500">Manage your profile and application preferences</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Navigation Sidebar */}
          <motion.aside 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <nav className="space-y-1 p-1 bg-white glass rounded-2xl border border-neutral-200 shadow-sm sticky top-24">
              <NavButton id="profile" icon={User} label="Profile" />
              <NavButton id="notifications" icon={Bell} label="Notifications" />
              <NavButton id="security" icon={Shield} label="Security" />
              <NavButton id="preferences" icon={Settings} label="Preferences" />
            </nav>
          </motion.aside>

          {/* Main Content */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {activeTab === 'profile' && (
                <motion.section 
                  key="profile"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden"
                >
                  <div className="p-6 border-b border-neutral-100 bg-neutral-50/50">
                    <h3 className="font-semibold text-neutral-900">Personal Information</h3>
                    <p className="text-xs text-neutral-500">Basic details about you and your account</p>
                  </div>

                  <form onSubmit={(e) => { e.preventDefault(); handleUpdateProfile('profile', { displayName }); }} className="p-6 space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="w-full h-11 pl-10 pr-4 bg-neutral-50 border border-neutral-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                          placeholder="Your full name"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                        Email Address
                      </label>
                      <div className="relative opacity-60">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                        <input
                          type="email"
                          disabled
                          value={profile.email}
                          className="w-full h-11 pl-10 pr-4 bg-neutral-100 border border-neutral-100 rounded-xl text-sm cursor-not-allowed font-medium"
                        />
                      </div>
                      <p className="text-[10px] text-neutral-400">Email cannot be changed automatically for security reasons.</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                        Role
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold uppercase tracking-wider">
                          {profile.role}
                        </span>
                      </div>
                    </div>

                    {message && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
                          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                        {message.text}
                      </motion.div>
                    )}

                    <div className="pt-4 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSaving || !displayName.trim() || displayName === profile.displayName}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none"
                      >
                        {isSaving ? (
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Save size={18} />
                        )}
                        Save Changes
                      </button>
                    </div>
                  </form>
                </motion.section>
              )}

              {activeTab === 'notifications' && (
                <motion.section 
                  key="notifications"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden"
                >
                  <div className="p-6 border-b border-neutral-100 bg-neutral-50/50">
                    <h3 className="font-semibold text-neutral-900">Notifications</h3>
                    <p className="text-xs text-neutral-500">Control when and how you receive alerts</p>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-neutral-900">Desktop Notifications</h4>
                        <p className="text-xs text-neutral-500">Receive alerts when a session status changes</p>
                      </div>
                      <button 
                        onClick={() => handleUpdateProfile('settings', { desktopNotify: !prefs.desktopNotify })}
                        className={`w-11 h-6 rounded-full flex items-center px-1 transition-colors ${prefs.desktopNotify ? 'bg-blue-600' : 'bg-neutral-200'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${prefs.desktopNotify ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-neutral-900">Email Summaries</h4>
                        <p className="text-xs text-neutral-500">Weekly reports for all proctored sessions</p>
                      </div>
                      <button 
                        onClick={() => handleUpdateProfile('settings', { emailSummary: !prefs.emailSummary })}
                        className={`w-11 h-6 rounded-full flex items-center px-1 transition-colors ${prefs.emailSummary ? 'bg-blue-600' : 'bg-neutral-200'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${prefs.emailSummary ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                  </div>
                </motion.section>
              )}

              {activeTab === 'security' && (
                <motion.section 
                  key="security"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden"
                >
                  <div className="p-6 border-b border-neutral-100 bg-neutral-50/50">
                    <h3 className="font-semibold text-neutral-900">Security</h3>
                    <p className="text-xs text-neutral-500">Manage your account protection</p>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-neutral-900">Two-Factor Authentication</h4>
                        <p className="text-xs text-neutral-500">Add an extra layer of security to your account</p>
                      </div>
                      <button className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-lg text-xs font-bold hover:bg-neutral-50 transition-all">
                        Enable
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-neutral-900">Active Sessions</h4>
                        <p className="text-xs text-neutral-500">You are currently logged in on this browser</p>
                      </div>
                      <Shield className="text-green-500" size={20} />
                    </div>
                  </div>
                </motion.section>
              )}

              {activeTab === 'preferences' && (
                <motion.section 
                  key="preferences"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden"
                >
                  <div className="p-6 border-b border-neutral-100 bg-neutral-50/50">
                    <h3 className="font-semibold text-neutral-900">Preferences</h3>
                    <p className="text-xs text-neutral-500">Customize your workspace experience</p>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-neutral-900">AI Auto-Analysis</h4>
                        <p className="text-xs text-neutral-500">Automatically generate reports after interviews</p>
                      </div>
                      <button 
                        onClick={() => handleUpdateProfile('settings', { autoAnalyze: !prefs.autoAnalyze })}
                        className={`w-11 h-6 rounded-full flex items-center px-1 transition-colors ${prefs.autoAnalyze ? 'bg-blue-600' : 'bg-neutral-200'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${prefs.autoAnalyze ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium text-neutral-900">Strict Privacy Mode</h4>
                        <p className="text-xs text-neutral-500">Mask candidate PII in aggregate reports</p>
                      </div>
                      <button 
                        onClick={() => handleUpdateProfile('settings', { highPrivacy: !prefs.highPrivacy })}
                        className={`w-11 h-6 rounded-full flex items-center px-1 transition-colors ${prefs.highPrivacy ? 'bg-blue-600' : 'bg-neutral-200'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${prefs.highPrivacy ? 'translate-x-5' : ''}`} />
                      </button>
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
