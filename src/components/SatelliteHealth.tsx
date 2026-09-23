import React, { useState } from 'react';
import { translations, Language } from '../utils/translations';
import { Satellite, MapPin, RefreshCw, AlertTriangle, CheckCircle2, Info, Leaf, Cloud, Activity, Navigation, ChevronDown, ChevronUp, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';
import LocationDisplay from './LocationDisplay';
import { geoData } from '../utils/geoData';
import { detectUserLocation } from '../utils/geolocation';

interface Props {
  lang: Language;
  globalLocation: { latitude: number; longitude: number } | null;
  setGlobalLocation: (loc: { latitude: number; longitude: number }) => void;
}

const SatelliteHealth: React.FC<Props> = ({ lang, globalLocation, setGlobalLocation }) => {
  const t = translations[lang];
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isManualLocation, setIsManualLocation] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState(geoData[0].id);
  const [selectedUpazila, setSelectedUpazila] = useState(geoData[0].upazilas[0]?.id || '');
  const [ndvi, setNdvi] = useState<number | null>(null);
  const [ndmi, setNdmi] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSpectralDetails, setShowSpectralDetails] = useState(false);

  const activeDistrict = geoData.find(d => d.id === selectedDistrict);
  const activeUpazila = activeDistrict?.upazilas.find(u => u.id === selectedUpazila);

  const detectLocation = async () => {
    setLoading(true);
    setError(null);
    setLocationError(null);
    setIsManualLocation(false);

    try {
      const coords = await detectUserLocation();
      setGlobalLocation(coords);
      setLoading(false);
    } catch (err: any) {
      console.warn("Location detection notice in SatelliteHealth:", err?.message || err);
      let msg = t.tooltips?.locationError || "Failed to detect location.";
      if (err?.code === 1) msg = "Permission denied. Please click the lock icon in your browser's address bar to allow location access, or use manual entry.";
      if (err?.code === 3) msg = "Location request timed out. Please try again or use manual entry.";
      setLocationError(msg);
      setError(msg);
      setLoading(false);
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

  const fetchNdvi = async () => {
    if (!globalLocation) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/.netlify/functions/sentinel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: globalLocation.latitude, lng: globalLocation.longitude })
      });
      const data = await response.json();
      if (data.error) {
        const detailStr = data.details ? (typeof data.details === 'object' ? JSON.stringify(data.details) : data.details) : '';
        if (data.error === 'invalid_client' || detailStr.includes('invalid_client')) {
          throw new Error("Sentinel Hub API credentials are not configured or invalid. Please set SENTINEL_HUB_CLIENT_ID and SENTINEL_HUB_CLIENT_SECRET in your environment variables.");
        }
        throw new Error(`${data.error}${detailStr ? ': ' + detailStr : ''}`);
      }
      setNdvi(data.ndvi);
      setNdmi(data.ndmi);
    } catch (err: any) {
      setError(err.message || "Failed to fetch satellite data");
    } finally {
      setLoading(false);
    }
  };

  // Disciplined Semantic Color Signals (Emerald, Amber, Rose, Sky)
  const getHealthStatus = (val: number) => {
    if (val > 0.6) return { label: t.healthLevels.healthy, color: '#16a34a', bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2, insight: t.insightHealthy };
    if (val > 0.3) return { label: t.healthLevels.stressed, color: '#d97706', bgClass: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertTriangle, insight: t.insightStressed };
    if (val > 0.1) return { label: t.healthLevels.sparse, color: '#e11d48', bgClass: 'bg-rose-50 text-rose-700 border-rose-200', icon: Info, insight: t.insightSparse };
    return { label: t.healthLevels.water, color: '#0284c7', bgClass: 'bg-sky-50 text-sky-700 border-sky-200', icon: Satellite, insight: t.insightWater };
  };

  const getMoistureStatus = (val: number) => {
    if (val > 0.4) return { label: t.moistureLevels.high, color: '#0284c7', bgClass: 'bg-sky-50 text-sky-700 border-sky-200', insight: t.insightMoistureHigh };
    if (val > 0.0) return { label: t.moistureLevels.good, color: '#16a34a', bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', insight: t.insightMoistureGood };
    if (val > -0.2) return { label: t.moistureLevels.low, color: '#d97706', bgClass: 'bg-amber-50 text-amber-700 border-amber-200', insight: t.insightMoistureLow };
    return { label: t.moistureLevels.drought, color: '#e11d48', bgClass: 'bg-rose-50 text-rose-700 border-rose-200', insight: t.insightMoistureDrought };
  };

  const chartData = ndvi !== null ? [
    { value: (ndvi + 1) / 2 },
    { value: 1 - (ndvi + 1) / 2 }
  ] : [];

  const moistureChartData = ndmi !== null ? [
    { value: (ndmi + 1) / 2 },
    { value: 1 - (ndmi + 1) / 2 }
  ] : [];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      {/* Top Banner Header: Stone & Forest restrained palette */}
      <motion.div variants={itemVariants} className="bg-white dark:bg-stone-900 rounded-2xl p-4 sm:p-5 border border-stone-200/80 dark:border-stone-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="bg-stone-100 dark:bg-stone-800 p-2.5 rounded-xl text-stone-700 dark:text-stone-300 shrink-0">
              <Satellite className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight leading-tight">{t.cropHealth}</h2>
              <p className="text-stone-500 dark:text-stone-400 text-xs sm:text-sm font-normal">{t.cropHealthDesc}</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold self-start sm:self-auto">
            <span className="recording-dot shrink-0" />
            <span>Sentinel-2 Multispectral (10m)</span>
          </div>
        </div>
      </motion.div>

      {/* Control / Location Trigger Card */}
      <motion.div 
        variants={itemVariants}
        className="bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 rounded-2xl p-4 sm:p-5 shadow-xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">{t.location}</span>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setIsManualLocation(!isManualLocation)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border ${
                    isManualLocation 
                      ? 'bg-amber-50 border-amber-200 text-amber-700' 
                      : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                  }`}
                  title={isManualLocation ? "Use GPS" : "Set Manually"}
                >
                  <span className="flex items-center gap-1">
                    <Navigation className="w-3 h-3" />
                    <span>{isManualLocation ? 'GPS' : (lang === 'bn' ? 'জেলা নির্বাচন' : 'Manual')}</span>
                  </span>
                </button>
                <button
                  onClick={detectLocation}
                  disabled={loading}
                  className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 dark:text-stone-300 rounded-lg transition-colors disabled:opacity-50"
                  title="Refresh GPS"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {isManualLocation && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
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
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800 outline-none focus:border-emerald-600"
                >
                  {geoData.map(d => (
                    <option key={d.id} value={d.id}>{lang === 'bn' ? d.bn_name : d.name}</option>
                  ))}
                </select>
                <select
                  value={selectedUpazila}
                  onChange={(e) => handleManualLocationChange(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800 outline-none focus:border-emerald-600"
                  disabled={!activeDistrict || activeDistrict.upazilas.length === 0}
                >
                  {activeDistrict?.upazilas.map(u => (
                    <option key={u.id} value={u.id}>{lang === 'bn' ? u.bn_name : u.name}</option>
                  ))}
                </select>
              </div>
            )}

            {globalLocation && (
              <div className="mt-2">
                <LocationDisplay coords={{ latitude: globalLocation.latitude, longitude: globalLocation.longitude }} lang={lang} color="emerald" />
              </div>
            )}
          </div>

          <div className="sm:w-64">
            <button
              onClick={fetchNdvi}
              disabled={loading || !globalLocation}
              className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{t.tooltips.detecting}</span>
                </>
              ) : (
                <>
                  <Satellite className="w-4 h-4" />
                  <span>{t.fetchSatelliteData}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Loading state: Calm spinner without animate-ping */}
      {loading && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white dark:bg-stone-900 p-8 rounded-2xl border border-stone-200/80 dark:border-stone-800 text-center space-y-3"
        >
          <div className="w-10 h-10 mx-auto rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
          <p className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
            {lang === 'bn' ? 'স্যাটেলাইট স্পেকট্রাল ব্যান্ড প্রসেস করা হচ্ছে...' : 'Ingesting Sentinel-2 MSI bands...'}
          </p>
          <p className="text-[11px] text-stone-400 font-normal">
            {lang === 'bn' ? '১০ মিটার রেজোলিউশনে উদ্ভিদের ক্লোরোফিল ও ক্যানোপির আর্দ্রতা পরিমাপ' : 'Calculating surface reflectance (NIR / Red / SWIR) for selected coordinates'}
          </p>
        </motion.div>
      )}

      {/* Error Card */}
      {error && !loading && (
        <motion.div 
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-2"
        >
          <div className="flex items-center justify-center gap-2 text-rose-700 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button 
            onClick={() => setError(null)}
            className="text-xs font-bold text-rose-600 hover:text-rose-800 underline"
          >
            {t.dismiss}
          </button>
        </motion.div>
      )}

      {/* Top 3 Actionable Farmer Outcomes (Vigor, Moisture, Field Scouting) */}
      {ndvi !== null && ndmi !== null && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Canopy Vigor */}
            <motion.div 
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  {lang === 'bn' ? '১. ক্যানোপি স্বাস্থ্য ও ঘনত্ব' : '1. Canopy Vigor'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getHealthStatus(ndvi).bgClass}`}>
                  {getHealthStatus(ndvi).label}
                </span>
              </div>
              <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed font-medium">
                {getHealthStatus(ndvi).insight}
              </p>
              <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-baseline justify-between text-stone-500">
                <span className="text-[10px] font-medium">NDVI Index</span>
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100 tabular-nums">{ndvi.toFixed(2)}</span>
              </div>
            </motion.div>

            {/* 2. Canopy Moisture */}
            <motion.div 
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="p-4 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  {lang === 'bn' ? '২. আর্দ্রতা ও সেচ পরামর্শ' : '2. Canopy Moisture'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getMoistureStatus(ndmi).bgClass}`}>
                  {getMoistureStatus(ndmi).label}
                </span>
              </div>
              <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed font-medium">
                {getMoistureStatus(ndmi).insight}
              </p>
              <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-baseline justify-between text-stone-500">
                <span className="text-[10px] font-medium">NDMI Index</span>
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100 tabular-nums">{ndmi.toFixed(2)}</span>
              </div>
            </motion.div>

            {/* 3. Field Scouting Action */}
            <motion.div 
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-4 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/80 dark:border-stone-800 shadow-xs space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  {lang === 'bn' ? '৩. তাত্ক্ষণিক মাঠ অ্যাকশন' : '3. Immediate Field Action'}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {lang === 'bn' ? 'কার্যকর করণীয়' : 'Actionable'}
                </span>
              </div>
              <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed font-medium">
                {ndvi > 0.6 
                  ? (lang === 'bn' ? 'ফসল শীর্ষ ভেজিটেটিভ অবস্থায় আছে। আগামী ৭ দিন নাইট্রোজেন সারের অতিরিক্ত প্রয়োগ বন্ধ রেখে ছত্রাক রোগ প্রতিরোধে নজর দিন।' : 'Crop is in prime vegetative vigor. Avoid surplus nitrogen to prevent fungal susceptibility.')
                  : (lang === 'bn' ? 'মাঠের নিম্ন-ঘনত্ব অংশে ইউরিয়া উপরিপ্রয়োগ বা আগাছা দমন নিশ্চিত করতে সরেজমিনে পরিদর্শন করুন।' : 'Conduct priority field scouting on low-biomass sections to verify root health or weed competition.')}
              </p>
              <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-baseline justify-between text-stone-500">
                <span className="text-[10px] font-medium">Scouting Priority</span>
                <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  {ndvi > 0.6 ? (lang === 'bn' ? 'স্বাভাবিক পর্যবেক্ষণ' : 'Routine') : (lang === 'bn' ? 'জরুরি পরিদর্শন' : 'High Priority')}
                </span>
              </div>
            </motion.div>
          </div>

          {/* Progressive Disclosure Toggle for Deep Spectral Metrology */}
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowSpectralDetails(!showSpectralDetails)}
              className="w-full flex items-center justify-between p-4 rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-stone-900 hover:bg-stone-50/80 transition-all cursor-pointer shadow-xs group text-left"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <div className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 group-hover:bg-emerald-50 group-hover:text-emerald-700 transition-colors shrink-0">
                  <Sliders className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100">
                      {lang === 'bn' ? 'স্পেকট্রাল সূচক ও সেন্সর বিশ্লেষণ' : 'Field Metrology & Spectral Readings'}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                      {lang === 'bn' ? 'এনডিভিআই ও এনডিএমআই ডায়াল' : 'NDVI / NDMI Gauges'}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 font-normal truncate">
                    {lang === 'bn' 
                      ? '১০মি স্পেকট্রাল রিফ্লেক্ট্যান্স ব্যান্ড এবং বৈজ্ঞানিক শ্রেণীবিভাগ স্কেল' 
                      : 'Band wavelengths (NIR 842nm, Red 665nm, SWIR 1610nm) & mathematical gauges'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-1.5 text-stone-500 group-hover:text-stone-800 dark:group-hover:text-stone-200 shrink-0 ml-3">
                <span className="text-xs font-semibold hidden sm:inline">
                  {showSpectralDetails 
                    ? (lang === 'bn' ? 'সংক্ষেপ করুন' : 'Hide Metrology') 
                    : (lang === 'bn' ? 'বিশদ দেখুন' : 'Show Metrology')}
                </span>
                {showSpectralDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </button>

            <AnimatePresence>
              {showSpectralDetails && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden space-y-4 pt-1"
                >
                  {/* Half-doughnut dials */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* NDVI Dial */}
                    <div className="flex flex-col items-center justify-center bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-200/80 dark:border-stone-800 shadow-xs">
                      <div className="w-full h-36 relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="100%"
                              startAngle={180}
                              endAngle={0}
                              innerRadius={55}
                              outerRadius={75}
                              paddingAngle={0}
                              dataKey="value"
                            >
                              <Cell fill={getHealthStatus(ndvi).color} />
                              <Cell fill="#e7e5e4" />
                              <Label
                                value={`${ndvi.toFixed(2)}`}
                                position="centerBottom"
                                className="fill-stone-900 dark:fill-stone-100 text-3xl font-bold tabular-nums"
                                dy={-12}
                              />
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 mb-0.5">
                          {React.createElement(getHealthStatus(ndvi).icon, {
                            className: `w-4 h-4`,
                            style: { color: getHealthStatus(ndvi).color }
                          })}
                          <span className="text-base font-bold text-stone-900 dark:text-stone-100">
                            {getHealthStatus(ndvi).label}
                          </span>
                        </div>
                        <p className="text-stone-400 text-[10px] font-semibold uppercase tracking-wider">{t.ndviValue} (NIR - Red)/(NIR + Red)</p>
                      </div>
                    </div>

                    {/* NDMI Dial */}
                    <div className="flex flex-col items-center justify-center bg-white dark:bg-stone-900 rounded-2xl p-5 border border-stone-200/80 dark:border-stone-800 shadow-xs">
                      <div className="w-full h-36 relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={moistureChartData}
                              cx="50%"
                              cy="100%"
                              startAngle={180}
                              endAngle={0}
                              innerRadius={55}
                              outerRadius={75}
                              paddingAngle={0}
                              dataKey="value"
                            >
                              <Cell fill={getMoistureStatus(ndmi).color} />
                              <Cell fill="#e7e5e4" />
                              <Label
                                value={`${ndmi.toFixed(2)}`}
                                position="centerBottom"
                                className="fill-stone-900 dark:fill-stone-100 text-3xl font-bold tabular-nums"
                                dy={-12}
                              />
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 mb-0.5">
                          <Cloud className="w-4 h-4" style={{ color: getMoistureStatus(ndmi).color }} />
                          <span className="text-base font-bold text-stone-900 dark:text-stone-100">
                            {getMoistureStatus(ndmi).label}
                          </span>
                        </div>
                        <p className="text-stone-400 text-[10px] font-semibold uppercase tracking-wider">Moisture Index (NIR - SWIR)/(NIR + SWIR)</p>
                      </div>
                    </div>
                  </div>

                  {/* Scientific scale info */}
                  <div className="bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row gap-5 shadow-xs">
                    <div className="lg:w-1/2 flex items-start gap-3">
                      <div className="p-2.5 bg-stone-100 dark:bg-stone-800 rounded-xl text-stone-700 shrink-0">
                        <Info className="w-4 h-4 text-emerald-700" />
                      </div>
                      <div>
                        <h4 className="text-stone-900 dark:text-stone-100 font-bold text-sm mb-1">{t.whatIsNdvi}</h4>
                        <p className="text-xs text-stone-500 leading-relaxed font-normal">
                          {t.ndviExplanation}
                        </p>
                      </div>
                    </div>
                    
                    <div className="lg:w-1/2 grid grid-cols-2 gap-2 border-t lg:border-t-0 lg:border-l border-stone-100 dark:border-stone-800 pt-3 lg:pt-0 lg:pl-5">
                      <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-800/60 p-2 rounded-xl">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" /> 
                        <span className="text-[11px] font-bold text-stone-800 dark:text-stone-200">0.6 - 1.0: <span className="text-stone-500 font-normal">{t.veryHealthy}</span></span>
                      </div>
                      <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-800/60 p-2 rounded-xl">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" /> 
                        <span className="text-[11px] font-bold text-stone-800 dark:text-stone-200">0.3 - 0.6: <span className="text-stone-500 font-normal">{t.healthLevels.stressed.split(' ')[0]}</span></span>
                      </div>
                      <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-800/60 p-2 rounded-xl">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" /> 
                        <span className="text-[11px] font-bold text-stone-800 dark:text-stone-200">0.1 - 0.3: <span className="text-stone-500 font-normal">{t.healthLevels.sparse.split(' ')[0]}</span></span>
                      </div>
                      <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-800/60 p-2 rounded-xl">
                        <div className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0" /> 
                        <span className="text-[11px] font-bold text-stone-800 dark:text-stone-200">&lt; 0.1: <span className="text-stone-500 font-normal">{t.nonVegetated}</span></span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Empty State before fetching */}
      {ndvi === null && !loading && (
        <div className="bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 rounded-2xl p-8 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 bg-stone-100 dark:bg-stone-800 rounded-2xl flex items-center justify-center mx-auto text-stone-500">
            <Satellite className="w-6 h-6 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-800 dark:text-stone-200">
              {lang === 'bn' ? 'স্যাটেলাইট মনিটরিং শুরু করতে ডেটা আনুন' : 'Ready to ingest Sentinel-2 Multispectral Feed'}
            </h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
              {lang === 'bn' 
                ? 'উপরের "স্যাটেলাইট ডেটা আনুন" বাটনে চাপ দিয়ে সরাসরি আপনার জমির ফসলের সতেজতা ও আর্দ্রতা বিশ্লেষণ দেখুন।'
                : 'Tap "Fetch Satellite Data" above to receive instantaneous canopy vigor and soil moisture indices.'}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default SatelliteHealth;
