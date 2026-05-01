import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, collection, addDoc, onSnapshot, query, where } from 'firebase/firestore';
import { AlertType, AlertLog } from '../types';
import { ProctorEngine } from './ProctorEngine';
import { Navbar } from './Navbar';
import { Shield, AlertTriangle, CheckCircle, Video, VideoOff, Mic, MicOff, Power, Info, Activity, ExternalLink, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InterviewRoomProps {
  sessionId: string;
  onClose: () => void;
}

export const InterviewRoom: React.FC<InterviewRoomProps> = ({ sessionId, onClose }) => {
  const { user, profile } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const [cheatingScore, setCheatingScore] = useState(0);
  const [status, setStatus] = useState<'ONGOING' | 'COMPLETED'>('ONGOING');
  const [interviewerJoined, setInterviewerJoined] = useState(false);
  const [interviewerName, setInterviewerName] = useState('');
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [activeNotification, setActiveNotification] = useState<{ message: string; type: AlertType; id: number } | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProctorLoading, setIsProctorLoading] = useState(true);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [streamVersion, setStreamVersion] = useState(0);
  const [videoKey, setVideoKey] = useState(0);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  // Deduplicated alerts for the display log
  const uniqueAlerts = alerts.reduce((acc: AlertLog[], current) => {
    const isDuplicate = acc.find(item => item.message === current.message);
    if (!isDuplicate) {
      acc.push(current);
    }
    return acc;
  }, []);

  useEffect(() => {
    if (alerts.length > 0) {
      const latestAlert = alerts[0];
      
      // Always show notification for the latest alert record
      setActiveNotification({ message: latestAlert.message, type: latestAlert.type, id: latestAlert.timestamp });

      const timer = setTimeout(() => setActiveNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [alerts.length > 0 ? alerts[0].timestamp : null]);

  // Get available cameras
  useEffect(() => {
     const getDevices = async () => {
       try {
         const devices = await navigator.mediaDevices.enumerateDevices();
         const cameras = devices.filter(d => d.kind === 'videoinput' && d.deviceId);
         setAvailableCameras(cameras);
         if (cameras.length > 0 && !selectedCameraId) {
           // Don't set by default yet, let getUserMedia pick first
         }
       } catch (e) {
         console.warn("Device enumeration failed:", e);
       }
     };
     getDevices();
  }, []);

  // Attachment logic
  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      console.log("Attaching stream:", stream.id);
      
      // Only re-attach if different
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      
      const playVideo = async () => {
        try {
          video.muted = true;
          video.setAttribute('muted', '');
          video.setAttribute('playsinline', '');
          
          // Re-trigger load to be safe
          if (video.readyState === 0) {
            video.load();
          }

          if (video.paused) {
            await video.play();
            console.log("Video started playing via effect");
          }
        } catch (err) {
          console.warn("Autoplay blocked, waiting for interaction", err);
        }
      };
      
      playVideo();
    }
  }, [stream, videoKey]);

  // Handle stream active state reliably
  useEffect(() => {
    const video = videoRef.current;
    
    if (!stream || isCameraOff || !video) {
      if (video) video.srcObject = null;
      setStreamActive(false);
      return;
    }

    // Assign stream to video element
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    let checkInterval: any;
    let fallbackTimeout: any;
    
    const checkState = () => {
      if (!video || !stream) return;
      
      // Check if video is actually rendering frames
      if (video.readyState >= 2 && video.videoWidth > 0 && !video.paused) {
        if (!streamActive) {
          console.log("Feed verified active:", video.videoWidth, "x", video.videoHeight);
          setStreamActive(true);
        }
      } else if (!isCameraOff && stream) {
        // If attached but stalled, try nudge
        if (video.paused) {
           video.play().catch(() => {});
        }
        
        // If readyState is 0, it might need a load()
        if (video.readyState === 0 && video.srcObject) {
           video.load();
        }
      }
    };

    // Auto-nudge after 3 seconds of being in 'stream present but inactive' state
    if (stream && !streamActive && !isCameraOff) {
      fallbackTimeout = setTimeout(() => {
        console.log("Auto-nudging stalled stream...");
        video.play().catch(() => {});
        // If still stuck, try a source refresh
        if (video.videoWidth === 0) {
          video.srcObject = stream;
        }
      }, 3500);
    }

    const onPlay = () => console.log("Video: Play");
    const onPause = () => console.log("Video: Pause");
    
    video.addEventListener('playing', checkState);
    video.addEventListener('loadeddata', checkState);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    
    checkInterval = setInterval(checkState, 1500);

    return () => {
      video.removeEventListener('playing', checkState);
      video.removeEventListener('loadeddata', checkState);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      clearInterval(checkInterval);
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
    };
  }, [stream, isCameraOff, streamActive, videoKey]);

  const startCamera = async () => {
    if (isCameraStarting) return;
    
    console.log("Initiating camera sequence...");
    
    // Stop existing stream if any
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setStreamActive(false);
    }

    setIsCameraStarting(true);
    setCameraError(null);
    
    try {
      if (user) {
        const sessionRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionRef, {
          candidateId: user.uid,
          candidateName: profile?.displayName || user.email || 'Candidate',
          lastContact: Date.now()
        }).catch(e => console.warn("Session update failed (non-critical):", e));
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("MEDIA_API_UNAVAILABLE");
      }

      // Check available devices
      const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      const hasCam = devices.some(d => d.kind === 'videoinput');
      
      // If we can't see any devices, enumerateDevices might be blocked or they really don't exist
      // We still try getUserMedia anyway as some browsers block enumerate until permission given
      
      let mediaStream: MediaStream | null = null;
      
      const constraints = [
        // 1. High-quality with specific camera if selected
        { 
          video: selectedCameraId ? { deviceId: { exact: selectedCameraId } } : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, 
          audio: true 
        },
        // 2. Generic with audio
        { video: true, audio: true },
        // 3. Simple video only
        { video: true },
        // 4. Ultra-fallback (very low res)
        { video: { width: 320, height: 240 } }
      ];

      for (let i = 0; i < constraints.length; i++) {
        try {
          console.log(`Attempting media with constraints (Set ${i + 1}):`, constraints[i]);
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints[i]);
          console.log(`Media attempt ${i + 1} successful!`);
          break;
        } catch (e: any) {
          const eName = e.name || "";
          const eMsg = e.message || "";
          const rawError = `${eName}: ${eMsg}`;
          console.warn(`Media attempt ${i + 1} failed:`, rawError);
          
          // Re-set detailed error for display
          setCameraError(`RAW_ERROR|${rawError}`);

          // If permission denied, we usually can't recover by changing constraints in the same session
          // but we try simple video-only just in case it's an audio-permission specific issue
          if (eName === 'NotAllowedError' || eName === 'PermissionDeniedError' || eMsg.toLowerCase().includes('denied')) {
             if (i === constraints.length - 1) throw e;
             continue; 
          }
          if (i === constraints.length - 1) throw e;
        }
      }

      if (mediaStream) {
        setCameraError(null); // Clear errors on success
        mediaStream.getTracks().forEach(t => t.enabled = true);
        setStream(mediaStream);
        setStreamVersion(v => v + 1);
        
        const hasVideo = mediaStream.getVideoTracks().length > 0;
        const hasAudio = mediaStream.getAudioTracks().length > 0;
        
        setIsCameraOff(!hasVideo);
        setIsMicMuted(!hasAudio);

        const sessionRef = doc(db, 'sessions', sessionId);
        await updateDoc(sessionRef, {
          status: 'ONGOING',
          startTime: Date.now()
        }).catch(e => console.error("Final session update failed:", e));
      }

    } catch (err: any) {
      console.error("Final camera access error:", err);
      let errorType = "GENERIC";
      
      const name = err.name || "";
      const msg = err.message || "";

      if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || msg.includes('denied')) {
        errorType = "PERMISSION_DENIED";
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || msg.includes('not found')) {
        errorType = "HARDWARE_NOT_FOUND";
      } else if (msg === 'MEDIA_API_UNAVAILABLE') {
        errorType = "API_UNAVAILABLE";
      }

      const isIframe = window.self !== window.top;
      if (isIframe && errorType === 'PERMISSION_DENIED') {
        errorType = "IFRAME_RESTRICTION";
      }

      setCameraError(errorType);
    } finally {
      setIsCameraStarting(false);
    }
  };

  useEffect(() => {
    if (user && isReady) {
      startCamera();
      // Show instructions automatically for 5 seconds when starting
      setShowInstructions(true);
      const timer = setTimeout(() => {
        setShowInstructions(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [user, isReady, selectedCameraId]);

  useEffect(() => {
    // Snapshot mechanism
    let isSnapshotting = false;
    const snapshotInterval = setInterval(async () => {
      if (isSnapshotting) return;
      
      if (videoRef.current && canvasRef.current && status === 'ONGOING' && videoRef.current.readyState >= 2) {
        isSnapshotting = true;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          isSnapshotting = false;
          return;
        }

        canvas.width = 400;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL('image/jpeg', 0.4); // Lower quality for speed
          try {
            await updateDoc(doc(db, 'sessions', sessionId), {
              lastScreenshot: base64,
              lastContact: Date.now()
            });
          } catch (e) {
            console.error("Snapshot error:", e);
          }
        }
        isSnapshotting = false;
      }
    }, 7000); // 7 seconds - even slower to prevent SDK assertion errors

    // Listen for alerts (optional, but good for sync)
    const q = query(collection(db, 'sessions', sessionId, 'alerts'), where('candidateId', '==', user?.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newAlerts = snapshot.docs.map(doc => doc.data() as AlertLog);
      setAlerts(newAlerts.sort((a, b) => b.timestamp - a.timestamp));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `sessions/${sessionId}/alerts`);
    });

    // Listen for interviewer status
    const unsubSession = onSnapshot(doc(db, 'sessions', sessionId), (doc) => {
      const data = doc.data();
      if (data) {
        setInterviewerJoined(!!data.interviewerJoined);
        setInterviewerName(data.interviewerName || 'Recruiter');
      }
    });

    return () => {
      clearInterval(snapshotInterval);
      unsubscribe();
      unsubSession();
    };
  }, [sessionId, status, user]);

  const handleAlert = async (type: AlertType, message: string, confidence: number) => {
    if (!user) return;
    
    const alert: AlertLog = {
      candidateId: user.uid,
      type,
      message,
      confidence,
      timestamp: Date.now(),
    } as any; // Cast because we added candidateId to type in blueprint but not yet in types.ts

    try {
      await addDoc(collection(db, 'sessions', sessionId, 'alerts'), alert);
      
      // Calculate new cheating score (simplified weight)
      setCheatingScore(prev => {
        const increment = type === 'MULTIPLE_FACES' ? 20 : type === 'PHONE_DETECTED' ? 30 : 5;
        const next = Math.min(100, prev + increment);
        
        // Async update to main session
        updateDoc(doc(db, 'sessions', sessionId), {
          cheatingScore: next,
          isFlagged: next > 40
        }).catch(err => {
          handleFirestoreError(err, OperationType.UPDATE, `sessions/${sessionId}`);
        });
        
        return next;
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `sessions/${sessionId}/alerts`);
    }
  };

  const endInterview = async () => {
    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        status: 'COMPLETED',
        endTime: Date.now()
      });
      setStatus('COMPLETED');
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (err) {
      console.error("Error ending interview:", err);
    }
  };

  const toggleCamera = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const newState = !videoTrack.enabled;
        videoTrack.enabled = newState;
        setIsCameraOff(!newState);
        console.log("Camera toggled:", newState ? "ON" : "OFF");
      } else {
        // Stream exists but no video track? Try to restart
        setIsCameraOff(false);
        startCamera();
      }
    } else {
      // No stream at all, just try to start
      setIsCameraOff(false);
      startCamera();
    }
  };

  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const newState = !audioTrack.enabled;
        audioTrack.enabled = newState;
        setIsMicMuted(!newState);
        console.log("Microphone toggled:", newState ? "UNMUTED" : "MUTED");
      }
    }
  };

  const isHighRisk = cheatingScore > 50;
  const isModerateRisk = cheatingScore > 20 && cheatingScore <= 50;

  if (status === 'COMPLETED') {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl p-12 max-w-lg w-full text-center"
        >
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-3xl font-bold mb-2">Interview Completed</h2>
          <p className="text-neutral-500 mb-8">
            Your session has been securely recorded and submitted for review. You can close this window now.
          </p>
          <button
            onClick={onClose}
            className="px-8 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-neutral-800 transition-colors"
          >
            Back to Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  const isIframe = typeof window !== 'undefined' && window.self !== window.top;

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden font-sans relative">
      <Navbar user={user} />
      
      {/* Real-time Suspicious Activity Notification */}
      <AnimatePresence>
        {activeNotification && (
          <motion.div
            key={activeNotification.id}
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-4 bg-red-600 text-white rounded-2xl shadow-2xl flex items-center gap-3 border border-red-500/50"
          >
            <AlertTriangle size={20} className="animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Suspicious Activity</span>
              <span className="text-sm font-bold">{activeNotification.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProctorEngine 
        videoRef={videoRef} 
        onAlert={handleAlert} 
        onLoadingChange={setIsProctorLoading}
        isActive={!isCameraOff}
      />
      
      {!isReady && (
        <div className="absolute inset-0 bg-black z-[70] flex flex-col items-center justify-center text-white p-8 text-center">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md"
            >
              <div className="w-20 h-20 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
                <Video size={40} />
              </div>
              <h2 className="text-3xl font-bold mb-4">Secure Interview Room</h2>
              <p className="text-neutral-400 mb-10 text-sm leading-relaxed">
                You are about to enter a proctored session. We'll need to access your camera to verify your identity and maintain interview integrity.
              </p>
              <button 
                onClick={() => setIsReady(true)}
                className="w-full px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 active:scale-95"
              >
                Start Interview Session
              </button>
              <button 
                onClick={onClose}
                className="mt-6 text-neutral-500 hover:text-white transition-colors text-xs uppercase tracking-widest font-bold"
              >
                Return to Dashboard
              </button>
            </motion.div>
        </div>
      )}

      {isReady && (isCameraStarting || cameraError) && (
        <div className="absolute inset-0 bg-black z-[60] flex flex-col items-center justify-center text-white p-8 text-center">
          {isCameraStarting ? (
            <>
              <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
              <p className="font-bold text-lg italic">Waking up camera...</p>
              <p className="text-sm text-neutral-400 mt-2 max-w-md">
                {isIframe ? "Running inside preview. This may request permissions from your browser." : "Initialising media stream..."}
              </p>
            </>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md"
            >
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-4">Hardware Blocked</h3>
              <div className="text-neutral-400 mb-8 text-sm leading-relaxed">
                {cameraError === 'IFRAME_RESTRICTION' ? (
                  <div className="text-left space-y-4">
                    <p>Browser security prevents camera access inside this "Preview" frame.</p>
                    <div className="bg-blue-600/10 p-4 rounded-xl border border-blue-500/20">
                      <p className="font-bold text-blue-400 mb-2 truncate">Solution:</p>
                      <p>Opening the app in a <b>New Tab</b> is the only way to bypass this restriction.</p>
                    </div>
                  </div>
                ) : cameraError === 'PERMISSION_DENIED' ? (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center justify-center p-6 bg-red-500/10 rounded-2xl border border-red-500/20 mb-4">
                       <Shield size={48} className="text-red-500 mb-3" />
                       <p className="font-bold text-red-500">Access Explicitly Denied</p>
                    </div>
                    <div className="bg-white/5 p-5 rounded-2xl border border-white/10 text-left">
                      <p className="text-xs uppercase tracking-widest font-bold text-amber-500 mb-3">How to unblock:</p>
                      <ol className="space-y-4 text-sm">
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-[10px] flex items-center justify-center font-bold">1</span>
                          <span>Click the <span className="text-white font-bold">Camera/Padlock icon</span> next to the URL in the address bar.</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-[10px] flex items-center justify-center font-bold">2</span>
                          <span>Switch <span className="text-green-500 font-bold">Camera</span> and <span className="text-green-500 font-bold">Microphone</span> to "Allow".</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-[10px] flex items-center justify-center font-bold">3</span>
                          <span>Click <span className="text-blue-400 font-bold underline">Try Again Here</span> or refresh the page.</span>
                        </li>
                      </ol>
                    </div>
                    {isIframe && (
                      <div className="bg-blue-600/10 p-4 rounded-xl border border-blue-500/20 text-xs text-left">
                        <p className="text-blue-400 font-bold mb-1 italic">Pro Tip:</p>
                        Some browsers block this *only* in this preview frame. Try the <span className="text-white font-bold">Open in New Tab</span> button below.
                      </div>
                    )}
                  </div>
                ) : cameraError?.startsWith('RAW_ERROR|') ? (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center justify-center p-6 bg-red-500/10 rounded-2xl border border-red-500/20">
                       <AlertTriangle size={48} className="text-red-500 mb-3" />
                       <p className="font-bold text-red-500">System Error Detected</p>
                       <p className="text-xs text-neutral-400 mt-1 font-mono break-all">{cameraError.split('|')[1]}</p>
                    </div>
                    
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 text-left text-xs text-neutral-400">
                      <p className="font-bold text-neutral-300 mb-2">Likely Causes:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Camera is being used by another application (Zoom, Teams, etc.)</li>
                        <li>Hardware failure or disconnected cable</li>
                        <li>Browser security prevents access in this context</li>
                      </ul>
                    </div>

                    <button 
                      onClick={() => {
                        const errorMsg = cameraError.split('|')[1];
                        navigator.clipboard.writeText(errorMsg).then(() => {
                           // Could add a toast here
                        });
                      }}
                      className="text-[10px] text-blue-400 hover:underline uppercase tracking-widest font-bold"
                    >
                      Copy error for support
                    </button>
                  </div>
                ) : (
                  <p>{cameraError === 'HARDWARE_NOT_FOUND' ? "No webcam found. Please connect a webcam and click 'Try Again'." : "An unexpected error occurred while accessing the camera."}</p>
                )}
              </div>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={startCamera}
                  className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 active:scale-95"
                >
                  <Video size={20} />
                  Try Again Here
                </button>
                <button 
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="px-8 py-3 bg-white/5 border border-white/10 text-white rounded-2xl font-bold hover:bg-white/10 transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <ExternalLink size={16} />
                  Open in New Tab
                </button>
              </div>
            </motion.div>
          )}
          
          {cameraError && isIframe && (
            <div className="mt-8 p-6 bg-neutral-900 rounded-3xl border border-white/5 text-xs text-neutral-400 max-w-sm text-left">
              <p className="mb-3 uppercase tracking-widest text-[10px] font-bold text-blue-500">Why is this happening?</p>
              <p className="leading-relaxed">
                Most browsers block camera access inside nested "Preview" windows for security. 
                <b> Opening the app in a new tab</b> removes this restriction and allows the interview to start immediately.
              </p>
            </div>
          )}
        </div>
      )}
      
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Instructions Overlay */}
      <AnimatePresence>
        {showInstructions && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute top-24 left-8 z-[50] w-80 bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl p-6 border border-white/20"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-neutral-900 flex items-center gap-2">
                <Shield size={18} className="text-blue-600" />
                Interview Guidelines
              </h3>
              <button 
                onClick={() => setShowInstructions(false)}
                className="text-neutral-400 hover:text-neutral-900 transition-colors"
              >
                <RefreshCw size={14} className="rotate-45" />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">Rules & Conduct</p>
                <ul className="space-y-4">
                  <li className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold">1</span>
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed font-medium">
                      Stay centered within the camera frame at all times.
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold">2</span>
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed font-medium">
                      Ensure your face is clearly visible and well-lit.
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold">3</span>
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed font-medium">
                      Mobile phones, books, and other people must not be present.
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold">4</span>
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed font-medium">
                      AI Assistants, screen overlays, and external tools are strictly prohibited.
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold">5</span>
                    </div>
                    <p className="text-xs text-neutral-600 leading-relaxed font-medium">
                      Switching tabs or losing window focus will be flagged as suspicious.
                    </p>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-neutral-100">
                <div className="flex items-center gap-2 text-amber-600 mb-2">
                  <AlertTriangle size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">AI Protection Active</span>
                </div>
                <p className="text-[10px] text-neutral-500 leading-relaxed italic">
                  This system detects Interview Coder, ChatGPT overlays, and screen-reading AI patterns.
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => setShowInstructions(false)}
              className="w-full mt-8 py-3 bg-neutral-900 text-white rounded-xl text-xs font-bold hover:bg-neutral-800 transition-colors"
            >
              Got it, thanks
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative bg-black">
        <div 
          onClick={async () => {
            const v = videoRef.current;
            if (v) {
              try {
                // If it's paused or not active, try to play
                await v.play();
                console.log("Manual play success via container click");
                if (v.videoWidth > 0) setStreamActive(true);
              } catch (e) {
                console.warn("Manual play failed:", e);
                // Last ditch: re-assign srcObject
                if (stream) {
                  v.srcObject = stream;
                  v.play().catch(() => {});
                }
              }
            }
          }}
          className="relative w-full max-w-7xl aspect-video bg-black rounded-[3rem] overflow-hidden border-8 border-neutral-900 shadow-2xl group cursor-pointer shadow-[0_0_100px_rgba(0,0,0,0.5)]"
        >
          {/* Scanning Line Effect */}
          <motion.div 
            animate={{ top: ["0%", "100%", "0%"] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute left-0 right-0 h-px bg-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.5)] z-20 pointer-events-none"
          />

          {/* Decorative Corner Markers */}
          <div className="absolute inset-8 z-30 pointer-events-none">
             <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/20 rounded-tl-2xl" />
             <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/20 rounded-tr-2xl" />
             <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/20 rounded-bl-2xl" />
             <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/20 rounded-br-2xl" />
             
             {/* Pulsing Status Dot */}
             <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 glass rounded-full">
                <motion.div 
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={`w-2 h-2 rounded-full ${isProctorLoading ? 'bg-amber-500' : 'bg-green-500'}`}
                />
                <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-900">
                  {isProctorLoading ? 'AI Initializing' : 'AI Protection Live'}
                </span>
             </div>
          </div>

          <video
            key={videoKey}
            ref={videoRef}
            autoPlay
            muted
            playsInline
            onPlaying={() => setStreamActive(true)}
            onLoadedData={() => setStreamActive(true)}
            onLoadedMetadata={(e) => {
              const video = e.currentTarget;
              video.muted = true;
              video.play().catch(err => {
                console.warn("Autoplay blocked:", err);
              });
            }}
            className="w-full h-full object-cover bg-black scale-x-[-1]"
          />

          {isCameraOff && (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                toggleCamera();
              }}
              className="absolute inset-0 bg-neutral-900/95 backdrop-blur-sm flex flex-col items-center justify-center text-white z-10 cursor-pointer group/pause"
            >
              <div className="w-24 h-24 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-6 group-hover/pause:scale-110 group-hover/pause:bg-red-500/20 transition-all duration-300">
                <VideoOff size={48} />
              </div>
              <p className="font-bold text-2xl">Camera Paused</p>
            </div>
          )}


          
          {/* Interviewer Video placeholder */}
          <AnimatePresence>
            {interviewerJoined && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 20 }}
                className="absolute top-6 right-6 w-48 aspect-video bg-neutral-800 rounded-2xl border-2 border-blue-500/50 overflow-hidden shadow-2xl z-20"
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/30 gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse">
                    <Video size={16} className="text-blue-400" />
                  </div>
                  <span className="text-[8px] font-bold uppercase tracking-widest">Live Video Active</span>
                </div>
                <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded-lg backdrop-blur-sm shadow-lg">
                  <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[8px] font-bold text-white uppercase tracking-wider">{interviewerName} (Admin)</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
            <div className="bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-2xl flex flex-col">
              <span className="text-[10px] text-white/60 uppercase font-bold tracking-widest">Candidate</span>
              <span className="text-sm font-medium text-white">{profile?.displayName || user?.displayName || user?.email || 'Guest'}</span>
            </div>

            {isMicMuted && (
              <button 
                onClick={toggleMic}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600 hover:bg-red-700 backdrop-blur-md border border-red-400/50 px-4 py-1.5 rounded-full flex items-center gap-2 z-30 transition-all font-bold text-white shadow-xl active:scale-95"
              >
                <MicOff size={14} />
                <span className="text-[10px] uppercase tracking-widest">Unmute Mic</span>
              </button>
            )}

            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setShowInstructions(!showInstructions);
                }}
                title="View Instructions"
                className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all backdrop-blur-md ${showInstructions ? 'bg-blue-600 text-white' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}`}
              >
                <Info size={20} />
              </button>
              <button 
                onClick={toggleMic}
                title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
                className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all backdrop-blur-md ${isMicMuted ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}`}
              >
                {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button 
                onClick={toggleCamera}
                title={isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
                className={`w-12 h-12 flex items-center justify-center rounded-2xl transition-all backdrop-blur-md ${isCameraOff ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'}`}
              >
                {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
              </button>
              <button 
                onClick={endInterview}
                className="px-6 h-12 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold flex items-center gap-2 transition-colors shadow-lg shadow-red-600/30"
              >
                <Power size={18} />
                End Session
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
