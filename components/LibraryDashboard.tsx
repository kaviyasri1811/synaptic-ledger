import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Book, Users, Building2, Bell, LogOut, LayoutDashboard, Search, BookOpenCheck, Clock, Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { User } from '../types';
import { motion } from 'framer-motion';
import Books from './library/Books';
import Issues from './library/Issues';
import Members from './library/Members';
import Departments from './library/Departments';
import Notifications from './library/Notifications';
import Reservations from './library/Reservations';
import { firestoreService } from '../src/services/firestoreService';
import { orderBy, limit, where, QueryConstraint } from 'firebase/firestore';

interface LibraryDashboardProps {
  user: User;
  onLogout: () => void;
}

const FINE_PER_DAY = 5.0;

const calculateFine = (dueDateStr: string, returnDateStr?: string) => {
  const dueDate = new Date(dueDateStr);
  const compareDate = returnDateStr ? new Date(returnDateStr) : new Date();
  dueDate.setHours(0, 0, 0, 0);
  compareDate.setHours(0, 0, 0, 0);
  if (compareDate <= dueDate) return 0;
  const diffTime = Math.abs(compareDate.getTime() - dueDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays * FINE_PER_DAY;
};

const LibraryDashboard: React.FC<LibraryDashboardProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchRecentActivity = async () => {
      const constraints: QueryConstraint[] = [orderBy('issueDate', 'desc')];
      if (user.role !== 'admin' && user.role !== 'hod') {
        constraints.push(where('userId', '==', user.uid));
      }
      
      const unsubscribe = firestoreService.subscribeToCollection('bookIssues', constraints, async (data) => {
        let filtered = data;
        if (user.role === 'hod') {
          const deptUsers = await firestoreService.getCollection<User>('users', [where('departmentId', '==', user.departmentId || '')]);
          const deptUserIds = deptUsers.map(u => u.uid);
          filtered = data.filter((i: any) => deptUserIds.includes(i.userId));
        }
        
        const enriched = await Promise.all(filtered.slice(0, 5).map(async (issue: any) => {
          const book = await firestoreService.getDoc<any>('books', issue.bookId);
          const member = await firestoreService.getDoc<User>('users', issue.userId);
          return {
            ...issue,
            title: book?.title || 'Unknown Book',
            userName: member?.name || 'Unknown User'
          };
        }));
        
        setRecentActivity(enriched);
      });
      return unsubscribe;
    };

    let unsub: any;
    fetchRecentActivity().then(u => unsub = u);
    
    fetchStats();

    return () => {
      if (unsub) unsub();
    };
  }, [user]);

  const fetchStats = async () => {
    try {
      // In a real app, we'd use aggregation or cloud functions for these counts
      // For this demo, we'll fetch and count
      const allBooks = await firestoreService.getCollection('books');
      const allIssues = await firestoreService.getCollection('bookIssues', [where('status', '==', 'issued')]);
      const allMembers = await firestoreService.getCollection('users', [where('role', '!=', 'admin')]);

      if (user.role === 'admin') {
        setStats({
          totalBooks: allBooks?.reduce((acc: number, b: any) => acc + (b.totalCopies || 0), 0) || 0,
          totalMembers: allMembers?.length || 0,
          issuedBooks: allIssues?.length || 0,
          overdueBooks: allIssues?.filter((i: any) => i.status === 'overdue').length || 0,
        });
      } else if (user.role === 'hod') {
        const deptMembers = allMembers?.filter((m: any) => m.departmentId === user.departmentId) || [];
        const deptMemberIds = deptMembers.map((m: any) => m.uid);
        const deptIssues = allIssues?.filter((i: any) => deptMemberIds.includes(i.userId)) || [];
        setStats({
          totalBooks: allBooks?.reduce((acc: number, b: any) => acc + (b.totalCopies || 0), 0) || 0,
          totalMembers: deptMembers.length,
          issuedBooks: deptIssues.length,
          overdueBooks: deptIssues.filter((i: any) => i.status === 'overdue').length,
        });
      } else {
        const myIssues = await firestoreService.getCollection('bookIssues', [where('userId', '==', user.uid)]);
        setStats({
          myIssues: myIssues?.filter((i: any) => i.status === 'issued').length || 0,
          myFines: myIssues?.reduce((acc: number, i: any) => {
            const fine = i.status === 'returned' ? (i.fineAmount || 0) : calculateFine(i.dueDate);
            return acc + fine;
          }, 0) || 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats', error);
    }
  };

  const navItems = [
    { path: '/library', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'hod', 'student', 'faculty'] },
    { path: '/library/books', label: 'Catalog', icon: Book, roles: ['admin', 'hod', 'student', 'faculty'] },
    { path: '/library/issues', label: 'Issues & Returns', icon: BookOpenCheck, roles: ['admin', 'hod', 'student', 'faculty'] },
    { path: '/library/reservations', label: 'Reservations', icon: Clock, roles: ['admin', 'hod', 'student', 'faculty'] },
    { path: '/library/members', label: 'Members', icon: Users, roles: ['admin', 'hod'] },
    { path: '/library/departments', label: 'Departments', icon: Building2, roles: ['admin'] },
    { path: '/library/notifications', label: 'Notifications', icon: Bell, roles: ['admin', 'hod', 'student', 'faculty'] },
  ];

  const filteredNav = navItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="flex flex-row h-screen bg-transparent relative overflow-hidden">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full md:w-64 md:translate-x-0'} absolute md:relative z-50 h-full transition-all duration-500 bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl border-r border-white/20 dark:border-white/5 flex flex-col overflow-hidden shrink-0 shadow-2xl md:shadow-none`}>
        <div className="w-64 h-full flex flex-col">
          <div className="p-6 flex flex-col justify-start items-start relative">
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden absolute right-4 top-4 p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
              <Book className="w-6 h-6" />
              LIBRARY
            </h2>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">
              {user.role} Portal
            </p>
          </div>

          <nav className="flex-1 px-4 space-y-2 overflow-y-auto flex flex-col pb-4">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => { if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 whitespace-nowrap ${
                    isActive 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="p-6 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user.name}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors font-bold text-sm"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative h-full overflow-y-auto w-full p-4 md:p-8 pt-16 md:pt-8">
        {/* Sidebar Toggle */}
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="absolute left-4 top-4 z-40 w-10 h-10 md:hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/20 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-xl hover:scale-110 transition-all"
        >
          <Menu size={20} />
        </button>

        <Routes>
          <Route path="/" element={
            <div className="space-y-6 md:space-y-8">
              <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Welcome back, {user.name}</h1>
                  <p className="text-sm md:text-base text-slate-500">Here's what's happening in the library today.</p>
                </div>
              </header>

              {/* Stats Grid */}
              {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  {Object.entries(stats).map(([key, value], i) => (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-4 md:p-6 border border-slate-200 dark:border-slate-800"
                    >
                      <p className="text-xs md:text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </p>
                      <p className="text-3xl md:text-4xl font-light text-slate-900 dark:text-white">
                        {key.toLowerCase().includes('fine') ? `₹${value}` : value as React.ReactNode}
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Recent Activity */}
              <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {recentActivity.length === 0 ? (
                    <div className="p-4 md:p-6 text-center text-slate-500 text-sm">No recent activity</div>
                  ) : (
                    recentActivity.map((activity, i) => (
                      <div key={i} className="p-3 md:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className={`p-2 rounded-lg shrink-0 ${
                            activity.status === 'issued' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' :
                            activity.status === 'returned' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' :
                            'bg-red-100 text-red-600 dark:bg-red-900/30'
                          }`}>
                            <Clock className="w-4 h-4 md:w-5 md:h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm md:text-base text-slate-900 dark:text-white truncate">{activity.title}</p>
                            <p className="text-xs md:text-sm text-slate-500 truncate">
                              {activity.status === 'issued' ? 'Issued to' : 'Returned by'} {activity.userName || 'You'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto pl-11 sm:pl-0">
                          <span className={`inline-flex items-center px-2 py-0.5 md:px-2.5 md:py-0.5 rounded-full text-[10px] md:text-xs font-medium capitalize ${
                            activity.status === 'issued' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                            activity.status === 'returned' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' :
                            'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                          }`}>
                            {activity.status}
                          </span>
                          <p className="text-[10px] md:text-xs text-slate-500 mt-0 sm:mt-1">
                            {new Date(activity.issueDate || activity.returnDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          } />
          
          <Route path="/books" element={<Books user={user} />} />
          <Route path="/issues" element={<Issues user={user} />} />
          <Route path="/reservations" element={<Reservations user={user} />} />
          <Route path="/members" element={<Members user={user} />} />
          <Route path="/departments" element={<Departments user={user} />} />
          <Route path="/notifications" element={<Notifications user={user} />} />
        </Routes>
      </main>
    </div>
  );
};

export default LibraryDashboard;
