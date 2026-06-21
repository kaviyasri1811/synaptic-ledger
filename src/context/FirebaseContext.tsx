import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User } from '../../types';

interface FirebaseContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isAuthReady: boolean;
}

const FirebaseContext = createContext<FirebaseContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
  isAuthReady: false,
});

export const useFirebase = () => useContext(FirebaseContext);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (fUser) => {
      setFirebaseUser(fUser);
      setIsAuthReady(true);
      
      if (!fUser) {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (firebaseUser) {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setUser(docSnap.data() as User);
        } else {
          // If user doc doesn't exist yet, we might need to create it on login
          setUser(null);
        }
        setLoading(false);
      }, (error) => {
        console.error("Error fetching user doc:", error);
        setLoading(false);
      });

      return () => unsubscribeUser();
    }
  }, [firebaseUser]);

  return (
    <FirebaseContext.Provider value={{ user, firebaseUser, loading, isAuthReady }}>
      {children}
    </FirebaseContext.Provider>
  );
};
