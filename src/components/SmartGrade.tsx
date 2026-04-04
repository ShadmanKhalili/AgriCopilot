import React, { useState, useRef } from 'react';
import { Camera, Loader2, Award, FileCheck, DollarSign, Sparkles, HelpCircle, Calendar } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { gradeProduce } from '../services/ai';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { useUsageTracking } from '../hooks/useUsageTracking';
import { translations, Language } from '../utils/translations';
import { resizeImage } from '../utils/imageOptimizer';
import { motion, AnimatePresence } from 'motion/react';
import Tooltip from './Tooltip';

const PRODUCE_TYPES = ['tomato', 'brinjal', 'dryFish', 'shrimp', 'salt', 'betelNut', 'mango', 'banana', 'coconut', 'chili'];

interface GradeResult {
  grade: string;
  justification: string;
  estimatedPriceBdt: number;
  shelfLife: string;
  bestMarket: string;
}

interface Props {
  lang: Language;
}

export default function SmartGrade({ lang }: Props) {
  const [image, setImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [produce, setProduce] = useState(PRODUCE_TYPES[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GradeResult | null>(null);
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
        setResult(null);
      } catch (error) {
        console.error("Error optimizing image:", error);
        alert("Failed to process image. Please try another one.");
      }
    }
  };

  const handleGrade = async () => {
    if (!image) return;
    
    if (!canUse()) {
      alert(t.limitReached);
      return;
    }

    setIsLoading(true);
    try {
      const gradeResult = await gradeProduce(image, mimeType, t.produce[produce as keyof typeof t.produce], lang, isAdvanced);
      setResult(gradeResult);
      
      await incrementUsage();

      // Save to Firestore if user is logged in
      if (user) {
        try {
          await addDoc(collection(db, 'certificates'), {
            userId: user.uid,
            produce,
            grade: gradeResult.grade,
            justification: gradeResult.justification,
            estimatedPriceBdt: gradeResult.estimatedPriceBdt,
            createdAt: new Date().toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'certificates');
        }
      }
    } catch (error: any) {
      console.error("Grading failed:", error);
      alert(error.message || "Error connecting to AI service. Please try again.");
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
      <div className="text-center mb-12">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl mb-6 shadow-lg shadow-blue-200"
        >
          <Award className="w-10 h-10 text-white animate-pulse" />
        </motion.div>
        <h2 className="text-4xl font-black text-gray-900 mb-3 tracking-tight">{t.smartGrade}</h2>
        <p className="text-gray-500 text-xl font-medium max-w-2xl mx-auto">{t.smartGradeDesc}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input Section */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-5 space-y-6 bg-white p-8 rounded-[40px] border border-blue-100 shadow-xl shadow-blue-50/50 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 pointer-events-none"></div>
          
          <div className="relative z-10 space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">{t.captureBatch}</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-blue-200 rounded-[32px] p-2 text-center cursor-pointer hover:border-blue-400 transition-all bg-blue-50/30 relative overflow-hidden group min-h-[240px] flex items-center justify-center shadow-inner"
              >
                {image ? (
                  <motion.img 
                    initial={{ scale: 1.1, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    src={`data:${mimeType};base64,${image}`} 
                    alt="Produce" 
                    className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity" 
                  />
                ) : null}
                <div className="relative z-10 flex flex-col items-center justify-center space-y-4">
                  <div className="bg-white p-5 rounded-full text-blue-600 shadow-xl group-hover:scale-110 transition-transform border border-blue-50">
                    <Camera className="w-10 h-10" />
                  </div>
                  <div className="text-xs font-black text-blue-700 uppercase tracking-widest bg-white/90 backdrop-blur-md px-6 py-2.5 rounded-full shadow-sm border border-blue-100">
                    {image ? 'Tap to change image' : 'Tap to take photo of batch'}
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

            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">{t.produceType}</label>
              <select 
                value={produce} 
                onChange={(e) => setProduce(e.target.value)}
                className="w-full rounded-2xl border-blue-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-blue-50/30 p-4 border text-base font-bold text-gray-900 transition-all"
              >
                {PRODUCE_TYPES.map(p => (
                  <option key={p} value={p}>
                    {t.produce[p as keyof typeof t.produce]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-white p-4 rounded-2xl border border-blue-100 shadow-inner">
              <div className="flex items-center space-x-3">
                <div className="relative inline-block w-10 h-6 transition duration-200 ease-in-out rounded-full cursor-pointer">
                  <input 
                    type="checkbox" 
                    id="advancedGrade" 
                    checked={isAdvanced}
                    onChange={(e) => setIsAdvanced(e.target.checked)}
                    disabled={tier !== 'premium'}
                    className="absolute w-6 h-6 transition duration-200 ease-in-out transform bg-white border-2 border-gray-300 rounded-full appearance-none cursor-pointer checked:translate-x-4 checked:border-blue-500 focus:outline-none disabled:opacity-50"
                  />
                  <label htmlFor="advancedGrade" className={`block h-6 overflow-hidden bg-gray-200 rounded-full cursor-pointer ${isAdvanced ? 'bg-blue-400' : ''}`}></label>
                </div>
                <label htmlFor="advancedGrade" className={`text-sm font-black uppercase tracking-widest flex items-center ${tier === 'premium' ? 'text-gray-700' : 'text-gray-400'}`}>
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
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{currentUsage} / {limit}</span>
              </div>
              <div className="w-full bg-blue-100/50 rounded-full h-2 overflow-hidden shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(currentUsage / limit) * 100}%` }}
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full"
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGrade}
              disabled={!image || isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black py-5 px-6 rounded-2xl hover:shadow-lg hover:shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3 transition-all text-lg tracking-tight"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-7 h-7 animate-spin" />
                  <span>{t.gradingBatch}</span>
                </>
              ) : (
                <>
                  <Award className="w-7 h-7" />
                  <span>{t.generateCert}</span>
                </>
              )}
            </motion.button>
          </div>
        </motion.div>

        {/* Results Section */}
        <div className="lg:col-span-7 space-y-6">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div 
                key="result"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-gradient-to-br from-blue-600 via-indigo-600 to-blue-700 p-1 rounded-[40px] shadow-2xl shadow-blue-200 h-full"
              >
                <div className="bg-white/95 backdrop-blur-xl rounded-[38px] p-8 md:p-10 h-full flex flex-col relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-30 pointer-events-none"></div>
                  
                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-10">
                      <div className="flex items-center space-x-4">
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-blue-100">
                          <FileCheck className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-gray-900 tracking-tight">{t.certTitle}</h3>
                          <div className="flex items-center mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Verified by Agri-AI</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Issue Date</p>
                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 uppercase tracking-widest">
                          {new Date().toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 border-b border-gray-100 pb-10">
                      <div className="space-y-6">
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t.produceType}</p>
                          <p className="text-3xl font-black text-gray-900 tracking-tighter">{t.produce[produce as keyof typeof t.produce]}</p>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="bg-green-50 px-4 py-2 rounded-xl border border-green-100 flex items-center space-x-2">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-black text-gray-900">৳ {result.estimatedPriceBdt} <span className="text-[10px] text-gray-400">/ {t.perKg}</span></span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-center md:items-end justify-center">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{t.assignedGrade}</p>
                        <motion.div 
                          initial={{ scale: 0.5, rotate: -10 }}
                          animate={{ scale: 1, rotate: 0 }}
                          className={`text-7xl font-black tracking-tighter drop-shadow-xl ${
                            result.grade.includes('A') ? 'text-green-600' : result.grade.includes('B') ? 'text-yellow-600' : 'text-red-600'
                          }`}
                        >
                          {result.grade}
                        </motion.div>
                      </div>
                    </div>

                    <div className="space-y-8 flex-1">
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">{t.justification}</p>
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm relative overflow-hidden"
                        >
                          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-20"></div>
                          <div className="markdown-body text-base md:text-lg leading-relaxed prose prose-blue max-w-none">
                            <ReactMarkdown>{result.justification}</ReactMarkdown>
                          </div>
                        </motion.div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <motion.div 
                          whileHover={{ y: -5 }}
                          className="bg-gradient-to-br from-white to-blue-50/30 p-6 rounded-[28px] border border-blue-100 shadow-sm"
                        >
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center">
                            <Calendar className="w-3 h-3 mr-2 text-blue-500" />
                            {t.shelfLife}
                          </p>
                          <p className="text-lg font-black text-blue-900 tracking-tight">{result.shelfLife}</p>
                        </motion.div>
                        <motion.div 
                          whileHover={{ y: -5 }}
                          className="bg-gradient-to-br from-white to-indigo-50/30 p-6 rounded-[28px] border border-indigo-100 shadow-sm"
                        >
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center">
                            <Award className="w-3 h-3 mr-2 text-indigo-500" />
                            {t.bestMarket}
                          </p>
                          <p className="text-lg font-black text-indigo-900 tracking-tight">{result.bestMarket}</p>
                        </motion.div>
                      </div>
                    </div>

                    <div className="mt-10 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-6">
                      <div className="flex items-center space-x-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <Sparkles className="w-4 h-4 text-yellow-500" />
                        <span>AI Certified Quality Report</span>
                      </div>
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-blue-200 transition-all uppercase tracking-widest text-xs"
                      >
                        {t.sendToBuyer}
                      </motion.button>
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
                  <Award className="w-20 h-20 text-gray-200" />
                </div>
                <p className="text-2xl font-black text-gray-300 max-w-sm leading-tight relative z-10 tracking-tight">Upload a batch photo and generate a certificate to see results here.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
