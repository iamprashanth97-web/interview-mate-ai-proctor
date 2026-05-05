import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, getDocs, doc, updateDoc, addDoc } from 'firebase/firestore';
import { InterviewSession, AlertLog, UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  Users, 
  Monitor, 
  ExternalLink, 
  Search, 
  Filter, 
  ShieldAlert, 
  User as UserIcon,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Activity,
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneOff,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { ReportView } from './ReportView';

interface AdminVideoProps {
  stream: MediaStream;
}

const AdminVideo: React.FC<AdminVideoProps> = ({ stream }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="w-full h-full bg-black">
      <video 
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover scale-x-[-1]"
      />
    </div>
  );
};

export const AdminDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionAlerts, setSessionAlerts] = useState<AlertLog[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [newCandidateName, setNewCandidateName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const selectedSession = sessions.find(s => s.id === selectedSessionId) || null;
  
  // Live Interview State
  const [isJoining, setIsJoining] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [adminStream, setAdminStream] = useState<MediaStream | null>(null);
  const adminVideoRefForSnap = React.useRef<HTMLVideoElement>(null);

  const handleJoinInterview = async (sessionToJoin?: InterviewSession) => {
    const session = sessionToJoin || selectedSession;
    if (!session || !profile) return;
    
    if (session.id !== selectedSessionId) {
      setSelectedSessionId(session.id);
    }

    setIsConnecting(true);
    
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not available. This might happen if the app is not running on a secure (HTTPS) connection or your browser is outdated.");
      }

      // Check available devices
      let hasMicrophone = false;
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        hasMicrophone = devices.some(d => d.kind === 'audioinput');
      } catch (e) {
        console.warn("Admin device check failed:", e);
      }

      // Try with both first, then fallback
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 640 }, height: { ideal: 480 } }, 
          audio: hasMicrophone ? true : false 
        });
      } catch (e) {
        console.warn("Admin failed to get both video and audio, trying video only...", e);
        // Fallback to just video
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: true
        });
      }
      
      setAdminStream(stream);
      setIsJoining(true);

      // Update Firestore so the candidate knows we joined
      await updateDoc(doc(db, 'sessions', session.id), {
        interviewerJoined: true,
        interviewerName: profile.displayName,
        status: 'ONGOING' // Ensure session marks as ongoing when admin joins
      });

    } catch (err) {
      console.error("Error accessing camera/microphone:", err);
      let msg = "Could not access camera or microphone.";
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.message.includes('Permission denied')) {
          msg = "Camera/Microphone permission was denied.\n\nSince this app is running in an iframe, security policies may be strict. Please try clicking the 'Open in new tab' button at the top right of the preview to run the app directly, then try again.";
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          msg = "No camera found on this device. Please connect a camera and try again.";
        } else {
          msg = `Error: ${err.message}`;
        }
      }
      alert(msg);
      setIsJoining(false);
    } finally {
      setIsConnecting(false);
    }
  };

  // Add snapshot logic for admin's camera
  useEffect(() => {
    let snapshotInterval: any;
    const video = adminVideoRefForSnap.current;
    
    if (isJoining && adminStream && selectedSessionId && video) {
      if (video.srcObject !== adminStream) {
        video.srcObject = adminStream;
      }
      
      snapshotInterval = setInterval(async () => {
        if (video.readyState >= 2) {
          const canvas = document.createElement('canvas');
          canvas.width = 300; // Smaller for speed
          canvas.height = 225;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg', 0.3); // Lower quality
            try {
              await updateDoc(doc(db, 'sessions', selectedSessionId), {
                interviewerScreenshot: base64,
                interviewerLastContact: Date.now(),
                lastContact: Date.now()
              });
            } catch (e) {
              console.warn("Interviewer snapshot failed:", e);
            }
          }
        }
      }, 3000); // Admin snapshots every 3 seconds
    }

    return () => {
      if (snapshotInterval) clearInterval(snapshotInterval);
    };
  }, [isJoining, adminStream, selectedSessionId]);

  const handleScheduleSession = async () => {
    if (!newCandidateName.trim()) return;
    setIsCreating(true);

    try {
      const newSessionData = {
        candidateName: newCandidateName,
        startTime: Date.now(),
        status: 'PENDING',
        cheatingScore: 0,
        interviewerJoined: false,
        interviewerName: profile?.displayName || 'Admin',
        alerts: [],
        screenshots: [],
        candidateId: 'demo-invited' // Use a special tag for invited sessions
      };
      
      const docRef = await addDoc(collection(db, 'sessions'), newSessionData);
      setSelectedSessionId(docRef.id);
      setShowScheduleModal(false);
      setNewCandidateName('');
      alert(`Interview Session Created for ${newCandidateName}!\n\nLink generated: ${window.location.origin}/invite/${docRef.id}`);
    } catch (err) {
      console.error("Error creating session:", err);
      alert("Failed to create session. Check permissions.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleLeaveInterview = async () => {
    if (!selectedSession) return;
    
    // Stop tracks
    if (adminStream) {
      adminStream.getTracks().forEach(t => t.stop());
      setAdminStream(null);
    }
    
    setIsJoining(false);
    
    try {
      await updateDoc(doc(db, 'sessions', selectedSession.id), {
        interviewerJoined: false
      });
    } catch (err) {
      console.error("Error leaving interview:", err);
    }
  };

  useEffect(() => {
    const sessionsQuery = query(collection(db, 'sessions'), orderBy('startTime', 'desc'));
    const usersQuery = query(collection(db, 'users'));

    const unsubSessions = onSnapshot(sessionsQuery, (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InterviewSession)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sessions');
    });

    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      setUsers(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubSessions();
      unsubUsers();
    };
  }, []);

  useEffect(() => {
    if (selectedSessionId) {
      const alertsQuery = query(collection(db, 'sessions', selectedSessionId, 'alerts'), orderBy('timestamp', 'desc'));
      const unsubAlerts = onSnapshot(alertsQuery, (snapshot) => {
        setSessionAlerts(snapshot.docs.map(doc => doc.data() as AlertLog));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `sessions/${selectedSessionId}/alerts`);
      });
      return () => unsubAlerts();
    } else {
      setSessionAlerts([]);
    }
  }, [selectedSessionId]);

  const flaggedCount = sessions.filter(s => s.cheatingScore > 40).length;
  const activeCount = sessions.filter(s => s.status === 'ONGOING').length;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
      {!isJoining ? (
        <>
          <header className="mb-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h1 className="text-4xl font-bold text-neutral-900 font-display tracking-tight">Recruiter Command</h1>
              <p className="text-neutral-500 font-medium">Monitoring {sessions.length} active and past sessions</p>
            </motion.div>
          </header>

          <AnimatePresence>
            {showReport && selectedSession && (
              <ReportView 
                session={selectedSession} 
                alerts={sessionAlerts} 
                onClose={() => setShowReport(false)} 
              />
            )}
          </AnimatePresence>

          {/* Stats Cards */}
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
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            <StatsCard 
              title="Total Candidates" 
              value={users.filter(u => u.role === 'CANDIDATE').length.toString()} 
              icon={<Users className="text-blue-600" />}
              trend="+12%"
              trendUp={true}
            />
            <StatsCard 
              title="Live Sessions" 
              value={activeCount.toString()} 
              icon={<Monitor className="text-green-600" />}
              trend="Real-time"
              trendUp={true}
            />
            <StatsCard 
              title="Flagged Cases" 
              value={flaggedCount.toString()} 
              icon={<ShieldAlert className="text-red-600" />}
              trend="Attention Req."
              trendUp={false}
            />
            <StatsCard 
              title="Avg. Cheating Score" 
              value={`${Math.round(sessions.length ? sessions.reduce((acc, s) => acc + s.cheatingScore, 0) / sessions.length : 0)}%`} 
              icon={<Activity className="text-amber-600" />}
              trend="-4%"
              trendUp={true}
            />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sessions List */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="lg:col-span-2 space-y-4"
            >
              <SectionHeader title="Recent Sessions" onAction={() => setShowScheduleModal(true)} />
              
              <div className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-50 text-[10px] uppercase tracking-widest text-neutral-500 font-bold">
                      <tr>
                        <th className="px-6 py-4">Candidate</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Score</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      <AnimatePresence mode="popLayout">
                        {sessions.map((session) => (
                          <motion.tr 
                            key={session.id}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            whileHover={{ backgroundColor: "rgba(249, 250, 251, 1)" }}
                            className={`cursor-pointer transition-colors ${selectedSessionId === session.id ? 'bg-blue-50/50' : ''}`}
                            onClick={() => setSelectedSessionId(session.id)}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <motion.div 
                                  whileHover={{ scale: 1.1 }}
                                  className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600"
                                >
                                  <UserIcon size={16} />
                                </motion.div>
                                <div>
                                  <p className="font-medium text-sm">{session.candidateName}</p>
                                  <p className="text-[10px] text-neutral-400 font-mono uppercase tracking-tighter">ID: {session.id.slice(0, 8)}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full ${
                                session.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 
                                session.status === 'ONGOING' ? 'bg-blue-100 text-blue-700' : 
                                session.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-700'
                              }`}>
                                {session.status}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                 <div className="w-16 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                                   <motion.div 
                                     initial={{ width: 0 }}
                                     animate={{ width: `${session.cheatingScore}%` }}
                                     className={`h-full ${session.cheatingScore > 40 ? 'bg-red-500' : 'bg-green-500'}`} 
                                   />
                                 </div>
                                 <span className={`text-xs font-bold ${session.cheatingScore > 40 ? 'text-red-600' : 'text-neutral-600'}`}>
                                   {Math.round(session.cheatingScore)}%
                                 </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                {(session.status === 'ONGOING' || session.status === 'PENDING') && (
                                  <motion.button 
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleJoinInterview(session);
                                    }}
                                    className="px-3 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 animate-pulse"
                                  >
                                    <Video size={12} />
                                    {session.status === 'PENDING' ? 'Start/Join' : 'Join Live'}
                                  </motion.button>
                                )}
                                <ChevronRight className={`text-neutral-300 transition-transform ${selectedSessionId === session.id ? 'translate-x-1 text-blue-500' : ''}`} size={18} />
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>

            {/* Details Panel */}
            <div className="space-y-4">
              <SectionHeader title="Session Audit" />
              
              <AnimatePresence mode="wait">
                {selectedSession ? (
                  <motion.div
                    key={selectedSession.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-3xl border border-neutral-200 shadow-sm p-6 space-y-6"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold">{selectedSession.candidateName}</h3>
                        <p className="text-xs text-neutral-500">{new Date(selectedSession.startTime).toLocaleString()}</p>
                      </div>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${
                        selectedSession.cheatingScore > 40 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'
                      }`}>
                        {Math.round(selectedSession.cheatingScore)}
                      </div>
                    </div>

                    {selectedSession.status !== 'COMPLETED' && (
                      <div className="space-y-4">
                        <div className="relative aspect-video bg-neutral-900 rounded-2xl border-4 border-neutral-100 overflow-hidden shadow-inner group">
                          {(() => {
                            const sess = selectedSession as any;
                            const isDisconnected = sess.status === 'ONGOING' && 
                              sess.lastContact && 
                              (Date.now() - sess.lastContact > 30000); // 30 seconds threshold
                            
                            if (sess.lastScreenshot && !isDisconnected) {
                              return (
                                <img 
                                  src={sess.lastScreenshot} 
                                  alt="Live Feed" 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              );
                            }
                            
                            return (
                              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 gap-2 bg-neutral-900 px-6 text-center">
                                <Monitor size={32} className={(sess.status === 'ONGOING' && !isDisconnected) ? 'animate-pulse' : ''} />
                                <span className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                                  {sess.status === 'ONGOING' 
                                    ? (isDisconnected ? 'Candidate Link Unstable / Disconnected' : 'Candidate Feed Loading...') 
                                    : 'Waiting for Candidate...'}
                                </span>
                              </div>
                            );
                          })()}
                          
                          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-600 px-2 py-0.5 rounded-full shadow-lg">
                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Live View</span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleJoinInterview()}
                            disabled={selectedSession.status === 'COMPLETED' || isConnecting}
                            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50"
                          >
                            {isConnecting ? (
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <>
                                <Video size={18} />
                                Join Live Interview
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <h4 className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">Activity Timeline</h4>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {sessionAlerts.map((alert, idx) => (
                          <div key={idx} className="flex gap-3 p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                            <div className="shrink-0 w-8 h-8 rounded-lg bg-white flex items-center justify-center text-amber-600 shadow-sm">
                               <ShieldAlert size={16} />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-neutral-900">{alert.message}</p>
                              <p className="text-[10px] text-neutral-400">{new Date(alert.timestamp).toLocaleTimeString()}</p>
                            </div>
                          </div>
                        ))}
                        {sessionAlerts.length === 0 && (
                          <p className="text-center text-sm text-neutral-400 py-10">No alerts logged for this session yet.</p>
                        )}
                      </div>
                    </div>

                    <button 
                      onClick={() => setShowReport(true)}
                      className="w-full py-3 bg-neutral-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors"
                    >
                      <ExternalLink size={16} />
                      Detailed Report
                    </button>
                  </motion.div>
                ) : (
                  <div className="h-96 bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-3xl flex flex-col items-center justify-center text-center p-8 grayscale">
                    <Search size={40} className="text-neutral-300 mb-4" />
                    <h3 className="font-bold text-neutral-400">No Session Selected</h3>
                    <p className="text-xs text-neutral-400 mt-1 uppercase tracking-widest">Select a row from the list to audit</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </>
      ) : (
        <LiveMeetingView 
          session={selectedSession!} 
          alerts={sessionAlerts} 
          adminStream={adminStream}
          onLeave={handleLeaveInterview}
        />
      )}

      {/* Schedule Modal */}
      <video ref={adminVideoRefForSnap} autoPlay muted playsInline className="fixed -left-[1000px] -top-[1000px] w-[320px] h-[240px] opacity-1" />
      <AnimatePresence>
        {showScheduleModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold text-neutral-900">Schedule Interview</h3>
                <button onClick={() => setShowScheduleModal(false)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
                  <PhoneOff size={20} className="rotate-45" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-neutral-400 mb-1 leading-none tracking-widest">Candidate Name</label>
                  <input 
                    type="text" 
                    value={newCandidateName}
                    onChange={(e) => setNewCandidateName(e.target.value)}
                    placeholder="Enter candidate's full name"
                    className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    autoFocus
                  />
                </div>
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-blue-700 space-y-2">
                  <div className="flex gap-2">
                    <Monitor size={16} className="shrink-0 mt-0.5" />
                    <p className="text-xs font-medium">This will create a live interview session. You can send the unique session link to the candidate.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleScheduleSession}
                  disabled={isCreating || !newCandidateName.trim()}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <Video size={18} />}
                  Create Session
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SectionHeader: React.FC<{ title: string; onAction?: () => void }> = ({ title, onAction }) => (
  <div className="flex items-center justify-between">
    <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
    <div className="flex gap-2">
      {title === "Recent Sessions" && (
        <button 
          className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
          onClick={onAction}
        >
          <Video size={14} />
          Schedule Session
        </button>
      )}
      <button className="p-2 bg-white border border-neutral-200 rounded-lg text-neutral-500 hover:bg-neutral-50">
        <Filter size={16} />
      </button>
      <button className="p-2 bg-white border border-neutral-200 rounded-lg text-neutral-500 hover:bg-neutral-50">
        <Search size={16} />
      </button>
    </div>
  </div>
);

const StatsCard: React.FC<{ title: string; value: string; icon: React.ReactNode; trend: string; trendUp: boolean }> = ({ title, value, icon, trend, trendUp }) => (
  <motion.div 
    variants={{ hidden: { opacity: 0, scale: 0.9 }, visible: { opacity: 1, scale: 1 } }}
    whileHover={{ y: -5 }}
    className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-sm hover:shadow-md transition-shadow"
  >
    <div className="flex justify-between items-start mb-4">
      <div className="w-12 h-12 bg-neutral-50 rounded-2xl flex items-center justify-center">
        {icon}
      </div>
      <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${trendUp ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
        {trendUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
        {trend}
      </div>
    </div>
    <p className="text-neutral-500 text-xs font-semibold mb-1 uppercase tracking-wider">{title}</p>
    <p className="text-3xl font-bold tracking-tight text-neutral-900">{value}</p>
  </motion.div>
);

interface LiveMeetingViewProps {
  session: InterviewSession;
  alerts: AlertLog[];
  adminStream: MediaStream | null;
  onLeave: () => void;
}

const LiveMeetingView: React.FC<LiveMeetingViewProps> = ({ session, alerts, adminStream, onLeave }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-6"
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Video size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 leading-none mb-1">Meeting Room: {session.candidateName}</h2>
            <p className="text-xs text-neutral-500 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Secure Mutual Link Active • {session.status}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest leading-none mb-1">Session ID</span>
            <span className="text-xs font-mono text-neutral-600 leading-none">{session.id.slice(0, 12)}</span>
          </div>
          <button 
            onClick={onLeave}
            className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-red-700 transition-all shadow-lg shadow-red-500/20 active:scale-95"
          >
            <PhoneOff size={18} />
            End Meeting
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Main Immersive Grid (Candidate & Recruiter Parallel) */}
        <div className="relative w-full aspect-video md:aspect-[21/9] lg:aspect-[21/8] bg-black rounded-[2.5rem] overflow-hidden border-[6px] md:border-[10px] border-neutral-100 shadow-2xl flex flex-col md:flex-row gap-1 p-1">
          
          {/* Candidate Feed */}
          <div className="relative flex-1 bg-neutral-900 overflow-hidden rounded-2xl md:rounded-[1.8rem] group">
            {(() => {
              const sess = session as any;
              const isDisconnected = sess.status === 'ONGOING' && 
                sess.lastContact && 
                (Date.now() - sess.lastContact > 30000);
              
              if (sess.lastScreenshot && !isDisconnected) {
                return (
                  <img 
                    src={sess.lastScreenshot} 
                    alt="Candidate" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                );
              }
              
              return (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 gap-4 p-4 text-center bg-neutral-800">
                  <Activity size={48} className="animate-pulse text-blue-500/30" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-white/60">{isDisconnected ? 'Candidate Link Lost' : 'Synchronizing Feed...'}</p>
                    <p className="text-[10px] text-white/20 mt-1 max-w-[200px] mx-auto">AI is establishing a secure monitoring channel with the remote client.</p>
                  </div>
                </div>
              );
            })()}

            <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-white uppercase tracking-widest leading-none">Candidate (Remote)</span>
            </div>
            
            <div className="absolute bottom-6 left-6 bg-black/40 px-4 py-2 rounded-2xl backdrop-blur-md flex flex-col">
              <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest leading-none mb-1">Speaker</span>
              <span className="text-sm font-bold text-white leading-none">{session.candidateName}</span>
            </div>
          </div>

          {/* Admin/Recruiter Feed */}
          <div className="relative flex-1 bg-neutral-900 overflow-hidden rounded-2xl md:rounded-[1.8rem] border-2 border-blue-500/20 group">
            {adminStream ? (
              <AdminVideo stream={adminStream} />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40 gap-4 p-4 text-center bg-neutral-800">
                <VideoOff size={48} className="text-white/10" />
                <p className="text-xs font-bold uppercase tracking-widest">Local Camera Off</p>
              </div>
            )}

            <div className="absolute top-4 left-4 flex items-center gap-2 bg-blue-600/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <div className="w-2 h-2 bg-blue-400 rounded-full" />
              <span className="text-[10px] font-bold text-white uppercase tracking-widest leading-none">You (Interviewer)</span>
            </div>

            <div className="absolute bottom-6 left-6 bg-blue-900/40 px-4 py-2 rounded-2xl backdrop-blur-md flex flex-col">
               <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest leading-none mb-1">Moderator</span>
               <span className="text-sm font-bold text-white leading-none">{session.interviewerName || 'Admin'}</span>
            </div>
          </div>
        </div>

        {/* Info & Logs Panel (Below Video for maximum camera height) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-4">
             <div className="bg-white p-6 rounded-3xl border border-neutral-200 h-full flex flex-col justify-center">
                <p className="text-[10px] uppercase font-bold text-neutral-400 mb-2 tracking-widest">Cheating Probability</p>
                <div className="flex items-center gap-4">
                   <div className="text-4xl font-bold text-neutral-900 leading-none">
                     {Math.round(session.cheatingScore)}%
                   </div>
                   <div className="flex-1 space-y-1">
                      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${session.cheatingScore}%` }}
                          className={`h-full transition-all duration-1000 ${session.cheatingScore > 40 ? 'bg-red-500' : 'bg-green-500'}`}
                        />
                      </div>
                      <p className="text-[10px] font-bold uppercase text-neutral-400 tracking-tighter">
                        {session.cheatingScore > 40 ? 'High Risk' : 'Normal Interaction'}
                      </p>
                   </div>
                </div>
             </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white rounded-3xl border border-neutral-200 p-6 shadow-sm flex flex-col h-full max-h-[300px]">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center justify-between">
                Live AI Proctering Logs
                <div className="flex items-center gap-1.5 bg-green-50 text-green-600 px-2 py-0.5 rounded-full">
                  <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[8px] uppercase">Active Analysis</span>
                </div>
              </h3>
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                {alerts.map((alert, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={idx} 
                    className={`flex items-start gap-3 p-3 rounded-xl border ${
                      alert.severity === 'high' ? 'bg-red-50 border-red-100 text-red-900' : 
                      alert.severity === 'medium' ? 'bg-amber-50 border-amber-100 text-amber-900' : 
                      'bg-neutral-50 border-neutral-100 text-neutral-600'
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {alert.severity === 'high' ? <ShieldAlert size={14} className="text-red-600" /> : <Activity size={14} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-tight">{alert.type}</span>
                        <span className="text-[9px] opacity-60 font-mono tracking-tighter">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs font-medium leading-tight">{alert.message}</p>
                    </div>
                  </motion.div>
                ))}
                {alerts.length === 0 && (
                  <div className="text-center py-8 text-neutral-400">
                    <p className="text-sm font-medium">No alerts generated</p>
                    <p className="text-[10px] uppercase tracking-widest mt-1">Listening for behavioral cues...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
