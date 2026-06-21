import React, { useState } from 'react';
import { auth, db } from '../src/firebase';
import { GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { BrainCircuit, Loader2, BookOpen, Chrome, Mail, Lock, UserPlus, LogIn } from 'lucide-react';

interface LoginProps {
  appType: 'chatbot' | 'library';
}

const Login: React.FC<LoginProps> = ({ appType }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [userRole, setUserRole] = useState<'student' | 'admin' | 'hod'>('student');

  const handleManualAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all required fields');
      return;
    }
    if (isRegistering && !name) {
      setError('Please enter your full name for registration');
      return;
    }

    setLoading(true);
    setError('');
    try {
      let userCredential;
      if (isRegistering) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }
      
      const user = userCredential.user;
      await syncUserToFirestore(user, name || user.displayName || 'Anonymous');
    } catch (err: any) {
      console.error("Auth error:", err);
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const syncUserToFirestore = async (user: any, displayName: string) => {
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      const finalName = displayName.trim();
      const isAuthorizedAdmin = user.email === 'synapticledger@gmail.com';
      
      if (userRole === 'admin' && !isAuthorizedAdmin) {
        await auth.signOut();
        throw new Error("Your email is not authorized for Admin access. Please sign in as a Student.");
      }

      if (userRole === 'hod') {
        await auth.signOut();
        throw new Error("Your email is not authorized for HOD access. Please contact Admin to assign you as HOD.");
      }

      const finalRole = userRole === 'admin' && isAuthorizedAdmin ? 'admin' : 'student';
      
      await setDoc(userDocRef, {
        uid: user.uid,
        name: finalName,
        email: user.email,
        role: finalRole,
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        queriesToday: 0
      });
    } else {
      const isAuthorizedAdmin = user.email === 'synapticledger@gmail.com';
      
      if (userRole === 'admin' && !isAuthorizedAdmin) {
        await auth.signOut();
        throw new Error("Your email is not authorized for Admin access. Please sign in as a Student.");
      }

      if (userRole === 'hod' && userDoc.data().role !== 'hod') {
        await auth.signOut();
        throw new Error("Your email is not authorized for HOD access. Please contact Admin to assign you as HOD.");
      }

      const updateData: any = { lastActive: serverTimestamp() };
      if (userRole === 'admin' && isAuthorizedAdmin) {
        updateData.role = 'admin';
      }
      await setDoc(userDocRef, updateData, { merge: true });
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      const result = await signInWithPopup(auth, provider);
      await syncUserToFirestore(result.user, name || result.user.displayName || 'Anonymous');
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto flex flex-col items-center justify-start md:justify-center p-4 pt-24 pb-12 md:p-8 relative custom-scrollbar">
      <div className="fixed inset-0 bg-slate-950 -z-10">
        <div className={`absolute top-1/4 left-1/4 w-64 h-64 md:w-96 md:h-96 rounded-full blur-3xl animate-pulse-soft ${appType === 'chatbot' ? 'bg-indigo-600/20' : 'bg-emerald-600/20'}`}></div>
        <div className={`absolute bottom-1/4 right-1/4 w-64 h-64 md:w-96 md:h-96 rounded-full blur-3xl animate-pulse-soft ${appType === 'chatbot' ? 'bg-purple-600/20' : 'bg-teal-600/20'}`} style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="w-full max-w-md relative z-10 m-auto">
        <div className="bg-white/10 dark:bg-slate-900/50 backdrop-blur-2xl p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-white/20 dark:border-slate-800 shadow-2xl">
          <div className="flex justify-center mb-6 md:mb-8">
            <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center shadow-lg ${appType === 'chatbot' ? 'bg-indigo-600 shadow-indigo-500/30' : 'bg-emerald-600 shadow-emerald-500/30'}`}>
              {appType === 'chatbot' ? <BrainCircuit size={28} className="text-white md:w-8 md:h-8" /> : <BookOpen size={28} className="text-white md:w-8 md:h-8" />}
            </div>
          </div>
          
          <h2 className="text-xl md:text-2xl font-black text-center text-white mb-2 tracking-tight uppercase">
            {appType === 'chatbot' ? 'AI Chatbot' : 'Digital Library'}
          </h2>
          <p className="text-slate-400 text-center text-xs md:text-sm font-medium mb-6 md:mb-8">
            {isRegistering ? 'Create your account' : 'Welcome back, sign in to continue.'}
          </p>

          <form onSubmit={handleManualAuth} className="space-y-4 mb-6">
            {isRegistering && (
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Full Name</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    <UserPlus size={16} />
                  </span>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full pl-12 pr-4 py-3 bg-white/5 dark:bg-slate-950/50 border border-white/10 dark:border-slate-800 rounded-xl text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Email Address</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Mail size={16} />
                </span>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 dark:bg-slate-950/50 border border-white/10 dark:border-slate-800 rounded-xl text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Password</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock size={16} />
                </span>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 dark:bg-slate-950/50 border border-white/10 dark:border-slate-800 rounded-xl text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">User Type</label>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  type="button"
                  onClick={() => setUserRole('student')}
                  className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${userRole === 'student' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                >
                  Student
                </button>
                <button 
                  type="button"
                  onClick={() => setUserRole('hod')}
                  className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${userRole === 'hod' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                >
                  HOD
                </button>
                <button 
                  type="button"
                  onClick={() => setUserRole('admin')}
                  className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${userRole === 'admin' ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
                >
                  Admin
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : (
                <>
                  {isRegistering ? <UserPlus size={18} /> : <LogIn size={18} />}
                  {isRegistering ? 'Create Account' : 'Sign In'}
                </>
              )}
            </button>
          </form>

          <div className="relative flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/10"></div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">or continue with</span>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 mb-6"
          >
            <Chrome size={18} />
            Google Account
          </button>

          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="w-full text-center text-[10px] text-indigo-400 hover:text-indigo-300 font-black uppercase tracking-widest transition-colors mb-6"
          >
            {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Register now"}
          </button>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px] font-medium text-center">
              {error}
            </div>
          )}

          <p className="mt-8 text-center text-[8px] text-slate-500 font-bold uppercase tracking-[0.2em]">
            Protected by Firebase Security
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
