import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, BrainCircuit } from 'lucide-react';
import { motion } from 'framer-motion';

const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full w-full overflow-y-auto flex flex-col p-4 pt-24 pb-12 md:py-4 custom-scrollbar">
      <div className="m-auto w-full max-w-5xl flex flex-col items-center">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10 md:mb-16 mt-10 md:mt-0"
        >
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-black tracking-tighter mb-4 text-slate-900 dark:text-white px-4">
            THE SYNAPTIC LEDGER
          </h1>
          <p className="text-base md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto px-4">
            Choose your portal. Access advanced AI-powered educational tools or manage your academic library resources.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 w-full px-4 md:px-0 pb-10 md:pb-0">
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => navigate('/login?app=chatbot')}
          className="group cursor-pointer relative overflow-hidden rounded-3xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-500"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-transform duration-500">
              <BrainCircuit className="w-10 h-10 md:w-12 md:h-12 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3 md:mb-4 text-slate-900 dark:text-white">AI Chatbot</h2>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400">
              Engage with our advanced RAG agent. Upload syllabi, ask complex questions, and get detailed answers with diagrams.
            </p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          onClick={() => navigate('/login?app=library')}
          className="group cursor-pointer relative overflow-hidden rounded-3xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 hover:shadow-2xl hover:shadow-emerald-500/20 transition-all duration-500"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mb-4 md:mb-6 group-hover:scale-110 transition-transform duration-500">
              <BookOpen className="w-10 h-10 md:w-12 md:h-12 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-3 md:mb-4 text-slate-900 dark:text-white">Digital Library</h2>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400">
              Access the complete library management system. Browse books, manage issues, and track availability in real-time.
            </p>
          </div>
        </motion.div>
      </div>
      </div>
    </div>
  );
};

export default Landing;
