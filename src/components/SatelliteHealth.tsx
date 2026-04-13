import React, { useState } from 'react';
import { translations, Language } from '../utils/translations';
import { Satellite, MapPin, RefreshCw, AlertTriangle, CheckCircle2, Info, Leaf, Cloud, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';
import LocationDisplay from './LocationDisplay';

interface Props {
  lang: Language;
  globalLocation: { latitude: number; longitude: number } | null;
  setGlobalLocation: (loc: { latitude: number; longitude: number }) => void;
}

const SatelliteHealth: React.FC<Props> = ({ lang, globalLocation, setGlobalLocation }) => {
  const t = translations[lang];
  const [loading, setLoading] = useState(false);
  const [ndvi, setNdvi] = useState<number | null>(null);
  const [ndmi, setNdmi] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detectLocation = () => {
    setLoading(true);
    setError(null);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGlobalLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setLoading(false);
        },
        (err) => {
          setError(t.tooltips.locationError);
          setLoading(false);
        }
      );
    } else {
      setError("Geolocation not supported");
      setLoading(false);
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
      className="space-y-8"
    >
      <motion.div variants={itemVariants} className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-4xl font-black text-gray-900 flex items-center gap-4 tracking-tight">
            <div className="p-4 bg-indigo-100 rounded-3xl shadow-inner">
              <Satellite className="w-10 h-10 text-indigo-600" />
            </div>
            {t.cropHealth}
          </h2>
          <p className="text-gray-500 text-xl font-medium mt-3">{t.cropHealthDesc}</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Location Card */}
        <motion.div 
          variants={itemVariants}
          className="bg-white border border-indigo-100 shadow-xl shadow-indigo-50/50 rounded-[40px] p-8 lg:col-span-1 h-fit relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 group-hover:opacity-80 transition-opacity"></div>
          
          <div className="flex items-center justify-between mb-8 relative z-10">
            <h3 className="text-2xl font-black text-gray-900 flex items-center gap-3">
              <MapPin className="w-7 h-7 text-indigo-500" />
              {t.location}
            </h3>
            <button
              onClick={detectLocation}
              disabled={loading}
              className="p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-2xl transition-colors disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {globalLocation ? (
            <div className="space-y-6 relative z-10">
              <LocationDisplay coords={{ latitude: globalLocation.latitude, longitude: globalLocation.longitude }} lang={lang} color="indigo" />
              <button
                onClick={fetchNdvi}
                disabled={loading}
                className="relative w-full py-5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-3xl font-black text-lg transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-3 overflow-hidden group"
              >
                {loading ? (
                  <>
                    <Activity className="w-6 h-6 animate-pulse" />
                    <span className="animate-pulse">{t.tooltips.detecting}</span>
                    <div className="absolute inset-0 bg-white/20 w-full h-full animate-[scan_2s_ease-in-out_infinite]" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 10%, 0 10%)' }} />
                  </>
                ) : (
                  <>
                    <Satellite className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    {t.fetchSatelliteData}
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-center py-12 relative z-10">
              <div className="w-24 h-24 bg-indigo-50 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-inner">
                <MapPin className="w-12 h-12 text-indigo-400" />
              </div>
              <p className="text-gray-500 font-bold text-lg mb-8 max-w-[200px] mx-auto">{t.detectPrompt}</p>
              <button
                onClick={detectLocation}
                className="px-8 py-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl transition-all font-black uppercase tracking-wider text-sm border border-indigo-100 shadow-sm"
              >
                {t.tooltips.detectLocation}
              </button>
            </div>
          )}
        </motion.div>

        {/* Health Status Card */}
        <motion.div 
          variants={itemVariants}
          className="bg-white border border-indigo-100 shadow-xl shadow-indigo-50/50 rounded-[40px] p-8 relative overflow-hidden lg:col-span-2 min-h-[300px]"
        >
          <h3 className="text-2xl font-black text-gray-900 mb-8 flex items-center gap-3">
            <CheckCircle2 className="w-7 h-7 text-green-500" />
            {t.satelliteInsights}
          </h3>

          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm z-10 rounded-[40px]">
              <div className="relative w-32 h-32 mb-6">
                <div className="absolute inset-0 border-4 border-indigo-100 rounded-full animate-ping" />
                <div className="absolute inset-2 border-4 border-indigo-500 rounded-full animate-spin" style={{ animationDuration: '3s', borderTopColor: 'transparent' }} />
                <Satellite className="absolute inset-0 m-auto w-12 h-12 text-indigo-600 animate-pulse" />
              </div>
              <p className="text-indigo-600 font-black animate-pulse tracking-widest uppercase text-sm">{t.tooltips.detecting}</p>
            </div>
          ) : ndvi !== null && ndmi !== null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {/* NDVI Section */}
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center justify-center bg-gray-50 rounded-[32px] p-8 border border-gray-100 shadow-inner"
              >
                <div className="w-full h-48 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="100%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={70}
                        outerRadius={90}
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
                          className="fill-gray-900 text-5xl font-black"
                          dy={-20}
                        />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="mt-8 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {React.createElement(getHealthStatus(ndvi).icon, {
                      className: `w-7 h-7`,
                      style: { color: getHealthStatus(ndvi).color }
                    })}
                    <span className="text-2xl font-black text-gray-900">
                      {getHealthStatus(ndvi).label}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs font-black uppercase tracking-widest mt-2">{t.ndviValue}</p>
                </div>
              </motion.div>

              {/* NDMI Section */}
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex flex-col items-center justify-center bg-gray-50 rounded-[32px] p-8 border border-gray-100 shadow-inner"
              >
                <div className="w-full h-48 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={moistureChartData}
                        cx="50%"
                        cy="100%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={70}
                        outerRadius={90}
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
                          className="fill-gray-900 text-5xl font-black"
                          dy={-20}
                        />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="mt-8 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Cloud className="w-7 h-7" style={{ color: getMoistureStatus(ndmi).color }} />
                    <span className="text-2xl font-black text-gray-900">
                      {getMoistureStatus(ndmi).label}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs font-black uppercase tracking-widest mt-2">Moisture Index (NDMI)</p>
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                <Satellite className="w-12 h-12 text-indigo-200" />
              </div>
              <p className="text-gray-400 text-xl font-bold">{t.noDataYet}</p>
            </div>
          )}

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-0 bg-white/95 backdrop-blur-md flex items-center justify-center p-8 text-center z-20 rounded-[40px]"
            >
              <div className="space-y-6 max-w-md">
                <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-12 h-12 text-red-500" />
                </div>
                <p className="text-gray-900 font-black text-2xl">{error}</p>
                <button 
                  onClick={() => setError(null)}
                  className="px-10 py-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl transition-colors font-bold text-lg"
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
            className="bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700 rounded-[40px] p-8 lg:p-12 relative overflow-hidden shadow-2xl shadow-indigo-200"
          >
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            
            <h3 className="text-3xl font-black text-white mb-10 flex items-center gap-4 relative z-10 tracking-tight">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                <Leaf className="w-8 h-8 text-green-300" />
              </div>
              {t.actionableInsights}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div className="bg-white/10 backdrop-blur-xl rounded-[32px] p-8 border border-white/20 hover:bg-white/20 transition-colors shadow-inner">
                <h4 className="text-indigo-100 font-black uppercase tracking-widest text-sm flex items-center gap-3 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-green-300" /> 
                  {t.cropHealthTitle || "Crop Health (NDVI)"}
                </h4>
                <p className="text-white leading-relaxed text-xl font-medium">
                  {getHealthStatus(ndvi).insight}
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-xl rounded-[32px] p-8 border border-white/20 hover:bg-white/20 transition-colors shadow-inner">
                <h4 className="text-indigo-100 font-black uppercase tracking-widest text-sm flex items-center gap-3 mb-4">
                  <Cloud className="w-5 h-5 text-blue-300" /> 
                  {t.moistureTitle || "Soil & Canopy Moisture (NDMI)"}
                </h4>
                <p className="text-white leading-relaxed text-xl font-medium">
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
        className="bg-white border border-gray-100 shadow-xl shadow-gray-100/50 rounded-[40px] p-8 lg:p-10 flex flex-col lg:flex-row gap-10"
      >
        <div className="flex items-start gap-6 lg:w-1/2">
          <div className="p-5 bg-indigo-50 rounded-3xl shrink-0 shadow-inner">
            <Info className="w-8 h-8 text-indigo-500" />
          </div>
          <div>
            <h4 className="text-gray-900 font-black text-2xl mb-3 tracking-tight">{t.whatIsNdvi}</h4>
            <p className="text-lg text-gray-500 leading-relaxed font-medium">
              {t.ndviExplanation}
            </p>
          </div>
        </div>
        
        <div className="lg:w-1/2 grid grid-cols-1 sm:grid-cols-2 gap-6 border-t lg:border-t-0 lg:border-l border-gray-100 pt-8 lg:pt-0 lg:pl-10">
          <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl">
            <div className="w-5 h-5 rounded-full bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)] shrink-0" /> 
            <span className="text-lg font-bold text-gray-900">0.6 - 1.0: <span className="text-gray-500">{t.veryHealthy}</span></span>
          </div>
          <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl">
            <div className="w-5 h-5 rounded-full bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)] shrink-0" /> 
            <span className="text-lg font-bold text-gray-900">0.3 - 0.6: <span className="text-gray-500">{t.healthLevels.stressed.split(' ')[0]}</span></span>
          </div>
          <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl">
            <div className="w-5 h-5 rounded-full bg-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)] shrink-0" /> 
            <span className="text-lg font-bold text-gray-900">0.1 - 0.3: <span className="text-gray-500">{t.healthLevels.sparse.split(' ')[0]}</span></span>
          </div>
          <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl">
            <div className="w-5 h-5 rounded-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)] shrink-0" /> 
            <span className="text-lg font-bold text-gray-900">&lt; 0.1: <span className="text-gray-500">{t.nonVegetated}</span></span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SatelliteHealth;
