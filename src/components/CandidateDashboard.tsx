import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, orderBy, getDocs, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { InterviewSession, AlertLog } from '../types';
import { PlayCircle, Clock, ShieldAlert, History, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { ReportView } from './ReportView';
import { onSnapshot } from 'firebase/firestore';

interface CandidateDashboardProps {
  onStartSession: (sessionId: string) => void;
}

export const CandidateDashboard: React.FC<CandidateDashboardProps> = ({ onStartSession }) => {
  const { user, profile } = useAuth();
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<InterviewSession | null>(null);
  const [sessionAlerts, setSessionAlerts] = useState<AlertLog[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchSessions = async () => {
      try {
        const q = query(
          collection(db, 'sessions'),
          where('candidateId', '==', user.uid),
          orderBy('startTime', 'desc')
        );
        const snapshot = await getDocs(q);
        const sessionData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InterviewSession));
        setSessions(sessionData);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'sessions');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [user]);

  useEffect(() => {
    if (selectedSession) {
      const q = query(
        collection(db, 'sessions', selectedSession.id, 'alerts'),
        orderBy('timestamp', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setSessionAlerts(snapshot.docs.map(doc => doc.data() as AlertLog));
      }, (error) => {
        console.error("Alerts listener error:", error);
        // Don't throw here to avoid crashing the dashboard, but clear alerts
        setSessionAlerts([]);
      });
      return () => unsubscribe();
    }
  }, [selectedSession]);

  const handleStart = async () => {
    if (!user || !profile) return;
    
    const newSession = {
      candidateId: user.uid,
      candidateName: profile.displayName,
      startTime: Date.now(),
      status: 'PENDING' as const,
      cheatingScore: 0,
      isFlagged: false
    };

    try {
      const docRef = await addDoc(collection(db, 'sessions'), newSession);
      onStartSession(docRef.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sessions');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <header>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h1 className="text-4xl font-bold text-neutral-900 font-display tracking-tight">Candidate Lounge</h1>
          <p className="text-neutral-500 font-medium tracking-tight">Welcome back, {profile?.displayName || 'Candidate'}</p>
        </motion.div>
      </header>

      <AnimatePresence>
        {selectedSession && (
          <ReportView 
            session={selectedSession} 
            alerts={sessionAlerts} 
            onClose={() => setSelectedSession(null)} 
          />
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.1 }
            }
          }}
          className="lg:col-span-2 space-y-8"
        >
          <motion.section variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <History className="text-brand-accent" size={24} />
                Recent Sessions
              </h2>
            </div>
            
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-40 bg-white rounded-3xl animate-pulse border border-neutral-100" />
                ))}
              </div>
            ) : sessions.length > 0 ? (
              <motion.div 
                layout
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {sessions.map((session) => (
                  <motion.div
                    key={session.id}
                    layout
                    variants={{ 
                      hidden: { opacity: 0, y: 20, scale: 0.95 }, 
                      visible: { opacity: 1, y: 0, scale: 1 } 
                    }}
                    whileHover={{ 
                      y: -8,
                      scale: 1.02,
                      boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)"
                    }}
                    className={`p-6 bg-white rounded-[2rem] border border-neutral-100 shadow-sm flex flex-col justify-between group transition-shadow relative overflow-hidden ${
                      session.status === 'COMPLETED' ? 'opacity-100' : 'bg-neutral-50/50'
                    }`}
                    onClick={() => session.status === 'COMPLETED' && setSelectedSession(session)}
                  >
                    {session.status === 'COMPLETED' && (
                      <div className="absolute top-0 right-0 p-3 text-neutral-100 transition-colors group-hover:text-blue-500/20">
                         <ShieldAlert size={64} className="rotate-12" />
                      </div>
                    )}

                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          session.status === 'COMPLETED' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                          <History size={24} />
                        </div>
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full ${
                          session.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {session.status}
                        </span>
                      </div>
                      
                      <h3 className="font-bold text-lg mb-1">{new Date(session.startTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</h3>
                      <p className="text-xs text-neutral-400 font-mono mb-4">ID: {session.id.slice(0, 12)}</p>
                    </div>

                    <div className="relative z-10 flex items-center justify-between mt-4">
                      <div className="text-sm text-neutral-500">
                        {session.status === 'COMPLETED' ? (
                          <span className="flex items-center gap-1.5 text-green-600 font-semibold">
                            <ShieldAlert size={14} /> Review Audit
                          </span>
                        ) : 'Ready to start'}
                      </div>
                      
                      {(session.status === 'PENDING' || session.status === 'ONGOING') && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => { e.stopPropagation(); onStartSession(session.id); }}
                          className="px-5 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
                        >
                          <PlayCircle size={14} />
                          Continue
                        </motion.button>
                      )}
                      
                      {session.status === 'COMPLETED' && (
                        <div className="w-8 h-8 rounded-full bg-neutral-50 flex items-center justify-center text-neutral-300 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                          <ExternalLink size={16} />
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-neutral-200">
                <p className="text-neutral-500">No sessions recorded yet.</p>
              </div>
            )}
          </motion.section>
        </motion.div>


        {/* Sidebar */}
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: { staggerChildren: 0.1, delayChildren: 0.3 }
            }
          }}
          className="space-y-6"
        >
          <motion.div 
            variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }}
            className="bg-neutral-900 rounded-3xl p-8 text-white shadow-xl"
          >
            <h2 className="text-2xl font-bold mb-4">Start New Interview</h2>
            <p className="text-neutral-400 text-sm mb-8 leading-relaxed">
              Before starting, ensure your webcam is enabled and you are in a well-lit environment with no other people present.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStart}
              className="w-full py-4 bg-brand-accent hover:bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-colors shadow-lg shadow-blue-500/20"
            >
              <PlayCircle size={20} />
              Launch ProctorRoom
            </motion.button>
          </motion.div>

          <motion.div 
            variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
            className="bg-white rounded-3xl p-6 border border-neutral-100 shadow-sm"
          >
            <h3 className="font-bold flex items-center gap-2 mb-4">
              <Clock size={18} className="text-neutral-400" />
              Guidelines
            </h3>
            <ul className="space-y-3 text-sm text-neutral-600">
              <li className="flex gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                Stay within the camera frame at all times.
              </li>
              <li className="flex gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                Avoid looking away from the screen.
              </li>
              <li className="flex gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                Ensure no mobile phones or books are visible.
              </li>
            </ul>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};
