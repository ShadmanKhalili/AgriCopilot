import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sprout, MapPin, Droplets, Sun, AlertTriangle, CheckCircle2, XCircle, ChevronRight, Info, Navigation, Cloud, Satellite, Wallet, History, Sparkles } from 'lucide-react';
import { getPlantingRecommendations } from '../services/ai';
import { useUsageTracking } from '../hooks/useUsageTracking';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { translations, Language } from '../utils/translations';
import { useAuth } from './AuthProvider';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { geoData } from '../utils/geoData';
import { detectUserLocation } from '../utils/geolocation';
import { LiveExpertCall } from './LiveExpertCall';

interface SmartPlantingProps {
  lang: Language;
  globalLocation: { latitude: number; longitude: number } | null;
  setGlobalLocation: (loc: { latitude: number; longitude: number }) => void;
}

export default function SmartPlanting({ lang, globalLocation, setGlobalLocation }: SmartPlantingProps) {
  const t = translations[lang];
  const { canUse, canUsePremium, incrementUsage, incrementPremiumUsage, currentUsage, limit, tier, currentPremiumUsage, premiumLimit } = useUsageTracking('smart-planting');
  const { user } = useAuth();
  const [usePremium, setUsePremium] = useState(false);
  const isOnline = useNetworkStatus();

  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isManualLocation, setIsManualLocation] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState(geoData[0].id);
  const [selectedUpazila, setSelectedUpazila] = useState(geoData[0].upazilas[0]?.id || '');

  const [landType, setLandType] = useState('Medium High');
  const [landSize, setLandSize] = useState('10');
  const [irrigation, setIrrigation] = useState('Rainfed');
  const [previousCrop, setPreviousCrop] = useState('None');
  const [budget, setBudget] = useState('Medium');
  const [targetTime, setTargetTime] = useState('Next Week');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeDistrict = geoData.find(d => d.id === selectedDistrict);
  const activeUpazila = activeDistrict?.upazilas.find(u => u.id === selectedUpazila);

  const detectLocation = async () => {
    setIsDetectingLocation(true);
    setLocationError(null);
    setIsManualLocation(false);
    
    try {
      const coords = await detectUserLocation();
      setGlobalLocation(coords);
      setIsDetectingLocation(false);
    } catch (error: any) {
      console.error("Error getting location:", error);
      let msg = t.tooltips?.locationError || "Failed to detect location.";
      if (error.code === 1) msg = "Permission denied. Please click the lock icon in your browser's address bar to allow location access, or use manual entry.";
      if (error.code === 3) msg = "Location request timed out. Please try again or use manual entry.";
      setLocationError(msg);
      setIsDetectingLocation(false);
      setIsManualLocation(true);
    }
  };

  const handleAnalyze = async () => {
    if (!isOnline) {
      alert(lang === 'bn' ? 'অফলাইনে কাজ হবে না। দয়া করে ইন্টারনেট সংযোগ চালু করুন।' : 'You are currently offline. Please connect to the internet to run this diagnosis.');
      return;
    }

    const activeLocation = isManualLocation && activeUpazila
      ? { latitude: activeUpazila.lat, longitude: activeUpazila.lng }
      : globalLocation;

    if (!activeLocation) {
      setError(t.locationRequired || "Please detect your location or select manually.");
      return;
    }

    if (currentUsage >= limit && limit !== Infinity) {
      setError(t.limitReached);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResults(null);

    try {
      // Fetch Weather Data
      let weatherData = null;
      try {
        const weatherRes = await fetch(`/api/daily-forecast?latitude=${activeLocation.latitude}&longitude=${activeLocation.longitude}&current=temperature_2m,relative_humidity_2m,precipitation&timezone=auto`);
        weatherData = await weatherRes.json();
      } catch (e) {
        console.warn("Failed to fetch weather data", e);
      }

      // Fetch Satellite Data
      let satelliteData = null;
      try {
        const satRes = await fetch('/.netlify/functions/sentinel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: activeLocation.latitude, lng: activeLocation.longitude })
        });
        satelliteData = await satRes.json();
      } catch (e) {
        console.warn("Failed to fetch satellite data", e);
      }

      const isPremiumAnalysis = usePremium || tier === 'premium';
      const data = await getPlantingRecommendations(
        activeLocation,
        landType,
        landSize,
        irrigation,
        previousCrop,
        budget,
        targetTime,
        weatherData,
        satelliteData,
        lang,
        isPremiumAnalysis
      );
      
      setResults(data);
      if (usePremium && tier !== 'premium') incrementPremiumUsage();
      incrementUsage();

      // Save Intent to Database
      if (user && data.recommended && data.recommended.length > 0) {
        try {
          await addDoc(collection(db, 'planting_intents'), {
            userId: user.uid,
            latitude: activeLocation.latitude,
            longitude: activeLocation.longitude,
            landType,
            landSize,
            irrigation,
            previousCrop,
            budget,
            targetTime,
            recommendedCrop: data.recommended[0].crop, // Save the top recommendation as intent
            createdAt: new Date().toISOString()
          });
        } catch (dbError) {
          handleFirestoreError(dbError, OperationType.CREATE, 'planting_intents');
        }
      }

    } catch (err: any) {
      console.error(err);
      const isQuotaError = err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED');
      const errorMsg = isQuotaError 
        ? (lang === 'bn' ? 'সিস্টেমের চাপ বেশি, দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন।' : 'AI limit reached. Please try again in 5 minutes.')
        : (err.message || 'Failed to generate recommendations.');
      setError(errorMsg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'low': return 'text-green-600 bg-green-100 border-green-200';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'high': return 'text-red-600 bg-red-100 border-red-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="bg-white rounded-[24px] md:rounded-[32px] p-4 md:p-6 shadow-xl shadow-green-900/5 border border-green-100 mb-4 md:mb-6">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="bg-green-100 p-2 md:p-3 rounded-xl flex-shrink-0">
            <Sprout className="w-6 h-6 md:w-7 h-7 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg md:text-2xl font-black text-gray-900 tracking-tight leading-tight">
              {lang === 'bn' ? 'স্মার্ট প্ল্যানার' : 'Smart Planner'}
            </h2>
            <p className="text-gray-500 text-[10px] md:text-sm font-medium">
              {lang === 'bn' ? 'পরবর্তী মৌসুমে কী চাষ করবেন তার এআই ভিত্তিক পরামর্শ' : 'AI-driven recommendations for your next crop cycle'}
            </p>
          </div>
        </div>
      </div>

        {/* Location Section */}
        <div className="mb-4 md:mb-6 p-4 md:p-5 bg-gray-50 rounded-2xl border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-grow">
              <h3 className="font-bold text-gray-900 flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-green-600" />
                <span>{lang === 'bn' ? 'আপনার অবস্থান' : 'Your Location'}</span>
              </h3>
              
              {!isManualLocation ? (
                <p className="text-sm text-gray-500 mt-1">
                  {globalLocation 
                    ? `${globalLocation.latitude.toFixed(4)}, ${globalLocation.longitude.toFixed(4)}`
                    : t.tooltips.locationDesc}
                </p>
              ) : (
                <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <select
                    value={selectedDistrict}
                    onChange={(e) => {
                      setSelectedDistrict(e.target.value);
                      const newDistrict = geoData.find(d => d.id === e.target.value);
                      if (newDistrict && newDistrict.upazilas.length > 0) {
                        setSelectedUpazila(newDistrict.upazilas[0].id);
                      } else {
                        setSelectedUpazila('');
                      }
                    }}
                    className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    {geoData.map(d => (
                      <option key={d.id} value={d.id}>{lang === 'bn' ? d.bn_name : d.name}</option>
                    ))}
                  </select>
                  <select
                    value={selectedUpazila}
                    onChange={(e) => setSelectedUpazila(e.target.value)}
                    className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-green-500 outline-none"
                    disabled={!activeDistrict || activeDistrict.upazilas.length === 0}
                  >
                    {activeDistrict?.upazilas.map(u => (
                      <option key={u.id} value={u.id}>{lang === 'bn' ? u.bn_name : u.name}</option>
                    ))}
                  </select>
                  {activeUpazila && (
                    <span className="text-xs text-gray-400 italic">
                      ({activeUpazila.lat.toFixed(4)}, {activeUpazila.lng.toFixed(4)})
                    </span>
                  )}
                </div>
              )}
              
              {locationError && <p className="text-xs text-red-500 mt-1">{locationError}</p>}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={detectLocation}
                disabled={isDetectingLocation}
                className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-xl font-bold transition-all ${
                  globalLocation && !isManualLocation
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-900/20'
                }`}
              >
                {isDetectingLocation ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Navigation className="w-4 h-4" />
                )}
                <span>{globalLocation && !isManualLocation ? (t.locationDetected || 'Location Detected') : (t.detectLocation || 'Detect Location')}</span>
              </button>

              <button
                onClick={() => setIsManualLocation(!isManualLocation)}
                className={`px-4 py-2 rounded-xl font-bold text-sm transition-all border ${
                  isManualLocation 
                    ? 'bg-amber-50 border-amber-200 text-amber-700' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {isManualLocation ? t.tryGpsAgain : t.setManually}
              </button>
            </div>
          </div>
          
          {isManualLocation && (
            <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                {t.manualLocationNotice}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {/* Target Time */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 flex items-center space-x-2">
              <Sun className="w-4 h-4 text-orange-500" />
              <span>{lang === 'bn' ? 'কবে চাষ শুরু করবেন?' : 'Target Planting Time'}</span>
            </label>
            <select 
              value={targetTime}
              onChange={(e) => setTargetTime(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none"
            >
              <option value="Next Week">{lang === 'bn' ? 'আগামী সপ্তাহে' : 'Next Week'}</option>
              <option value="Next Month">{lang === 'bn' ? 'আগামী মাসে' : 'Next Month'}</option>
              <option value="Next Season">{lang === 'bn' ? 'পরবর্তী মৌসুমে' : 'Next Season'}</option>
            </select>
          </div>

          {/* Land Type */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 flex items-center space-x-2">
              <Sprout className="w-4 h-4 text-green-600" />
              <span>{lang === 'bn' ? 'জমির ধরন' : 'Land Type'}</span>
            </label>
            <select 
              value={landType}
              onChange={(e) => setLandType(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none"
            >
              <option value="High">{lang === 'bn' ? 'উঁচু জমি' : 'High'}</option>
              <option value="Medium High">{lang === 'bn' ? 'মাঝারি উঁচু জমি' : 'Medium High'}</option>
              <option value="Medium Low">{lang === 'bn' ? 'মাঝারি নিচু জমি' : 'Medium Low'}</option>
              <option value="Low">{lang === 'bn' ? 'নিচু জমি' : 'Low'}</option>
              <option value="Very Low">{lang === 'bn' ? 'খুব নিচু জমি' : 'Very Low'}</option>
            </select>
          </div>

          {/* Irrigation */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 flex items-center space-x-2">
              <Droplets className="w-4 h-4 text-blue-500" />
              <span>{lang === 'bn' ? 'সেচ ব্যবস্থা' : 'Irrigation System'}</span>
            </label>
            <select 
              value={irrigation}
              onChange={(e) => setIrrigation(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none"
            >
              <option value="Rainfed">{lang === 'bn' ? 'বৃষ্টি নির্ভর (সেচ নেই)' : 'Rainfed (None)'}</option>
              <option value="Shallow Tube Well">{lang === 'bn' ? 'অগভীর নলকূপ' : 'Shallow Tube Well'}</option>
              <option value="Deep Tube Well">{lang === 'bn' ? 'গভীর নলকূপ' : 'Deep Tube Well'}</option>
              <option value="Surface Water">{lang === 'bn' ? 'ভূপৃষ্ঠের পানি (পাম্প)' : 'Surface Water (Pump)'}</option>
            </select>
          </div>

          {/* Previous Crop */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 flex items-center space-x-2">
              <History className="w-4 h-4 text-purple-500" />
              <span>{lang === 'bn' ? 'আগের ফসল' : 'Previous Crop'}</span>
            </label>
            <select 
              value={previousCrop}
              onChange={(e) => setPreviousCrop(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none"
            >
              <option value="None">{lang === 'bn' ? 'কিছুই না (পতিত)' : 'None (Fallow)'}</option>
              <option value="Rice (Aman)">{lang === 'bn' ? 'আমন ধান' : 'Rice (Aman)'}</option>
              <option value="Rice (Boro)">{lang === 'bn' ? 'বোরো ধান' : 'Rice (Boro)'}</option>
              <option value="Rice (Aus)">{lang === 'bn' ? 'আউশ ধান' : 'Rice (Aus)'}</option>
              <option value="Potato">{lang === 'bn' ? 'আলু' : 'Potato'}</option>
              <option value="Jute">{lang === 'bn' ? 'পাট' : 'Jute'}</option>
              <option value="Wheat">{lang === 'bn' ? 'গম' : 'Wheat'}</option>
              <option value="Maize">{lang === 'bn' ? 'ভুট্টা' : 'Maize'}</option>
              <option value="Mustard">{lang === 'bn' ? 'সরিষা' : 'Mustard'}</option>
              <option value="Onion">{lang === 'bn' ? 'পেঁয়াজ' : 'Onion'}</option>
              <option value="Garlic">{lang === 'bn' ? 'রসুন' : 'Garlic'}</option>
              <option value="Chili">{lang === 'bn' ? 'মরিচ' : 'Chili'}</option>
              <option value="Tomato">{lang === 'bn' ? 'টমেটো' : 'Tomato'}</option>
              <option value="Brinjal">{lang === 'bn' ? 'বেগুন' : 'Brinjal'}</option>
              <option value="Lentil">{lang === 'bn' ? 'মসুর ডাল' : 'Lentil'}</option>
              <option value="Mungbean">{lang === 'bn' ? 'মুগ ডাল' : 'Mungbean'}</option>
            </select>
          </div>

          {/* Budget */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 flex items-center space-x-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span>{lang === 'bn' ? 'বিনিয়োগ ক্ষমতা' : 'Investment Budget'}</span>
            </label>
            <select 
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none"
            >
              <option value="Low">{lang === 'bn' ? 'কম' : 'Low'}</option>
              <option value="Medium">{lang === 'bn' ? 'মাঝারি' : 'Medium'}</option>
              <option value="High">{lang === 'bn' ? 'বেশি' : 'High'}</option>
            </select>
          </div>

          {/* Land Size */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-green-600" />
              <span>{lang === 'bn' ? 'জমির পরিমাণ (শতাংশ)' : 'Land Size (Decimals)'}</span>
            </label>
            <input 
              type="number" 
              value={landSize}
              onChange={(e) => setLandSize(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {tier !== 'premium' && canUsePremium() && (
          <div className="mb-6 flex items-center justify-between p-4 bg-orange-50 border border-orange-100 rounded-2xl">
            <div className="flex items-center space-x-3">
              <div className="bg-orange-100 p-2 rounded-xl">
                <Sparkles className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900">Premium Analysis (Gemini 3.1 Flash)</h4>
                <p className="text-xs text-gray-500">Use your 1 free daily premium run for this tab.</p>
              </div>
            </div>
            <button
              onClick={() => setUsePremium(!usePremium)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${usePremium ? 'bg-orange-500' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${usePremium ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !globalLocation}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-green-900/20 disabled:opacity-70 flex items-center justify-center space-x-2"
        >
          {isAnalyzing ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>{lang === 'bn' ? 'বিশ্লেষণ করা হচ্ছে...' : 'Analyzing...'}</span>
            </>
          ) : (
            <>
              <Sprout className="w-5 h-5" />
              <span>{lang === 'bn' ? 'পরামর্শ নিন' : 'Get Recommendations'}</span>
            </>
          )}
        </button>

      {results && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* AI Voice Call Section */}
          <div className="bg-gradient-to-br from-green-900 to-emerald-900 rounded-[28px] p-4 md:p-6 shadow-xl border border-green-800 text-white">
            <div className="mb-3">
              <h3 className="text-lg font-black mb-1">{lang === 'bn' ? 'মাস্টার এগ্রোনমিস্টের সাথে কথা বলুন' : 'Discuss Your Plan with AI'}</h3>
              <p className="text-green-200 text-xs">{lang === 'bn' ? 'আপনার প্ল্যান সম্পর্কে এআই এর সাথে সরাসরি কথা বলুন' : 'Have a live conversation with our AI expert about these crop recommendations.'}</p>
            </div>
            <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-sm border border-white/10">
              <LiveExpertCall 
                diagnosisContext={`User Profile: ${landSize} decimal ${landType} land, ${irrigation} irrigation, budget: ${budget}. 
Top Recommendations:
${results.recommended?.map((r:any)=> `- ${r.crop}: ${r.detailedAnalysis} (Margin: ${r.expectedMargin}, Risk: ${r.riskLevel} - ${r.riskReason})`).join('\n')}

Diversification Option:
${results.diversification?.crop}: ${results.diversification?.detailedAnalysis}

Crops to Avoid:
${results.avoid?.map((r:any) => `- ${r.crop}: ${r.evidence}`).join('\n')}`}
                lang={lang}
                locationContext={globalLocation ? `GPS: ${globalLocation.latitude}, ${globalLocation.longitude}` : "Bangladesh"}
              />
            </div>
          </div>

          {/* Recommended Crops */}
          <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-xl shadow-green-900/5 border border-green-100">
            <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span>{lang === 'bn' ? 'শীর্ষ সুপারিশকৃত ফসল' : 'Top Recommended Crops'}</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {results.recommended?.map((rec: any, idx: number) => (
                <div key={idx} className="bg-gray-50 rounded-2xl p-5 border border-gray-100 hover:border-green-300 transition-colors flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="text-lg font-bold text-gray-900">{rec.crop}</h4>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${getRiskColor(rec.riskLevel)}`}>
                      Risk: {rec.riskLevel}
                    </span>
                  </div>
                  
                  <div className="mb-4">
                    <div className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">
                      {lang === 'bn' ? 'আনুমানিক লাভ (প্রতি শতাংশ)' : 'Expected Margin (per decimal)'}
                    </div>
                    <div className="text-lg font-black text-green-700">{rec.expectedMargin}</div>
                  </div>

                  <div className="space-y-2 mb-4 flex-grow">
                    {rec.reasons?.map((reason: string, rIdx: number) => (
                      <div key={rIdx} className="flex items-start space-x-2 text-sm text-gray-600">
                        <ChevronRight className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h5 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Info className="w-3 h-3 text-blue-500" />
                      {lang === 'bn' ? 'কেন এই ফসল?' : 'Why this crop?'}
                    </h5>
                    <p className="text-xs text-gray-600 leading-relaxed italic">
                      {rec.detailedAnalysis}
                    </p>
                  </div>

                  <div className="mt-4 bg-white p-3 rounded-xl border border-gray-200 text-xs text-gray-600">
                    <span className="font-bold text-gray-900">{lang === 'bn' ? 'ঝুঁকির কারণ:' : 'Risk Reason:'}</span> {rec.riskReason}
                  </div>

                  {rec.macroWarning && (
                    <div className="mt-3 bg-orange-50 p-3 rounded-xl border border-orange-100 text-xs text-orange-800 flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{rec.macroWarning}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Avoid Crops */}
            <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-xl shadow-red-900/5 border border-red-100">
              <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center space-x-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <span>{lang === 'bn' ? 'যেসব ফসল এড়িয়ে চলবেন' : 'Crops to Avoid'}</span>
              </h3>
              <div className="space-y-3">
                {results.avoid?.map((avoid: any, idx: number) => (
                  <div key={idx} className="bg-red-50 rounded-2xl p-4 border border-red-100">
                    <div className="flex items-center gap-2 mb-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <h4 className="text-base font-bold text-red-900">{avoid.crop}</h4>
                    </div>
                    <p className="text-xs text-red-700 leading-relaxed">{avoid.evidence}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Diversification */}
            {results.diversification && (
              <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-xl shadow-blue-900/5 border border-blue-100">
                <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center space-x-2">
                  <Info className="w-5 h-5 text-blue-500" />
                  <span>{lang === 'bn' ? 'ঝুঁকি কমাতে বিকল্প ফসল' : 'Diversification Option'}</span>
                </h3>
                <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="text-base font-bold text-blue-900">{results.diversification.crop}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${getRiskColor(results.diversification.riskLevel)}`}>
                      Risk: {results.diversification.riskLevel}
                    </span>
                  </div>
                  <div className="space-y-1.5 mb-3">
                    {results.diversification.reasons?.map((reason: string, rIdx: number) => (
                      <div key={rIdx} className="flex items-start space-x-2 text-xs text-blue-800">
                        <ChevronRight className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <h5 className="text-[10px] font-bold text-blue-900 uppercase tracking-wider mb-1.5">
                      {lang === 'bn' ? 'বিকল্প হিসেবে কেন?' : 'Why as an alternative?'}
                    </h5>
                    <p className="text-[10px] text-blue-800 leading-relaxed italic">
                      {results.diversification.detailedAnalysis}
                    </p>
                  </div>

                  <div className="mt-3 bg-white/60 p-2.5 rounded-xl border border-blue-200 text-[10px] text-blue-900">
                    <span className="font-bold">{lang === 'bn' ? 'ঝুঁকির কারণ:' : 'Risk Reason:'}</span> {results.diversification.riskReason}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
