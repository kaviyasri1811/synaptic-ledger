import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import StudentDashboard from './components/StudentDashboard';
import ThemeToggle from './components/ThemeToggle';
import Landing from './components/Landing';
import LibraryDashboard from './components/LibraryDashboard';
import { FirebaseProvider, useFirebase } from './src/context/FirebaseContext';
import { auth } from './src/firebase';
import { signOut } from 'firebase/auth';

const AppContent: React.FC = () => {
  const { user, loading, isAuthReady } = useFirebase();
  const location = useLocation();

  useEffect(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  if (!isAuthReady || loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-transparent text-slate-900 dark:text-white">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-indigo-600 dark:text-indigo-400 font-bold tracking-widest uppercase">Initializing Neural Link...</p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut(auth);
  };

  const appType = new URLSearchParams(location.search).get('app') as 'chatbot' | 'library' || 'chatbot';

  return (
    <div className="h-screen flex flex-col font-sans transition-colors duration-500 relative z-10 overflow-hidden bg-transparent">
      <ThemeToggle />
      <Routes>
        <Route path="/" element={<Landing />} />
        
        <Route 
          path="/login" 
          element={
            appType === 'library' ? (
              user ? <Navigate to="/library" /> : <Login appType="library" />
            ) : (
              user ? <Navigate to={user.role === 'admin' ? '/admin' : '/student'} /> : <Login appType="chatbot" />
            )
          } 
        />
        
        {/* Chatbot Routes */}
        <Route 
          path="/admin/*" 
          element={user?.role === 'admin' ? <AdminDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login?app=chatbot" />} 
        />
        <Route 
          path="/student/*" 
          element={user && user.role !== 'admin' ? <StudentDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login?app=chatbot" />} 
        />
        
        {/* Library Routes */}
        <Route 
          path="/library/*" 
          element={user ? <LibraryDashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login?app=library" />} 
        />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <FirebaseProvider>
      <Router>
        <AppContent />
      </Router>
    </FirebaseProvider>
  );
};

export default App;
