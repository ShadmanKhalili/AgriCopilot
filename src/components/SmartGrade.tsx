import React, { useState, useRef } from 'react';
import { Camera, Loader2, Award, FileCheck, DollarSign, Sparkles } from 'lucide-react';
import { gradeProduce } from '../services/ai';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { useUsageTracking } from '../hooks/useUsageTracking';
import { translations, Language } from '../utils/translations';

const PRODUCE_TYPES = ['Tomato', 'Brinjal', 'Dry Fish'];

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
  const { canUse, incrementUsage, tier } = useUsageTracking();
  const t = translations[lang];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setImage(base64String.split(',')[1]);
        setMimeType(file.type);
        setResult(null);
      };
      reader.readAsDataURL(file);
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
      const gradeResult = await gradeProduce(image, mimeType, produce, isAdvanced);
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
    } catch (error) {
      console.error("Grading failed:", error);
      // Handle error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t.smartGrade}</h2>
        <p className="text-gray-500 mt-1">{t.smartGradeDesc}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6 bg-gray-50 p-6 rounded-xl border border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.captureBatch}</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-blue-300 rounded-xl p-8 text-center cursor-pointer hover:bg-blue-50 transition-colors bg-white relative overflow-hidden group"
            >
              {image ? (
                <img src={`data:${mimeType};base64,${image}`} alt="Produce" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity" />
              ) : null}
              <div className="relative z-10 flex flex-col items-center justify-center space-y-3">
                <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                  <Camera className="w-6 h-6" />
                </div>
                <div className="text-sm text-gray-600 font-medium">
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
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white p-2.5 border"
            >
              {PRODUCE_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              id="advancedGrade" 
              checked={isAdvanced}
              onChange={(e) => setIsAdvanced(e.target.checked)}
              disabled={tier !== 'premium'}
              className="rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50"
            />
            <label htmlFor="advancedGrade" className={`text-sm font-medium flex items-center ${tier === 'premium' ? 'text-gray-700' : 'text-gray-400'}`}>
              <Sparkles className="w-4 h-4 mr-1 text-yellow-500" />
              {t.advancedAnalysis}
            </label>
          </div>

          <button
            onClick={handleGrade}
            disabled={!image || isLoading}
            className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t.gradingBatch}</span>
              </>
            ) : (
              <>
                <Award className="w-5 h-5" />
                <span>{t.generateCert}</span>
              </>
            )}
          </button>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          {result ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
              <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileCheck className="w-6 h-6" />
                  <span className="font-semibold text-lg">{t.certTitle}</span>
                </div>
                <span className="text-blue-100 text-sm">{new Date().toLocaleDateString()}</span>
              </div>
              
              <div className="p-6 flex-1 flex flex-col space-y-6">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div>
                    <p className="text-sm text-gray-500">{t.produceType}</p>
                    <p className="font-medium text-gray-900">{produce}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{t.assignedGrade}</p>
                    <p className={`font-bold text-2xl ${result.grade.includes('A') ? 'text-green-600' : result.grade.includes('B') ? 'text-yellow-600' : 'text-red-600'}`}>
                      {result.grade}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-500 mb-1">{t.justification}</p>
                  <p className="text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm leading-relaxed">
                    {result.justification}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <p className="text-xs text-blue-600 font-medium mb-1">{t.shelfLife}</p>
                    <p className="text-sm font-bold text-blue-900">{result.shelfLife}</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <p className="text-xs text-blue-600 font-medium mb-1">{t.bestMarket}</p>
                    <p className="text-sm font-bold text-blue-900">{result.bestMarket}</p>
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-gray-600">
                    <DollarSign className="w-5 h-5" />
                    <span className="text-sm font-medium">{t.estimatedPrice}</span>
                  </div>
                  <div className="text-xl font-bold text-gray-900">
                    ৳ {result.estimatedPriceBdt} <span className="text-sm font-normal text-gray-500">/ kg</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-end">
                 <button className="text-blue-600 font-medium text-sm hover:text-blue-700 flex items-center space-x-1">
                   <span>{t.sendToBuyer}</span>
                 </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 h-full flex flex-col items-center justify-center text-gray-400 text-center">
              <Award className="w-12 h-12 mb-4 opacity-20" />
              <p>Upload a batch photo and generate a certificate to see results here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
