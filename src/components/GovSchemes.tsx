import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Landmark, Loader2, Search, MapPin, ExternalLink, CheckCircle2, AlertCircle, RefreshCcw, UserCheck, HelpCircle, Globe, ShieldCheck, LayoutDashboard, Database, Clock, Bot, X, Send } from 'lucide-react';

interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  url: string;
  isRestricted?: boolean;
}

function LinkPreviewCard({ url, lang }: { url: string; lang: Language }) {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (!data.error) setMetadata(data);
      } catch (err) {
        console.error("Link preview error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMetadata();
  }, [url]);

  if (loading) return (
    <div className="animate-pulse bg-white/5 h-24 rounded-2xl border border-white/10 p-4 flex gap-4 items-center">
      <div className="w-16 h-16 bg-white/10 rounded-xl"></div>
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-white/10 rounded w-1/2"></div>
        <div className="h-2 bg-white/10 rounded w-3/4"></div>
      </div>
    </div>
  );

  if (!metadata) return (
    <motion.a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      whileHover={{ y: -2 }}
      className="flex items-center justify-between w-full bg-white/5 hover:bg-white/10 p-5 rounded-2xl border border-white/10 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Globe className="w-5 h-5 text-blue-400" />
        <span className="text-xs font-black uppercase tracking-widest">{lang === 'bn' ? 'অফিসিয়াল পোর্টাল' : 'Official Portal'}</span>
      </div>
      <ExternalLink className="w-4 h-4 text-blue-400" />
    </motion.a>
  );

  if (metadata.isRestricted) {
    return (
      <motion.a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        whileHover={{ y: -4, backgroundColor: 'rgba(255,255,255,0.08)' }}
        className="block group/link bg-orange-500/5 rounded-[2rem] overflow-hidden border border-orange-500/20 transition-all shadow-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <UserCheck className="w-4 h-4 text-orange-400" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">{metadata.siteName || 'Official Website'}</span>
        </div>
        <h5 className="font-black text-white text-sm leading-snug group-hover/link:text-orange-400 transition-colors line-clamp-2 mb-2">{metadata.title}</h5>
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-3 font-medium mb-3">{metadata.description}</p>
        <div className="flex items-center justify-between">
           <span className="text-[9px] font-bold text-orange-500/80 uppercase tracking-widest">{lang === 'bn' ? 'পোর্টাল দেখুন' : 'VIEW PORTAL'}</span>
           <ExternalLink className="w-3 h-3 text-orange-400" />
        </div>
      </motion.a>
    );
  }

  return (
    <motion.a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      whileHover={{ y: -4, backgroundColor: 'rgba(255,255,255,0.08)' }}
      className="block group/link bg-white/10 rounded-[2rem] overflow-hidden border border-white/20 transition-all shadow-2xl"
    >
      {metadata.image && (
        <div className="relative aspect-video overflow-hidden">
          <img 
            src={metadata.image} 
            alt={metadata.title} 
            className="w-full h-full object-cover transition-transform group-hover/link:scale-110"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 truncate">{metadata.siteName || 'Official Website'}</p>
          </div>
        </div>
      )}
      <div className="p-6 space-y-2">
        <h5 className="font-black text-white text-sm leading-snug group-hover/link:text-blue-400 transition-colors line-clamp-2">{metadata.title}</h5>
        {metadata.description && (
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 font-medium">{metadata.description}</p>
        )}
        <div className="pt-2 flex items-center justify-between">
           <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{lang === 'bn' ? 'দেখুন' : 'VISIT PORTAL'}</span>
           <ExternalLink className="w-3 h-3 text-blue-400" />
        </div>
      </div>
    </motion.a>
  );
}
import { translations, Language } from '../utils/translations';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { syncCuratedSchemes, startSchemeChat } from '../services/ai';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { CURRENT_PDF_SCHEMES, seedGovSchemes } from '../data/seedSchemes';
import ReactMarkdown from 'react-markdown';

interface Props {
  lang: Language;
  globalLocation: { latitude: number; longitude: number } | null;
}

export interface GovScheme {
  id: string;
  title: { en: string; bn: string; };
  description: { en: string; bn: string; };
  eligibility: { en: string; bn: string; };
  howToApply: { en: string; bn: string; };
  benefits?: { en: string; bn: string; };
  deadline?: { en: string; bn: string; };
  contactInfo?: { en: string; bn: string; };
  tags?: string[];
  crops: string[];
  districts: string[];
  sourceLinks: string[];
  provider?: string;
  status?: string;
  lastUpdated: string;
}

const DISTRICTS = [
  'all', 'dhaka', 'rajshahi', 'khulna', 'barisal', 'sylhet', 'chittagong', 'comilla', 'bogra', 'narsingdi'
];

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export default function GovSchemes({ lang, globalLocation }: Props) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [allSchemes, setAllSchemes] = useState<GovScheme[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [chatScheme, setChatScheme] = useState<GovScheme | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatSession, setChatSession] = useState<any>(null);
  const chatEndRef = React.useRef<HTMLDivElement>(null);
  
  const { userProfile } = useAuth();
  const t = translations[lang];

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleStartChat = (scheme: GovScheme) => {
    setChatScheme(scheme);
    setChatMessages([{
      role: 'model',
      text: lang === 'bn' 
        ? `স্বাগতম! আমি আপনাকে "${scheme.title[lang]}" সম্পর্কে সাহায্য করতে পারি। আপনি কীভাবে সুবিধা পেতে পারেন বা আপনার কোনো প্রশ্ন থাকলে তা আমাকে জিজ্ঞাসা করুন।` 
        : `Welcome! I can help you with "${scheme.title[lang]}". Feel free to ask how you can avail this benefit or any other questions you may have.`
    }]);
    setChatSession(startSchemeChat(scheme, lang));
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading || !chatSession) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsChatLoading(true);

    try {
      const response = await chatSession.sendMessage({ message: userMsg });
      setChatMessages(prev => [...prev, { role: 'model', text: response.text }]);
    } catch (err) {
      console.error("Chat error:", err);
      setChatMessages(prev => [...prev, { role: 'model', text: lang === 'bn' ? "দুঃখিত, আমি বর্তমানে উত্তর দিতে পারছি না।" : "Sorry, I'm unable to respond correctly at the moment." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Sync status and UI-level deduplication
  const rawSchemes = allSchemes.length > 0 ? allSchemes : (CURRENT_PDF_SCHEMES as GovScheme[]);
  
  // Ensure UI-level uniqueness by ID and Title
  const deduplicatedSchemes = React.useMemo(() => {
    const seen = new Set();
    return rawSchemes.filter(scheme => {
      const titleKey = scheme.title?.en?.toLowerCase().trim();
      if (seen.has(scheme.id) || (titleKey && seen.has(titleKey))) return false;
      seen.add(scheme.id);
      if (titleKey) seen.add(titleKey);
      return true;
    });
  }, [rawSchemes]);

  const uniqueTags = React.useMemo(() => [
    'All', 
    ...Array.from(new Set(deduplicatedSchemes.flatMap(s => s.tags || [])))
  ], [deduplicatedSchemes]);

  const filteredSchemes = React.useMemo(() => {
    return selectedTag === 'All' 
      ? deduplicatedSchemes 
      : deduplicatedSchemes.filter(s => s.tags?.includes(selectedTag));
  }, [deduplicatedSchemes, selectedTag]);

  // Real-time listener for schemes
  useEffect(() => {
    const q = query(collection(db, 'gov_schemes'), orderBy('lastUpdated', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const schemes: GovScheme[] = [];
      snapshot.forEach((doc) => {
        schemes.push({ id: doc.id, ...doc.data() } as GovScheme);
      });
      setAllSchemes(schemes);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'gov_schemes');
    });

    return () => unsubscribe();
  }, []);

  const handleSync = async () => {
    if (!window.confirm(lang === 'bn' ? "গুগল সার্চের মাধ্যমে প্রকল্পগুলো আপডেট করবেন? এটি এআই ব্যবহার করে এবং কিছুটা সময় নিতে পারে।" : "Sync curated schemes with Google Search? This uses AI and takes a few moments.")) return;
    
    setIsSyncing(true);
    setSyncStatus(lang === 'bn' ? 'এআই ইঞ্জিন চালু হচ্ছে...' : 'Initializing AI Engine...');
    
    try {
      // Simulate phases for user transparency
      setTimeout(() => setSyncStatus(lang === 'bn' ? 'গুগল সার্চে অনুসন্ধান করা হচ্ছে...' : 'Searching Google for latest schemes...'), 2000);
      setTimeout(() => setSyncStatus(lang === 'bn' ? 'ডেটা প্রসেস করা হচ্ছে...' : 'Analyzing and structuring data...'), 5000);
      
      const count = await syncCuratedSchemes();
      
      setSyncStatus(lang === 'bn' ? 'ডেটাবেস আপডেট করা হচ্ছে...' : 'Finalizing Database Update...');
      setTimeout(() => {
        alert(lang === 'bn' ? `সফলভাবে ${count}টি প্রকল্প আপডেট করা হয়েছে!` : `Successfully synced ${count} schemes from the latest search!`);
        setSyncStatus('');
      }, 1000);
    } catch (error) {
      console.error("Sync failed:", error);
      alert(lang === 'bn' ? "আপডেট করতে ব্যর্থ হয়েছে। কনসোল দেখুন।" : "Failed to sync schemes. check console.");
      setSyncStatus('');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm(lang === 'bn' ? "আপনি কি নিশ্চিত যে আপনি প্রকল্পসমূহ পুনরায় সেট করতে চান? এটি বর্তমান তালিকা মুছে দেবে এবং পিডিএফ থেকে সংগৃহীত মূল ডেটা পুনরুদ্ধার করবে।" : "Are you sure you want to reset the schemes? This will restore the original curated list from our official catalog.")) return;
    setIsSyncing(true);
    try {
      await seedGovSchemes();
      alert(lang === 'bn' ? "সফলভাবে মূল ক্যাটালগ পুনরুদ্ধার করা হয়েছে!" : "Original curated catalog successfully restored!");
    } catch (error) {
      console.error("Reset failed:", error);
      alert(lang === 'bn' ? "পুনরায় সেট করতে ব্যর্থ হয়েছে।" : "Failed to reset schemes.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12 max-w-6xl mx-auto px-4"
    >
      <div className="bg-white rounded-[40px] p-5 md:p-8 shadow-xl shadow-blue-900/5 border border-blue-100 mb-6 md:mb-8">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="bg-blue-50 p-3 md:p-4 rounded-2xl flex-shrink-0">
            <Landmark className="w-6 h-6 md:w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl md:text-3xl font-black text-gray-900 tracking-tight leading-tight">{t.govSchemes}</h2>
            <p className="text-gray-500 text-xs md:text-base font-medium">{t.govSchemesDesc}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col space-y-6">
        {userProfile?.role === 'admin' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-gray-900 via-blue-900 to-indigo-900 rounded-[2.5rem] p-10 border-4 border-blue-500/50 shadow-[0_20px_50px_rgba(59,130,246,0.2)] overflow-hidden relative"
          >
            {/* Minimal static gradients instead of GPU-heavy blurs */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-400/20 to-transparent rounded-full -mr-32 -mt-32" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-indigo-400/20 to-transparent rounded-full -ml-32 -mb-32" />
            
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-10">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-blue-500/30 rounded-2xl border border-blue-400/50 shadow-inner">
                      <ShieldCheck className="w-8 h-8 text-blue-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-green-400 animate-ping"></span>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">System Administrator Dashboard</h2>
                      </div>
                      <p className="text-blue-300 text-sm font-bold tracking-[0.1em] uppercase opacity-80">Full Authority: {allSchemes.length} Live Governance Systems</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative group">
                    <AnimatePresence>
                      {isSyncing && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1.1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="absolute -inset-2 bg-blue-500/20 rounded-[2.5rem] blur-xl animate-pulse -z-10"
                        />
                      )}
                    </AnimatePresence>
                    <motion.button
                      whileHover={{ scale: 1.05, backgroundColor: 'rgba(59, 130, 246, 0.4)' }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSync}
                      disabled={isSyncing}
                      className="flex items-center space-x-4 text-[12px] font-black uppercase tracking-[0.25em] bg-blue-500/30 text-white px-10 py-6 rounded-[2rem] border-2 border-blue-400/50 transition-all disabled:opacity-50 shadow-xl shadow-blue-500/20 relative overflow-hidden"
                    >
                      <div className="flex items-center gap-3">
                        {isSyncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCcw className="w-5 h-5" />}
                        <div className="flex flex-col items-start">
                          <span>{isSyncing ? (lang === 'bn' ? 'এআই সিঙ্কিং শুরু...' : 'INITIALIZING SYNC...') : (lang === 'bn' ? 'এআই দিয়ে সিঙ্ক করুন' : 'TRIGGER AI SYNC')}</span>
                          {isSyncing && (
                            <motion.span 
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="text-[8px] opacity-70 mt-1 lowercase font-mono translate-y-[-2px]"
                            >
                              {syncStatus}
                            </motion.span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.05, backgroundColor: 'rgba(239, 68, 68, 0.2)' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleReset}
                    disabled={isSyncing}
                    className="flex items-center space-x-4 text-[12px] font-black uppercase tracking-[0.25em] bg-white/5 text-red-300 px-10 py-6 rounded-[2rem] border-2 border-red-500/30 transition-all disabled:opacity-50 shadow-lg"
                  >
                    <Database className="w-5 h-5" />
                    <span>{lang === 'bn' ? 'রিসেট করুন' : 'HARD RESET'}</span>
                  </motion.button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 border-t border-white/10 pt-10">
                {[
                  { label: 'Active Catalogs', value: allSchemes.length, icon: Globe, color: 'text-blue-400' },
                  { label: 'Search Index', value: 'Google Cloud', icon: Search, color: 'text-emerald-400' },
                  { label: 'Security Level', value: 'Level 5', icon: ShieldCheck, color: 'text-orange-400' },
                  { label: 'Last System Sync', value: 'Synced', icon: Clock, color: 'text-purple-400' }
                ].map((stat, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white/5 p-5 rounded-[2rem] border border-white/10"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 bg-white/5 rounded-xl ${stat.color}`}>
                        <stat.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1.5">{stat.label}</p>
                        <p className="text-lg font-black text-white tracking-tight">{stat.value}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[3rem] border border-gray-100 gap-8 shadow-sm">
          <div className="flex items-center space-x-6">
            <div className="bg-blue-600 text-white font-black px-6 py-3 rounded-2xl text-2xl shadow-xl shadow-blue-500/20">
              {filteredSchemes.length}
            </div>
            <div>
              <h3 className="font-black text-gray-900 uppercase tracking-widest text-sm">
                {lang === 'bn' ? 'উপলব্ধ প্রকল্পসমূহ' : 'Available Systems'}
              </h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                {selectedTag === 'All' ? (lang === 'bn' ? 'সব বিভাগ' : 'GLOBAL ACCESS') : `${selectedTag.toUpperCase()} ONLY`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {uniqueTags.map((tag) => (
              <motion.button
                key={tag}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedTag(tag)}
                className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                  selectedTag === tag 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30' 
                    : 'bg-white text-gray-400 border-gray-100 hover:border-blue-200 hover:text-blue-600'
                }`}
              >
                {tag}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-12">
        {filteredSchemes.map((scheme, idx) => (
          <motion.div 
            key={scheme.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group relative"
          >
            {/* Background decorative element */}
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity -z-10"></div>
            
            <div className="bg-white rounded-[3rem] p-8 md:p-12 border border-gray-100 shadow-xl shadow-gray-200/20 hover:shadow-blue-500/10 transition-all flex flex-col lg:flex-row gap-12">
              <div className="flex-1 space-y-8">
                <div>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {scheme.tags?.map((tag, tagIdx) => (
                      <span key={tagIdx} className="text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                        {tag}
                      </span>
                    )) || (
                      <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                        {lang === 'bn' ? 'কৃষি সেবা' : 'Agri Service'}
                      </span>
                    )}
                    {allSchemes.length === 0 && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-orange-500 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-100">
                        {lang === 'bn' ? 'ডিফল্ট ক্যাটালগ' : 'Default Catalog'}
                      </span>
                    )}
                  </div>
                  
                  <h3 className="text-4xl font-black text-gray-900 mb-6 tracking-tighter leading-none group-hover:text-blue-600 transition-colors uppercase italic font-display">{scheme.title[lang]}</h3>
                  <p className="text-gray-400 text-lg font-medium leading-relaxed max-w-2xl">{scheme.description[lang]}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <motion.div 
                    whileHover={{ scale: 1.01 }}
                    className="p-8 bg-blue-50/50 rounded-[2.5rem] border border-blue-100/50 relative group/info"
                  >
                    <div className="absolute top-6 right-8 opacity-20 group-hover/info:opacity-40 transition-opacity">
                       <UserCheck className="w-12 h-12 text-blue-600" />
                    </div>
                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                       <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                       {lang === 'bn' ? 'আপনি আবেদন করতে পারবেন কি?' : 'Can You Apply?'}
                    </h4>
                    <p className="text-lg text-gray-900 font-black leading-tight tracking-tight">{scheme.eligibility[lang]}</p>
                  </motion.div>

                  <motion.div 
                    whileHover={{ scale: 1.01 }}
                    className="p-8 bg-indigo-50/50 rounded-[2.5rem] border border-indigo-100/50 relative group/info"
                  >
                    <div className="absolute top-6 right-8 opacity-20 group-hover/info:opacity-40 transition-opacity">
                       <HelpCircle className="w-12 h-12 text-indigo-600" />
                    </div>
                    <h4 className="text-xs font-black text-indigo-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                       <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse"></span>
                       {lang === 'bn' ? 'কিভাবে শুরু করবেন?' : 'How to Start?'}
                    </h4>
                    <p className="text-lg text-gray-900 font-black leading-tight tracking-tight">{scheme.howToApply[lang]}</p>
                  </motion.div>
                </div>

                {scheme.benefits && (
                  <div className="p-8 bg-blue-600 text-white rounded-[2.5rem] shadow-xl shadow-blue-500/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-70">{lang === 'bn' ? 'মূল সুবিধাগুলো' : 'Key Benefits'}</h4>
                        <p className="text-xl font-black italic tracking-tight">{scheme.benefits[lang]}</p>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleStartChat(scheme)}
                        className="bg-white text-blue-600 p-3 rounded-2xl shadow-xl flex items-center gap-2 group/chat cursor-pointer"
                      >
                        <Bot className="w-5 h-5 group-hover/chat:animate-bounce" />
                        <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">
                          {lang === 'bn' ? 'পরামর্শ' : 'ADVISOR'}
                        </span>
                      </motion.button>
                    </div>
                  </div>
                )}
              </div>

              <div className="w-full lg:w-80 flex flex-col gap-6">
                <div className="bg-gray-900 text-white p-8 rounded-[2.5rem] flex-1 flex flex-col justify-between shadow-2xl">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-6">{lang === 'bn' ? 'অফিসিয়াল তথ্য' : 'Official Info'}</h4>
                    
                    <div className="space-y-6">
                      {scheme.provider && (
                        <div>
                          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">{lang === 'bn' ? 'প্রদানকারী' : 'Provider'}</p>
                          <p className="text-sm font-black text-white">{scheme.provider}</p>
                        </div>
                      )}
                      
                      {!scheme.benefits && (
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleStartChat(scheme)}
                          className="w-full bg-blue-600 text-white p-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 group/chat cursor-pointer mb-6"
                        >
                          <Bot className="w-5 h-5 group-hover/chat:animate-bounce" />
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            {lang === 'bn' ? 'এআই পরামর্শদাতার সাথে কথা বলুন' : 'CHAT WITH AI ADVISOR'}
                          </span>
                        </motion.button>
                      )}
                      
                      {scheme.deadline && (
                        <div>
                          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">{lang === 'bn' ? 'সময়সীমা' : 'Deadline'}</p>
                          <p className="text-sm font-black text-orange-400">{scheme.deadline[lang]}</p>
                        </div>
                      )}

                      {scheme.contactInfo && (
                        <div>
                          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1">{lang === 'bn' ? 'যোগাযোগ' : 'Contact'}</p>
                          <p className="text-sm font-bold text-gray-300">{scheme.contactInfo[lang]}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-8 space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 px-2">{lang === 'bn' ? 'সরাসরি লিঙ্ক ও প্রিভিউ' : 'Direct Link & Preview'}</h4>
                    {scheme.sourceLinks?.map((link, linkIdx) => (
                      <LinkPreviewCard key={linkIdx} url={link} lang={lang} />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-center p-4">
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">
                    {scheme.lastUpdated ? (lang === 'bn' ? `যাচাইকৃত: ${new Date(scheme.lastUpdated).toLocaleDateString()}` : `Verified: ${new Date(scheme.lastUpdated).toLocaleDateString()}`) : 'TRUSTED'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Chat Overlay */}
      <AnimatePresence>
        {chatScheme && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl h-[80vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden border border-white/20"
            >
              {/* Header */}
              <div className="p-6 sm:p-8 bg-blue-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-3 rounded-2xl">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg leading-tight uppercase tracking-tight">{lang === 'bn' ? 'স্কিম গাইড' : 'Scheme Advisor'}</h3>
                    <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">{chatScheme.title[lang]}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setChatScheme(null)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 scrollbar-hide">
                {chatMessages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] p-5 rounded-[2rem] text-sm font-medium shadow-sm leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-blue-50 text-gray-900 rounded-tl-none border border-blue-100'
                    }`}>
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  </motion.div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-blue-50 p-5 rounded-[2rem] rounded-tl-none border border-blue-100 flex items-center gap-3">
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      <span className="text-xs font-black text-blue-600 uppercase tracking-widest">
                        {lang === 'bn' ? 'পরামর্শদাতা লিখছেন...' : 'Advisor is typing...'}
                      </span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSendMessage} className="p-6 sm:p-8 bg-gray-50 border-t border-gray-100">
                <div className="relative group">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={lang === 'bn' ? 'কিভাবে আবেদন করব?' : 'How do I apply? Ask anything...'}
                    className="w-full bg-white border border-gray-200 p-5 pr-16 rounded-[2rem] text-sm font-medium focus:ring-4 focus:ring-blue-100 focus:border-blue-600 outline-none transition-all shadow-inner"
                    disabled={isChatLoading}
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isChatLoading}
                    className="absolute right-2 top-2 bottom-2 aspect-square bg-blue-600 text-white rounded-2xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors cursor-pointer"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
