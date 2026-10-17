import React, { useState, useRef } from 'react';
import { Camera, Loader2, Award, FileCheck, DollarSign, Sparkles, HelpCircle, Calendar } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { gradeProduce } from '../services/ai';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firestore';
import { useAuth } from './AuthProvider';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { useUsageTracking } from '../hooks/useUsageTracking';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { translations, Language } from '../utils/translations';
import { resizeImage } from '../utils/imageOptimizer';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import Tooltip from './Tooltip';
import { recordFarmerInteractionEvent } from '../utils/farmerProfiler';

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
  const isOnline = useNetworkStatus();
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
        toast.error("Failed to process image. Please try another one.");
      }
    }
  };

  const [isBuyerModalOpen, setIsBuyerModalOpen] = useState(false);
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerQuantityKg, setBuyerQuantityKg] = useState('100');

  const handleGrade = async () => {
    if (!image) return;
    
    if (!isOnline) {
      toast.error(lang === 'bn' ? 'অফলাইনে কাজ হবে না। দয়া করে ইন্টারনেট সংযোগ চালু করুন।' : 'You are currently offline. Please connect to the internet to run this diagnosis.');
      return;
    }

    if (!canUse()) {
      toast.error(t.limitReached);
      return;
    }

    setIsLoading(true);
    try {
      const gradeResult = await gradeProduce(image, mimeType, t.produce[produce as keyof typeof t.produce], lang, isAdvanced);
      setResult(gradeResult);
      
      await incrementUsage();

      // Save to Firestore as indicative visual assessment if user is logged in
      if (user) {
        try {
          await addDoc(collection(db, 'certificates'), {
            userId: user.uid,
            produce,
            grade: gradeResult.grade,
            justification: gradeResult.justification,
            estimatedPriceBdt: gradeResult.estimatedPriceBdt,
            assessmentType: 'indicative_visual_assessment',
            isStatutoryCertificate: false,
            authorityDisclaimer: 'Indicative visual assessment for farmgate bargaining; not statutory BSTI/DAM certification',
            createdAt: new Date().toISOString()
          });

          recordFarmerInteractionEvent({
            userId: user.uid,
            fullName: user.displayName || 'কৃষক ভাই (Farmer)',
            eventType: 'smart_grading',
            origin: 'ai_unverified',
            evidenceStatus: 'unverified',
            title: lang === 'bn' ? `ফসলের প্রাক-বাছাই মূল্যায়ন: ${produce} (গ্রেড ${gradeResult.grade})` : `Indicative Visual Assessment: ${produce} (Grade ${gradeResult.grade})`,
            summary: gradeResult.justification.substring(0, 300),
            keyFacts: [
              `ফসল: ${produce}`,
              `মান গ্রেড: ${gradeResult.grade} (প্রাক-বাছাই)`,
              `আনুমানিক বাজারদর: ৳${gradeResult.estimatedPriceBdt}/কেজি`
            ],
            crop: produce,
            insight: `গ্রেড ${gradeResult.grade} ফসল উৎপাদনে সক্ষম (বাজার দরকষাকষির সহায়ক প্রাক-বাছাই)`
          }).catch(e => console.warn(e));
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'certificates');
        }
      }
    } catch (error: any) {
      console.error("Grading failed:", error);
      const isQuotaError = error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED');
      const errorMsg = isQuotaError 
        ? (lang === 'bn' ? 'সিস্টেমের চাপ বেশি, দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন।' : 'AI limit reached. Please try again in 5 minutes.')
        : (error.message || "Error connecting to AI service. Please try again.");
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 md:space-y-6"
    >
      <div className="bg-white rounded-[24px] md:rounded-[32px] p-4 md:p-6 shadow-xl shadow-blue-900/5 border border-blue-100 mb-4 md:mb-6">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="bg-blue-50 p-2 md:p-3 rounded-xl flex-shrink-0">
            <Award className="w-6 h-6 md:w-7 h-7 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg md:text-2xl font-black text-gray-900 tracking-tight leading-tight">{t.smartGrade}</h2>
            <p className="text-gray-500 text-[11px] md:text-sm font-medium">{t.smartGradeDesc}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        {/* Input Section */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-12 xl:col-span-5 space-y-4 sm:space-y-5 bg-white p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-3xl border border-blue-100 shadow-xl shadow-blue-50/50 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 pointer-events-none"></div>
          
          <div className="relative z-10 space-y-4 sm:space-y-5">
            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">{t.captureBatch}</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-blue-200 rounded-2xl md:rounded-3xl p-2 text-center cursor-pointer hover:border-blue-400 transition-all bg-blue-50/30 relative overflow-hidden group min-h-[220px] sm:min-h-[240px] flex items-center justify-center shadow-inner"
              >
                {image ? (
                  <motion.img 
                    initial={{ scale: 1.1, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    src={`data:${mimeType};base64,${image}`} 
                    alt="Produce" 
                    className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity" 
                    referrerPolicy="no-referrer"
                  />
                ) : null}
                <div className="relative z-10 flex flex-col items-center justify-center space-y-3 sm:space-y-4">
                  <div className="bg-white p-4 sm:p-5 rounded-full text-blue-600 shadow-xl group-hover:scale-110 transition-transform border border-blue-50">
                    <Camera className="w-8 h-8 sm:w-10 sm:h-10" />
                  </div>
                  <div className="text-xs font-bold text-blue-700 bg-white/95 backdrop-blur-md px-5 sm:px-6 py-2 rounded-full shadow-sm border border-blue-100">
                    {image 
                      ? (lang === 'bn' ? 'ছবি পরিবর্তন করুন' : 'Change photo')
                      : (lang === 'bn' ? 'ক্যামেরা চালু করুন বা ছবি নির্বাচন করুন' : 'Take photo or upload produce')}
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

            <div className="space-y-1.5">
              <label htmlFor="produce-type-grade" className="block text-xs font-black text-gray-400 uppercase tracking-widest">{t.produceType}</label>
              <select 
                id="produce-type-grade"
                value={produce} 
                onChange={(e) => setProduce(e.target.value)}
                className="w-full rounded-xl sm:rounded-2xl border-blue-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-blue-50/30 p-3 sm:p-3.5 border text-sm sm:text-base font-bold text-gray-900 transition-all"
              >
                {PRODUCE_TYPES.map(p => (
                  <option key={p} value={p}>
                    {t.produce[p as keyof typeof t.produce]}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-white p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-blue-100 shadow-inner">
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
                <label htmlFor="advancedGrade" className={`text-xs sm:text-sm font-black uppercase tracking-widest flex items-center ${tier === 'premium' ? 'text-gray-700' : 'text-gray-400'}`}>
                  <Sparkles className="w-4 h-4 mr-1.5 text-yellow-500" />
                  {t.advancedAnalysis}
                </label>
              </div>
              <Tooltip content={t.tooltips.advanced}>
                <HelpCircle className="w-4 h-4 text-gray-300 cursor-help" />
              </Tooltip>
            </div>

            <div className="pt-1">
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center space-x-1">
                  <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{t.usage} (Daily)</span>
                  <Tooltip content={t.tooltips.usage}>
                    <HelpCircle className="w-3 h-3 text-gray-300" />
                  </Tooltip>
                </div>
                <span className="text-[11px] font-black text-blue-600 uppercase tracking-widest">{currentUsage} / {limit}</span>
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
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGrade}
              disabled={!image || isLoading || !isOnline}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black py-3.5 sm:py-4 px-5 rounded-xl sm:rounded-2xl hover:shadow-lg hover:shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2.5 transition-all text-base sm:text-lg tracking-tight min-h-[48px] cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>{t.gradingBatch}</span>
                </>
              ) : (
                <>
                  <Award className="w-6 h-6" />
                  <span>{t.generateCert}</span>
                </>
              )}
            </motion.button>
          </div>
        </motion.div>

        {/* Results Section */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-6">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div 
                key="result"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-2xl md:rounded-3xl border border-blue-200 shadow-xl overflow-hidden h-full flex flex-col"
              >
                <div className="p-4 sm:p-6 md:p-8 h-full flex flex-col relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-30 pointer-events-none"></div>
                  
                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                      <div className="flex items-center space-x-3">
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2 sm:p-2.5 rounded-xl shadow-md text-white">
                          <FileCheck className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-base sm:text-lg md:text-xl font-black text-gray-900 tracking-tight">{t.certTitle}</h3>
                          <div className="flex items-center mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Verified by Agri-AI</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Issue Date</p>
                        <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 uppercase tracking-widest">
                          {new Date().toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6 border-b border-gray-100 pb-4 sm:pb-6">
                      <div className="space-y-3">
                        <div>
                          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">{t.produceType}</p>
                          <p className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 tracking-tighter">{t.produce[produce as keyof typeof t.produce]}</p>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="bg-green-50 px-3 py-1.5 rounded-xl border border-green-100 flex items-center space-x-2">
                            <DollarSign className="w-3.5 h-3.5 text-green-600" />
                            <span className="text-sm font-black text-gray-900">৳ {result.estimatedPriceBdt} <span className="text-[11px] text-gray-400">/ {t.perKg}</span></span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-start sm:items-end justify-center">
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1">{t.assignedGrade}</p>
                        <motion.div 
                          initial={{ scale: 0.5, rotate: -10 }}
                          animate={{ scale: 1, rotate: 0 }}
                          className={`text-5xl sm:text-6xl md:text-7xl font-black tracking-tighter drop-shadow-md ${
                            result.grade.includes('A') ? 'text-green-600' : result.grade.includes('B') ? 'text-yellow-600' : 'text-red-600'
                          }`}
                        >
                          {result.grade}
                        </motion.div>
                      </div>
                    </div>

                    <div className="space-y-4 sm:space-y-6 flex-1">
                      <div>
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">{t.justification}</p>
                        <motion.div 
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-gray-50/70 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 border border-gray-100 shadow-inner relative overflow-hidden"
                        >
                          <div className="markdown-body text-xs sm:text-sm md:text-base leading-relaxed prose prose-blue max-w-none">
                            <ReactMarkdown>{result.justification}</ReactMarkdown>
                          </div>
                        </motion.div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <motion.div 
                          whileHover={{ y: -2 }}
                          className="bg-gradient-to-br from-white to-blue-50/30 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border border-blue-100 shadow-xs"
                        >
                          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 md:mb-3 flex items-center">
                            <Calendar className="w-3 h-3 mr-2 text-blue-500" />
                            {t.shelfLife}
                          </p>
                          <p className="text-base md:text-lg font-black text-blue-900 tracking-tight">{result.shelfLife}</p>
                        </motion.div>
                        <motion.div 
                          whileHover={{ y: -3 }}
                          className="bg-gradient-to-br from-white to-indigo-50/30 p-4 md:p-5 rounded-[24px] border border-indigo-100 shadow-sm"
                        >
                          <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 md:mb-3 flex items-center">
                            <Award className="w-3 h-3 mr-2 text-indigo-500" />
                            {t.bestMarket}
                          </p>
                          <p className="text-base md:text-lg font-black text-indigo-900 tracking-tight">{result.bestMarket}</p>
                        </motion.div>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex flex-col space-y-0.5">
                        <div className="flex items-center space-x-2 text-[11px] font-black text-gray-500 uppercase tracking-widest">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>AI Indicative Pre-Grading Assessment</span>
                        </div>
                        <p className="text-[11px] text-gray-400">
                          {lang === 'bn' 
                            ? 'বাজার দরকষাকষির সহায়ক প্রাক-বাছাই • সংবিধিবদ্ধ BSTI/DAM সনদ নয়' 
                            : 'Farmgate price bargaining aid • Non-statutory BSTI/DAM certificate'}
                        </p>
                      </div>
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsBuyerModalOpen(true)}
                        className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-blue-200 transition-all uppercase tracking-widest text-xs cursor-pointer active:scale-95"
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
                className="bg-white rounded-[28px] md:rounded-[32px] p-10 md:p-16 border border-dashed border-gray-200 h-full flex flex-col items-center justify-center text-gray-400 text-center relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-gray-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50"></div>
                <div className="bg-gray-50 p-6 md:p-10 rounded-[28px] md:rounded-[32px] mb-6 md:mb-8 shadow-inner relative z-10">
                  <Award className="w-16 h-16 md:w-20 h-20 text-gray-200" />
                </div>
                <p className="text-xl md:text-2xl font-black text-gray-400 max-w-sm leading-tight relative z-10 tracking-tight">
                  {lang === 'bn' 
                    ? 'ফসলের ব্যাচ ছবি আপলোড করে প্রাক-বাছাই গুণমান মূল্যায়ন দেখতে ক্লিক করুন।' 
                    : 'Upload a batch photo to view an indicative visual pre-grading assessment here.'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Buyer Connect & Share Assessment Modal */}
      <AnimatePresence>
        {isBuyerModalOpen && result && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-900 dark:text-white text-base">
                      {lang === 'bn' ? 'পাইকারি ক্রেতাকে বিবরণ পাঠান' : 'Send Offer to Buyer'}
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      {lang === 'bn' ? 'প্রাক-বাছাই গ্রেড ও প্রস্তাবিত দর শেয়ার করুন' : 'Share indicative grade & target price'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBuyerModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400"
                >
                  ✕
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/80 text-xs space-y-1">
                <div className="flex justify-between font-medium text-stone-700 dark:text-stone-300">
                  <span>{lang === 'bn' ? 'ফসল:' : 'Produce:'}</span>
                  <span className="font-bold text-stone-900 dark:text-white">{t.produce[produce as keyof typeof t.produce]}</span>
                </div>
                <div className="flex justify-between font-medium text-stone-700 dark:text-stone-300">
                  <span>{lang === 'bn' ? 'প্রাক-বাছাই গ্রেড:' : 'Indicative Grade:'}</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">গ্রেড {result.grade}</span>
                </div>
                <div className="flex justify-between font-medium text-stone-700 dark:text-stone-300">
                  <span>{lang === 'bn' ? 'প্রস্তাবিত পাইকারি দর:' : 'Target Price:'}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">৳{result.estimatedPriceBdt}/কেজি</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    {lang === 'bn' ? 'ক্রেতার ফোন নম্বর / হোয়াটসঅ্যাপ (ঐচ্ছিক)' : 'Buyer Phone / WhatsApp (Optional)'}
                  </label>
                  <input
                    type="tel"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    {lang === 'bn' ? 'লটের পরিমাণ (কেজি)' : 'Batch Quantity (Kg)'}
                  </label>
                  <input
                    type="number"
                    value={buyerQuantityKg}
                    onChange={(e) => setBuyerQuantityKg(e.target.value)}
                    placeholder="100"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const message = lang === 'bn'
                      ? `[Agri-Copilot ফসল প্রস্তাব]\nফসল: ${t.produce[produce as keyof typeof t.produce]}\nপ্রাক-বাছাই গ্রেড: ${result.grade}\nপরিমাণ: ${buyerQuantityKg} কেজি\nপ্রস্তাবিত পাইকারি দর: ৳${result.estimatedPriceBdt}/কেজি\nসার্বক্ষণিক বাজার: ${result.bestMarket}\n*এটি খামারি দরকষাকষির জন্য এআই প্রাক-বাছাই মূল্যায়ন।*`
                      : `[Agri-Copilot Offer]\nProduce: ${t.produce[produce as keyof typeof t.produce]}\nIndicative Grade: ${result.grade}\nQuantity: ${buyerQuantityKg} Kg\nTarget Price: ৳${result.estimatedPriceBdt}/Kg\nMarket: ${result.bestMarket}\n*Indicative pre-grading assessment for trade negotiation.*`;

                    const targetNumber = buyerPhone.trim().replace(/[^0-9]/g, '');
                    const url = targetNumber 
                      ? `https://wa.me/${targetNumber.startsWith('88') ? targetNumber : '88' + targetNumber}?text=${encodeURIComponent(message)}`
                      : `https://wa.me/?text=${encodeURIComponent(message)}`;
                    
                    window.open(url, '_blank');
                    setIsBuyerModalOpen(false);
                    toast.success(lang === 'bn' ? 'হোয়াটসঅ্যাপে বিবরণ প্রস্তুত করা হয়েছে!' : 'WhatsApp offer message generated!');
                  }}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>{lang === 'bn' ? 'হোয়াটসঅ্যাপে পাঠান' : 'Share on WhatsApp'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const message = lang === 'bn'
                      ? `[Agri-Copilot ফসল প্রস্তাব]\nফসল: ${t.produce[produce as keyof typeof t.produce]}\nপ্রাক-বাছাই গ্রেড: ${result.grade}\nপরিমাণ: ${buyerQuantityKg} কেজি\nপ্রস্তাবিত পাইকারি দর: ৳${result.estimatedPriceBdt}/কেজি\nসার্বক্ষণিক বাজার: ${result.bestMarket}`
                      : `[Agri-Copilot Offer]\nProduce: ${t.produce[produce as keyof typeof t.produce]}\nIndicative Grade: ${result.grade}\nQuantity: ${buyerQuantityKg} Kg\nTarget Price: ৳${result.estimatedPriceBdt}/Kg\nMarket: ${result.bestMarket}`;
                    
                    navigator.clipboard.writeText(message);
                    toast.success(lang === 'bn' ? 'বিবরণ ক্লিপবোর্ডে কপি হয়েছে!' : 'Offer copied to clipboard!');
                    setIsBuyerModalOpen(false);
                  }}
                  className="w-full py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold text-xs transition-colors"
                >
                  {lang === 'bn' ? 'বিবরণ কপি করুন (SMS/বার্তা)' : 'Copy Offer (SMS/Text)'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
