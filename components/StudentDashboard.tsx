
import React, { useState, useRef, useEffect } from 'react';
import { User, Document, ChatMessage, ImageSize, ChatSession } from '../types';
import { 
  Send, Sparkles, BookOpen, Trash2, Key, Loader2, BrainCircuit, 
  Target, Lightbulb, BookMarked, Plus, Search, MessageSquare, 
  Clock, History, FileQuestion, ChevronLeft, ChevronRight, LogOut, Square,
  Table as TableIcon, Menu
} from 'lucide-react';
import { generateEducationalResponse, generateEducationalResponseStream, generateEducationalImage, findRelevantImageFromPDF } from '../services/gemini';
import ChatMessageItem from './ChatMessageItem';
import LogicTable from './LogicTable';
import { firestoreService } from '../src/services/firestoreService';
import { where, orderBy, serverTimestamp } from 'firebase/firestore';

interface StudentDashboardProps {
  user: User;
  onLogout: () => void;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ user, onLogout }) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sessionSearch, setSessionSearch] = useState('');
  const [view, setView] = useState<'chat' | 'logic'>('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;
  const messages = activeSession?.messages || [];

  useEffect(() => {
    const unsubscribeDocs = firestoreService.subscribeToCollection<Document>('documents', [orderBy('uploadedAt', 'desc')], (data) => {
      const processedDocs = data.map(doc => ({
        ...doc,
        images: typeof doc.images === 'string' ? JSON.parse(doc.images) : doc.images
      }));
      setDocuments(processedDocs);
    });

    const unsubscribeSessions = firestoreService.subscribeToCollection<ChatSession>('chatSessions', [
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    ], (data) => {
      setSessions(data);
    });

    return () => {
      unsubscribeDocs();
      unsubscribeSessions();
    };
  }, [user.uid]);

  const createNewSession = async () => {
    try {
      const newSession = {
        userId: user.uid,
        title: 'New Discussion',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0
      };
      const id = await firestoreService.addDoc('chatSessions', newSession);
      setActiveSessionId(id);
    } catch (error) {
      console.error('Failed to create session', error);
    }
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await firestoreService.deleteDoc('chatSessions', id);
      if (activeSessionId === id) {
        setActiveSessionId(null);
      }
    } catch (error) {
      console.error('Failed to delete session', error);
    }
  };

  const updateSessionMessages = async (sessionId: string, newMessages: ChatMessage[]) => {
    try {
      await firestoreService.updateDoc('chatSessions', sessionId, {
        messages: newMessages,
        updatedAt: new Date().toISOString(),
        messageCount: newMessages.length
      });
    } catch (error) {
      console.error('Failed to update session', error);
    }
  };
  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setIsGeneratingImage(false);
  };

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const active = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(active);
      } else {
        setHasApiKey(true); // Assume true on localhost, relies on .env
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    if (sessions.length === 0) {
      createNewSession();
    } else if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions.length, activeSessionId]);

  const handleSend = async (customPrompt?: string) => {
    const text = customPrompt || inputValue;
    if (!text.trim() || isLoading || !activeSessionId) return;
    
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    const currentSession = sessions.find(s => s.id === activeSessionId);
    if (!currentSession) return;

    const newMessages = [...currentSession.messages, userMessage];
    await updateSessionMessages(activeSessionId, newMessages);
    
    setInputValue('');
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const signal = abortController.signal;

    try {
      // Check for exact image from PDF first
      const pdfImage = findRelevantImageFromPDF(text, documents);
      
      // Create a promise that rejects when the signal is aborted
      const abortPromise = new Promise<never>((_, reject) => {
        const onAbort = () => {
          signal.removeEventListener('abort', onAbort);
          reject(new DOMException('Aborted', 'AbortError'));
        };
        signal.addEventListener('abort', onAbort);
      });
      // Attach a dummy catch to prevent unhandled rejection if the race ends before abortion
      abortPromise.catch(() => {});
      
      const assistantMessageId = (Date.now() + 1).toString();
      let fullResponse = '';
      
      const stream = generateEducationalResponseStream(text, documents, newMessages, !!pdfImage);
      
      setStreamingMessageId(assistantMessageId);
      setStreamingContent('');

      try {
        for await (const chunk of stream) {
          if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
          fullResponse += chunk;
          setStreamingContent(fullResponse);
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') throw e;
      }
      
      setStreamingMessageId(null);
      setStreamingContent('');

      if (signal.aborted) return;
      
      let imageUrl = pdfImage || undefined;
      const visualKeywords = ['architecture', 'diagram', 'block diagram', 'circuit', 'flowchart', 'draw', 'visualize', 'structure', 'image', 'figure', 'diagranm', 'architectre', 'flow chart'];
      const needsVisual = visualKeywords.some(kw => text.toLowerCase().includes(kw)) || fullResponse.includes('[VISUAL]');

      const isImageOnly = fullResponse.trim() === 'IMAGE_ONLY_RESPONSE_REQUESTED';
      
      // Clean up the final response
      let cleanedResponse = fullResponse;
      cleanedResponse = cleanedResponse.replace(/^(\s*#+.*(\n|$))+/, '').trim();
      cleanedResponse = cleanedResponse.replace(/```mermaid\s*([\s\S]*?)\s*```/g, (match, code) => {
        return `\n\`\`\`mermaid\n${code.trim()}\n\`\`\`\n`;
      });

      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: isImageOnly ? '' : cleanedResponse,
        timestamp: new Date(),
        imageUrl: imageUrl || null
      };

      // Save the text content immediately so it doesn't disappear while image generates
      // Using newMessages (which has the user message) instead of stale sessions state
      const messagesWithAssistant = [...newMessages, assistantMessage];
      await updateSessionMessages(activeSessionId, messagesWithAssistant);

      if (needsVisual && !imageUrl) {
        // Check if user has selected an API key for image generation
        if (window.aistudio) {
          // @ts-ignore
          const active = await window.aistudio.hasSelectedApiKey();
          if (!active) {
            // @ts-ignore
            await window.aistudio.openSelectKey();
            setHasApiKey(true);
          }
        }

        setIsLoading(true);
        setIsGeneratingImage(true);
        try {
          const imgPromise = generateEducationalImage(text, documents, fullResponse);
          const generatedUrl = await Promise.race([imgPromise, abortPromise as Promise<any>]);
          if (generatedUrl) {
            // Update the message specifically with the image URL
            const updatedMessages = messagesWithAssistant.map(m => 
              m.id === assistantMessageId ? { ...m, imageUrl: generatedUrl } : m
            );
            await updateSessionMessages(activeSessionId, updatedMessages);
          }
        } catch (e: any) {
          if (e.name !== 'AbortError') console.error("Image generation failed", e);
        }
        setIsGeneratingImage(false);
        setIsLoading(false);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Generation stopped by user');
      } else {
        console.error(error);
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        setIsLoading(false);
        setIsGeneratingImage(false);
        setStreamingMessageId(null);
        setStreamingContent('');
        abortControllerRef.current = null;
      }
    }
  };


  const pyqDocs = documents.filter(doc => 
    doc.name.toLowerCase().includes('pyq') || 
    doc.name.toLowerCase().includes('question') || 
    doc.name.toLowerCase().includes('paper')
  );

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(sessionSearch.toLowerCase())
  );

  return (
    <div className="h-full flex bg-transparent overflow-hidden relative">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full md:w-80 md:translate-x-0'} absolute md:relative z-50 h-full transition-all duration-500 bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl border-r border-white/20 dark:border-white/5 flex flex-col overflow-hidden shrink-0 shadow-2xl md:shadow-none`}>
        <div className="p-6 space-y-8 flex-1 overflow-y-auto custom-scrollbar w-80 relative">
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden absolute right-4 top-4 p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <ChevronLeft size={20} />
          </button>
          <button 
            onClick={() => { createNewSession(); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
            className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-[1.5rem] flex items-center justify-center gap-3 font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] transition-all"
          >
            <Plus size={18} />
            New Synthesis
          </button>

          <div className="space-y-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={14} />
              <input 
                type="text" 
                placeholder="Search Chats..."
                value={sessionSearch}
                onChange={(e) => setSessionSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 focus:outline-none text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300"
              />
            </div>

            <div className="space-y-2">
              <p className="px-2 text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <History size={12} />
                Recent Synapse
              </p>
              <div className="space-y-1">
                {filteredSessions.map(session => (
                  <div 
                    key={session.id}
                    onClick={() => { setActiveSessionId(session.id); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                    className={`group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all ${
                      activeSessionId === session.id 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                        : 'hover:bg-white/60 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <MessageSquare size={16} className={activeSessionId === session.id ? 'text-indigo-200' : 'text-slate-400'} />
                      <span className="text-[10px] font-black uppercase tracking-widest truncate">{session.title}</span>
                    </div>
                    <button onClick={(e) => deleteSession(session.id, e)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-4">
              <p className="px-2 text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                <TableIcon size={12} />
                Reference Vault
              </p>
              <button 
                onClick={() => { setView('logic'); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`w-full text-left p-4 rounded-2xl border transition-all group ${view === 'logic' ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-indigo-500/5 border-indigo-500/10 hover:bg-indigo-500/10'}`}
              >
                <p className={`text-[9px] font-black uppercase tracking-widest truncate ${view === 'logic' ? 'text-white' : 'text-indigo-600 dark:text-indigo-500'}`}>Logic Gate Perceptrons</p>
                <p className={`text-[8px] font-bold uppercase mt-1 ${view === 'logic' ? 'text-indigo-100' : 'text-slate-400'}`}>Weights & Thresholds</p>
              </button>
            </div>

            <div className="space-y-2 pt-4">
              <p className="px-2 text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
                <FileQuestion size={12} />
                PYQ Vault
              </p>
              <div className="space-y-1">
                {pyqDocs.length > 0 ? pyqDocs.map(doc => (
                  <button 
                    key={doc.id}
                    onClick={() => { handleSend(`Summarize the core questions from ${doc.name} and provide high-yield solutions.`); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                    className="w-full text-left p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 transition-all group"
                  >
                    <p className="text-[9px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest truncate">{doc.name}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Found in archives</p>
                  </button>
                )) : (
                  <p className="p-4 text-[9px] font-bold text-slate-400 uppercase text-center border border-dashed rounded-2xl opacity-40">No PYQ Papers Found</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* User Profile & Logout */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{user.name.charAt(0)}</span>
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
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative h-full overflow-hidden w-full">
        {/* Sidebar Toggle */}
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="absolute left-4 top-4 z-40 w-10 h-10 md:hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/20 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shadow-xl hover:scale-110 transition-all"
        >
          <Menu size={20} />
        </button>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-10 space-y-6 md:space-y-10 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-8 md:space-y-12 pb-32 md:pb-40 pt-12 md:pt-0">
            {view === 'logic' ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 md:mb-12">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black dark:text-white mb-2 tracking-tighter uppercase">Logic Gate Perceptrons</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-medium">Reference for weights, thresholds, and activation logic.</p>
                  </div>
                  <button 
                    onClick={() => setView('chat')}
                    className="px-4 md:px-6 py-2 md:py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-xl md:rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all self-start sm:self-auto"
                  >
                    Back to Chat
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <LogicTable />
                </div>
              </div>
            ) : messages.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-10 md:py-20 text-center animate-in fade-in zoom-in duration-700">
                  <div className="w-16 h-16 md:w-24 md:h-24 bg-indigo-600 rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-center shadow-2xl mb-6 md:mb-8 animate-float">
                    <BrainCircuit size={32} className="text-white md:w-10 md:h-10" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black dark:text-white mb-2 md:mb-3 tracking-tighter uppercase">Initialize Synapse</h2>
                  <p className="text-slate-500 dark:text-slate-400 max-w-sm text-xs md:text-sm font-medium mb-8 md:mb-12 px-4">Select a topic or upload curriculum data to start the synthesis.</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 w-full max-w-2xl px-4 md:px-0">
                    <button onClick={() => handleSend("Explain the Memory Hierarchy exactly as described in the ledger with a diagram.")} className="p-4 md:p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[1.5rem] md:rounded-[2rem] hover:border-indigo-500 transition-all text-left">
                       <Target className="text-indigo-500 mb-3 md:mb-4 w-5 h-5 md:w-6 md:h-6" />
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-white">Architecture Drilldown</p>
                       <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase mt-1 md:mt-2">Exact structural mapping</p>
                    </button>
                    <button onClick={() => handleSend("Give me the top 10 2-mark definitions likely to appear based on our PYQs.")} className="p-4 md:p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[1.5rem] md:rounded-[2rem] hover:border-indigo-500 transition-all text-left">
                       <BookMarked className="text-amber-500 mb-3 md:mb-4 w-5 h-5 md:w-6 md:h-6" />
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-white">PYQ High-Yield</p>
                       <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase mt-1 md:mt-2">Flash-card style synthesis</p>
                    </button>
                  </div>
               </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <ChatMessageItem key={msg.id} message={msg} />
                ))}
                {streamingMessageId && (
                  <ChatMessageItem 
                    key={streamingMessageId} 
                    message={{
                      id: streamingMessageId,
                      role: 'assistant',
                      content: streamingContent,
                      timestamp: new Date()
                    }} 
                    isStreaming={true}
                  />
                )}
              </>
            )}
            
            {isLoading && !streamingMessageId && (
              <div className="flex gap-3 md:gap-6 animate-pulse px-2 md:px-0">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-indigo-600/20 flex items-center justify-center border border-indigo-600/30 shrink-0">
                  <Loader2 className="animate-spin text-indigo-600 w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl px-4 py-3 md:px-8 md:py-5 rounded-2xl md:rounded-[2.5rem] rounded-tl-none border border-slate-200 dark:border-slate-800 shadow-xl">
                   <span className="text-[10px] md:text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                     {isGeneratingImage ? 'Synthesizing High-Fidelity Visual...' : 'Accessing Synaptic Ledger...'}
                   </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Floating Input area remains consistent with previous design but anchored to bottom right of main area */}
        {view === 'chat' && (
          <div className="absolute bottom-4 md:bottom-8 left-0 right-0 px-2 sm:px-4 md:px-10 pointer-events-none">
            <div className="max-w-3xl mx-auto pointer-events-auto flex flex-col items-center">
              {isLoading && (
                <button 
                  onClick={stopGeneration}
                  className="mb-2 md:mb-4 px-3 md:px-4 py-1.5 md:py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-full flex items-center gap-2 text-[10px] md:text-xs font-bold uppercase tracking-widest shadow-xl hover:scale-105 transition-all border border-slate-700"
                >
                  <Square size={10} className="fill-white md:w-3 md:h-3" />
                  Stop Generating
                </button>
              )}
              <div className="relative group w-full">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-[2rem] md:rounded-[3rem] blur opacity-20 group-focus-within:opacity-40 transition duration-500"></div>
                <div className="relative flex items-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl rounded-[2rem] md:rounded-[2.5rem] border border-white/50 dark:border-white/10 shadow-2xl overflow-hidden px-2 py-1.5 md:px-3 md:py-2">
                  <input 
                    type="text" 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask for an exact diagram or definition..."
                    className="flex-1 px-3 md:px-6 py-2 md:py-4 bg-transparent border-none focus:outline-none dark:text-white font-bold text-sm md:text-lg placeholder:text-slate-400 w-full"
                  />
                  <button 
                    onClick={() => handleSend()}
                    disabled={!inputValue.trim() || isLoading}
                    className="w-10 h-10 md:w-14 md:h-14 bg-slate-900 dark:bg-indigo-600 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-xl disabled:opacity-30 shrink-0"
                  >
                    <Send size={18} className="md:w-6 md:h-6" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
