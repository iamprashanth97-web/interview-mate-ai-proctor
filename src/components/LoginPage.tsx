import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, LogIn, Mail, Lock, User, UserPlus, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserRole } from '../types';

export const LoginPage: React.FC = () => {
  const { login, loginEmail, register, loading } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('CANDIDATE');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegistering) {
        await register(email, password, name, role);
      } else {
        await loginEmail(email, password);
      }
    } catch (err: any) {
      let message = err.message || 'An error occurred during authentication.';
      if (err.code === 'auth/invalid-credential') {
        message = 'Invalid email or password. If you are a new user, please click "Sign Up" first.';
      } else if (err.code === 'auth/email-already-in-use') {
        message = 'This email is already registered. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password should be at least 6 characters.';
      }
      setError(message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4 py-8 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            x: [0, 50, 0],
            y: [0, 30, 0] 
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-blue-100/30 rounded-full blur-3xl" 
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.5, 1],
            rotate: [0, -90, 0],
            x: [0, -50, 0],
            y: [0, -30, 0] 
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-purple-100/30 rounded-full blur-3xl" 
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-neutral-200 border border-neutral-100 p-8 md:p-10 relative z-10 backdrop-blur-sm bg-white/90"
      >
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 20 }}
          className="flex flex-col items-center text-center mb-8"
        >
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-200">
            <ShieldCheck size={28} />
          </div>
          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-3xl font-bold text-neutral-900 font-display tracking-tight"
          >
            InterviewMate
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-xs font-bold text-blue-600/60 uppercase tracking-[0.2em] mt-2 font-mono"
          >
            AI-Integrity Engine
          </motion.p>
        </motion.div>

        <div className="flex bg-neutral-100 p-1.5 rounded-2xl mb-8">
          <button 
            onClick={() => { setIsRegistering(false); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${!isRegistering ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            Sign In
          </button>
          <button 
            onClick={() => { setIsRegistering(true); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${isRegistering ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            {isRegistering && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                key="register-fields"
                className="space-y-4"
              >
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Full Name" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full h-12 pl-12 pr-4 bg-neutral-50 border border-neutral-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="flex gap-2">
                  {(['CANDIDATE', 'ADMIN'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`flex-1 py-2.5 text-xs font-bold rounded-xl border transition-all ${role === r ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-neutral-100 text-neutral-500 hover:bg-neutral-50'}`}
                    >
                      {r === 'ADMIN' ? 'Admin' : 'Candidate'}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input 
              type="email" 
              placeholder="Email Address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-12 pl-12 pr-4 bg-neutral-50 border border-neutral-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full h-12 pl-12 pr-12 bg-neutral-50 border border-neutral-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors focus:outline-none"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-500 font-medium px-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {isRegistering ? <UserPlus size={18} /> : <LogIn size={18} />}
                {isRegistering ? 'Create Account' : 'Sign In'}
              </>
            )}
          </button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-100"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-3 text-neutral-400 font-medium">Or continue with</span></div>
        </div>

        <button
          onClick={login}
          disabled={loading}
          className="w-full h-12 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-700 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Google
        </button>

        <p className="mt-8 text-[10px] text-center text-neutral-400 leading-relaxed">
          By signing in, you agree to our <span className="underline cursor-pointer">Terms of Service</span> and <span className="underline cursor-pointer">Privacy Policy</span>.
        </p>
      </motion.div>
    </div>
  );
};
