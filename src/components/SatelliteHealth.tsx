import React, { useState, useEffect } from 'react';
import { translations, Language } from '../utils/translations';
import { Satellite, MapPin, RefreshCw, AlertTriangle, CheckCircle2, Info, Leaf, Cloud } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';
import Tooltip from './Tooltip';

interface Props {
  lang: Language;
}

const SatelliteHealth: React.FC<Props> = ({ lang }) => {
  const t = translations[lang];
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [ndvi, setNdvi] = useState<number | null>(null);
  const [ndmi, setNdmi] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detectLocation = () => {
    setLoading(true);
    setError(null);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
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
    if (!location) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/sentinel/ndvi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(location)
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Satellite className="w-8 h-8 text-indigo-400" />
            {t.cropHealth}
          </h2>
          <p className="text-indigo-200/70">{t.cropHealthDesc}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Location Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-400" />
              {t.location}
            </h3>
            <button
              onClick={detectLocation}
              disabled={loading}
              className="p-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-xl transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {location ? (
            <div className="space-y-2">
              <div className="flex justify-between text-indigo-200/70 text-sm">
                <span>Latitude</span>
                <span className="text-white font-mono">{location.lat.toFixed(6)}</span>
              </div>
              <div className="flex justify-between text-indigo-200/70 text-sm">
                <span>Longitude</span>
                <span className="text-white font-mono">{location.lng.toFixed(6)}</span>
              </div>
              <button
                onClick={fetchNdvi}
                disabled={loading}
                className="w-full mt-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-semibold transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Satellite className="w-5 h-5" />}
                {t.fetchSatelliteData}
              </button>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-indigo-200/50 mb-4">Detect your location to start monitoring</p>
              <button
                onClick={detectLocation}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all border border-white/10"
              >
                {t.tooltips.detectLocation}
              </button>
            </div>
          )}
        </motion.div>

        {/* Health Status Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 relative overflow-hidden"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            {t.satelliteInsights}
          </h3>

          {ndvi !== null && ndmi !== null ? (
            <div className="space-y-6">
              {/* NDVI Section */}
              <div className="flex flex-col items-center justify-center">
                <div className="w-full h-32 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="100%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={0}
                        dataKey="value"
                      >
                        <Cell fill={getHealthStatus(ndvi).color} />
                        <Cell fill="rgba(255,255,255,0.1)" />
                        <Label
                          value={`${ndvi.toFixed(2)}`}
                          position="centerBottom"
                          className="fill-white text-2xl font-bold"
                          dy={-10}
                        />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="mt-2 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {React.createElement(getHealthStatus(ndvi).icon, {
                      className: `w-5 h-5`,
                      style: { color: getHealthStatus(ndvi).color }
                    })}
                    <span className="text-lg font-bold text-white">
                      {getHealthStatus(ndvi).label}
                    </span>
                  </div>
                  <p className="text-indigo-200/70 text-xs">{t.ndviValue}</p>
                </div>
              </div>

              {/* NDMI Section */}
              <div className="flex flex-col items-center justify-center border-t border-white/10 pt-4">
                <div className="w-full h-32 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={moistureChartData}
                        cx="50%"
                        cy="100%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={40}
                        outerRadius={60}
                        paddingAngle={0}
                        dataKey="value"
                      >
                        <Cell fill={getMoistureStatus(ndmi).color} />
                        <Cell fill="rgba(255,255,255,0.1)" />
                        <Label
                          value={`${ndmi.toFixed(2)}`}
                          position="centerBottom"
                          className="fill-white text-2xl font-bold"
                          dy={-10}
                        />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="mt-2 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Cloud className="w-5 h-5" style={{ color: getMoistureStatus(ndmi).color }} />
                    <span className="text-lg font-bold text-white">
                      {getMoistureStatus(ndmi).label}
                    </span>
                  </div>
                  <p className="text-indigo-200/70 text-xs">Moisture Index (NDMI)</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <Satellite className="w-12 h-12 text-white/10 mb-4" />
              <p className="text-indigo-200/50">No data available yet</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 bg-red-500/10 backdrop-blur-md flex items-center justify-center p-6 text-center">
              <div className="space-y-2">
                <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
                <p className="text-white font-medium">{error}</p>
                <button 
                  onClick={() => setError(null)}
                  className="text-sm text-red-300 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Actionable Insights Section */}
      <AnimatePresence>
        {ndvi !== null && ndmi !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-indigo-500/20 border border-indigo-500/30 rounded-2xl p-6"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Leaf className="w-6 h-6 text-green-400" />
              {t.actionableInsights || "Actionable Insights"}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h4 className="text-indigo-200 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Crop Health
                </h4>
                <p className="text-white/90 leading-relaxed">
                  {getHealthStatus(ndvi).insight}
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="text-indigo-200 font-semibold flex items-center gap-2">
                  <Cloud className="w-4 h-4" /> Soil & Canopy Moisture
                </h4>
                <p className="text-white/90 leading-relaxed">
                  {getMoistureStatus(ndmi).insight}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex gap-4"
      >
        <Info className="w-6 h-6 text-indigo-400 shrink-0" />
        <div className="text-sm text-indigo-200/80 space-y-2">
          <p><strong>What is NDVI?</strong> Normalized Difference Vegetation Index (NDVI) is a measure of plant health based on how they reflect light. Healthy plants reflect more near-infrared light and less red light.</p>
          <ul className="grid grid-cols-2 gap-2">
            <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500" /> 0.6 - 1.0: Very Healthy</li>
            <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500" /> 0.3 - 0.6: Stressed</li>
            <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500" /> 0.1 - 0.3: Sparse</li>
            <li className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500" /> &lt; 0.1: Non-vegetated</li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
};

export default SatelliteHealth;
