import React, { useState, useRef } from 'react';
import { Camera, Loader2, Leaf, Volume2, Sparkles } from 'lucide-react';
import { diagnoseCrop, generateSpeech } from '../services/ai';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { useUsageTracking } from '../hooks/useUsageTracking';
import { translations, Language } from '../utils/translations';

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
        setDiagnosis(null);
        setAudioUrl(null);
      };
      reader.readAsDataURL(file);
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
    } catch (error) {
      console.error("Diagnosis failed:", error);
      setDiagnosis("Error connecting to AI service. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t.agriCopilot}</h2>
        <p className="text-gray-500 mt-1">{t.agriCopilotDesc}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6 bg-gray-50 p-6 rounded-xl border border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t.captureImage}</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-green-300 rounded-xl p-8 text-center cursor-pointer hover:bg-green-50 transition-colors bg-white relative overflow-hidden group"
            >
              {image ? (
                <img src={`data:${mimeType};base64,${image}`} alt="Crop" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity" />
              ) : null}
              <div className="relative z-10 flex flex-col items-center justify-center space-y-3">
                <div className="bg-green-100 p-3 rounded-full text-green-600">
                  <Camera className="w-6 h-6" />
                </div>
                <div className="text-sm text-gray-600 font-medium">
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
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 bg-white p-2.5 border"
              >
                {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t.upazila}</label>
              <select 
                value={upazila} 
                onChange={(e) => setUpazila(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 bg-white p-2.5 border"
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
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 bg-white p-2.5 border"
            >
              <option value="disease">{t.disease}</option>
              <option value="pest">{t.pest}</option>
              <option value="nutrient">{t.nutrient}</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              id="advanced" 
              checked={isAdvanced}
              onChange={(e) => setIsAdvanced(e.target.checked)}
              disabled={tier !== 'premium'}
              className="rounded text-green-600 focus:ring-green-500 disabled:opacity-50"
            />
            <label htmlFor="advanced" className={`text-sm font-medium flex items-center ${tier === 'premium' ? 'text-gray-700' : 'text-gray-400'}`}>
              <Sparkles className="w-4 h-4 mr-1 text-yellow-500" />
              {t.advancedAnalysis}
            </label>
          </div>

          <button
            onClick={handleDiagnose}
            disabled={!image || isLoading}
            className="w-full bg-green-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t.analyzing}</span>
              </>
            ) : (
              <>
                <Leaf className="w-5 h-5" />
                <span>{t.diagnoseDisease}</span>
              </>
            )}
          </button>
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          {diagnosis ? (
            <div className="bg-green-50 rounded-xl p-6 border border-green-100 h-full flex flex-col">
              <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
                <Leaf className="w-5 h-5 mr-2 text-green-600" />
                {t.diagnosisResult}
              </h3>
              
              <div className="flex-1 bg-white rounded-lg p-4 border border-green-200 text-gray-800 leading-relaxed shadow-sm">
                {diagnosis}
              </div>

              {audioUrl && (
                <div className="mt-6 bg-white rounded-lg p-4 border border-green-200 shadow-sm flex items-center space-x-4">
                  <div className="bg-green-100 p-2 rounded-full text-green-600">
                    <Volume2 className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700 mb-2">{t.playAudio}</p>
                    <audio controls src={audioUrl} className="w-full h-10" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 h-full flex flex-col items-center justify-center text-gray-400 text-center">
              <Leaf className="w-12 h-12 mb-4 opacity-20" />
              <p>Upload an image and click Diagnose to see results here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
