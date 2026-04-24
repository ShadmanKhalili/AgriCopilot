import React, { useState, useRef, useEffect } from 'react';
import { Camera, Loader2, Leaf, Volume2, Sparkles, HelpCircle, Calendar, MapPin, Navigation, Send, User, Bot, MessageSquare, AlertTriangle, CheckCircle2, Plus, X, ShieldAlert, Search, Globe, Radar, ThumbsUp, ThumbsDown, Bug, Activity, Share2, Download, Image as ImageIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toPng } from 'html-to-image';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { diagnoseCrop, deepDiagnoseCrop, generateSpeech, startAgriChat, translateText, summarizeConversation } from '../services/ai';
import { collection, addDoc, doc, updateDoc, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import toast from 'react-hot-toast';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { useUsageTracking } from '../hooks/useUsageTracking';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { translations, Language } from '../utils/translations';
import { resizeImage } from '../utils/imageOptimizer';
import { motion, AnimatePresence } from 'motion/react';
import Tooltip from './Tooltip';
import LocationDisplay from './LocationDisplay';
import { LiveExpertCall } from './LiveExpertCall';
import { geoData } from '../utils/geoData';
import { detectUserLocation } from '../utils/geolocation';

const CROPS = ['tomato', 'brinjal', 'paddy', 'chili', 'watermelon', 'potato', 'onion', 'cucumber', 'betelLeaf'];

interface Props {
  lang: Language;
  globalLocation: { latitude: number; longitude: number } | null;
  setGlobalLocation: (loc: { latitude: number; longitude: number }) => void;
  persistedImages?: { base64: string; mimeType: string }[];
  setPersistedImages?: (images: { base64: string; mimeType: string }[]) => void;
  persistedDiagnosis?: any | null;
  setPersistedDiagnosis?: (diagnosis: any | null) => void;
  persistedDeepDiagnosis?: any | null;
  setPersistedDeepDiagnosis?: (diagnosis: any | null) => void;
  persistedChatMessages?: { role: 'user' | 'model'; text: string }[];
  setPersistedChatMessages?: (messages: { role: 'user' | 'model'; text: string }[]) => void;
  persistedChatSession?: any | null;
  setPersistedChatSession?: (session: any | null) => void;
  persistedAudioUrl?: string | null;
  setPersistedAudioUrl?: (url: string | null) => void;
  persistedCropStage?: string;
  setPersistedCropStage?: (stage: string) => void;
  persistedCrop?: string;
  setPersistedCrop?: (crop: string) => void;
  persistedAnalysisType?: string;
  setPersistedAnalysisType?: (type: string) => void;
}

export default function AgriCopilot({ 
  lang,
  globalLocation,
  setGlobalLocation,
  persistedImages,
  setPersistedImages,
  persistedDiagnosis,
  setPersistedDiagnosis,
  persistedDeepDiagnosis,
  setPersistedDeepDiagnosis,
  persistedChatMessages,
  setPersistedChatMessages,
  persistedChatSession,
  setPersistedChatSession,
  persistedAudioUrl,
  setPersistedAudioUrl,
  persistedCropStage,
  setPersistedCropStage,
  persistedCrop,
  setPersistedCrop,
  persistedAnalysisType,
  setPersistedAnalysisType
}: Props) {
  const [images, setImages] = useState<{ base64: string; mimeType: string }[]>(persistedImages || []);
  const [cropStage, setCropStage] = useState(persistedCropStage || '');
  const [crop, setCrop] = useState(persistedCrop || '');
  const [analysisType, setAnalysisType] = useState(persistedAnalysisType || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isFindingExpert, setIsFindingExpert] = useState(false);
  const [diagnosis, setDiagnosis] = useState<any | null>(persistedDiagnosis || null);
  const [deepDiagnosis, setDeepDiagnosis] = useState<any | null>(persistedDeepDiagnosis || null);
  const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(persistedAudioUrl || null);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isManualLocation, setIsManualLocation] = useState(false);
  const isOnline = useNetworkStatus();
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedUpazila, setSelectedUpazila] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model'; text: string }[]>(persistedChatMessages || []);
  const [currentChatMessage, setCurrentChatMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [chatSummary, setChatSummary] = useState<string | null>(null);
  const [lastDiagnosisId, setLastDiagnosisId] = useState<string | null>(null);
  const [chatSession, setChatSession] = useState<any>(persistedChatSession || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { canUse, incrementUsage, tier, currentUsage, limit } = useUsageTracking();
  const t = translations[lang];

  // Sync with persisted state
  React.useEffect(() => {
    if (setPersistedImages) setPersistedImages(images);
  }, [images, setPersistedImages]);

  useEffect(() => {
    if (setPersistedDiagnosis) setPersistedDiagnosis(diagnosis);
  }, [diagnosis, setPersistedDiagnosis]);

  useEffect(() => {
    if (setPersistedDeepDiagnosis) setPersistedDeepDiagnosis(deepDiagnosis);
  }, [deepDiagnosis, setPersistedDeepDiagnosis]);

  useEffect(() => {
    if (setPersistedChatMessages) setPersistedChatMessages(chatMessages);
  }, [chatMessages, setPersistedChatMessages]);

  useEffect(() => {
    if (setPersistedChatSession) setPersistedChatSession(chatSession);
  }, [chatSession, setPersistedChatSession]);

  useEffect(() => {
    if (setPersistedAudioUrl) setPersistedAudioUrl(audioUrl);
  }, [audioUrl, setPersistedAudioUrl]);

  useEffect(() => {
    if (setPersistedCropStage) setPersistedCropStage(cropStage);
  }, [cropStage, setPersistedCropStage]);

  useEffect(() => {
    if (setPersistedCrop) setPersistedCrop(crop);
  }, [crop, setPersistedCrop]);

  useEffect(() => {
    if (setPersistedAnalysisType) setPersistedAnalysisType(analysisType);
  }, [analysisType, setPersistedAnalysisType]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const remainingSlots = 5 - images.length;
      const filesToProcess = Array.from(files).slice(0, remainingSlots);

      try {
        const processedImages = await Promise.all(
          filesToProcess.map(async (file) => {
            const optimizedDataUrl = await resizeImage(file, 800);
            const base64Data = optimizedDataUrl.split(',')[1];
            return { base64: base64Data, mimeType: 'image/jpeg' };
          })
        );
        
        setImages(prev => [...prev, ...processedImages]);
        setDiagnosis(null);
        setDeepDiagnosis(null);
        setAudioUrl(null);
      } catch (error) {
        console.error("Error optimizing images:", error);
        alert("Failed to process one or more images. Please try again.");
      }
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleVerifyWithExpert = () => {
    setIsFindingExpert(true);
    // Open maps directly with coordinates if available, otherwise general search
    let mapsUrl = '';
    if (globalLocation) {
      const query = encodeURIComponent("Department of Agricultural Extension");
      mapsUrl = `https://www.google.com/maps/search/${query}/@${globalLocation.latitude},${globalLocation.longitude},12z`;
    } else {
      const query = encodeURIComponent("Department of Agricultural Extension Bangladesh");
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    }
    
    setTimeout(() => {
      window.open(mapsUrl, '_blank');
      setIsFindingExpert(false);
    }, 1500);
  };

  const activeDistrict = geoData.find(d => d.id === selectedDistrict);
  const activeUpazila = activeDistrict?.upazilas.find(u => u.id === selectedUpazila);

  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    setLocationError(null);
    setIsManualLocation(false);

    try {
      const coords = await detectUserLocation();
      setGlobalLocation(coords);
      setIsDetectingLocation(false);
    } catch (error: any) {
      console.error("Error detecting location:", error);
      let msg = t.tooltips?.locationError || "Failed to detect location.";
      if (error.code === 1) msg = "Permission denied. Please click the lock icon in your browser's address bar to allow location access, or use manual entry.";
      if (error.code === 3) msg = "Location request timed out. Please try again or use manual entry.";
      setLocationError(msg);
      setIsDetectingLocation(false);
      setIsManualLocation(true);
    }
  };

  const handleManualLocationChange = (upazilaId: string) => {
    setSelectedUpazila(upazilaId);
    const upazila = activeDistrict?.upazilas.find(u => u.id === upazilaId);
    if (upazila) {
      setGlobalLocation({
        latitude: upazila.lat,
        longitude: upazila.lng
      });
    }
  };

  const [isTranslating, setIsTranslating] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null);

  const handleTranslate = async () => {
    if (!diagnosis) return;
    setIsTranslating(true);
    try {
      const targetLang = lang === 'en' ? 'English' : 'Bengali';
      
      // Translate diagnosis
      const translatedDiagnosis = await translateText(diagnosis.diagnosis, targetLang);
      const translatedAdvice = await translateText(diagnosis.verificationAdvice, targetLang);
      
      setDiagnosis(prev => prev ? {
        ...prev,
        diagnosis: translatedDiagnosis,
        verificationAdvice: translatedAdvice
      } : null);

      // Generate new TTS
      try {
        const base64Audio = await generateSpeech(translatedDiagnosis);
        if (base64Audio) {
          const binary = atob(base64Audio);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          
          const blob = new Blob([bytes], { type: 'audio/wav' });
          setAudioUrl(URL.createObjectURL(blob));
        }
      } catch (ttsError) {
        console.error("TTS generation failed after translation:", ttsError);
      }
    } catch (error) {
      console.error("Translation error:", error);
      alert("Failed to translate content.");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentChatMessage.trim() || !chatSession || isChatLoading) return;

    const userMessage = currentChatMessage.trim();
    setCurrentChatMessage('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsChatLoading(true);

    try {
      const response = await chatSession.sendMessage({ message: userMessage });
      setChatMessages(prev => [...prev, { role: 'model', text: response.text || '' }]);
    } catch (error) {
      console.error("Chat error:", error);
      alert(t.tooltips.chatError);
    } finally {
      setIsChatLoading(false);
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const handleSummarizeAndSave = async () => {
    if (chatMessages.length < 2 || isSummarizing) return;
    
    setIsSummarizing(true);
    try {
      const summary = await summarizeConversation(chatMessages, lang);
      setChatSummary(summary);
      
      if (user && lastDiagnosisId) {
        try {
          const diagRef = doc(db, 'diagnoses', lastDiagnosisId);
          await updateDoc(diagRef, {
            chatSummary: summary
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, 'diagnoses');
        }
      }
    } catch (error) {
      console.error("Summarization Error:", error);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDiagnose = async () => {
    if (images.length === 0) return;
    
    if (!isOnline) {
      alert(lang === 'bn' ? 'অফলাইনে কাজ হবে না। দয়া করে ইন্টারনেট সংযোগ চালু করুন।' : 'You are currently offline. Please connect to the internet to run this diagnosis.');
      return;
    }

    if (!canUse()) {
      alert(t.limitReached);
      return;
    }

    setIsLoading(true);
    try {
      const analysisTypeStr = analysisType === 'disease' ? t.disease : analysisType === 'pest' ? t.pest : t.abiotic;
      // Use English values for the AI prompt to ensure consistency, but we can pass the translated ones too
      const cropName = translations.en.crops[crop as keyof typeof translations.en.crops];
      const stageName = translations.en.stages[cropStage as keyof typeof translations.en.stages];
      
      const result = await diagnoseCrop(
        images, 
        cropName, 
        stageName, 
        analysisTypeStr, 
        lang, 
        isAdvanced,
        globalLocation || undefined
      );
      setDiagnosis(result);
      
      // Initialize chat session
      const locationContext = globalLocation ? `GPS Coordinates: ${globalLocation.latitude}, ${globalLocation.longitude}` : "Bangladesh";
      const session = startAgriChat(result.diagnosis, lang, locationContext);
      setChatSession(session);
      setChatMessages([]);
      
      await incrementUsage();

      // Save to Firestore if user is logged in
      if (user) {
        try {
          const allowedSeverities = ['Low', 'Medium', 'High'];
          const severity = allowedSeverities.includes(result.qualitativeSeverity) ? result.qualitativeSeverity : 'Medium';

          const diagDoc = await addDoc(collection(db, 'diagnoses'), {
            userId: String(user.uid),
            crop: String(crop || ''),
            cropStage: String(cropStage || ''),
            analysisType: String(analysisType || ''),
            diagnosisText: String(result.diagnosis || 'No diagnosis provided'),
            qualitativeSeverity: String(severity),
            symptomsBreakdown: Array.isArray(result.symptomsBreakdown) ? result.symptomsBreakdown : [],
            verificationAdvice: String(result.verificationAdvice || 'Consult an expert.'),
            createdAt: new Date().toISOString()
          });
          setLastDiagnosisId(diagDoc.id);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'diagnoses');
        }
      }

      // Generate audio
      const audioBase64 = await generateSpeech(result.diagnosis);
      if (audioBase64) {
        const binary = atob(audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: 'audio/wav' });
        setAudioUrl(URL.createObjectURL(blob));
      }
    } catch (error: any) {
      console.error("Diagnosis failed:", error);
      setDiagnosis(error.message || "Error connecting to AI service. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const [isSharing, setIsSharing] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const infographicRef = useRef<HTMLDivElement>(null);

  const handleShareImage = async () => {
    if (!infographicRef.current || isGeneratingImage) return;
    setIsGeneratingImage(true);
    try {
      // Small delay to ensure any layout shifts are settled
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dataUrl = await toPng(infographicRef.current, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        width: 800,
        height: 1200,
        style: {
          transform: 'scale(1)',
          opacity: '1',
          visibility: 'visible',
        },
        fontEmbedCSS: '', // Try to avoid remote CSS if it causes issues, or leave default
      });
      
      // Convert dataUrl to Blob without using fetch
      const arr = dataUrl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      if (!mimeMatch) throw new Error("Invalid data URL");
      const mime = mimeMatch[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const file = new File([blob], 'agri-copilot-report.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: lang === 'bn' ? 'আমার ফসলের রিপোর্ট' : 'My Crop Report',
          text: lang === 'bn' ? 'কৃষি-কপিলট দিয়ে উৎপন্ন ফসল রিপোর্ট' : 'Crop report generated by Agri-Copilot',
        });
      } else {
        const link = document.createElement('a');
        link.download = `agri-report-${new Date().getTime()}.png`;
        link.href = dataUrl;
        link.click();
        toast.success(lang === 'bn' ? 'রিপোর্ট কার্ডটি সেভ হয়েছে!' : 'Report card saved!');
      }
    } catch (err) {
      console.error("Image generation failed:", err);
      toast.error(lang === 'bn' ? 'ছবি তৈরিতে সমস্যা হয়েছে।' : 'Failed to generate image.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Sharing logic
  const handleShare = async () => {
    if (!diagnosis) return;

    const shareTitle = lang === 'bn' ? `কৃষি-কপিলট রিপোর্ট: ${diagnosis.diagnosis}` : `Agri-Copilot Report: ${diagnosis.diagnosis}`;
    
    let shareBody = lang === 'bn' 
      ? `🌱 *কৃষি-কপিলট ডায়াগনসিস রিপোর্ট*\n\n`
      : `🌱 *Agri-Copilot Diagnosis Report*\n\n`;

    shareBody += `📸 ${lang === 'bn' ? 'ফসল' : 'Crop'}: ${diagnosis.crop || 'Plant'}\n`;
    shareBody += `📍 ${lang === 'bn' ? 'অবস্থা' : 'Status'}: ${diagnosis.status}\n`;
    shareBody += `⚠️ ${lang === 'bn' ? 'তীব্রতা' : 'Severity'}: ${diagnosis.qualitativeSeverity}\n`;
    shareBody += `📋 ${lang === 'bn' ? 'লক্ষণ' : 'Symptoms'}: ${diagnosis.symptomsBreakdown?.join(', ')}\n`;
    shareBody += `🔍 ${lang === 'bn' ? 'নির্ণয়' : 'Diagnosis'}: ${diagnosis.diagnosis}\n\n`;

    if (deepDiagnosis) {
      shareBody += `🔬 *${lang === 'bn' ? 'গভীর বিশ্লেষণ' : 'Deep Analysis'}*\n`;
      shareBody += `📊 ${lang === 'bn' ? 'তীব্রতা স্কোর' : 'Severity Score'}: ${deepDiagnosis.severityScore}/10\n`;
      shareBody += `💡 ${lang === 'bn' ? 'পরামর্শ' : 'Expert Conclusion'}: ${deepDiagnosis.detailedDiagnosis.substring(0, 200)}...\n\n`;
    }

    shareBody += `${lang === 'bn' ? 'আরও জানতে দেখুন' : 'View more at'}: ${window.location.href}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareBody,
          url: window.location.href,
        });
      } catch (err) {
        console.error("Share failed:", err);
      }
    } else {
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(shareBody);
        setIsSharing(true);
        setTimeout(() => setIsSharing(false), 2000);
      } catch (err) {
        console.error("Copy failed:", err);
      }
    }
  };

  const handleDeepDiagnose = async () => {
    if (!diagnosis || images.length === 0) return;
    
    if (!isOnline) {
      alert(lang === 'bn' ? 'অফলাইনে কাজ হবে না। দয়া করে ইন্টারনেট সংযোগ চালু করুন।' : 'You are currently offline. Please connect to the internet to run this diagnosis.');
      return;
    }

    if (!canUse()) {
      alert(t.limitReached);
      return;
    }

    setIsDeepAnalyzing(true);
    try {
      const analysisTypeStr = analysisType === 'disease' ? t.disease : analysisType === 'pest' ? t.pest : t.abiotic;
      const cropName = translations.en.crops[crop as keyof typeof translations.en.crops];
      const stageName = translations.en.stages[cropStage as keyof typeof translations.en.stages];
      
      const result = await deepDiagnoseCrop(
        images, 
        cropName, 
        stageName, 
        analysisTypeStr, 
        lang, 
        diagnosis,
        globalLocation || undefined
      );
      
      setDeepDiagnosis(result);
      await incrementUsage();

      // Save deep diagnosis to Firestore
      if (user && lastDiagnosisId) {
        try {
          await updateDoc(doc(db, 'diagnoses', lastDiagnosisId), {
            deepDiagnosis: result,
            deepDiagnosedAt: new Date().toISOString()
          });
        } catch (error) {
          console.error("Failed to update diagnosis with deep analysis:", error);
        }
      }
    } catch (error: any) {
      console.error("Deep Diagnosis failed:", error);
      alert(lang === 'bn' ? 'গভীর বিশ্লেষণে সমস্যা হয়েছে।' : 'Error performing deep analysis. Please try again.');
    } finally {
      setIsDeepAnalyzing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Ultra-Compact Main Header */}
      <div className="bg-white rounded-3xl p-3 md:p-5 shadow-sm border border-gray-100 mb-4 md:mb-6 relative overflow-hidden group">
        <div className="flex items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-3 md:space-x-5">
            <div className="bg-green-600 p-2 md:p-3 rounded-xl shadow-lg shadow-green-100 flex-shrink-0">
              <Radar className="w-5 h-5 md:w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5 mb-0.5">
                <span className="text-[8px] md:text-[9px] font-display font-black text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 uppercase tracking-widest">Live Engine</span>
              </div>
              <h1 className="text-lg md:text-2xl font-display font-black text-gray-900 tracking-tight leading-none uppercase">
                {t.agriCopilot}
              </h1>
            </div>
          </div>
          
          <div className="hidden sm:flex flex-col items-end opacity-40">
            <div className="font-mono text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">{t.agriCopilotDesc}</div>
            <div className="font-mono text-[8px] font-bold text-gray-300 uppercase">System: v3.1.2_Stable</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col space-y-10 max-w-4xl mx-auto">
        {/* Input Section */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6 bg-white p-8 rounded-[40px] border border-green-100 shadow-xl shadow-green-50/50 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 pointer-events-none"></div>
          
          <div className="relative z-10 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block font-display font-black text-gray-500 uppercase tracking-[0.2em] text-[10px] sm:text-xs">{t.captureImage}</label>
                <span className="text-[10px] font-mono font-bold text-green-700 bg-green-100/50 px-2.5 py-1 rounded-full border border-green-200/50 uppercase tracking-widest">{images.length}/5 Photo Payload</span>
              </div>
              
              {images.length > 0 && (
                <div 
                  className="space-y-4 mb-4" 
                  role="region" 
                  aria-label={lang === 'bn' ? 'আপলোড করা ছবিগুলো' : 'Uploaded photos'}
                >
                  <div className="grid grid-cols-5 gap-3">
                    {images.map((img, idx) => (
                      <motion.div 
                        key={idx} 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="relative aspect-square rounded-2xl overflow-hidden border-2 border-green-100 group shadow-sm"
                      >
                        <img 
                          src={`data:${img.mimeType};base64,${img.base64}`} 
                          alt={lang === 'bn' ? `ফসলের ছবি ${idx + 1}` : `Crop photo ${idx + 1}`} 
                          className="w-full h-full object-cover transition-transform group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(idx);
                          }}
                          aria-label={lang === 'bn' ? 'ছবিটি মুছুন' : 'Remove image'}
                          className="absolute top-2 right-2 bg-red-500/90 backdrop-blur-sm text-white p-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 focus:opacity-100 focus:ring-2 focus:ring-red-400 outline-none"
                        >
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                  {images.length < 5 && (
                    <motion.label 
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="w-full py-3 rounded-2xl border-2 border-dashed border-green-200 flex items-center justify-center cursor-pointer hover:bg-green-50 hover:border-green-400 transition-all bg-green-50/30 focus-within:ring-2 focus-within:ring-green-500 outline-none"
                    >
                      <Plus className="w-5 h-5 text-green-500 mr-2" aria-hidden="true" />
                      <span className="text-xs font-black text-green-600 uppercase tracking-widest">{t.addPhoto}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageUpload} 
                        className="sr-only" 
                        multiple={images.length === 0} 
                        aria-label={t.addPhoto}
                      />
                    </motion.label>
                  )}
                </div>
              )}

              {images.length === 0 && (
                <motion.button
                  type="button"
                  whileHover={{ y: -2 }}
                  className="w-full bg-gradient-to-br from-green-50 to-white rounded-3xl p-10 border-2 border-dashed border-green-200 flex flex-col items-center justify-center text-center group hover:border-green-400 transition-all cursor-pointer shadow-inner focus:ring-2 focus:ring-green-500 outline-none" 
                  onClick={() => fileInputRef.current?.click()}
                  aria-label={t.captureImage}
                >
                  <div className="bg-white p-5 rounded-[24px] shadow-md mb-4 group-hover:scale-110 transition-transform text-green-600">
                    <Camera className="w-12 h-12" aria-hidden="true" />
                  </div>
                  <p className="text-lg font-black text-green-900 mb-1 tracking-tight">{t.captureImage}</p>
                  <p className="text-sm text-green-600/70 font-medium">{lang === 'bn' ? 'পাতা বা ফলের ছবি দিন' : 'Upload leaf or fruit photo'}</p>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    accept="image/*" 
                    onChange={handleImageUpload} 
                    className="sr-only" 
                    multiple
                    aria-hidden="true"
                  />
                </motion.button>
              )}
            </div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDiagnose}
              disabled={images.length === 0 || isLoading || !isOnline}
              aria-busy={isLoading}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-black py-5 px-6 rounded-2xl hover:shadow-lg hover:shadow-green-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 transition-all text-lg tracking-tight focus:ring-4 focus:ring-green-400 outline-none"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-7 h-7 animate-spin" aria-hidden="true" />
                  <span>{t.analyzing}</span>
                </>
              ) : (
                <>
                  <Leaf className="w-7 h-7" aria-hidden="true" />
                  <span>{t.diagnoseDisease}</span>
                </>
              )}
            </motion.button>

          </div>
        </motion.div>

        {/* Results Section */}
        <div className="space-y-6 w-full">
          <AnimatePresence mode="wait">
            {diagnosis ? (
              <motion.div 
                key="result"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-gradient-to-br from-green-600 via-emerald-600 to-green-700 p-1 rounded-[40px] shadow-2xl shadow-green-200 h-full"
              >
                <div className="bg-white/95 backdrop-blur-xl rounded-[38px] p-8 md:p-10 h-full flex flex-col relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-green-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-30 pointer-events-none"></div>
                  
                  {/* Translation Loading Overlay */}
                  <AnimatePresence>
                    {isTranslating && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center space-y-4"
                      >
                        <div className="relative">
                          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                          <Globe className="w-6 h-6 text-blue-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                        <p className="text-blue-600 font-black uppercase tracking-widest text-xs animate-pulse">
                          {lang === 'bn' ? 'অনুবাদ করা হচ্ছে...' : 'Translating...'}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center space-x-4">
                        <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3 rounded-2xl shadow-lg shadow-green-100" aria-hidden="true">
                          <Leaf className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-gray-900 tracking-tight">{t.diagnosisResult}</h3>
                          <div className="flex items-center mt-0.5">
                            <Calendar className="w-3.5 h-3.5 mr-1.5 text-green-500" aria-hidden="true" />
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                              <span className="sr-only">{lang === 'bn' ? 'তারিখ:' : 'Date:'}</span>
                              {new Date().toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          type="button"
                          onClick={handleTranslate}
                          disabled={isTranslating}
                          aria-label={lang === 'en' ? 'বাংলায় অনুবাদ করুন' : 'Translate to English'}
                          className="flex items-center space-x-1 text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full border border-blue-100 uppercase tracking-widest transition-all focus:ring-2 focus:ring-blue-400 outline-none"
                        >
                          {isTranslating ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : <Globe className="w-3 h-3" aria-hidden="true" />}
                          <span>{lang === 'en' ? 'বাংলায় দেখুন' : 'View in English'}</span>
                        </button>
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true"></div>
                        <span className="text-[10px] font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100 uppercase tracking-widest">AI Verified</span>
                      </div>
                    </div>
                    
                    <div 
                      className="flex-1 space-y-8"
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      {diagnosis.status === 'Invalid' ? (
                        <motion.div 
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="bg-red-50 border border-red-100 rounded-3xl p-8 flex items-start space-x-5 shadow-inner"
                        >
                          <div className="bg-white p-3 rounded-2xl shadow-sm" aria-hidden="true">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                          </div>
                          <p className="text-red-900 font-bold text-lg leading-relaxed">{diagnosis.diagnosis}</p>
                        </motion.div>
                      ) : (
                        <>
                          {/* 1. AI Suggestion (Diagnosis Text) */}
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="bg-white rounded-[32px] p-8 md:p-12 border border-green-100/60 text-gray-800 shadow-sm relative overflow-hidden"
                            role="article"
                            aria-labelledby="diagnosis-heading"
                          >
                            <h4 id="diagnosis-heading" className="sr-only">{t.diagnosisResult}</h4>
                            <div className="absolute top-0 right-0 w-full h-full pointer-events-none opacity-[0.03]" aria-hidden="true" style={{ backgroundImage: 'radial-gradient(#166534 0.5px, transparent 0.5px)', backgroundSize: '16px 16px' }}></div>
                            
                            <div className="relative z-10">
                              <div className="flex items-center justify-between mb-8 border-b border-green-50 pb-4">
                                <span className="font-display font-black text-xs uppercase tracking-[0.2em] text-green-700">Digital Diagnosis Core</span>
                                <span className="font-mono text-[10px] text-gray-300 font-bold">ANALYSIS_SEQ: {lastDiagnosisId?.slice(-6) || 'LIVE'}</span>
                              </div>
                              <div className="markdown-body text-base md:text-xl leading-relaxed prose prose-green max-w-none">
                                <ReactMarkdown>{diagnosis.diagnosis}</ReactMarkdown>
                              </div>

                              {/* Helpfulness Rating Section */}
                              <div className="mt-8 pt-6 border-t border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Feedback Algorithm Input</div>
                                  <p className="text-xs font-bold text-gray-500">{lang === 'en' ? 'Was this diagnosis helpful?' : 'এই পরামর্শটি কি আপনার উপকারে এসেছে?'}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button 
                                    disabled={feedbackGiven !== null}
                                    onClick={async () => {
                                      setFeedbackGiven('up');
                                      if (lastDiagnosisId) {
                                        try {
                                          await updateDoc(doc(db, 'diagnoses', lastDiagnosisId), { helpful: true });
                                          toast.success(lang === 'en' ? 'Thanks for your feedback!' : 'আপনার মতামতের জন্য ধন্যবাদ!');
                                        } catch (e) {
                                          console.error(e);
                                        }
                                      }
                                    }}
                                    className={`p-3 rounded-xl border flex items-center space-x-2 transition-all ${feedbackGiven === 'up' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-500 hover:text-green-600 disabled:opacity-50'}`}
                                  >
                                    <ThumbsUp className={`w-4 h-4 ${feedbackGiven === 'up' ? 'fill-current' : ''}`} />
                                    {feedbackGiven === 'up' && <span className="text-xs font-bold pr-1">{lang === 'bn' ? 'উপকারী' : 'Helpful'}</span>}
                                  </button>
                                  <button 
                                    disabled={feedbackGiven !== null}
                                    onClick={async () => {
                                      setFeedbackGiven('down');
                                      if (lastDiagnosisId) {
                                        try {
                                          await updateDoc(doc(db, 'diagnoses', lastDiagnosisId), { helpful: false });
                                          toast.success(lang === 'en' ? 'Thanks for your feedback!' : 'আপনার মতামতের জন্য ধন্যবাদ!');
                                        } catch (e) {
                                          console.error(e);
                                        }
                                      }
                                    }}
                                    className={`p-3 rounded-xl border flex items-center space-x-2 transition-all ${feedbackGiven === 'down' ? 'bg-red-100 border-red-500 text-red-700' : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-500 hover:text-red-600 disabled:opacity-50'}`}
                                  >
                                    <ThumbsDown className={`w-4 h-4 ${feedbackGiven === 'down' ? 'fill-current' : ''}`} />
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                            {/* TTS Audio Player */}
                            {audioUrl && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-10 bg-gradient-to-r from-emerald-100 to-green-100 rounded-[2rem] p-6 md:p-8 border-2 border-green-200/50 shadow-xl shadow-green-900/5 flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6 relative overflow-hidden"
                                role="region"
                                aria-label={lang === 'bn' ? 'এআই অডিও বিশ্লেষণ' : 'AI audio analysis'}
                              >
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
                                <motion.div 
                                  animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                  className="bg-white p-5 rounded-2xl text-green-600 shadow-md relative z-10 border border-green-50"
                                  aria-hidden="true"
                                >
                                  <Volume2 className="w-10 h-10" />
                                </motion.div>
                                <div className="flex-1 w-full text-center md:text-left relative z-10">
                                  <p id="audio-analysis-label" className="text-sm font-black text-green-900 uppercase tracking-widest mb-3 drop-shadow-sm">
                                    {lang === 'bn' ? 'এআই অডিও শুনুন' : 'Listen to AI Analysis'}
                                  </p>
                                  <div className="bg-white/60 p-2 rounded-2xl shadow-inner border border-green-100/50">
                                    <audio 
                                      controls 
                                      src={audioUrl} 
                                      className="w-full h-12 rounded-xl"
                                      aria-labelledby="audio-analysis-label"
                                    />
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </motion.div>

                          {/* 2. Verification Advice */}
                          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-[32px] p-8 shadow-inner">
                            <div className="flex items-center space-x-3 mb-4">
                              <div className="bg-white p-2 rounded-xl shadow-sm">
                                <ShieldAlert className="w-5 h-5 text-blue-500" />
                              </div>
                              <p className="text-xs font-black text-blue-900 uppercase tracking-widest">{t.confidenceAdvice}</p>
                            </div>
                            <div className="markdown-body text-sm text-blue-900/80 font-medium mb-6 prose-sm prose-blue leading-relaxed">
                              <ReactMarkdown>{diagnosis.verificationAdvice}</ReactMarkdown>
                            </div>
                            
                            {diagnosis.confidence < 70 && (
                              <div className="flex items-center space-x-2 text-amber-600 bg-amber-100/50 px-4 py-2 rounded-xl border border-amber-200 w-fit">
                                <AlertTriangle className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">{t.lowConfidenceWarning}</span>
                              </div>
                            )}
                          </div>

                          {/* 3. Symptoms and Severity */}
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                            {/* Severity */}
                            <motion.div 
                              whileHover={{ y: -4, scale: 1.01 }}
                              className="bg-white/80 backdrop-blur-md rounded-3xl p-6 border border-gray-100 shadow-lg shadow-gray-200/50 flex flex-col justify-center relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-100 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 opacity-50"></div>
                              <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2.5 bg-gray-50 rounded-2xl">
                                  <AlertTriangle className="w-5 h-5 text-gray-500" />
                                </div>
                                <p className="text-[11px] font-black text-gray-500 uppercase tracking-widest">{lang === 'bn' ? 'সংক্রমণের মাত্রা' : 'Severity Level'}</p>
                              </div>
                              
                              <div className="flex items-center space-x-4">
                                <div className={`flex-1 h-3 rounded-full overflow-hidden bg-gray-100`}>
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: diagnosis.qualitativeSeverity === 'High' ? '100%' : diagnosis.qualitativeSeverity === 'Medium' ? '60%' : '30%' }}
                                    transition={{ duration: 1, ease: 'easeOut' }}
                                    className={`h-full ${
                                      diagnosis.qualitativeSeverity === 'High' ? 'bg-red-500' : 
                                      diagnosis.qualitativeSeverity === 'Medium' ? 'bg-amber-500' : 
                                      'bg-green-500'
                                    }`}
                                  />
                                </div>
                                <div className={`px-5 py-2 rounded-xl font-black text-lg shadow-sm ${
                                  diagnosis.qualitativeSeverity === 'High' ? 'bg-red-50 text-red-600 border border-red-100' : 
                                  diagnosis.qualitativeSeverity === 'Medium' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 
                                  'bg-green-50 text-green-600 border border-green-100'
                                }`}>
                                  {diagnosis.qualitativeSeverity === 'High' && lang === 'bn' ? 'উচ্চ' : 
                                   diagnosis.qualitativeSeverity === 'Medium' && lang === 'bn' ? 'মাঝারি' : 
                                   diagnosis.qualitativeSeverity === 'Low' && lang === 'bn' ? 'নিম্ন' : 
                                   diagnosis.qualitativeSeverity || 'Unknown'}
                                </div>
                              </div>
                            </motion.div>

                            {/* Symptoms Breakdown */}
                            <motion.div 
                              whileHover={{ y: -4, scale: 1.01 }}
                              className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-3xl p-6 border border-indigo-100/50 shadow-lg shadow-indigo-100/50 relative overflow-hidden flex flex-col"
                            >
                              <div className="absolute top-0 right-0 w-24 h-24 bg-white/40 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                              <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2.5 bg-white rounded-2xl shadow-sm">
                                  <Bug className="w-5 h-5 text-indigo-500" />
                                </div>
                                <p className="text-[11px] font-black text-indigo-500 uppercase tracking-widest">{lang === 'bn' ? 'শনাক্তকৃত লক্ষণ' : 'Visible Symptoms'}</p>
                              </div>
                              <ul className="space-y-2.5 flex-1 font-medium">
                                {diagnosis.symptomsBreakdown?.slice(0, 4).map((symptom: string, idx: number) => (
                                  <motion.li 
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    key={idx} 
                                    className="flex items-start text-sm text-indigo-900/80"
                                  >
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0 mr-2.5"></div>
                                    <span className="leading-snug">{symptom}</span>
                                  </motion.li>
                                ))}
                              </ul>
                            </motion.div>
                          </div>

                          {/* Differential Diagnosis (Chain of Thought Output) */}
                          {(diagnosis.possibleDiseases?.length > 0 || diagnosis.differentialDiagnosis) && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm relative z-10"
                            >
                              <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                                <Activity className="w-4 h-4 mr-2" />
                                {lang === 'bn' ? 'সম্ভাব্য রোগ ও পার্থক্য' : 'Differential Diagnosis'}
                              </h4>
                              
                              {diagnosis.possibleDiseases && diagnosis.possibleDiseases.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                  {diagnosis.possibleDiseases.map((disease: string, idx: number) => (
                                    <span key={idx} className="bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1 rounded-lg text-xs font-bold">
                                      {disease}
                                    </span>
                                  ))}
                                </div>
                              )}
                              
                              {diagnosis.differentialDiagnosis && (
                                <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
                                  <p className="text-sm font-medium text-gray-700 leading-relaxed">
                                    <span className="font-bold text-orange-600 mr-2">Why this diagnosis?</span>
                                    {diagnosis.differentialDiagnosis}
                                  </p>
                                </div>
                              )}
                            </motion.div>
                          )}

                                                    {/* Deep Analysis Result or Button */}
                          <div className="mt-8">
  {/* Chatbot Section (Moved to Left Column) */}
                            <div className="mt-8 pt-8 border-t border-gray-100">
                              <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center space-x-3">
                                  <div className="bg-green-100 p-2.5 rounded-xl shadow-inner">
                                    <MessageSquare className="w-5 h-5 text-green-600" />
                                  </div>
                                  <div>
                                    <h4 className="font-black text-gray-900 text-lg tracking-tight">{lang === 'bn' ? 'কৃষি বিশেষজ্ঞের সাথে কথা বলুন' : 'Chat with Expert AI'}</h4>
                                    <p className="text-[9px] text-gray-400 uppercase tracking-widest font-black mt-0.5">{lang === 'bn' ? 'এই রোগ সম্পর্কে আরও কিছু জানতে চান?' : 'Want to know more about this disease?'}</p>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                  <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Expert Online</span>
                                </div>
                              </div>

                              {diagnosis && (
                                <div className="mb-6">
                                  <LiveExpertCall 
                                    diagnosisContext={`Crop: ${crop}. Stage: ${cropStage}. Diagnosis: ${diagnosis.diagnosis}. Symptoms recognized: ${diagnosis.symptomsBreakdown?.join(', ')}. Action plan: ${diagnosis.verificationAdvice}`} 
                                    lang={lang} 
                                    locationContext={globalLocation ? `GPS: ${globalLocation.latitude}, ${globalLocation.longitude}` : "Bangladesh"} 
                                  />
                                </div>
                              )}

                              <div 
                                className="bg-gray-50/50 backdrop-blur-sm rounded-[24px] border border-gray-100 overflow-hidden flex flex-col h-[400px] shadow-inner relative"
                                role="log"
                                aria-live="polite"
                                aria-label={lang === 'bn' ? 'চ্যাট ইতিহাস' : 'Chat history'}
                              >
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                  {chatMessages.length === 0 && !chatSummary && (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-300">
                                      <motion.div 
                                        animate={{ y: [0, -5, 0] }}
                                        transition={{ duration: 3, repeat: Infinity }}
                                        className="bg-white p-4 rounded-[24px] shadow-sm mb-4"
                                        aria-hidden="true"
                                      >
                                        <Bot className="w-8 h-8 opacity-40" />
                                      </motion.div>
                                      <p className="text-xs font-bold max-w-[200px] leading-relaxed">{lang === 'bn' ? 'আপনার প্রশ্ন জিজ্ঞাসা করুন...' : 'Ask your follow-up questions here......'}</p>
                                    </div>
                                  )}

                                  {chatSummary && (
                                    <motion.div 
                                      initial={{ opacity: 0, scale: 0.95 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      className="bg-green-50 border border-green-100 p-6 rounded-[32px] mb-4 shadow-sm"
                                      role="article"
                                      aria-label={t.tooltips.chatSummaryTitle}
                                    >
                                      <div className="flex items-center space-x-2 text-green-700 mb-3">
                                        <Sparkles className="w-4 h-4" aria-hidden="true" />
                                        <h4 className="text-xs font-black uppercase tracking-widest leading-none">{t.tooltips.chatSummaryTitle}</h4>
                                      </div>
                                      <div className="markdown-body prose-sm prose-green leading-relaxed text-green-900 text-xs">
                                        <ReactMarkdown>{chatSummary}</ReactMarkdown>
                                      </div>
                                    </motion.div>
                                  )}

                                  {!chatSummary && chatMessages.map((msg, idx) => (
                                    <motion.div 
                                      key={idx} 
                                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                      <div className={`max-w-[85%] p-4 rounded-[20px] text-xs shadow-md relative ${
                                        msg.role === 'user' 
                                          ? 'bg-gradient-to-br from-green-600 to-emerald-600 text-white rounded-tr-none' 
                                          : 'bg-white text-gray-800 border border-gray-50 rounded-tl-none'
                                      }`}>
                                        <div className={`flex items-center space-x-1.5 mb-1.5 opacity-70 text-[9px] font-black uppercase tracking-widest ${msg.role === 'user' ? 'text-green-100' : 'text-gray-400'}`}>
                                          {msg.role === 'user' ? <User className="w-3 h-3" aria-hidden="true" /> : <Bot className="w-3 h-3" aria-hidden="true" />}
                                          <span>{msg.role === 'user' ? (lang === 'bn' ? 'আপনি' : 'You') : (lang === 'bn' ? 'বিশেষজ্ঞ এআই' : 'Expert AI')}</span>
                                        </div>
                                        <div className="markdown-body leading-relaxed text-xs prose-sm prose-invert">
                                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                                        </div>
                                      </div>
                                    </motion.div>
                                  ))}
                                  {isChatLoading && (
                                    <motion.div 
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      className="flex justify-start"
                                      aria-label={t.tooltips.aiThinking}
                                    >
                                      <div className="bg-white border border-gray-50 p-4 rounded-[20px] rounded-tl-none shadow-md flex items-center space-x-2">
                                        <div className="flex space-x-1">
                                          <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1 h-1 bg-green-500 rounded-full"></motion.div>
                                          <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1 h-1 bg-green-500 rounded-full"></motion.div>
                                          <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1 h-1 bg-green-500 rounded-full"></motion.div>
                                        </div>
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t.tooltips.aiThinking}</span>
                                      </div>
                                    </motion.div>
                                  )}
                                  <div ref={chatEndRef} />
                                </div>
                                
                                <div className="p-3 bg-white border-t border-gray-100 flex flex-col space-y-2">
                                  {chatMessages.length >= 2 && !chatSummary && (
                                    <button
                                      type="button"
                                      onClick={handleSummarizeAndSave}
                                      disabled={isSummarizing || isChatLoading}
                                      className="w-full flex items-center justify-center space-x-2 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl border border-indigo-100 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50 mb-1 focus:ring-2 focus:ring-indigo-400 outline-none"
                                    >
                                      {isSummarizing ? (
                                        <>
                                          <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                                          <span>{t.tooltips.summarizing}</span>
                                        </>
                                      ) : (
                                        <>
                                          <Sparkles className="w-3 h-3" aria-hidden="true" />
                                          <span>{t.tooltips.saveSummary}</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                  
                                  <div className="relative flex items-center">
                                    <label htmlFor="chat-input" className="sr-only">{lang === 'bn' ? 'আপনার প্রশ্ন' : 'Your question'}</label>
                                    <input
                                      id="chat-input"
                                      type="text"
                                      value={currentChatMessage}
                                      onChange={(e) => setCurrentChatMessage(e.target.value)}
                                      onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleSendMessage(e as any);
                                        }
                                      }}
                                      placeholder={lang === 'bn' ? 'আপনার প্রশ্ন লিখুন...' : 'Type your question...'}
                                      disabled={!diagnosis || isChatLoading || !!chatSummary}
                                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:opacity-50 transition-all font-medium"
                                    />
                                    <button
                                      type="button"
                                      onClick={handleSendMessage}
                                      disabled={!currentChatMessage.trim() || !diagnosis || isChatLoading || !!chatSummary}
                                      aria-label={lang === 'bn' ? 'বার্তা পাঠান' : 'Send message'}
                                      className="absolute right-2 p-2 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:hover:bg-green-500 transition-all shadow-sm focus:ring-2 focus:ring-green-400 outline-none"
                                    >
                                      <Send className="w-4 h-4" aria-hidden="true" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {deepDiagnosis ? (
                            <motion.div 
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-8 bg-white border border-blue-100 rounded-[32px] p-4 md:p-8 shadow-md relative overflow-hidden"
                            >
                              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-80 pointer-events-none"></div>
                              <div className="relative z-10 space-y-6">
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between w-full">
                                      <div className="flex items-center space-x-3">
                                        <div className="bg-blue-600 p-3 rounded-2xl shadow-xl shadow-blue-200 flex-shrink-0">
                                          <ShieldAlert className="w-7 h-7 text-white" />
                                        </div>
                                        <div>
                                          <h3 className="font-display font-black text-blue-900 tracking-tight uppercase text-xl leading-none">{lang === 'bn' ? 'গভীর কৃষি বিশ্লেষণ' : 'Master Agronomist Analysis'}</h3>
                                          <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mt-1.5 inline-block">Grounding Search Active</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-4 bg-blue-50/50 px-6 py-3 rounded-2xl border border-blue-100 shadow-sm">
                                      <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest leading-none">{lang === 'bn' ? 'তীব্রতা স্কোর' : 'Severity Score'}</span>
                                      <div className="flex items-center space-x-1.5">
                                        <span className="text-2xl font-black text-blue-900 leading-none">{deepDiagnosis.severityScore || 'N/A'}</span>
                                        <span className="text-xs font-bold text-blue-400">/ 10</span>
                                      </div>
                                    </div>
                                  </div>

                                <div className="space-y-10">
                                  {/* Severity Meter */}
                                  <div className="bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100 shadow-inner">
                                    <div className="flex items-center justify-between mb-3 px-1">
                                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{lang === 'bn' ? 'নিরাপদ' : 'Safe'}</span>
                                      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">{lang === 'bn' ? 'মারাত্মক' : 'Critical'}</span>
                                    </div>
                                    <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden flex shadow-inner">
                                      <div 
                                        className={`h-full transition-all duration-1000 shadow-sm ${
                                          (deepDiagnosis.severityScore || 0) <= 3 ? 'bg-gradient-to-r from-green-400 to-green-500' : 
                                          (deepDiagnosis.severityScore || 0) <= 7 ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-gradient-to-r from-orange-500 to-red-600'
                                        }`}
                                        style={{ width: `${(deepDiagnosis.severityScore || 0) * 10}%` }}
                                      ></div>
                                    </div>
                                  </div>

                                  {/* Step 1: Hypothesis Verification */}
                                  <div className="bg-blue-50/40 p-8 rounded-[2.5rem] border border-blue-100 shadow-sm relative overflow-hidden group hover:bg-blue-50/60 transition-colors">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50 pointer-events-none group-hover:scale-110 transition-transform"></div>
                                    <h4 className="flex items-center text-[10px] font-black text-blue-800 uppercase tracking-[0.3em] mb-6">
                                      <CheckCircle2 className="w-4 h-4 mr-2.5 text-blue-600" />
                                      {lang === 'bn' ? 'প্রাথমিক অনুমান যাচাই' : 'Initial Hypothesis Verification'}
                                    </h4>
                                    <div className="markdown-body text-[15px] text-blue-950 font-medium leading-relaxed">
                                      <ReactMarkdown>{deepDiagnosis.hypothesesEvaluation}</ReactMarkdown>
                                    </div>
                                  </div>

                                  {/* Step 2: Deductive Reasoning & Alternatives */}
                                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    <div className="lg:col-span-2 space-y-6">
                                      <h4 className="flex items-center text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] pl-2">
                                        <Activity className="w-4 h-4 mr-2.5 text-indigo-500" />
                                        {lang === 'bn' ? 'ডিফারেনশিয়াল যুক্তি এবং প্রমাণ' : 'Differential Reasoning & Evidence'}
                                      </h4>
                                      <div className="markdown-body text-[15px] text-gray-800 leading-relaxed bg-white p-7 rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                        <ReactMarkdown>{deepDiagnosis.differentialReasoning}</ReactMarkdown>
                                      </div>
                                    </div>
                                    <div className="space-y-6">
                                      <h4 className="flex items-center text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] pl-2">
                                        <HelpCircle className="w-4 h-4 mr-2.5 text-gray-400" />
                                        {lang === 'bn' ? 'বিকল্প সম্ভাবনা' : 'Possible Alternatives'}
                                      </h4>
                                      <div className="space-y-3">
                                        {deepDiagnosis.possibleAlternatives?.map((alt: string, idx: number) => (
                                          <motion.div 
                                            key={idx}
                                            whileHover={{ x: 4 }}
                                            className="bg-gray-50/80 px-5 py-4 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-3 group"
                                          >
                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-indigo-400 transition-colors"></div>
                                            <span className="text-xs font-black text-gray-700 tracking-tight">{alt}</span>
                                          </motion.div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Step 3: Final Detailed Diagnosis */}
                                  <div className="bg-white p-8 md:p-10 rounded-[3rem] border-2 border-green-50 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-40 h-40 bg-green-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-40 pointer-events-none"></div>
                                    <h4 className="flex items-center text-[10px] font-black text-green-700 uppercase tracking-[0.3em] mb-6">
                                      <Plus className="w-4 h-4 mr-2.5 text-green-600" />
                                      {lang === 'bn' ? 'চূড়ান্ত বিস্তারিত নির্ণয়' : 'Final Detailed Diagnosis'}
                                    </h4>
                                    <div className="markdown-body text-lg text-gray-950 font-black leading-tight tracking-tight mb-4">
                                      <ReactMarkdown>{deepDiagnosis.detailedDiagnosis}</ReactMarkdown>
                                    </div>
                                  </div>

                                  {/* Step 4: Advanced Treatment (Exact Dosages) */}
                                  <div className="bg-emerald-600/95 backdrop-blur-md p-8 md:p-10 rounded-[3.5rem] shadow-2xl shadow-emerald-200/50 text-white relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                                    <h4 className="flex items-center text-[10px] font-black text-emerald-100 uppercase tracking-[0.4em] mb-8">
                                      <ShieldAlert className="w-5 h-5 mr-3 text-white" />
                                      {lang === 'bn' ? 'উন্নত চিকিৎসা ব্যবস্থা এবং সঠিক মাত্রা' : 'Advanced Treatment & Exact Dosages'}
                                    </h4>
                                    <div className="markdown-body text-white/95 text-[15px] font-medium leading-relaxed space-y-4">
                                      <ReactMarkdown>{deepDiagnosis.advancedTreatment}</ReactMarkdown>
                                    </div>
                                  </div>

                                  {/* Step 5: Timeline & Context */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="bg-amber-50/50 p-7 rounded-[2.5rem] border border-amber-100 shadow-sm hover:bg-amber-50/80 transition-colors">
                                      <h4 className="flex items-center text-[10px] font-black text-amber-800 uppercase tracking-[0.3em] mb-5">
                                        <Calendar className="w-4 h-4 mr-2.5 text-amber-600" />
                                        {lang === 'bn' ? 'সফলতার সময়সীমা' : 'Actionable Timeline'}
                                      </h4>
                                      <div className="markdown-body text-[13px] text-amber-950 font-bold leading-relaxed">
                                        <ReactMarkdown>{deepDiagnosis.recoveryTimeline}</ReactMarkdown>
                                      </div>
                                    </div>
                                    <div className="bg-indigo-50/50 p-7 rounded-[2.5rem] border border-indigo-100 shadow-sm hover:bg-indigo-50/80 transition-colors">
                                      <h4 className="flex items-center text-[10px] font-black text-indigo-800 uppercase tracking-[0.3em] mb-5">
                                        <Globe className="w-4 h-4 mr-2.5 text-indigo-600" />
                                        {lang === 'bn' ? 'পরিবেশ ও প্রাদুর্ভাবের তথ্য' : 'Environmental & Outbreak Context'}
                                      </h4>
                                      <div className="markdown-body text-[13px] text-indigo-950 font-bold leading-relaxed">
                                        <ReactMarkdown>{deepDiagnosis.environmentalContext}</ReactMarkdown>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Technical Details (Pathogen) - Moved to bottom */}
                                  <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-200 opacity-60 hover:opacity-100 transition-opacity">
                                    <h4 className="flex items-center text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2">
                                      <Bug className="w-3 h-3 mr-2" />
                                      {lang === 'bn' ? 'প্রযুক্তিগত তথ্য (প্যাথোজেন)' : 'Technical Pathogen Data'}
                                    </h4>
                                    <p className="text-[11px] font-bold text-gray-500 leading-relaxed italic">
                                      {deepDiagnosis.biologicalCause}
                                    </p>
                                  </div>
                                  
                                  {deepDiagnosis.sources && deepDiagnosis.sources.length > 0 && (
                                    <div className="pt-4 border-t border-gray-100">
                                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{lang === 'bn' ? 'যাচাইকৃত তথ্যসূত্র' : 'Verified Sources'}</h4>
                                      <div className="flex flex-wrap gap-2">
                                        {deepDiagnosis.sources.map((source: string, idx: number) => (
                                          <div key={idx} className="flex items-center space-x-2 text-[10px] bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                                            <Globe className="w-2.5 h-2.5 text-gray-400" />
                                            <span className="text-gray-500 font-bold max-w-[150px] truncate">{source.replace(/https?:\/\/(www\.)?/, '')}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          ) : (
                            <div className="mt-8 flex justify-center">
                              <motion.button 
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleDeepDiagnose}
                                disabled={isDeepAnalyzing}
                                className="group relative inline-flex items-center justify-center space-x-3 bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black py-4 px-8 rounded-2xl hover:shadow-xl hover:shadow-blue-200 disabled:opacity-50 transition-all focus:ring-4 focus:ring-blue-400 outline-none w-full sm:w-auto"
                              >
                                {isDeepAnalyzing ? (
                                  <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span className="uppercase tracking-widest">{lang === 'bn' ? 'বিশ্লেষণ করা হচ্ছে...' : 'Performing Deep Analysis...'}</span>
                                  </>
                                ) : (
                                  <>
                                    <div className="absolute inset-0 bg-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <Globe className="w-5 h-5 relative z-10" />
                                    <span className="uppercase tracking-widest relative z-10">
                                      {lang === 'bn' ? 'যাচাই ও গভীর বিশ্লেষণ করুন' : 'Verify & Deep Analysis'}
                                    </span>
                                  </>
                                )}
                              </motion.button>
                            </div>
                          )}

                          {/* 4. Chat with Expert (Search DAE) - Indicative */}
                          <div className="flex justify-center pt-2 pb-4">
                            <motion.button 
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={handleVerifyWithExpert}
                              disabled={isFindingExpert}
                              className="text-gray-500 hover:text-blue-600 py-3 px-6 rounded-full text-xs font-bold uppercase tracking-widest flex items-center justify-center space-x-2 transition-all border border-transparent hover:border-blue-100 hover:bg-blue-50"
                            >
                              {isFindingExpert ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Search className="w-4 h-4" />
                              )}
                              <span>{isFindingExpert ? t.findingExpert : t.verifyWithExpert} (Indicative)</span>
                            </motion.button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-[40px] p-16 border border-dashed border-gray-200 h-full flex flex-col items-center justify-center text-gray-400 text-center relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-gray-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50"></div>
                <div className="bg-gray-50 p-10 rounded-[32px] mb-8 shadow-inner relative z-10">
                  <Leaf className="w-20 h-20 text-gray-200" />
                </div>
                <p className="text-2xl font-black text-gray-300 max-w-sm leading-tight relative z-10 tracking-tight">Upload an image and click Diagnose to see results here.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Settings and Info Section */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8 space-y-6 bg-white/50 backdrop-blur-sm p-6 sm:p-8 rounded-[32px] border border-gray-100 shadow-sm"
        >
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="font-black text-gray-700 uppercase tracking-widest text-sm">Additional Configuration & Details</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">{t.produceType}</label>
                <select 
                  value={crop} 
                  onChange={(e) => setCrop(e.target.value)}
                  className="w-full rounded-2xl border-green-100 shadow-sm focus:border-green-500 focus:ring-green-500 bg-green-50/30 p-4 border text-base font-bold text-gray-900 transition-all"
                >
                  <option value="">{lang === 'bn' ? 'স্বয়ংক্রিয় সনাক্তকরণ' : 'Auto detect'}</option>
                  {CROPS.map(c => (
                    <option key={c} value={c}>
                      {t.crops[c as keyof typeof t.crops]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">{t.cropStage}</label>
                <select 
                  value={cropStage} 
                  onChange={(e) => setCropStage(e.target.value)}
                  className="w-full rounded-2xl border-green-100 shadow-sm focus:border-green-500 focus:ring-green-500 bg-green-50/30 p-4 border text-base font-bold text-gray-900 transition-all"
                >
                  <option value="">{lang === 'bn' ? 'স্বয়ংক্রিয় সনাক্তকরণ' : 'Auto detect'}</option>
                  {Object.keys(translations.en.stages).map(s => (
                    <option key={s} value={s}>
                      {t.stages[s as keyof typeof t.stages]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-green-100 shadow-sm flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 id="location-label" className="font-black text-gray-900 text-sm uppercase tracking-widest mb-1">{t.location}</h4>
                  <p className="text-xs text-gray-500 font-medium">{globalLocation ? t.tooltips.locationDetected : t.tooltips.locationDesc}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsManualLocation(!isManualLocation)}
                    className={`p-2 rounded-xl transition-colors border focus:ring-2 focus:ring-amber-400 outline-none ${
                      isManualLocation 
                        ? 'bg-amber-50 border-amber-200 text-amber-700' 
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                    aria-label={isManualLocation ? (lang === 'bn' ? 'জিপিএস ব্যবহার করুন' : 'Use GPS') : (lang === 'bn' ? 'ম্যানুয়ালি সেট করুন' : 'Set Manually')}
                    aria-pressed={isManualLocation}
                  >
                    <Navigation className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button 
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={isDetectingLocation}
                    className={`flex items-center space-x-2 font-black uppercase tracking-widest px-5 py-3 rounded-2xl transition-all shadow-sm focus:ring-2 focus:ring-green-500 outline-none ${
                      globalLocation 
                        ? 'bg-green-50 text-green-700 hover:bg-green-100' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    } disabled:opacity-50`}
                    aria-label={t.tooltips.detectLocation}
                  >
                    {isDetectingLocation ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : globalLocation ? (
                      <Navigation className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <MapPin className="w-4 h-4" aria-hidden="true" />
                    )}
                    <span className="text-xs">{isDetectingLocation ? t.tooltips.detecting : globalLocation ? 'Update' : t.tooltips.detectLocation}</span>
                  </button>
                </div>
              </div>

              {isManualLocation && (
                <div 
                  className="pt-2 border-t border-green-50 flex flex-col gap-2"
                  role="group"
                  aria-labelledby="location-label"
                >
                  <select
                    value={selectedDistrict}
                    onChange={(e) => {
                      setSelectedDistrict(e.target.value);
                      const newDistrict = geoData.find(d => d.id === e.target.value);
                      if (newDistrict && newDistrict.upazilas.length > 0) {
                        handleManualLocationChange(newDistrict.upazilas[0].id);
                      } else {
                        setSelectedUpazila('');
                      }
                    }}
                    className="w-full bg-green-50/30 border border-green-100 rounded-xl px-4 py-2 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-green-500 outline-none"
                    aria-label={lang === 'bn' ? 'জেলা নির্বাচন করুন' : 'Select District'}
                  >
                    <option value="">{lang === 'bn' ? 'জেলা নির্বাচন করুন (ঐচ্ছিক)' : 'Select District (Optional)'}</option>
                    {geoData.map(d => (
                      <option key={d.id} value={d.id}>{lang === 'bn' ? d.bn_name : d.name}</option>
                    ))}
                  </select>
                  <select
                    value={selectedUpazila}
                    onChange={(e) => handleManualLocationChange(e.target.value)}
                    className="w-full bg-green-50/30 border border-green-100 rounded-xl px-4 py-2 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-green-500 outline-none"
                    disabled={!activeDistrict || activeDistrict.upazilas.length === 0}
                    aria-label={lang === 'bn' ? 'উপজেলা নির্বাচন করুন' : 'Select Upazila'}
                  >
                    <option value="">{lang === 'bn' ? 'উপজেলা নির্বাচন করুন (ঐচ্ছিক)' : 'Select Upazila (Optional)'}</option>
                    {activeDistrict?.upazilas.map(u => (
                      <option key={u.id} value={u.id}>{lang === 'bn' ? u.bn_name : u.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-green-600 mt-2 font-medium">
                    {t.manualLocationNotice}
                  </p>
                </div>
              )}

              {locationError && <p className="text-[10px] text-red-500 font-bold">{locationError}</p>}
            </div>

            {globalLocation && (
              <LocationDisplay coords={globalLocation} lang={lang} color="green" />
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label id="analysis-type-label" className="block text-xs font-black text-gray-400 uppercase tracking-widest">{t.analysisType}</label>
                <Tooltip content={t.tooltips[analysisType as keyof typeof t.tooltips]}>
                  <button type="button" aria-label={t.tooltips[analysisType as keyof typeof t.tooltips]} className="focus:outline-none">
                    <HelpCircle className="w-4 h-4 text-gray-300 cursor-help" aria-hidden="true" />
                  </button>
                </Tooltip>
              </div>
              <select 
                value={analysisType} 
                onChange={(e) => setAnalysisType(e.target.value)}
                aria-labelledby="analysis-type-label"
                className="w-full rounded-2xl border-green-100 shadow-sm focus:border-green-500 focus:ring-green-500 bg-green-50/30 p-4 border text-base font-bold text-gray-900 transition-all outline-none"
              >
                <option value="disease">{t.disease}</option>
                <option value="pest">{t.pest}</option>
                <option value="abiotic">{t.abiotic}</option>
              </select>
            </div>

            <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-white p-4 rounded-2xl border border-green-100 shadow-inner">
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  role="switch"
                  id="advanced-toggle"
                  aria-checked={isAdvanced}
                  aria-label={t.advancedAnalysis}
                  disabled={tier !== 'premium'}
                  onClick={() => tier === 'premium' && setIsAdvanced(!isAdvanced)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      tier === 'premium' && setIsAdvanced(!isAdvanced);
                    }
                  }}
                  className={`relative inline-block w-10 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer focus:ring-2 focus:ring-green-500 outline-none ${tier !== 'premium' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className={`block h-6 overflow-hidden bg-gray-200 rounded-full transition-colors ${isAdvanced ? 'bg-green-400' : ''}`}></div>
                  <div className={`absolute left-0.5 top-0.5 w-5 h-5 transition duration-200 ease-in-out transform bg-white border-2 border-gray-300 rounded-full ${isAdvanced ? 'translate-x-4 border-green-500' : ''}`}></div>
                </button>
                <label htmlFor="advanced-toggle" className={`text-sm font-black uppercase tracking-widest flex items-center cursor-pointer ${tier === 'premium' ? 'text-gray-700' : 'text-gray-400'}`}>
                  <Sparkles className="w-4 h-4 mr-1.5 text-yellow-500" aria-hidden="true" />
                  {t.advancedAnalysis}
                </label>
              </div>
              <Tooltip content={t.tooltips.advanced}>
                <button type="button" aria-label={t.tooltips.advanced} className="focus:outline-none">
                  <HelpCircle className="w-4 h-4 text-gray-300 cursor-help" aria-hidden="true" />
                </button>
              </Tooltip>
            </div>

            <div className="pt-2">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-1">
                  <span id="usage-label" className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.usage} (Daily)</span>
                  <Tooltip content={t.tooltips.usage}>
                    <button type="button" aria-label={t.tooltips.usage} className="focus:outline-none">
                      <HelpCircle className="w-3 h-3 text-gray-300" aria-hidden="true" />
                    </button>
                  </Tooltip>
                </div>
                <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">{currentUsage} / {limit}</span>
              </div>
              <div 
                className="w-full bg-green-100/50 rounded-full h-2 overflow-hidden shadow-inner"
                role="progressbar"
                aria-labelledby="usage-label"
                aria-valuenow={currentUsage}
                aria-valuemin={0}
                aria-valuemax={limit}
              >
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(currentUsage / limit) * 100}%` }}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-full rounded-full"
                />
              </div>
            </div>

            

            {/* Safety Disclaimer */}
            <div className="mt-6 bg-amber-50/50 backdrop-blur-sm border border-amber-100 rounded-2xl p-5 shadow-inner">
              <div className="flex items-center space-x-3 mb-2">
                <div className="bg-amber-100 p-1.5 rounded-lg">
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                </div>
                <h4 className="font-black text-amber-900 text-xs uppercase tracking-widest">{t.disclaimerTitle}</h4>
              </div>
              <p className="text-[11px] text-amber-800/80 leading-relaxed font-medium">
                {t.disclaimerText}
              </p>
            </div>

            
        </motion.div>

      </div>
    </motion.div>
  );
}