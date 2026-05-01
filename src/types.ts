export type UserRole = 'ADMIN' | 'CANDIDATE';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: number;
  settings?: {
    desktopNotify: boolean;
    emailSummary: boolean;
    autoAnalyze: boolean;
    highPrivacy: boolean;
  };
}

export interface InterviewSession {
  id: string;
  candidateId: string;
  candidateName: string;
  startTime: number;
  endTime?: number;
  status: 'PENDING' | 'ONGOING' | 'COMPLETED';
  cheatingScore: number; // 0 to 100
  alerts: AlertLog[];
  screenshots: string[]; // storage paths or base64 (prefer storage)
  lastScreenshot?: string; // latest base64 snapshot for live monitoring
  interviewerJoined?: boolean;
  interviewerName?: string;
}

export interface AlertLog {
  candidateId: string;
  timestamp: number;
  type: AlertType;
  message: string;
  confidence: number;
}

export type AlertType = 
  | 'LOOKING_AWAY' 
  | 'MULTIPLE_FACES' 
  | 'NO_FACE_DETECTED' 
  | 'PHONE_DETECTED' 
  | 'BOOK_DETECTED' 
  | 'SUSPICIOUS_OBJECT'
  | 'WINDOW_LOST_FOCUS'
  | 'SCREEN_CAPTURE_DETECTED';

export interface ProctoringState {
  isSafe: boolean;
  warnings: string[];
  cheatingScore: number;
}
