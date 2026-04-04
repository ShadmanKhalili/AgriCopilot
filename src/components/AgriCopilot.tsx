import React, { useState, useRef } from 'react';
import { Camera, Loader2, Leaf, Volume2, Sparkles } from 'lucide-react';
import { diagnoseCrop, generateSpeech } from '../services/ai';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { useUsageTracking } from '../hooks/useUsageTracking';
import { translations, Language } from '../utils/translations';
import { resizeImage } from '../utils/imageOptimizer';
import { motion, AnimatePresence } from 'motion/react';

const UPAZILAS = ['Teknaf', 'Ukhia', 'Moheshkhali', 'Kutubdia', 'Ramu', 'Cox\'s Bazar Sadar', 'Chakaria', 'Pekua'];
const CROPS = ['Tomato', 'Brinjal', 'Paddy', 'Betel Leaf', 'Chili', 'Watermelon'];

interface Props {
  lang: Language;
}

export default function AgriCopilot({ lang }: Props) {
  const [image, setImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [upazila, setUpazila] = useState(UPAZILAS[0]);
  const [crop, setCrop] = useState(CROPS[0]);
  const [analysisType, setAnalysisType] = useState('disease');
  const [isLoading, setIsLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { canUse, incrementUsage, tier, currentUsage, limit } = useUsageTracking();
  const t = translations[lang];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const optimizedDataUrl = await resizeImage(file, 800);
        setImage(optimizedDataUrl.split(',')[1]);
        setMimeType('image/jpeg'); // resizeImage converts to jpeg
        setDiagnosis(null);
        setAudioUrl(null);
      } catch (error) {
        console.error("Error optimizing image:", error);
        alert("Failed to process image. Please try another one.");
      }
    }
  };

  const handleDiagnose = async () => {
    if (!image) return;
    
    if (!canUse()) {
      alert(t.limitReached);
      return;
    }

    setIsLoading(true);
    try {
      const analysisTypeStr = analysisType === 'disease' ? t.disease : analysisType === 'pest' ? t.pest : t.nutrient;
      const resultText = await diagnoseCrop(image, mimeType, crop, upazila, analysisTypeStr, isAdvanced);
      setDiagnosis(resultText);
      
      await incrementUsage();

      // Save to Firestore if user is logged in
      if (user) {
        try {
          await addDoc(collection(db, 'diagnoses'), {
            userId: user.uid,
            crop,
            upazila,
            analysisType,
            diagnosisText: resultText,
            createdAt: new Date().toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'diagnoses');
        }
      }

      // Generate audio
      const audioBase64 = await generateSpeech(resultText);
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Input Section */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6 bg-white p-6 rounded-3xl border border-green-100 shadow-sm hover:shadow-md transition-shadow"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.captureImage}</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-green-300 rounded-2xl p-8 text-center cursor-pointer hover:bg-green-50 transition-colors bg-white relative overflow-hidden group min-h-[200px] flex items-center justify-center"
            >
              {image ? (
                <img src={`data:${mimeType};base64,${image}`} alt="Crop" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
              ) : null}
              <div className="relative z-10 flex flex-col items-center justify-center space-y-3">
                <div className="bg-green-100 p-4 rounded-full text-green-600 shadow-inner group-hover:scale-110 transition-transform">
                  <Camera className="w-8 h-8" />
                </div>
                <div className="text-sm text-gray-700 font-medium bg-white/80 backdrop-blur-sm px-4 py-1.5 rounded-full">
                  {image ? 'Tap to change image' : 'Tap to take photo or upload'}
                </div>
              </div>
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleImageUpload}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.cropType}</label>
              <select 
                value={crop} 
                onChange={(e) => setCrop(e.target.value)}
                className="w-full rounded-xl border-gray-200 shadow-sm focus:border-green-500 focus:ring-green-500 bg-gray-50 p-3 border transition-colors"
              >
                {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.upazila}</label>
              <select 
                value={upazila} 
                onChange={(e) => setUpazila(e.target.value)}
                className="w-full rounded-xl border-gray-200 shadow-sm focus:border-green-500 focus:ring-green-500 bg-gray-50 p-3 border transition-colors"
              >
                {UPAZILAS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.analysisType}</label>
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

          <div className="flex items-center space-x-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
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

          <div className="pt-2">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[10px] font-black text-green-900 uppercase tracking-widest">{t.usage} (Daily)</span>
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
            disabled={!image || isLoading}
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
        </motion.div>

        {/* Results Section */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {diagnosis ? (
              <motion.div 
                key="result"
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-8 border border-green-100 h-full flex flex-col shadow-sm relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
                <h3 className="text-2xl font-bold text-green-900 mb-6 flex items-center">
                  <div className="bg-green-100 p-2 rounded-xl mr-3">
                    <Leaf className="w-6 h-6 text-green-600" />
                  </div>
                  {t.diagnosisResult}
                </h3>
                
                <div className="flex-1 bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-green-200/50 text-gray-800 leading-relaxed shadow-sm prose prose-green max-w-none">
                  <div className="whitespace-pre-wrap">{diagnosis}</div>
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
