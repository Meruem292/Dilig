import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import {
  type User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../config/firebase';
import type { UserProfile, SoilThresholds } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateThresholds: (thresholds: SoilThresholds) => Promise<void>;
  friendlyError: (error: unknown) => string;
}

const DEFAULT_THRESHOLDS: SoilThresholds = {
  dryMoistureMax: 30, // below 30% is Dry
  wetMoistureMin: 70, // above 70% is Wet
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Friendly error translator for farmers
  const friendlyError = (error: unknown): string => {
    if (!error || typeof error !== 'object') return 'An unexpected error occurred. Please try again.';
    const err = error as { code?: string; message?: string };
    
    switch (err.code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Incorrect email or password. Please verify your details.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Try signing in instead.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters long.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/too-many-requests':
        return 'Too many sign-in attempts. Please wait a few moments and try again.';
      case 'auth/network-request-failed':
        return 'Network connection issue. Please check your internet connection.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      default:
        return err.message || 'Action failed. Please try again.';
    }
  };

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user && db) {
        // Listen to user profile document in Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const unsubProfile = onSnapshot(userDocRef, (snapshot) => {
          if (snapshot.exists()) {
            setUserProfile(snapshot.data() as UserProfile);
          } else {
            // First time login: create user doc
            const initialProfile: UserProfile = {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || user.email?.split('@')[0] || 'Farmer',
              createdAt: new Date().toISOString(),
              thresholds: DEFAULT_THRESHOLDS,
            };
            setDoc(userDocRef, initialProfile, { merge: true }).catch(console.error);
            setUserProfile(initialProfile);
          }
        });

        setLoading(false);
        return () => unsubProfile();
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, pass: string) => {
    if (!auth) throw new Error('Firebase Authentication is not configured.');
    await signInWithEmailAndPassword(auth, email.trim(), pass);
  };

  const signUp = async (email: string, pass: string, name: string) => {
    if (!auth || !db) throw new Error('Firebase Authentication is not configured.');
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    if (name.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() });
    }
    const initialProfile: UserProfile = {
      uid: cred.user.uid,
      email: cred.user.email,
      displayName: name.trim() || cred.user.email?.split('@')[0] || 'Farmer',
      createdAt: new Date().toISOString(),
      thresholds: DEFAULT_THRESHOLDS,
    };
    await setDoc(doc(db, 'users', cred.user.uid), initialProfile, { merge: true });
    setUserProfile(initialProfile);
  };

  const signOut = async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
    setUserProfile(null);
    setCurrentUser(null);
  };

  const resetPassword = async (email: string) => {
    if (!auth) throw new Error('Firebase Authentication is not configured.');
    await sendPasswordResetEmail(auth, email.trim());
  };

  const updateThresholds = async (thresholds: SoilThresholds) => {
    if (!currentUser || !db) throw new Error('User not authenticated.');
    const userDocRef = doc(db, 'users', currentUser.uid);
    await setDoc(userDocRef, { thresholds }, { merge: true });
    setUserProfile((prev) => prev ? { ...prev, thresholds } : null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        isConfigured: isFirebaseConfigured,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updateThresholds,
        friendlyError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
