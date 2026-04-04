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
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-2xl mb-4">
          <Award className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-3xl font-extrabold text-gray-900 mb-2">{t.smartGrade}</h2>
        <p className="text-gray-500 text-lg">{t.smartGradeDesc}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {/* Input Section */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6 bg-white p-5 md:p-8 rounded-3xl border border-blue-100 shadow-sm hover:shadow-md transition-shadow"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.captureBatch}</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-300 rounded-2xl p-8 text-center cursor-pointer hover:bg-blue-50 transition-colors bg-white relative overflow-hidden group min-h-[200px] flex items-center justify-center"
            >
              {image ? (
                <img src={`data:${mimeType};base64,${image}`} alt="Produce" className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
              ) : null}
              <div className="relative z-10 flex flex-col items-center justify-center space-y-3">
                <div className="bg-blue-100 p-4 rounded-full text-blue-600 shadow-inner group-hover:scale-110 transition-transform">
                  <Camera className="w-8 h-8" />
                </div>
                <div className="text-sm text-gray-700 font-medium bg-white/80 backdrop-blur-sm px-4 py-1.5 rounded-full">
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.produceType}</label>
            <select 
              value={produce} 
              onChange={(e) => setProduce(e.target.value)}
              className="w-full rounded-xl border-gray-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-gray-50 p-3 border transition-colors"
            >
              {PRODUCE_TYPES.map(p => (
                <option key={p} value={p}>
                  {t.produce[p as keyof typeof t.produce]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
            <div className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                id="advancedGrade" 
                checked={isAdvanced}
                onChange={(e) => setIsAdvanced(e.target.checked)}
                disabled={tier !== 'premium'}
                className="rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50 w-4 h-4"
              />
              <label htmlFor="advancedGrade" className={`text-sm font-medium flex items-center ${tier === 'premium' ? 'text-gray-700' : 'text-gray-400'}`}>
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
                <span className="text-[10px] font-black text-blue-900 uppercase tracking-widest">{t.usage} (Daily)</span>
                <Tooltip content={t.tooltips.usage}>
                  <HelpCircle className="w-3 h-3 text-gray-400" />
                </Tooltip>
              </div>
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{currentUsage} / {limit}</span>
            </div>
            <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(currentUsage / limit) * 100}%` }}
                className="bg-blue-600 h-full"
              />
            </div>
          </div>

          <button
            onClick={handleGrade}
            disabled={!image || isLoading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-4 px-4 rounded-xl hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
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
          </button>
        </motion.div>

        {/* Results Section */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div 
                key="result"
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                className="bg-white rounded-3xl border border-blue-200 shadow-sm overflow-hidden flex flex-col h-full relative"
              >
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 md:p-6 flex items-center justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
                  <div className="flex items-center space-x-3 relative z-10">
                    <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                      <FileCheck className="w-6 h-6" />
                    </div>
                    <span className="font-bold text-xl">{t.certTitle}</span>
                  </div>
                  <div className="flex items-center text-xs font-bold text-blue-100 bg-black/10 px-3 py-1.5 rounded-full relative z-10">
                    <Calendar className="w-3.5 h-3.5 mr-1.5" />
                    {new Date().toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                
                <div className="p-5 md:p-8 flex-1 flex flex-col space-y-6 bg-gradient-to-b from-white to-blue-50/30">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-6">
                    <div>
                      <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">{t.produceType}</p>
                      <p className="font-bold text-gray-900 text-xl">{t.produce[produce as keyof typeof t.produce]}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end space-x-1 mb-1">
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{t.assignedGrade}</p>
                        <Tooltip content={t.tooltips.grading}>
                          <HelpCircle className="w-3 h-3 text-gray-400" />
                        </Tooltip>
                      </div>
                      <p className={`font-black text-4xl drop-shadow-sm ${result.grade.includes('A') ? 'text-green-600' : result.grade.includes('B') ? 'text-yellow-600' : 'text-red-600'}`}>
                        {result.grade}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">{t.justification}</p>
                    <div className="text-gray-800 bg-white p-4 rounded-2xl border border-gray-100 text-sm leading-relaxed shadow-sm markdown-body">
                      <ReactMarkdown>{result.justification}</ReactMarkdown>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50/80 backdrop-blur-sm p-4 rounded-2xl border border-blue-100/50">
                      <div className="flex items-center space-x-1 mb-1">
                        <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">{t.shelfLife}</p>
                        <Tooltip content={t.tooltips.shelfLife}>
                          <HelpCircle className="w-3 h-3 text-blue-400" />
                        </Tooltip>
                      </div>
                      <p className="text-sm font-bold text-blue-900">{result.shelfLife}</p>
                    </div>
                    <div className="bg-indigo-50/80 backdrop-blur-sm p-4 rounded-2xl border border-indigo-100/50">
                      <div className="flex items-center space-x-1 mb-1">
                        <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider">{t.bestMarket}</p>
                        <Tooltip content={t.tooltips.bestMarket}>
                          <HelpCircle className="w-3 h-3 text-indigo-400" />
                        </Tooltip>
                      </div>
                      <p className="text-sm font-bold text-indigo-900">{result.bestMarket}</p>
                    </div>
                  </div>

                  <div className="mt-auto pt-6 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-bold">{t.estimatedPrice}</span>
                      <Tooltip content={t.tooltips.pricing}>
                        <HelpCircle className="w-3 h-3 text-gray-400" />
                      </Tooltip>
                    </div>
                    <div className="text-2xl font-black text-gray-900">
                      ৳ {result.estimatedPriceBdt} <span className="text-sm font-semibold text-gray-400">/ kg</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-end">
                   <button className="text-blue-600 font-bold text-sm hover:text-blue-700 flex items-center space-x-2 bg-blue-100/50 hover:bg-blue-100 px-4 py-2 rounded-full transition-colors">
                     <span>{t.sendToBuyer}</span>
                   </button>
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
                  <Award className="w-12 h-12 text-gray-300" />
                </div>
                <p className="text-lg font-medium text-gray-500">Upload a batch photo and generate a certificate to see results here.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
