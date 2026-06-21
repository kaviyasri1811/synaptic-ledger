
import React, { useState, useEffect } from 'react';
import { Document, User } from '../types';
import { Upload, FileText, Trash2, Loader2, Database, Search, FolderOpen, AlertCircle, Users, Activity, BookOpen, BarChart3, LogOut, Server, Cpu, Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { extractDataFromPDF } from '../services/pdfProcessor';
import { firestoreService } from '../src/services/firestoreService';
import { orderBy, limit } from 'firebase/firestore';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'materials' | 'insights' | 'users'>('overview');
  const [analytics, setAnalytics] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [newSubject, setNewSubject] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubscribeDocs = firestoreService.subscribeToCollection<Document>('documents', [orderBy('uploadedAt', 'desc')], (data) => {
      const processedDocs = data.map(doc => ({
        ...doc,
        images: typeof doc.images === 'string' ? JSON.parse(doc.images) : doc.images
      }));
      setDocuments(processedDocs);
    });

    const unsubscribeSubjects = firestoreService.subscribeToCollection<any>('subjects', [orderBy('name', 'asc')], (data) => {
      setSubjects(data);
    });

    const unsubscribeUsers = firestoreService.subscribeToCollection<User>('users', [], (data) => {
      setAllUsers(data);
    });

    const unsubscribeDepartments = firestoreService.subscribeToCollection<any>('departments', [], (data) => {
      setDepartments(data);
    });

    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000);

    return () => {
      unsubscribeDocs();
      unsubscribeSubjects();
      unsubscribeUsers();
      unsubscribeDepartments();
      clearInterval(interval);
    };
  }, []);

  const fetchAnalytics = async () => {
    try {
      const users = await firestoreService.getCollection('users');
      const docs = await firestoreService.getCollection('documents');
      const sessions = await firestoreService.getCollection('chatSessions');
      
      const now = new Date().getTime();
      const oneDay = 24 * 60 * 60 * 1000;
      const fiveMins = 5 * 60 * 1000;

      const processedUsers = users.map((u: any) => {
        let lastActiveTime = 0;
        if (u.lastActive) {
          if (typeof u.lastActive === 'object' && u.lastActive.toDate) {
            lastActiveTime = u.lastActive.toDate().getTime();
          } else if (typeof u.lastActive === 'string') {
            lastActiveTime = new Date(u.lastActive).getTime();
          } else if (u.lastActive?.seconds) {
            lastActiveTime = u.lastActive.seconds * 1000;
          }
        }
        return { ...u, lastActiveTime };
      });

      const loggedInTodayCount = processedUsers.filter(u => (now - u.lastActiveTime) < oneDay).length;
      const liveStudents = processedUsers.filter(u => u.role === 'student' && (now - u.lastActiveTime) < fiveMins);
      
      setAnalytics({
        overview: {
          totalRegistered: users.length,
          loggedInToday: loggedInTodayCount,
          currentlyActive: liveStudents.length,
          totalQueries: sessions.reduce((acc: number, s: any) => acc + (s.messageCount || 0), 0),
        },
        liveStudents: liveStudents
      });
    } catch (err) {
      console.error('Failed to fetch analytics', err);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim()) return;
    try {
      await firestoreService.addDoc('subjects', { name: newSubject });
      setNewSubject('');
    } catch (err) {
      console.error('Failed to add subject', err);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    try {
      await firestoreService.deleteDoc('subjects', id);
    } catch (err) {
      console.error('Failed to delete subject', err);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      await firestoreService.deleteDoc('documents', id);
    } catch (err) {
      console.error('Failed to delete document', err);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'student' | 'faculty' | 'hod' | 'admin') => {
    try {
      await firestoreService.updateDoc('users', userId, { role: newRole });
    } catch (err) {
      console.error('Failed to update user role', err);
      alert('Failed to update user role. Ensure you have the necessary permissions.');
    }
  };

  const handleDepartmentChange = async (userId: string, newDepartmentId: string) => {
    try {
      await firestoreService.updateDoc('users', userId, { departmentId: newDepartmentId });
    } catch (err) {
      console.error('Failed to update user department', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadStatus('Syncing Materials...');
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type !== 'application/pdf') continue;
        
        const { text, images } = await extractDataFromPDF(file);

        // Firestore has a strict 1MB (1,048,576 bytes) limit per document. 
        // We need to ensure the text and images don't exceed this.
        // A safe estimate is 1 character = 2-3 bytes for UTF-8. We'll limit text to ~300,000 characters to be absolutely safe.
        const MAX_TEXT_LENGTH = 300000; 
        let finalContent = text;
        
        if (text.length > MAX_TEXT_LENGTH) {
          finalContent = text.substring(0, MAX_TEXT_LENGTH) + "\n\n...[CONTENT TRUNCATED DUE TO FIRESTORE 1MB SIZE LIMIT]...";
          console.warn(`Document ${file.name} was truncated because it exceeded the size limit.`);
        }

        // Also limit images if there are too many or they are too large
        let finalImages = images;
        const imagesString = JSON.stringify(images);
        if (imagesString.length > 50000) { // Limit images to ~50KB
           finalImages = []; // Drop images if they are too large to save space
           console.warn(`Images for ${file.name} were dropped to save space.`);
        }

        await firestoreService.addDoc('documents', {
          name: file.name,
          subjectId: subjects.length > 0 ? subjects[0].id : 'unassigned',
          size: file.size,
          content: finalContent,
          images: finalImages,
          uploadedAt: new Date().toISOString()
        });
      }
      
      setUploadStatus('Successfully Indexed!');
      setTimeout(() => setUploadStatus(null), 3000);
      fetchAnalytics(); // Refresh counts
    } catch (error: any) {
      console.error(error);
      alert(`Index failed: ${error.message || 'Ensure files are valid PDFs.'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    doc.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-row bg-transparent overflow-hidden relative">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`${isSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full md:w-64 md:translate-x-0'} absolute md:relative z-50 h-full transition-all duration-500 bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl border-r border-white/20 dark:border-white/5 flex flex-col overflow-hidden shrink-0 shadow-2xl md:shadow-none`}>
        <div className="w-64 h-full flex flex-col">
          <div className="p-6 flex flex-col justify-start items-start relative">
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden absolute right-4 top-4 p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Database size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white leading-tight">Admin</h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Control Panel</p>
              </div>
            </div>

            <nav className="flex flex-col space-y-2 w-full">
              <button 
                onClick={() => { setActiveTab('overview'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'overview' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <Activity size={18} />
                Overview
              </button>
              <button 
                onClick={() => { setActiveTab('materials'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'materials' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <BookOpen size={18} />
                Materials
              </button>
              <button 
                onClick={() => { setActiveTab('insights'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'insights' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <BarChart3 size={18} />
                System Insights
              </button>
              <button 
                onClick={() => { setActiveTab('users'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <Users size={18} />
                User Management
              </button>
            </nav>
          </div>
          
          <div className="mt-auto p-6 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{user.name.charAt(0)}</span>
              </div>
              <div className="flex-1 truncate">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative h-full overflow-y-auto w-full p-4 md:p-8 lg:p-12 pt-16 md:pt-8">
        {/* Sidebar Toggle */}
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="absolute left-4 top-4 z-40 w-10 h-10 md:hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/20 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-xl hover:scale-110 transition-all"
        >
          <Menu size={20} />
        </button>

        <header className="mb-6 md:mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">
              {activeTab === 'overview' && 'System Overview'}
              {activeTab === 'materials' && 'Subject & Material Management'}
              {activeTab === 'insights' && 'System Insights'}
              {activeTab === 'users' && 'User Management'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-xs md:text-sm mt-1">
              {activeTab === 'overview' && 'Real-time metrics and active student monitoring.'}
              {activeTab === 'materials' && 'Manage curriculum subjects and index PDF materials.'}
              {activeTab === 'insights' && 'Analytics and system health monitoring.'}
              {activeTab === 'users' && 'Assign roles and manage user access.'}
            </p>
          </div>
        </header>

        {activeTab === 'overview' && (
          <div className="space-y-10">
            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              <MetricCard 
                title="Total Registered" 
                value={analytics?.overview?.totalRegistered || 0} 
                icon={<Users size={24} className="text-blue-500" />} 
                color="blue" 
              />
              <MetricCard 
                title="Logged In Today" 
                value={analytics?.overview?.loggedInToday || 0} 
                icon={<Activity size={24} className="text-emerald-500" />} 
                color="emerald" 
              />
              <MetricCard 
                title="Currently Active" 
                value={analytics?.overview?.currentlyActive || 0} 
                icon={<div className="relative"><div className="absolute inset-0 bg-amber-500 rounded-full animate-ping opacity-50"></div><Activity size={24} className="text-amber-500 relative z-10" /></div>} 
                color="amber" 
              />
              <MetricCard 
                title="Total Subjects" 
                value={subjects.length} 
                icon={<BookOpen size={24} className="text-purple-500" />} 
                color="purple" 
              />
              <MetricCard 
                title="Indexed PDFs" 
                value={documents.length} 
                icon={<FileText size={24} className="text-indigo-500" />} 
                color="indigo" 
              />
              <MetricCard 
                title="Total Queries" 
                value={analytics?.overview?.totalQueries || 0} 
                icon={<Search size={24} className="text-pink-500" />} 
                color="pink" 
              />
            </div>

            {/* Live Student Monitor */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Activity size={16} className="text-emerald-500" />
                  Live Student Monitor
                </h3>
                <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full">
                  {analytics?.liveStudents?.length || 0} Online
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {analytics?.liveStudents?.length > 0 ? (
                  analytics.liveStudents.map((student: any) => (
                    <div key={student.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300">
                            {student.name.charAt(0)}
                          </div>
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></div>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{student.name}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Active just now</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{student.queriesToday}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Queries Today</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-500 text-sm font-medium">
                    No students currently active.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'materials' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
              {/* Subjects & Upload */}
              <div className="lg:col-span-4 space-y-6 md:space-y-8">
                {/* Add Subject */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 mb-4">Subjects</h3>
                  <form onSubmit={handleAddSubject} className="flex flex-col sm:flex-row gap-2 mb-6">
                    <input 
                      type="text" 
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      placeholder="New Subject Name"
                      className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-indigo-500 dark:text-white"
                    />
                    <button type="submit" className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors w-full sm:w-auto">Add</button>
                  </form>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                  {subjects.map(sub => (
                    <div key={sub.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{sub.name}</span>
                      <button onClick={() => handleDeleteSubject(sub.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {subjects.length === 0 && <p className="text-xs text-slate-500 text-center py-4">No subjects added yet.</p>}
                </div>
              </div>

              {/* Upload PDF */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-4 border-2 border-dashed border-indigo-200 dark:border-indigo-500/30">
                  <Upload className="text-indigo-600 dark:text-indigo-400" size={24} />
                </div>
                <h3 className="text-lg font-black dark:text-white mb-2">Upload Material</h3>
                <p className="text-xs text-slate-500 font-medium mb-6">PDF files only. Max 50MB.</p>
                
                <label className="w-full">
                  <input type="file" multiple accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={isUploading || subjects.length === 0} />
                  <span className={`flex items-center justify-center gap-2 py-3 bg-slate-900 dark:bg-indigo-600 text-white font-bold rounded-xl cursor-pointer hover:opacity-90 transition-all shadow-md text-sm ${subjects.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {isUploading ? <Loader2 className="animate-spin" size={16} /> : <FolderOpen size={16} />}
                    {subjects.length === 0 ? 'ADD SUBJECT FIRST' : 'SELECT PDFS'}
                  </span>
                </label>
                {uploadStatus && (
                  <div className="mt-4 flex items-center gap-2 text-emerald-500">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></div>
                    <p className="text-[10px] font-black uppercase tracking-widest">{uploadStatus}</p>
                  </div>
                )}
              </div>
            </div>

            {/* PDF List */}
            <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col overflow-hidden h-[500px] lg:h-auto">
              <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search documents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:border-indigo-500 dark:text-white text-sm"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 custom-scrollbar">
                {filteredDocuments.length === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center text-slate-400 space-y-3">
                    <Database size={32} className="opacity-20" />
                    <p className="font-bold text-xs uppercase tracking-widest text-center">No documents found</p>
                  </div>
                ) : (
                  filteredDocuments.map((doc) => (
                    <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center gap-3 md:gap-4 p-3 md:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-indigo-500/50 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                          <FileText size={18} />
                        </div>
                        <div className="flex-1 min-w-0 sm:hidden">
                          <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{doc.name}</p>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 hidden sm:block">
                        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{doc.name}</p>
                        <div className="flex items-center gap-2 md:gap-3 mt-1 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{doc.uploadedAt}</span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">•</span>
                          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Indexed
                          </span>
                        </div>
                      </div>
                      <div className="sm:hidden flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{doc.uploadedAt}</span>
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Indexed
                        </span>
                      </div>
                      <button 
                        onClick={() => handleDeleteDocument(doc.id)} 
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 self-end sm:self-auto mt-2 sm:mt-0"
                        title="Delete Document"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'insights' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
              {/* System Status */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
                  <Server size={16} className="text-indigo-500" />
                  System Health
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Server size={18} className="text-slate-500" />
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Main Server</span>
                    </div>
                    <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full">Operational</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Cpu size={18} className="text-slate-500" />
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Embedding Engine</span>
                    </div>
                    <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full">Online</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Database size={18} className="text-slate-500" />
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Vector Database</span>
                    </div>
                    <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-full">Connected</span>
                  </div>
                </div>
              </div>

              {/* Mock Charts Area */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 md:p-6 flex flex-col min-h-[300px]">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
                  <BarChart3 size={16} className="text-indigo-500" />
                  Activity Trends
                </h3>
                <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  <div className="text-center space-y-2">
                    <BarChart3 size={32} className="mx-auto text-slate-400 opacity-50" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Chart Visualization</p>
                    <p className="text-[10px] text-slate-400">Requires Recharts Integration</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Users size={16} className="text-indigo-500" />
                  User Directory
                </h3>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dark:text-white"
                  />
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">User</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Role</th>
                      <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Department</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {allUsers.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase())).map((u) => (
                      <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs shrink-0">
                              {u.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{u.name}</p>
                              <p className="text-xs text-slate-500 truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.uid, e.target.value as any)}
                            disabled={u.uid === user.uid}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                          >
                            <option value="student">Student</option>
                            <option value="faculty">Faculty</option>
                            <option value="hod">HOD</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="p-4">
                          <select
                            value={u.departmentId || ''}
                            onChange={(e) => handleDepartmentChange(u.uid, e.target.value)}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">None</option>
                            {departments.map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                    {allUsers.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-slate-500 text-sm">
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const MetricCard = ({ title, value, icon, color }: { title: string, value: number | string, icon: React.ReactNode, color: string }) => {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20',
    amber: 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20',
    purple: 'bg-purple-50 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/20',
    indigo: 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20',
    pink: 'bg-pink-50 dark:bg-pink-500/10 border-pink-100 dark:border-pink-500/20',
  };

  return (
    <div className={`p-4 md:p-6 rounded-3xl border ${colorMap[color]} flex items-center gap-4 md:gap-5 transition-transform hover:scale-[1.02]`}>
      <div className="w-12 h-12 md:w-14 md:h-14 bg-white dark:bg-slate-900 rounded-2xl shadow-sm flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-none">{value}</p>
      </div>
    </div>
  );
};

export default AdminDashboard;
