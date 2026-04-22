import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, browserSessionPersistence, setPersistence, reauthenticateWithCredential, EmailAuthProvider, updatePassword } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const EMAIL_DOMAIN = '@gmail.com';
const EMAIL_PREFIX = 'idfrwst+';

function usernameToEmail(username) {
  return `${EMAIL_PREFIX}${username.toLowerCase().trim()}${EMAIL_DOMAIN}`;
}

function emailToUsername(email) {
  if (!email) return '';
  const match = email.match(/\+(.+)@/);
  return match ? match[1] : email.split('@')[0];
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userRoles, setUserRoles] = useState(null);
  const [userDisplayName, setUserDisplayName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubRoles = null;

    setPersistence(auth, browserSessionPersistence).then(() => {
      const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
        if (unsubRoles) { unsubRoles(); unsubRoles = null; }

        if (firebaseUser) {
          setUser(firebaseUser);

          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            await setDoc(userRef, {
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || emailToUsername(firebaseUser.email),
              orgs: {},
              createdAt: serverTimestamp(),
            });
          }

          unsubRoles = onSnapshot(userRef, (snap) => {
            const data = snap.data();
            setUserRoles(data?.orgs || {});
            setUserDisplayName(data?.displayName || emailToUsername(firebaseUser.email));
            setLoading(false);
          });
        } else {
          setUser(null);
          setUserRoles(null);
          setLoading(false);
        }
      });

      return () => {
        unsubAuth();
        if (unsubRoles) unsubRoles();
      };
    });
  }, []);

  const signIn = async (username, password) => {
    const email = usernameToEmail(username);
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = () => firebaseSignOut(auth);

  const changePassword = async (currentPassword, newPassword) => {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  };

  return (
    <AuthContext.Provider value={{ user, loading, userRoles, userDisplayName, signIn, signOut, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
