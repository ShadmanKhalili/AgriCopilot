import React, { useState } from 'react';
import { translations, Language } from '../utils/translations';
import { Satellite, MapPin, RefreshCw, AlertTriangle, CheckCircle2, Info, Leaf, Cloud, Activity, Navigation } from 'lucide-react';
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
      console.error("Location error:", err);
      let msg = t.tooltips?.locationError || "Failed to detect location.";
      if (err.code === 1) msg = "Permission denied. Please click the lock icon in your browser's address bar to allow location access, or use manual entry.";
      if (err.code === 3) msg = "Location request timed out. Please try again or use manual entry.";
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

  const getHealthStatus = (val: number) => {
    if (val > 0.6) return { label: t.healthLevels.healthy, color: '#22c55e', icon: CheckCircle2, insight: t.insightHealthy };
    if (val > 0.3) return { label: t.healthLevels.stressed, color: '#eab308', icon: AlertTriangle, insight: t.insightStressed };
    if (val > 0.1) return { label: t.healthLevels.sparse, color: '#f97316', icon: Info, insight: t.insightSparse };
    return { label: t.healthLevels.water, color: '#3b82f6', icon: Satellite, insight: t.insightWater };
  };

  const getMoistureStatus = (val: number) => {
    if (val > 0.4) return { label: t.moistureLevels.high, color: '#3b82f6', insight: t.insightMoistureHigh };
    if (val > 0.0) return { label: t.moistureLevels.good, color: '#22c55e', insight: t.insightMoistureGood };
    if (val > -0.2) return { label: t.moistureLevels.low, color: '#eab308', insight: t.insightMoistureLow };
    return { label: t.moistureLevels.drought, color: '#ef4444', insight: t.insightMoistureDrought };
  };

  const chartData = ndvi !== null ? [
    { value: (ndvi + 1) / 2 }, // Normalize -1..1 to 0..1
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
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-4 md:space-y-6"
    >
      <motion.div variants={itemVariants} className="bg-white rounded-[24px] md:rounded-[32px] p-4 md:p-6 shadow-xl shadow-indigo-900/5 border border-indigo-100 mb-4 md:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3 md:space-x-4">
            <div className="bg-indigo-50 p-2 md:p-3 rounded-xl flex-shrink-0">
              <Satellite className="w-6 h-6 md:w-7 h-7 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg md:text-2xl font-black text-gray-900 tracking-tight leading-tight">{t.cropHealth}</h2>
              <p className="text-gray-500 text-[10px] md:text-sm font-medium leading-relaxed">{t.cropHealthDesc}</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50/80 border border-indigo-200/60 rounded-xl text-indigo-700 text-xs font-semibold self-start sm:self-auto">
            <Activity className="w-3.5 h-3.5 text-indigo-600" />
            <span>{lang === 'bn' ? 'সেন্টিনেল-২ (১০মি) ও কৃষি-মডেল' : 'Sentinel-2 (10m) + Agro-Model'}</span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Location Card */}
        <motion.div 
          variants={itemVariants}
          className="bg-white border border-indigo-100 shadow-xl shadow-indigo-50/50 rounded-2xl md:rounded-3xl p-4 sm:p-5 md:p-6 lg:col-span-1 h-fit relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 group-hover:opacity-80 transition-opacity"></div>
          
          <div className="flex items-center justify-between mb-4 sm:mb-6 relative z-10">
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2.5">
              <MapPin className="w-6 h-6 text-indigo-500" />
              {t.location}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setIsManualLocation(!isManualLocation)}
                className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl transition-colors border ${
                  isManualLocation 
                    ? 'bg-amber-50 border-amber-200 text-amber-700' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
                title={isManualLocation ? "Use GPS" : "Set Manually"}
              >
                <Navigation className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={detectLocation}
                disabled={loading}
                className="p-2 sm:p-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl sm:rounded-2xl transition-colors disabled:opacity-50 shadow-sm"
              >
                <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {isManualLocation && (
            <div className="mb-4 sm:mb-6 relative z-10 flex flex-col gap-2.5">
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
                className="w-full bg-white border-2 border-indigo-100 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 text-sm sm:text-base font-bold text-gray-900 focus:ring-4 focus:ring-indigo-500/20 outline-none shadow-sm"
              >
                {geoData.map(d => (
                  <option key={d.id} value={d.id}>{lang === 'bn' ? d.bn_name : d.name}</option>
                ))}
              </select>
              <select
                value={selectedUpazila}
                onChange={(e) => handleManualLocationChange(e.target.value)}
                className="w-full bg-white border-2 border-indigo-100 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2.5 text-sm sm:text-base font-bold text-gray-900 focus:ring-4 focus:ring-indigo-500/20 outline-none shadow-sm"
                disabled={!activeDistrict || activeDistrict.upazilas.length === 0}
              >
                {activeDistrict?.upazilas.map(u => (
                  <option key={u.id} value={u.id}>{lang === 'bn' ? u.bn_name : u.name}</option>
                ))}
              </select>
            </div>
          )}

          {globalLocation ? (
            <div className="space-y-4 sm:space-y-5 relative z-10">
              <LocationDisplay coords={{ latitude: globalLocation.latitude, longitude: globalLocation.longitude }} lang={lang} color="indigo" />
              <button
                onClick={fetchNdvi}
                disabled={loading}
                className="relative w-full py-3.5 sm:py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl sm:rounded-2xl font-black text-sm sm:text-base transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2.5 overflow-hidden group cursor-pointer"
              >
                {loading ? (
                  <>
                    <Activity className="w-5 h-5 animate-pulse" />
                    <span className="animate-pulse">{t.tooltips.detecting}</span>
                    <div className="absolute inset-0 bg-white/20 w-full h-full animate-[scan_2s_ease-in-out_infinite]" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 10%, 0 10%)' }} />
                  </>
                ) : (
                  <>
                    <Satellite className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    {t.fetchSatelliteData}
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-center py-8 sm:py-10 relative z-10">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                <MapPin className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-400" />
              </div>
              <p className="text-gray-500 font-bold text-sm sm:text-base mb-6 max-w-[200px] mx-auto">{t.detectPrompt}</p>
              <button
                onClick={detectLocation}
                className="px-6 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-all font-black uppercase tracking-wider text-xs border border-indigo-100 shadow-sm cursor-pointer"
              >
                {t.tooltips.detectLocation}
              </button>
            </div>
          )}
        </motion.div>

        {/* Health Status Card */}
        <motion.div 
          variants={itemVariants}
          className="bg-white border border-indigo-100 shadow-xl shadow-indigo-50/50 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 relative overflow-hidden lg:col-span-2 min-h-[300px]"
        >
          <h3 className="text-xl sm:text-2xl font-black text-gray-900 mb-4 sm:mb-6 flex items-center gap-2.5">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
            {t.satelliteInsights}
          </h3>

          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm z-10 rounded-2xl md:rounded-3xl">
              <div className="relative w-24 h-24 mb-4">
                <div className="absolute inset-0 border-4 border-indigo-100 rounded-full animate-ping" />
                <div className="absolute inset-2 border-4 border-indigo-500 rounded-full animate-spin" style={{ animationDuration: '3s', borderTopColor: 'transparent' }} />
                <Satellite className="absolute inset-0 m-auto w-10 h-10 text-indigo-600 animate-pulse" />
              </div>
              <p className="text-indigo-600 font-black animate-pulse tracking-widest uppercase text-xs sm:text-sm">{t.tooltips.detecting}</p>
            </div>
          ) : ndvi !== null && ndmi !== null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {/* NDVI Section */}
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center justify-center bg-gray-50/80 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-gray-100 shadow-inner"
              >
                <div className="w-full h-40 sm:h-44 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="100%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={0}
                        dataKey="value"
                        animationDuration={1500}
                        animationBegin={200}
                      >
                        <Cell fill={getHealthStatus(ndvi).color} />
                        <Cell fill="#e5e7eb" />
                        <Label
                          value={`${ndvi.toFixed(2)}`}
                          position="centerBottom"
                          className="fill-gray-900 text-3xl sm:text-4xl font-black"
                          dy={-15}
                        />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="mt-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {React.createElement(getHealthStatus(ndvi).icon, {
                      className: `w-5 h-5`,
                      style: { color: getHealthStatus(ndvi).color }
                    })}
                    <span className="text-lg sm:text-xl font-black text-gray-900">
                      {getHealthStatus(ndvi).label}
                    </span>
                  </div>
                  <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">{t.ndviValue}</p>
                </div>
              </motion.div>

              {/* NDMI Section */}
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex flex-col items-center justify-center bg-gray-50/80 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-gray-100 shadow-inner"
              >
                <div className="w-full h-40 sm:h-44 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={moistureChartData}
                        cx="50%"
                        cy="100%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={0}
                        dataKey="value"
                        animationDuration={1500}
                        animationBegin={400}
                      >
                        <Cell fill={getMoistureStatus(ndmi).color} />
                        <Cell fill="#e5e7eb" />
                        <Label
                          value={`${ndmi.toFixed(2)}`}
                          position="centerBottom"
                          className="fill-gray-900 text-3xl sm:text-4xl font-black"
                          dy={-15}
                        />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="mt-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Cloud className="w-5 h-5" style={{ color: getMoistureStatus(ndmi).color }} />
                    <span className="text-lg sm:text-xl font-black text-gray-900">
                      {getMoistureStatus(ndmi).label}
                    </span>
                  </div>
                  <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Moisture Index (NDMI)</p>
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 sm:py-16">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                <Satellite className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-300" />
              </div>
              <p className="text-gray-400 text-base sm:text-lg font-bold">{t.noDataYet}</p>
            </div>
          )}

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-0 bg-white/95 backdrop-blur-md flex items-center justify-center p-6 text-center z-20 rounded-2xl md:rounded-3xl"
            >
              <div className="space-y-4 max-w-md">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-gray-900 font-black text-lg sm:text-xl">{error}</p>
                <button 
                  onClick={() => setError(null)}
                  className="px-6 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors font-bold text-sm"
                >
                  {t.dismiss}
                </button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Actionable Insights Section */}
      <AnimatePresence>
        {ndvi !== null && ndmi !== null && !loading && (
          <motion.div
            variants={itemVariants}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
            className="bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 relative overflow-hidden shadow-xl shadow-indigo-200"
          >
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            
            <h3 className="text-lg sm:text-xl md:text-2xl font-black text-white mb-4 sm:mb-6 flex items-center gap-3 relative z-10 tracking-tight">
              <div className="p-2 sm:p-2.5 bg-white/20 rounded-xl sm:rounded-2xl backdrop-blur-md">
                <Leaf className="w-5 h-5 sm:w-6 sm:h-6 text-green-300" />
              </div>
              {t.actionableInsights}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 relative z-10">
              <div className="bg-white/10 backdrop-blur-xl rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-white/20 hover:bg-white/20 transition-colors shadow-inner">
                <h4 className="text-indigo-100 font-black uppercase tracking-widest text-[10px] flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-300" /> 
                  {t.cropHealthTitle || "Crop Health (NDVI)"}
                </h4>
                <p className="text-white leading-relaxed text-sm sm:text-base font-medium">
                  {getHealthStatus(ndvi).insight}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-xl rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-white/20 hover:bg-white/20 transition-colors shadow-inner">
                <h4 className="text-indigo-100 font-black uppercase tracking-widest text-[10px] flex items-center gap-2 mb-2">
                  <Cloud className="w-4 h-4 text-blue-300" /> 
                  {t.moistureTitle || "Soil & Canopy Moisture (NDMI)"}
                </h4>
                <p className="text-white leading-relaxed text-sm sm:text-base font-medium">
                  {getMoistureStatus(ndmi).insight}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Section */}
      <motion.div
        variants={itemVariants}
        className="bg-white border border-gray-100 shadow-xl shadow-gray-100/50 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 flex flex-col lg:flex-row gap-6 lg:gap-8"
      >
        <div className="flex items-start gap-4 lg:w-1/2">
          <div className="p-3 sm:p-4 bg-indigo-50 rounded-2xl shrink-0 shadow-inner">
            <Info className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <h4 className="text-gray-900 font-black text-lg sm:text-xl mb-1.5 tracking-tight">{t.whatIsNdvi}</h4>
            <p className="text-xs sm:text-sm text-gray-500 leading-relaxed font-medium">
              {t.ndviExplanation}
            </p>
          </div>
        </div>
        
        <div className="lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 border-t lg:border-t-0 lg:border-l border-gray-100 pt-4 lg:pt-0 lg:pl-8">
          <div className="flex items-center gap-2.5 bg-gray-50 p-2.5 sm:p-3 rounded-xl">
            <div className="w-3.5 h-3.5 rounded-full bg-green-500 shrink-0" /> 
            <span className="text-xs sm:text-sm font-bold text-gray-900">0.6 - 1.0: <span className="text-gray-500 font-normal">{t.veryHealthy}</span></span>
          </div>
          <div className="flex items-center gap-2.5 bg-gray-50 p-2.5 sm:p-3 rounded-xl">
            <div className="w-3.5 h-3.5 rounded-full bg-yellow-500 shrink-0" /> 
            <span className="text-xs sm:text-sm font-bold text-gray-900">0.3 - 0.6: <span className="text-gray-500 font-normal">{t.healthLevels.stressed.split(' ')[0]}</span></span>
          </div>
          <div className="flex items-center gap-2.5 bg-gray-50 p-2.5 sm:p-3 rounded-xl">
            <div className="w-3.5 h-3.5 rounded-full bg-orange-500 shrink-0" /> 
            <span className="text-xs sm:text-sm font-bold text-gray-900">0.1 - 0.3: <span className="text-gray-500 font-normal">{t.healthLevels.sparse.split(' ')[0]}</span></span>
          </div>
          <div className="flex items-center gap-2.5 bg-gray-50 p-2.5 sm:p-3 rounded-xl">
            <div className="w-3.5 h-3.5 rounded-full bg-blue-500 shrink-0" /> 
            <span className="text-xs sm:text-sm font-bold text-gray-900">&lt; 0.1: <span className="text-gray-500 font-normal">{t.nonVegetated}</span></span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SatelliteHealth;
