import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  loginEmail: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  setRole: (role: UserRole) => void;
  updateProfileData: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const isStaffEmail = 
          user.email === 'iamprashanth.97@gmail.com' || 
          user.email === 'prashanth97@gmail.com' ||
          user.email === 'prashanth221@gmail.com' ||
          user.email === 'prashanth28@gmail.com';
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          } else {
            // This path is mainly for Google Login or if registration failed to write profile
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'User',
              role: isStaffEmail ? 'ADMIN' : 'CANDIDATE',
              createdAt: Date.now(),
            };
            await setDoc(doc(db, 'users', user.uid), newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const register = async (email: string, pass: string, name: string, role: UserRole) => {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(res.user, { displayName: name });
    
    const newProfile: UserProfile = {
      uid: res.user.uid,
      email: email,
      displayName: name,
      role: role,
      createdAt: Date.now(),
    };
    
    await setDoc(doc(db, 'users', res.user.uid), newProfile);
    setProfile(newProfile);
  };

  const logout = async () => {
    await signOut(auth);
  };

  const setRole = (role: UserRole) => {
    if (profile) {
      setProfile({ ...profile, role });
    }
  };

  const updateProfileData = async (data: Partial<UserProfile>) => {
    if (!user || !profile) return;
    
    try {
      const updatedProfile = { ...profile, ...data };
      await setDoc(doc(db, 'users', user.uid), updatedProfile);
      
      if (data.displayName) {
        await updateProfile(user, { displayName: data.displayName });
      }
      
      setProfile(updatedProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, loginEmail, register, logout, setRole, updateProfileData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
