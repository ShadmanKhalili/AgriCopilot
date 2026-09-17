import React, { useState } from 'react';
import { Volume2, VolumeX, ShieldCheck, AlertTriangle, XCircle, Clock, Droplets, Wind, Sun, Sparkles, Sprout, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Language } from '../utils/translations';
import { generateSpeech } from '../services/ai';

interface WeatherNextData {
  temp: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  rainChance: number;
  rainfall: number;
  soilMoisture?: number;
  evapotranspiration?: number;
  safeSprayingWindow?: string;
  fungalBlightRisk?: 'low' | 'moderate' | 'high';
  hourlyForecast?: Array<{
    time: string;
    temp: number;
    humidity: number;
    rainProb: number;
    wind: number;
    condition: string;
  }>;
}

interface Props {
  lang: Language;
  weather: WeatherNextData;
}

export default function FarmActionTrafficLight({ lang, weather }: Props) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // 1. Analyze Spray Safety
  // Rules: Wind < 15 km/h, Rain Chance < 25%, Temp between 15°C and 32°C
  const windSafe = weather.windSpeed <= 14;
  const rainSafe = weather.rainChance <= 20;
  const tempSafe = weather.temp >= 14 && weather.temp <= 33;
  
  let sprayStatus: 'safe' | 'caution' | 'danger' = 'safe';
  let sprayMsgBn = 'আজ বিকেল পর্যন্ত স্প্রে করার জন্য নিরাপদ। বৃষ্টি বা অতিরিক্ত বাতাসের ঝুঁকি নেই।';
  let sprayMsgEn = 'Safe to spray today. Optimal wind speed and low washout probability.';

  if (!rainSafe || weather.windSpeed > 22) {
    sprayStatus = 'danger';
    sprayMsgBn = `স্প্রে করবেন না! বৃষ্টির সম্ভাবনা ${weather.rainChance}% অথবা বাতাস ${weather.windSpeed.toFixed(0)} কিমি/ঘণ্টা, ওষুধ ভেসে যাওয়ার ঝুঁকি।`;
    sprayMsgEn = `Do NOT spray! Rain chance is ${weather.rainChance}% or winds exceed 20 km/h. High chemical washout risk.`;
  } else if (!windSafe || !tempSafe || weather.rainChance > 10) {
    sprayStatus = 'caution';
    sprayMsgBn = 'সতর্কতা: কেবল ভোরে বা মৃদু বাতাসে সীমিত স্প্রে করুন। আগামী কয়েক ঘণ্টার আবহাওয়ায় নজর রাখুন।';
    sprayMsgEn = 'Caution: Only spray in early morning calm air. Keep dosage precise and watch for sudden gusts.';
  }

  // 2. Analyze Irrigation Need (Diesel Pump Saving)
  // Rules: If rain is coming (rainChance > 45% or rainfall > 5mm), hold off pumping to save fuel!
  // If soil moisture is high (> 0.38 m³/m³), no pump needed.
  let irrigateStatus: 'safe' | 'caution' | 'danger' = 'safe';
  let irrigateActionBn = 'পাম্প চালানোর প্রয়োজন নেই (টাকা বাঁচান)';
  let irrigateActionEn = 'Hold Off Irrigation (Save Diesel/Cost)';
  let irrigateMsgBn = 'মাটিতে পর্যাপ্ত আর্দ্রতা রয়েছে অথবা আগামী ৪৮ ঘণ্টায় বৃষ্টির পূর্বাভাস আছে। পাম্প না চালিয়ে ডিজেল খরচ সাশ্রয় করুন।';
  let irrigateMsgEn = 'Rain anticipated or soil moisture adequate. Delay diesel pump to save ~250-400 BDT in fuel.';

  const isRainComingSoon = weather.rainChance >= 40 || (weather.hourlyForecast && weather.hourlyForecast.slice(0, 12).some(h => h.rainProb > 45));
  const isSoilWet = (weather.soilMoisture !== undefined && weather.soilMoisture >= 0.35);

  if (isRainComingSoon || isSoilWet) {
    irrigateStatus = 'caution';
    irrigateActionBn = 'পাম্প বন্ধ রাখুন (বৃষ্টির সম্ভাবনা)';
    irrigateActionEn = 'Postpone Pump (Rain Incoming)';
    irrigateMsgBn = `বৃষ্টির সম্ভাবনা ${weather.rainChance}%। প্রাকৃতিক বৃষ্টিতে সেচ হতে পারে, আজ পাম্প চালালে জলাবদ্ধতা হতে পারে।`;
    irrigateMsgEn = `Rain probability is ${weather.rainChance}%. Delaying irrigation avoids waterlogging and saves pump costs.`;
  } else if (weather.temp >= 30 && weather.humidity < 60 && (weather.soilMoisture !== undefined && weather.soilMoisture < 0.22)) {
    irrigateStatus = 'safe';
    irrigateActionBn = 'আজ জমিতে সেচ দিন';
    irrigateActionEn = 'Irrigate Today (High Deficit)';
    irrigateMsgBn = 'মাটি শুষ্ক এবং তাপমাত্রা বেশি। জমিতে পর্যাপ্ত সেচ দিন যাতে চারা বা ফল শুকিয়ে না যায়।';
    irrigateMsgEn = 'Soil moisture is low and evapotranspiration is elevated. Provide supplemental watering.';
  } else {
    irrigateStatus = 'safe';
    irrigateActionBn = 'পরিমিত সেচ দিন';
    irrigateActionEn = 'Normal Moderate Irrigation';
    irrigateMsgBn = 'মাটিতে স্বাভাবিক আর্দ্রতা আছে। প্রয়োজনমতো হালকা সেচ বা ড্রেনেজ বজায় রাখুন।';
    irrigateMsgEn = 'Moisture levels are moderate. Maintain normal scheduled irrigation.';
  }

  // 3. Analyze Crop Harvesting & Sun Drying
  let harvestStatus: 'safe' | 'caution' | 'danger' = 'safe';
  let harvestActionBn = 'ফসল কাটা ও রোদ দেওয়া অনুকূল';
  let harvestActionEn = 'Favorable for Harvest & Drying';
  let harvestMsgBn = 'পরিষ্কার রোদ এবং কম আর্দ্রতা। ধান, পাট বা গম শুকানোর জন্য আজকের দিনটি চমৎকার।';
  let harvestMsgEn = 'Bright sunshine and dry canopy. Excellent conditions for field threshing and sun-drying.';

  if (weather.rainChance >= 50 || weather.condition.toLowerCase().includes('rain')) {
    harvestStatus = 'danger';
    harvestActionBn = 'ফসল কাটা পিছিয়ে দিন';
    harvestActionEn = 'Delay Field Harvesting';
    harvestMsgBn = 'বৃষ্টি বা ভিজে যাওয়ার আশঙ্কা। খোলা মাঠে কাটা ফসল রাখবেন না, ছত্রাক ও পচন হতে পারে।';
    harvestMsgEn = 'Rain and dampness risk. Do not leave harvested grain exposed on drying yards.';
  } else if (weather.rainChance >= 25 || weather.humidity > 80) {
    harvestStatus = 'caution';
    harvestActionBn = 'সতর্কতার সাথে শুকান (পলিথিন প্রস্তুত রাখুন)';
    harvestActionEn = 'Dry With Caution (Keep Tarps Ready)';
    harvestMsgBn = 'বাতাসে আর্দ্রতা বেশি। বেলা ১১টা থেকে বিকেল ৩টার কড়া রোদে শুকান এবং পলিথিন পাশে রাখুন।';
    harvestMsgEn = 'Elevated morning humidity. Sun-dry between 11 AM - 3 PM with tarps ready for sudden showers.';
  }

  // Audio Playback in Bangla/English for marginal farmers
  const handlePlayVoice = async () => {
    if (isSpeaking) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsSpeaking(false);
      return;
    }

    setIsAudioLoading(true);
    const summaryText = lang === 'bn'
      ? `কৃষক ভাইদের জন্য আজকের কৃষি সিগন্যাল। এক, বালাইনাশক স্প্রে: ${sprayMsgBn} দুই, সেচ পাম্প: ${irrigateMsgBn} তিন, ফসল তোলা ও রোদে শুকানো: ${harvestMsgBn}`
      : `Daily Farm Action Signal. First, Spraying: ${sprayMsgEn} Second, Irrigation: ${irrigateMsgEn} Third, Harvesting and drying: ${harvestMsgEn}`;

    try {
      const base64Audio = await generateSpeech(summaryText);
      if (base64Audio) {
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play();
          setIsSpeaking(true);
        }
      }
    } catch (e) {
      console.error('Failed to generate action speech, trying Web Speech fallback:', e);
      if ('speechSynthesis' in window) {
        try {
          const plainText = summaryText.replace(/[*#_`]/g, '');
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(plainText);
          utterance.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
          utterance.onstart = () => setIsSpeaking(true);
          utterance.onend = () => setIsSpeaking(false);
          utterance.onerror = () => setIsSpeaking(false);
          window.speechSynthesis.speak(utterance);
        } catch (synthErr) {
          console.warn('Speech synthesis failed:', synthErr);
        }
      }
    } finally {
      setIsAudioLoading(false);
    }
  };

  const getStatusBadge = (status: 'safe' | 'caution' | 'danger') => {
    switch (status) {
      case 'safe':
        return {
          color: 'bg-emerald-500 text-white',
          border: 'border-emerald-200 bg-emerald-50/50',
          indicator: 'bg-emerald-500',
          text: lang === 'bn' ? 'অনুকূল (সবুজ)' : 'Safe (Green)',
          icon: ShieldCheck
        };
      case 'caution':
        return {
          color: 'bg-amber-500 text-white',
          border: 'border-amber-200 bg-amber-50/50',
          indicator: 'bg-amber-500',
          text: lang === 'bn' ? 'সতর্কতা (হলুদ)' : 'Caution (Amber)',
          icon: AlertTriangle
        };
      case 'danger':
        return {
          color: 'bg-rose-500 text-white',
          border: 'border-rose-200 bg-rose-50/50',
          indicator: 'bg-rose-500',
          text: lang === 'bn' ? 'নিষেধ (লাল)' : 'Avoid (Red)',
          icon: XCircle
        };
    }
  };

  const sprayBadge = getStatusBadge(sprayStatus);
  const irrigateBadge = getStatusBadge(irrigateStatus);
  const harvestBadge = getStatusBadge(harvestStatus);

  return (
    <div className="bg-white rounded-[32px] p-5 md:p-6 border border-emerald-100/80 shadow-lg shadow-emerald-50/60 relative overflow-hidden mb-6">
      {/* Subtle background glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-emerald-100/40 via-blue-50/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 relative z-10 border-b border-gray-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
              {lang === 'bn' ? '১-ক্লিক মাঠ সিদ্ধান্ত' : '1-Tap Daily Farm Action'}
            </span>
            <span className="text-[11px] text-gray-400 font-bold hidden md:inline">
              WeatherNext 3 Engine
            </span>
          </div>
          <h3 className="text-xl md:text-2xl font-black text-gray-900 mt-1 flex items-center gap-2">
            <span>{lang === 'bn' ? 'আজকের মাঠ অ্যাকশন ট্রাফিক লাইট' : 'Today\'s Farm Action Traffic Light'}</span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {lang === 'bn' 
              ? 'জটিল আবহাওয়া চার্ট না দেখেই তাৎক্ষণিক ৩টি গুরুত্বপূর্ণ সিদ্ধান্ত নিন'
              : 'Zero guesswork for farmers: direct green/amber/red indicators for daily operations'}
          </p>
        </div>

        {/* 1-Tap Audio Voiceout Button */}
        <button
          onClick={handlePlayVoice}
          disabled={isAudioLoading}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all self-start sm:self-auto shadow-sm active:scale-95 ${
            isSpeaking
              ? 'bg-rose-50 text-rose-600 border border-rose-200 shadow-inner'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
          }`}
          title={lang === 'bn' ? 'মুখে শুনে নিন' : 'Listen in voice'}
        >
          {isAudioLoading ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isSpeaking ? (
            <VolumeX className="w-4 h-4 text-rose-600" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
          <span>
            {isSpeaking 
              ? (lang === 'bn' ? 'থামান' : 'Stop Audio') 
              : (lang === 'bn' ? 'বাংলা অডিও শুনুন' : 'Listen Advisory')}
          </span>
        </button>
      </div>

      {/* 3 Decision Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
        {/* Card 1: Pesticide / Fertilizer Spraying */}
        <motion.div 
          whileHover={{ y: -3 }}
          className={`rounded-2xl p-4 border transition-all ${sprayBadge.border}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-white shadow-xs text-indigo-600">
                <Wind className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  {lang === 'bn' ? 'সিদ্ধান্ত ১' : 'Decision 1'}
                </span>
                <h4 className="text-sm font-black text-gray-900">
                  {lang === 'bn' ? 'কীটনাশক / সার স্প্রে' : 'Pesticide & Spraying'}
                </h4>
              </div>
            </div>
            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${sprayBadge.color}`}>
              {sprayBadge.text}
            </span>
          </div>

          <div className="mt-3 bg-white/90 backdrop-blur-xs rounded-xl p-3 border border-gray-100">
            <div className="flex items-center gap-1.5 text-xs font-black text-gray-800 mb-1">
              <sprayBadge.icon className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>
                {weather.safeSprayingWindow ? weather.safeSprayingWindow : (lang === 'bn' ? 'উইন্ডো সক্রিয়' : 'Window Active')}
              </span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {lang === 'bn' ? sprayMsgBn : sprayMsgEn}
            </p>
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px] text-gray-500 pt-1">
            <span>{lang === 'bn' ? 'বাতাস:' : 'Wind:'} <strong className="text-gray-800">{weather.windSpeed.toFixed(1)} km/h</strong></span>
            <span>{lang === 'bn' ? 'বৃষ্টির ঝুঁকি:' : 'Rain Risk:'} <strong className="text-gray-800">{weather.rainChance}%</strong></span>
          </div>
        </motion.div>

        {/* Card 2: Diesel Pump / Irrigation Scheduling */}
        <motion.div 
          whileHover={{ y: -3 }}
          className={`rounded-2xl p-4 border transition-all ${irrigateBadge.border}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-white shadow-xs text-blue-600">
                <Droplets className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  {lang === 'bn' ? 'সিদ্ধান্ত ২' : 'Decision 2'}
                </span>
                <h4 className="text-sm font-black text-gray-900">
                  {lang === 'bn' ? 'ডিজেল পাম্প / সেচ' : 'Diesel Pump / Irrigation'}
                </h4>
              </div>
            </div>
            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${irrigateBadge.color}`}>
              {irrigateBadge.text}
            </span>
          </div>

          <div className="mt-3 bg-white/90 backdrop-blur-xs rounded-xl p-3 border border-gray-100">
            <div className="flex items-center gap-1.5 text-xs font-black text-gray-800 mb-1">
              <irrigateBadge.icon className="w-4 h-4 shrink-0 text-blue-600" />
              <span>{lang === 'bn' ? irrigateActionBn : irrigateActionEn}</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {lang === 'bn' ? irrigateMsgBn : irrigateMsgEn}
            </p>
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px] text-gray-500 pt-1">
            <span>
              {lang === 'bn' ? 'মাটির রস:' : 'Soil Moisture:'} <strong className="text-gray-800">{weather.soilMoisture !== undefined ? `${weather.soilMoisture} m³/m³` : 'স্বাভাবিক'}</strong>
            </span>
            <span>
              {lang === 'bn' ? 'বাষ্পীভবন:' : 'ET₀:'} <strong className="text-gray-800">{weather.evapotranspiration || 3.4} mm/d</strong>
            </span>
          </div>
        </motion.div>

        {/* Card 3: Crop Harvest & Sun Drying */}
        <motion.div 
          whileHover={{ y: -3 }}
          className={`rounded-2xl p-4 border transition-all ${harvestBadge.border}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-white shadow-xs text-amber-500">
                <Sun className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  {lang === 'bn' ? 'সিদ্ধান্ত ৩' : 'Decision 3'}
                </span>
                <h4 className="text-sm font-black text-gray-900">
                  {lang === 'bn' ? 'ফসল তোলা ও রোদে শুকানো' : 'Harvesting & Drying'}
                </h4>
              </div>
            </div>
            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${harvestBadge.color}`}>
              {harvestBadge.text}
            </span>
          </div>

          <div className="mt-3 bg-white/90 backdrop-blur-xs rounded-xl p-3 border border-gray-100">
            <div className="flex items-center gap-1.5 text-xs font-black text-gray-800 mb-1">
              <harvestBadge.icon className="w-4 h-4 shrink-0 text-amber-500" />
              <span>{lang === 'bn' ? harvestActionBn : harvestActionEn}</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {lang === 'bn' ? harvestMsgBn : harvestMsgEn}
            </p>
          </div>

          <div className="mt-2.5 flex items-center justify-between text-[11px] text-gray-500 pt-1">
            <span>{lang === 'bn' ? 'আর্দ্রতা:' : 'Humidity:'} <strong className="text-gray-800">{weather.humidity}%</strong></span>
            <span>{lang === 'bn' ? 'অবস্থা:' : 'Condition:'} <strong className="text-gray-800">{weather.condition}</strong></span>
          </div>
        </motion.div>
      </div>

      {/* Hidden audio element for speech */}
      <audio 
        ref={audioRef} 
        onEnded={() => setIsSpeaking(false)} 
        className="hidden" 
      />
    </div>
  );
}
