import React, { useState } from 'react';
import { MapPin, Navigation, Search, Check, X, Loader2, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { geoData, District, Upazila } from '../utils/geoData';
import { detectUserLocation } from '../utils/geolocation';
import { Language } from '../utils/translations';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  globalLocation: { latitude: number; longitude: number } | null;
  setGlobalLocation: (loc: { latitude: number; longitude: number }) => void;
  currentLocationName?: string | null;
}

export default function RegionModal({
  isOpen,
  onClose,
  lang,
  globalLocation,
  setGlobalLocation,
  currentLocationName
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>(geoData[0]?.id || '1');
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedDistrict = geoData.find(d => d.id === selectedDistrictId) || geoData[0];

  const filteredDistricts = geoData.filter(d => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return d.name.toLowerCase().includes(q) || d.bn_name.includes(q) || d.upazilas.some(u => u.name.toLowerCase().includes(q) || u.bn_name.includes(q));
  });

  const handleDetectGPS = async () => {
    setIsDetecting(true);
    setDetectError(null);
    try {
      const loc = await detectUserLocation();
      setGlobalLocation(loc);
      setIsDetecting(false);
      onClose();
    } catch (err: any) {
      console.error('GPS detect error in modal', err);
      setDetectError(lang === 'bn' ? 'জিপিএস অবস্থান পাওয়া যায়নি। তালিকা থেকে উপজেলা নির্বাচন করুন।' : 'Could not detect GPS. Please select your Upazila from the list.');
      setIsDetecting(false);
    }
  };

  const handleSelectUpazila = (district: District, upazila: Upazila) => {
    setGlobalLocation({
      latitude: upazila.lat || district.lat,
      longitude: upazila.lng || district.lng
    });
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-gray-100 overflow-hidden z-10 flex flex-col max-h-[88vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-emerald-800 to-green-900 text-white flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-white/10 rounded-2xl backdrop-blur-sm">
                <MapPin className="w-5 h-5 text-emerald-300" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight">
                  {lang === 'bn' ? 'আপনার এলাকা নির্বাচন করুন' : 'Select Your Region / Upazila'}
                </h3>
                <p className="text-xs text-emerald-200/80 font-medium">
                  {currentLocationName ? `বর্তমান: ${currentLocationName}` : (lang === 'bn' ? 'সঠিক আবহাওয়া ও কৃষি পরামর্শের জন্য' : 'For accurate weather & farm advisories')}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick GPS Action */}
          <div className="p-4 bg-emerald-50/70 border-b border-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5 text-xs text-emerald-900">
              <Compass className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="font-bold">
                {lang === 'bn' ? 'সরাসরি মোবাইলের জিপিএস দিয়ে অবস্থান নিন' : 'Detect live field location via GPS'}
              </span>
            </div>
            <button
              onClick={handleDetectGPS}
              disabled={isDetecting}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white text-xs font-black px-4 py-2 rounded-xl transition-all shadow-md shadow-emerald-900/10 disabled:opacity-50"
            >
              {isDetecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === 'bn' ? 'খোঁজা হচ্ছে...' : 'Locating...'}</span>
                </>
              ) : (
                <>
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'জিপিএস সংযোগ' : 'Use GPS Auto'}</span>
                </>
              )}
            </button>
          </div>

          {detectError && (
            <div className="px-4 py-2 bg-amber-50 text-amber-800 text-xs font-medium border-b border-amber-200">
              {detectError}
            </div>
          )}

          {/* Search bar */}
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={lang === 'bn' ? 'জেলা বা উপজেলার নাম লিখুন (যেমন: বগুড়া, নওগাঁ, রংপুর)...' : 'Search District or Upazila (e.g. Bogura, Rangpur)...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* District & Upazila Split Grid */}
          <div className="flex-1 overflow-hidden grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
            {/* Districts Column */}
            <div className="overflow-y-auto p-3 max-h-56 sm:max-h-80 custom-scrollbar">
              <div className="text-[11px] font-black uppercase tracking-wider text-gray-400 px-2 py-1 mb-1">
                {lang === 'bn' ? 'জেলাসমূহ' : 'Districts'} ({filteredDistricts.length})
              </div>
              <div className="space-y-1">
                {filteredDistricts.map((district) => {
                  const isSelected = selectedDistrictId === district.id;
                  return (
                    <button
                      key={district.id}
                      onClick={() => setSelectedDistrictId(district.id)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-sm font-black'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span>{lang === 'bn' ? district.bn_name : district.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-emerald-700 text-emerald-100' : 'bg-gray-100 text-gray-500'}`}>
                        {district.upazilas.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Upazilas Column */}
            <div className="overflow-y-auto p-3 max-h-56 sm:max-h-80 custom-scrollbar bg-gray-50/40">
              <div className="text-[11px] font-black uppercase tracking-wider text-gray-400 px-2 py-1 mb-1">
                {lang === 'bn' ? `${selectedDistrict.bn_name} জেলার উপজেলাসমূহ` : `Upazilas of ${selectedDistrict.name}`}
              </div>
              <div className="space-y-1.5">
                {selectedDistrict.upazilas.map((upazila) => (
                  <button
                    key={upazila.id}
                    onClick={() => handleSelectUpazila(selectedDistrict, upazila)}
                    className="w-full text-left p-2.5 bg-white border border-gray-200/80 hover:border-emerald-500 hover:bg-emerald-50/50 rounded-xl text-xs font-bold text-gray-800 transition-all flex items-center justify-between group shadow-sm"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 opacity-60 group-hover:opacity-100" />
                      <span>{lang === 'bn' ? upazila.bn_name : upazila.name}</span>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                      <span>{lang === 'bn' ? 'সেট করুন' : 'Select'}</span>
                      <Check className="w-3 h-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              {lang === 'bn' ? 'নির্বাচিত এলাকা সব টুলে কার্যকর হবে' : 'Selected area applies across all tools'}
            </span>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-lg transition-colors"
            >
              {lang === 'bn' ? 'বন্ধ করুন' : 'Cancel'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
