import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type UserRole = 'Pending' | 'Admin' | 'President' | 'Collector';

export interface UserProfile {
  email: string;
  role: UserRole;
  name: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  errorDetails: string | null;
  accessToken: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
          setAccessToken(null);
      }
      if (firebaseUser) {
        try {
          let userDoc;
          try {
              userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          } catch (fetchError) {
              throw fetchError;
          }

          if (userDoc.exists()) {
            const currentProfile = userDoc.data() as UserProfile;
            const isBootstrapAdmin = firebaseUser.email === 'greene.smm.1@gmail.com';
            
            // Self-promote the bootstrap admin if stuck on Pending
            if (isBootstrapAdmin && currentProfile.role === 'Pending') {
               await updateDoc(doc(db, 'users', firebaseUser.uid), {
                  role: 'Admin',
                  updatedAt: serverTimestamp()
               });
               setProfile({ ...currentProfile, role: 'Admin' });
               localStorage.setItem('cached_profile_' + firebaseUser.uid, JSON.stringify({ ...currentProfile, role: 'Admin' }));
            } else {
               setProfile(currentProfile);
               localStorage.setItem('cached_profile_' + firebaseUser.uid, JSON.stringify(currentProfile));
            }
          } else {
            // New user registration
            const isBootstrapAdmin = firebaseUser.email === 'greene.smm.1@gmail.com';
            const newProfile: UserProfile = {
              email: firebaseUser.email || '',
              role: isBootstrapAdmin ? 'Admin' : 'Pending',
              name: firebaseUser.displayName || 'Unknown',
            };
            
            // Only required fields needed here, createdAt is handled serverTimestamp
            await setDoc(doc(db, 'users', firebaseUser.uid), {
                ...newProfile,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            setProfile(newProfile);
            localStorage.setItem('cached_profile_' + firebaseUser.uid, JSON.stringify(newProfile));
          }
          setErrorDetails(null);
        } catch (error: any) {
          console.error("Error fetching user profile:", error);
          const cachedProfile = localStorage.getItem('cached_profile_' + firebaseUser.uid);
          if (cachedProfile && (error.message.includes('offline') || error.message.includes('network'))) {
            setProfile(JSON.parse(cachedProfile));
            setErrorDetails(null);
          } else {
            setErrorDetails(error?.message || String(error));
            setProfile(null);
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/spreadsheets');
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
          setAccessToken(credential.accessToken);
      }
      setErrorDetails(null);
    } catch (error: any) {
      console.error("Error signing in with Google", error);
      setErrorDetails(error?.message || String(error));
      throw error;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setAccessToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, errorDetails, accessToken, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
