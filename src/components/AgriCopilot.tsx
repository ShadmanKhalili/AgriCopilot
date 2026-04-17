import React, { useState, useRef, useEffect } from 'react';
import { Camera, Loader2, Leaf, Volume2, Sparkles, HelpCircle, Calendar, MapPin, Navigation, Send, User, Bot, MessageSquare, AlertTriangle, CheckCircle2, Plus, X, ShieldAlert, Search, Globe } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { diagnoseCrop, generateSpeech, startAgriChat, translateText, summarizeConversation } from '../services/ai';
import { collection, addDoc, doc, updateDoc, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { useUsageTracking } from '../hooks/useUsageTracking';
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
  const [cropStage, setCropStage] = useState(persistedCropStage || 'vegetative');
  const [crop, setCrop] = useState(persistedCrop || CROPS[0]);
  const [analysisType, setAnalysisType] = useState(persistedAnalysisType || 'disease');
  const [isLoading, setIsLoading] = useState(false);
  const [isFindingExpert, setIsFindingExpert] = useState(false);
  const [diagnosis, setDiagnosis] = useState<any | null>(persistedDiagnosis || null);
  const [audioUrl, setAudioUrl] = useState<string | null>(persistedAudioUrl || null);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isManualLocation, setIsManualLocation] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState(geoData[0].id);
  const [selectedUpazila, setSelectedUpazila] = useState(geoData[0].upazilas[0]?.id || '');
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
      const remainingSlots = 3 - images.length;
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
    
    if (!canUse()) {
      alert(t.limitReached);
      return;
    }

    setIsLoading(true);
    try {
      const analysisTypeStr = analysisType === 'disease' ? t.disease : analysisType === 'pest' ? t.pest : t.nutrient;
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
            userId: user.uid,
            crop,
            cropStage,
            analysisType,
            diagnosisText: result.diagnosis || 'No diagnosis provided',
            qualitativeSeverity: severity,
            symptomsBreakdown: Array.isArray(result.symptomsBreakdown) ? result.symptomsBreakdown : [],
            verificationAdvice: result.verificationAdvice || 'Consult an expert.',
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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="bg-white rounded-[40px] p-5 md:p-8 shadow-xl shadow-green-900/5 border border-green-100 mb-6 md:mb-8">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="bg-green-50 p-3 md:p-4 rounded-2xl flex-shrink-0">
            <Leaf className="w-6 h-6 md:w-8 h-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl md:text-3xl font-black text-gray-900 tracking-tight leading-tight">{t.agriCopilot}</h2>
            <p className="text-gray-500 text-xs md:text-base font-medium">{t.agriCopilotDesc}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input Section */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-5 space-y-6 bg-white p-8 rounded-[40px] border border-green-100 shadow-xl shadow-green-50/50 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 pointer-events-none"></div>
          
          <div className="relative z-10 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">{t.captureImage}</label>
                <span className="text-[10px] font-black text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100 uppercase tracking-widest">{images.length}/3 {t.photoLimit}</span>
              </div>
              
              {images.length > 0 && (
                <div className="space-y-4 mb-4">
                  <div className="grid grid-cols-3 gap-3">
                    {images.map((img, idx) => (
                      <motion.div 
                        key={idx} 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="relative aspect-square rounded-2xl overflow-hidden border-2 border-green-100 group shadow-sm"
                      >
                        <img 
                          src={`data:${img.mimeType};base64,${img.base64}`} 
                          alt={`Upload ${idx + 1}`} 
                          className="w-full h-full object-cover transition-transform group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(idx);
                          }}
                          className="absolute top-2 right-2 bg-red-500/90 backdrop-blur-sm text-white p-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                  {images.length < 3 && (
                    <motion.label 
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="w-full py-3 rounded-2xl border-2 border-dashed border-green-200 flex items-center justify-center cursor-pointer hover:bg-green-50 hover:border-green-400 transition-all bg-green-50/30"
                    >
                      <Plus className="w-5 h-5 text-green-500 mr-2" />
                      <span className="text-xs font-black text-green-600 uppercase tracking-widest">{t.addPhoto}</span>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" multiple={images.length === 0} />
                    </motion.label>
                  )}
                </div>
              )}

              {images.length === 0 && (
                <motion.div 
                  whileHover={{ y: -2 }}
                  className="bg-gradient-to-br from-green-50 to-white rounded-3xl p-10 border-2 border-dashed border-green-200 flex flex-col items-center justify-center text-center group hover:border-green-400 transition-all cursor-pointer shadow-inner" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="bg-white p-5 rounded-[24px] shadow-md mb-4 group-hover:scale-110 transition-transform text-green-600">
                    <Camera className="w-12 h-12" />
                  </div>
                  <p className="text-lg font-black text-green-900 mb-1 tracking-tight">{t.captureImage}</p>
                  <p className="text-sm text-green-600/70 font-medium">{lang === 'bn' ? 'পাতা বা ফলের ছবি দিন' : 'Upload leaf or fruit photo'}</p>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    accept="image/*" 
                    onChange={handleImageUpload} 
                    className="hidden" 
                    multiple
                  />
                </motion.div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">{t.produceType}</label>
                <select 
                  value={crop} 
                  onChange={(e) => setCrop(e.target.value)}
                  className="w-full rounded-2xl border-green-100 shadow-sm focus:border-green-500 focus:ring-green-500 bg-green-50/30 p-4 border text-base font-bold text-gray-900 transition-all"
                >
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
                  <h4 className="font-black text-gray-900 text-sm uppercase tracking-widest mb-1">{t.location}</h4>
                  <p className="text-xs text-gray-500 font-medium">{globalLocation ? t.tooltips.locationDetected : t.tooltips.locationDesc}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsManualLocation(!isManualLocation)}
                    className={`p-2 rounded-xl transition-colors border ${
                      isManualLocation 
                        ? 'bg-amber-50 border-amber-200 text-amber-700' 
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                    title={isManualLocation ? "Use GPS" : "Set Manually"}
                  >
                    <Navigation className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={handleDetectLocation}
                    disabled={isDetectingLocation}
                    className={`flex items-center space-x-2 font-black uppercase tracking-widest px-5 py-3 rounded-2xl transition-all shadow-sm ${
                      globalLocation 
                        ? 'bg-green-50 text-green-700 hover:bg-green-100' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {isDetectingLocation ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : globalLocation ? (
                      <Navigation className="w-4 h-4" />
                    ) : (
                      <MapPin className="w-4 h-4" />
                    )}
                    <span className="text-xs">{isDetectingLocation ? t.tooltips.detecting : globalLocation ? 'Update' : t.tooltips.detectLocation}</span>
                  </button>
                </div>
              </div>

              {isManualLocation && (
                <div className="pt-2 border-t border-green-50 flex flex-col gap-2">
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
                  >
                    {geoData.map(d => (
                      <option key={d.id} value={d.id}>{lang === 'bn' ? d.bn_name : d.name}</option>
                    ))}
                  </select>
                  <select
                    value={selectedUpazila}
                    onChange={(e) => handleManualLocationChange(e.target.value)}
                    className="w-full bg-green-50/30 border border-green-100 rounded-xl px-4 py-2 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-green-500 outline-none"
                    disabled={!activeDistrict || activeDistrict.upazilas.length === 0}
                  >
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
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">{t.analysisType}</label>
                <Tooltip content={t.tooltips[analysisType as keyof typeof t.tooltips]}>
                  <HelpCircle className="w-4 h-4 text-gray-300 cursor-help" />
                </Tooltip>
              </div>
              <select 
                value={analysisType} 
                onChange={(e) => setAnalysisType(e.target.value)}
                className="w-full rounded-2xl border-green-100 shadow-sm focus:border-green-500 focus:ring-green-500 bg-green-50/30 p-4 border text-base font-bold text-gray-900 transition-all"
              >
                <option value="disease">{t.disease}</option>
                <option value="pest">{t.pest}</option>
                <option value="nutrient">{t.nutrient}</option>
              </select>
            </div>

            <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-white p-4 rounded-2xl border border-green-100 shadow-inner">
              <div className="flex items-center space-x-3">
                <div className="relative inline-block w-10 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer">
                  <input 
                    type="checkbox" 
                    id="advanced" 
                    checked={isAdvanced}
                    onChange={(e) => setIsAdvanced(e.target.checked)}
                    disabled={tier !== 'premium'}
                    className="absolute w-6 h-6 transition duration-200 ease-in-out transform bg-white border-2 border-gray-300 rounded-full appearance-none cursor-pointer checked:translate-x-4 checked:border-green-500 focus:outline-none disabled:opacity-50"
                  />
                  <label htmlFor="advanced" className={`block h-6 overflow-hidden bg-gray-200 rounded-full cursor-pointer ${isAdvanced ? 'bg-green-400' : ''}`}></label>
                </div>
                <label htmlFor="advanced" className={`text-sm font-black uppercase tracking-widest flex items-center ${tier === 'premium' ? 'text-gray-700' : 'text-gray-400'}`}>
                  <Sparkles className="w-4 h-4 mr-1.5 text-yellow-500" />
                  {t.advancedAnalysis}
                </label>
              </div>
              <Tooltip content={t.tooltips.advanced}>
                <HelpCircle className="w-4 h-4 text-gray-300 cursor-help" />
              </Tooltip>
            </div>

            <div className="pt-2">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.usage} (Daily)</span>
                  <Tooltip content={t.tooltips.usage}>
                    <HelpCircle className="w-3 h-3 text-gray-300" />
                  </Tooltip>
                </div>
                <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">{currentUsage} / {limit}</span>
              </div>
              <div className="w-full bg-green-100/50 rounded-full h-2 overflow-hidden shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(currentUsage / limit) * 100}%` }}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-full rounded-full"
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDiagnose}
              disabled={images.length === 0 || isLoading}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-black py-5 px-6 rounded-2xl hover:shadow-lg hover:shadow-green-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 transition-all text-lg tracking-tight"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-7 h-7 animate-spin" />
                  <span>{t.analyzing}</span>
                </>
              ) : (
                <>
                  <Leaf className="w-7 h-7" />
                  <span>{t.diagnoseDisease}</span>
                </>
              )}
            </motion.button>

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

              <div className="bg-gray-50/50 backdrop-blur-sm rounded-[24px] border border-gray-100 overflow-hidden flex flex-col h-[400px] shadow-inner relative">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {chatMessages.length === 0 && !chatSummary && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-300">
                      <motion.div 
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="bg-white p-4 rounded-[24px] shadow-sm mb-4"
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
                    >
                      <div className="flex items-center space-x-2 text-green-700 mb-3">
                        <Sparkles className="w-4 h-4" />
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
                          {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
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
                      onClick={handleSummarizeAndSave}
                      disabled={isSummarizing || isChatLoading}
                      className="w-full flex items-center justify-center space-x-2 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl border border-indigo-100 transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-50 mb-1"
                    >
                      {isSummarizing ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>{t.tooltips.summarizing}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          <span>{t.tooltips.saveSummary}</span>
                        </>
                      )}
                    </button>
                  )}
                  
                  <div className="relative flex items-center">
                    <input
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
                      onClick={handleSendMessage}
                      disabled={!currentChatMessage.trim() || !diagnosis || isChatLoading || !!chatSummary}
                      className="absolute right-2 p-2 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:hover:bg-green-500 transition-all shadow-sm"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Results Section */}
        <div className="lg:col-span-7 space-y-6">
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
                        <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-3 rounded-2xl shadow-lg shadow-green-100">
                          <Leaf className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-gray-900 tracking-tight">{t.diagnosisResult}</h3>
                          <div className="flex items-center mt-0.5">
                            <Calendar className="w-3.5 h-3.5 mr-1.5 text-green-500" />
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                              {new Date().toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={handleTranslate}
                          disabled={isTranslating}
                          className="flex items-center space-x-1 text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full border border-blue-100 uppercase tracking-widest transition-all"
                        >
                          {isTranslating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                          <span>{lang === 'en' ? 'Translate to EN' : 'Translate to BN'}</span>
                        </button>
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-[10px] font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-100 uppercase tracking-widest">AI Verified</span>
                      </div>
                    </div>
                    
                    <div className="flex-1 space-y-8">
                      {diagnosis.status === 'Invalid' ? (
                        <motion.div 
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="bg-red-50 border border-red-100 rounded-3xl p-8 flex items-start space-x-5 shadow-inner"
                        >
                          <div className="bg-white p-3 rounded-2xl shadow-sm">
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
                            className="bg-white rounded-[32px] p-8 md:p-10 border border-gray-100 text-gray-800 shadow-sm relative overflow-hidden"
                          >
                            <div className="absolute top-0 left-0 w-1 h-full bg-green-500 opacity-20"></div>
                            <div className="markdown-body text-base md:text-lg leading-relaxed prose prose-green max-w-none">
                              <ReactMarkdown>{diagnosis.diagnosis}</ReactMarkdown>
                            </div>
                            
                            {/* TTS Audio Player */}
                            {audioUrl && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-8 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100 shadow-inner flex items-center space-x-4"
                              >
                                <motion.div 
                                  animate={{ scale: [1, 1.1, 1] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                  className="bg-white p-3 rounded-xl text-green-600 shadow-sm"
                                >
                                  <Volume2 className="w-6 h-6" />
                                </motion.div>
                                <div className="flex-1">
                                  <p className="text-[10px] font-black text-green-900 uppercase tracking-widest mb-2">{t.playAudio}</p>
                                  <audio controls src={audioUrl} className="w-full h-8 rounded-lg" />
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
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {/* Severity */}
                            <motion.div 
                              whileHover={{ y: -5 }}
                              className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm flex flex-col items-center justify-center relative overflow-hidden"
                            >
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">{lang === 'bn' ? 'তীব্রতা' : 'Severity'}</p>
                              <div className={`px-6 py-3 rounded-2xl font-black text-xl ${
                                diagnosis.qualitativeSeverity === 'High' ? 'bg-red-100 text-red-600' : 
                                diagnosis.qualitativeSeverity === 'Medium' ? 'bg-amber-100 text-amber-600' : 
                                'bg-green-100 text-green-600'
                              }`}>
                                {diagnosis.qualitativeSeverity || 'Unknown'}
                              </div>
                            </motion.div>

                            {/* Symptoms Breakdown */}
                            <motion.div 
                              whileHover={{ y: -5 }}
                              className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm flex flex-col justify-center relative overflow-hidden"
                            >
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">{lang === 'bn' ? 'লক্ষণসমূহ' : 'Visible Symptoms'}</p>
                              <ul className="space-y-2">
                                {diagnosis.symptomsBreakdown?.map((symptom: string, idx: number) => (
                                  <li key={idx} className="flex items-start space-x-2 text-sm text-gray-700 font-medium">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0"></div>
                                    <span>{symptom}</span>
                                  </li>
                                ))}
                              </ul>
                            </motion.div>
                          </div>

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
      </div>
    </motion.div>
  );
}
