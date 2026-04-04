import React, { useState, useRef, useEffect } from 'react';
import { Camera, Loader2, Leaf, Volume2, Sparkles, HelpCircle, Calendar, MapPin, Navigation, Send, User, Bot, MessageSquare, AlertTriangle, CheckCircle2, Plus, X, ShieldAlert, Search } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { diagnoseCrop, generateSpeech, startAgriChat } from '../services/ai';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { useUsageTracking } from '../hooks/useUsageTracking';
import { translations, Language } from '../utils/translations';
import { resizeImage } from '../utils/imageOptimizer';
import { motion, AnimatePresence } from 'motion/react';
import Tooltip from './Tooltip';

const UPAZILAS = ['sadar', 'chakaria', 'ukhiya', 'teknaf', 'ramu', 'peua', 'kutubdia', 'moheshkhali'];
const CROPS = ['tomato', 'brinjal', 'paddy', 'chili', 'watermelon', 'potato', 'onion', 'cucumber', 'betelLeaf'];

interface Props {
  lang: Language;
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
  persistedUpazila?: string;
  setPersistedUpazila?: (upazila: string) => void;
  persistedCrop?: string;
  setPersistedCrop?: (crop: string) => void;
  persistedAnalysisType?: string;
  setPersistedAnalysisType?: (type: string) => void;
}

export default function AgriCopilot({ 
  lang,
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
  persistedUpazila,
  setPersistedUpazila,
  persistedCrop,
  setPersistedCrop,
  persistedAnalysisType,
  setPersistedAnalysisType
}: Props) {
  const [images, setImages] = useState<{ base64: string; mimeType: string }[]>(persistedImages || []);
  const [upazila, setUpazila] = useState(persistedUpazila || UPAZILAS[0]);
  const [crop, setCrop] = useState(persistedCrop || CROPS[0]);
  const [analysisType, setAnalysisType] = useState(persistedAnalysisType || 'disease');
  const [isLoading, setIsLoading] = useState(false);
  const [isFindingExpert, setIsFindingExpert] = useState(false);
  const [diagnosis, setDiagnosis] = useState<any | null>(persistedDiagnosis || null);
  const [audioUrl, setAudioUrl] = useState<string | null>(persistedAudioUrl || null);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model'; text: string }[]>(persistedChatMessages || []);
  const [currentChatMessage, setCurrentChatMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
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
    if (setPersistedUpazila) setPersistedUpazila(upazila);
  }, [upazila, setPersistedUpazila]);

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
    // Simulate finding expert or open maps directly
    const query = encodeURIComponent("Department of Agricultural Extension Cox's Bazar");
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}`;
    
    setTimeout(() => {
      window.open(mapsUrl, '_blank');
      setIsFindingExpert(false);
    }, 1500);
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setIsDetectingLocation(false);
      },
      (error) => {
        console.error("Error detecting location:", error);
        setIsDetectingLocation(false);
        alert(t.tooltips.locationError || "Failed to detect location. Please check permissions.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
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
      const upazilaName = translations.en.upazilas[upazila as keyof typeof translations.en.upazilas];
      
      const result = await diagnoseCrop(
        images, 
        cropName, 
        upazilaName, 
        analysisTypeStr, 
        lang, 
        isAdvanced,
        coords || undefined
      );
      setDiagnosis(result);
      
      // Initialize chat session
      const session = startAgriChat(result.diagnosis, lang);
      setChatSession(session);
      setChatMessages([]);
      
      await incrementUsage();

      // Save to Firestore if user is logged in
      if (user) {
        try {
          await addDoc(collection(db, 'diagnoses'), {
            userId: user.uid,
            crop,
            upazila,
            analysisType,
            diagnosisText: result.diagnosis,
            severity: result.severity,
            confidence: result.confidence,
            verificationAdvice: result.verificationAdvice,
            createdAt: new Date().toISOString()
          });
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
        
        // Gemini TTS returns raw 16-bit PCM at 24000Hz. We must add a WAV header for the <audio> tag to play it.
        const addWavHeader = (pcmData: Uint8Array, sampleRate: number) => {
          const buffer = new ArrayBuffer(44 + pcmData.length);
          const view = new DataView(buffer);
          const writeString = (offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
              view.setUint8(offset + i, string.charCodeAt(i));
            }
          };
          writeString(0, 'RIFF');
          view.setUint32(4, 36 + pcmData.length, true);
          writeString(8, 'WAVE');
          writeString(12, 'fmt ');
          view.setUint32(16, 16, true);
          view.setUint16(20, 1, true);
          view.setUint16(22, 1, true);
          view.setUint32(24, sampleRate, true);
          view.setUint32(28, sampleRate * 2, true);
          view.setUint16(32, 2, true);
          view.setUint16(34, 16, true);
          writeString(36, 'data');
          view.setUint32(40, pcmData.length, true);
          new Uint8Array(buffer, 44).set(pcmData);
          return new Blob([buffer], { type: 'audio/wav' });
        };

        const blob = addWavHeader(bytes, 24000);
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
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-green-100 rounded-2xl mb-4">
          <Leaf className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-3xl font-extrabold text-gray-900 mb-2">{t.agriCopilot}</h2>
        <p className="text-gray-500 text-lg">{t.agriCopilotDesc}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {/* Input Section */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6 bg-white p-5 md:p-8 rounded-3xl border border-green-100 shadow-sm hover:shadow-md transition-shadow"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-bold text-gray-700 uppercase tracking-wider">{t.captureImage}</label>
              <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">{images.length}/3 {t.photoLimit}</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2 mb-4">
              {images.map((img, idx) => (
                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border-2 border-green-100 group">
                  <img 
                    src={`data:${img.mimeType};base64,${img.base64}`} 
                    alt={`Upload ${idx + 1}`} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(idx);
                    }}
                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {images.length < 3 && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-green-200 flex flex-col items-center justify-center cursor-pointer hover:bg-green-50 transition-colors">
                  <Plus className="w-6 h-6 text-green-400 mb-1" />
                  <span className="text-[8px] font-bold text-green-600 uppercase">{t.addPhoto}</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" multiple={images.length === 0} />
                </label>
              )}
            </div>

            {images.length === 0 && (
              <div className="bg-green-50/50 rounded-2xl p-8 border-2 border-dashed border-green-200 flex flex-col items-center justify-center text-center group hover:border-green-400 transition-all cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="bg-white p-4 rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
                  <Camera className="w-10 h-10 text-green-600" />
                </div>
                <p className="text-sm font-bold text-green-800 mb-1">{t.captureImage}</p>
                <p className="text-xs text-green-600/70">{lang === 'bn' ? 'পাতা বা ফলের ছবি দিন' : 'Upload leaf or fruit photo'}</p>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept="image/*" 
                  onChange={handleImageUpload} 
                  className="hidden" 
                  multiple
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.cropType}</label>
              <select 
                value={crop} 
                onChange={(e) => setCrop(e.target.value)}
                className="w-full rounded-xl border-gray-200 shadow-sm focus:border-green-500 focus:ring-green-500 bg-gray-50 p-3 border transition-colors"
              >
                {CROPS.map(c => (
                  <option key={c} value={c}>
                    {t.crops[c as keyof typeof t.crops]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">{t.upazila}</label>
                <Tooltip content={t.tooltips.locationDesc}>
                  <button 
                    onClick={handleDetectLocation}
                    disabled={isDetectingLocation}
                    className={`flex items-center space-x-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg transition-colors ${
                      coords 
                        ? 'bg-green-100 text-green-700 border border-green-200' 
                        : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {isDetectingLocation ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : coords ? (
                      <Navigation className="w-3 h-3" />
                    ) : (
                      <MapPin className="w-3 h-3" />
                    )}
                    <span>{isDetectingLocation ? t.tooltips.detecting : coords ? t.tooltips.locationDetected : t.tooltips.detectLocation}</span>
                  </button>
                </Tooltip>
              </div>
              <select 
                value={upazila} 
                onChange={(e) => setUpazila(e.target.value)}
                className="w-full rounded-xl border-gray-200 shadow-sm focus:border-green-500 focus:ring-green-500 bg-gray-50 p-3 border transition-colors"
              >
                {UPAZILAS.map(u => (
                  <option key={u} value={u}>
                    {t.upazilas[u as keyof typeof t.upazilas]}
                  </option>
                ))}
              </select>
              {coords && upazila === 'others' && (
                <div className="mt-2 text-xs text-green-600 font-medium flex items-center bg-green-50 p-2 rounded-lg border border-green-100">
                  <Navigation className="w-3 h-3 mr-1" />
                  GPS: {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">{t.analysisType}</label>
              <Tooltip content={t.tooltips[analysisType as keyof typeof t.tooltips]}>
                <HelpCircle className="w-4 h-4 text-gray-400" />
              </Tooltip>
            </div>
            <select 
              value={analysisType} 
              onChange={(e) => setAnalysisType(e.target.value)}
              className="w-full rounded-xl border-gray-200 shadow-sm focus:border-green-500 focus:ring-green-500 bg-gray-50 p-3 border transition-colors"
            >
              <option value="disease">{t.disease}</option>
              <option value="pest">{t.pest}</option>
              <option value="nutrient">{t.nutrient}</option>
            </select>
          </div>

          <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
            <div className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                id="advanced" 
                checked={isAdvanced}
                onChange={(e) => setIsAdvanced(e.target.checked)}
                disabled={tier !== 'premium'}
                className="rounded text-green-600 focus:ring-green-500 disabled:opacity-50 w-4 h-4"
              />
              <label htmlFor="advanced" className={`text-sm font-medium flex items-center ${tier === 'premium' ? 'text-gray-700' : 'text-gray-400'}`}>
                <Sparkles className="w-4 h-4 mr-1 text-yellow-500" />
                {t.advancedAnalysis}
              </label>
            </div>
            <Tooltip content={t.tooltips.advanced}>
              <HelpCircle className="w-4 h-4 text-gray-400" />
            </Tooltip>
          </div>

          <div className="pt-2">
            <div className="flex justify-between items-center mb-1.5">
              <div className="flex items-center space-x-1">
                <span className="text-[10px] font-black text-green-900 uppercase tracking-widest">{t.usage} (Daily)</span>
                <Tooltip content={t.tooltips.usage}>
                  <HelpCircle className="w-3 h-3 text-gray-400" />
                </Tooltip>
              </div>
              <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">{currentUsage} / {limit}</span>
            </div>
            <div className="w-full bg-green-100 rounded-full h-1.5 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(currentUsage / limit) * 100}%` }}
                className="bg-green-600 h-full"
              />
            </div>
          </div>

          <button
            onClick={handleDiagnose}
            disabled={images.length === 0 || isLoading}
            className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white font-bold py-4 px-4 rounded-xl hover:from-green-500 hover:to-green-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>{t.analyzing}</span>
              </>
            ) : (
              <>
                <Leaf className="w-6 h-6" />
                <span>{t.diagnoseDisease}</span>
              </>
            )}
          </button>

          {/* Safety Disclaimer */}
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center space-x-2 mb-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <h4 className="font-bold text-amber-900 text-sm">{t.disclaimerTitle}</h4>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              {t.disclaimerText}
            </p>
          </div>
        </motion.div>

        {/* Results Section */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {diagnosis ? (
              <motion.div 
                key="result"
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-5 md:p-8 border border-green-100 h-full flex flex-col shadow-sm relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-green-900 flex items-center">
                    <div className="bg-green-100 p-2 rounded-xl mr-3">
                      <Leaf className="w-6 h-6 text-green-600" />
                    </div>
                    {t.diagnosisResult}
                  </h3>
                  <div className="flex items-center text-xs font-bold text-green-600 bg-green-100/50 px-3 py-1.5 rounded-full">
                    <Calendar className="w-3.5 h-3.5 mr-1.5" />
                    {new Date().toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                
                <div className="flex-1 space-y-6">
                  {diagnosis.status === 'Invalid' ? (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start space-x-4">
                      <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                      <p className="text-red-800 font-medium">{diagnosis.diagnosis}</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Severity Gauge */}
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-green-200/50 shadow-sm flex flex-col items-center">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{lang === 'bn' ? 'তীব্রতা' : 'Severity'}</p>
                          <div className="w-full h-32 relative">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={[
                                    { value: diagnosis.severity },
                                    { value: 100 - diagnosis.severity }
                                  ]}
                                  cx="50%"
                                  cy="100%"
                                  startAngle={180}
                                  endAngle={0}
                                  innerRadius={40}
                                  outerRadius={60}
                                  paddingAngle={0}
                                  dataKey="value"
                                >
                                  <Cell fill={diagnosis.severity > 70 ? '#ef4444' : diagnosis.severity > 40 ? '#f59e0b' : '#10b981'} />
                                  <Cell fill="#f3f4f6" />
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                              <span className="text-2xl font-black text-gray-900">{diagnosis.severity}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Confidence Score */}
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-green-200/50 shadow-sm flex flex-col items-center justify-center">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{lang === 'bn' ? 'নির্ভরযোগ্যতা' : 'Confidence'}</p>
                          <div className="flex items-center space-x-2">
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                            <span className="text-3xl font-black text-gray-900">{diagnosis.confidence}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Nutrient Chart */}
                      {diagnosis.nutrientLevels && (
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-green-200/50 shadow-sm">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">{lang === 'bn' ? 'পুষ্টির মাত্রা' : 'Nutrient Levels'}</p>
                          <div className="w-full h-48">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={[
                                  { name: 'N', value: diagnosis.nutrientLevels.nitrogen, ideal: diagnosis.idealNutrientLevels?.nitrogen, fill: '#3b82f6' },
                                  { name: 'P', value: diagnosis.nutrientLevels.phosphorus, ideal: diagnosis.idealNutrientLevels?.phosphorus, fill: '#8b5cf6' },
                                  { name: 'K', value: diagnosis.nutrientLevels.potassium, ideal: diagnosis.idealNutrientLevels?.potassium, fill: '#f59e0b' }
                                ]}
                                margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 'bold' }} />
                                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <RechartsTooltip 
                                  cursor={{ fill: 'transparent' }}
                                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                  formatter={(value: any, name: string, props: any) => {
                                    if (name === 'value') {
                                      return [`${value}% (${t.idealLevel}: ${props.payload.ideal || 'N/A'})`, t.detectedLevel];
                                    }
                                    return [value, name];
                                  }}
                                />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      {/* Verification Advice */}
                      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">{t.confidenceAdvice}</p>
                        <div className="markdown-body text-sm text-blue-900 font-medium mb-4 prose-sm prose-blue">
                          <ReactMarkdown>{diagnosis.verificationAdvice}</ReactMarkdown>
                        </div>
                        
                        {diagnosis.confidence < 70 && (
                          <div className="flex items-center space-x-2 text-amber-600 mb-4">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase">{t.lowConfidenceWarning}</span>
                          </div>
                        )}

                        <button 
                          onClick={handleVerifyWithExpert}
                          disabled={isFindingExpert}
                          className="w-full bg-blue-600 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 hover:bg-blue-700 transition-colors"
                        >
                          {isFindingExpert ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Search className="w-4 h-4" />
                          )}
                          <span>{isFindingExpert ? t.findingExpert : t.verifyWithExpert}</span>
                        </button>
                      </div>

                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-green-200/50 text-gray-800 leading-relaxed shadow-sm max-w-none">
                        <div className="markdown-body text-sm md:text-base">
                          <ReactMarkdown>{diagnosis.diagnosis}</ReactMarkdown>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {audioUrl && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 bg-white rounded-2xl p-4 border border-green-200 shadow-sm flex items-center space-x-4"
                  >
                    <div className="bg-green-100 p-3 rounded-xl text-green-600 shadow-inner">
                      <Volume2 className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-700 mb-2">{t.playAudio}</p>
                      <audio controls src={audioUrl} className="w-full h-10 rounded-lg" />
                    </div>
                  </motion.div>
                )}

                {/* Chatbot Section */}
                <div className="mt-8 pt-8 border-t border-green-200/50">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="bg-green-100 p-2 rounded-xl">
                      <MessageSquare className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">{t.tooltips.chatWithExpert}</h4>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">{t.tooltips.chatDesc}</p>
                    </div>
                  </div>

                  <div className="bg-white/50 backdrop-blur-sm rounded-2xl border border-green-100 overflow-hidden flex flex-col h-[350px] shadow-inner">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {chatMessages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400">
                          <Bot className="w-10 h-10 mb-3 opacity-20" />
                          <p className="text-xs font-medium">{lang === 'bn' ? 'আপনার প্রশ্ন জিজ্ঞাসা করুন...' : 'Ask your follow-up questions here...'}</p>
                        </div>
                      )}
                      {chatMessages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                            msg.role === 'user' 
                              ? 'bg-green-600 text-white rounded-tr-none' 
                              : 'bg-white text-gray-800 border border-green-50 rounded-tl-none'
                          }`}>
                            <div className="flex items-center space-x-2 mb-1 opacity-70 text-[10px] font-bold uppercase tracking-wider">
                              {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                              <span>{msg.role === 'user' ? (lang === 'bn' ? 'আপনি' : 'You') : (lang === 'bn' ? 'বিশেষজ্ঞ' : 'Expert')}</span>
                            </div>
                              <div className="markdown-body leading-relaxed text-xs md:text-sm">
                                <ReactMarkdown>{msg.text}</ReactMarkdown>
                              </div>
                          </div>
                        </div>
                      ))}
                      {isChatLoading && (
                        <div className="flex justify-start">
                          <div className="bg-white border border-green-50 p-3 rounded-2xl rounded-tl-none shadow-sm flex items-center space-x-2">
                            <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t.tooltips.aiThinking}</span>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={handleSendMessage} className="p-2 bg-white border-t border-green-100 flex items-center space-x-2">
                      <input 
                        type="text"
                        value={currentChatMessage}
                        onChange={(e) => setCurrentChatMessage(e.target.value)}
                        placeholder={t.tooltips.typeMessage}
                        disabled={isChatLoading}
                        className="flex-1 bg-gray-50 border-none focus:ring-2 focus:ring-green-500 rounded-xl px-4 py-2 text-sm"
                      />
                      <button 
                        type="submit"
                        disabled={!currentChatMessage.trim() || isChatLoading}
                        className="bg-green-600 text-white p-2 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
                      >
                        <Send className="w-5 h-5" />
                      </button>
                    </form>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-3xl p-8 border border-dashed border-gray-200 h-full flex flex-col items-center justify-center text-gray-400 text-center"
              >
                <div className="bg-gray-50 p-6 rounded-full mb-4">
                  <Leaf className="w-12 h-12 text-gray-300" />
                </div>
                <p className="text-lg font-medium text-gray-500">Upload an image and click Diagnose to see results here.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
