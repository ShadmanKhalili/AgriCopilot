import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Landmark, Loader2, Search, MapPin, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import { translations, Language } from '../utils/translations';
import { govSchemesDB, GovScheme } from '../data/govSchemesDB';

interface Props {
  lang: Language;
  globalLocation: { latitude: number; longitude: number } | null;
}

const DISTRICTS = [
  'all', 'dhaka', 'rajshahi', 'khulna', 'barisal', 'sylhet', 'chittagong', 'comilla', 'bogra', 'narsingdi'
];

export default function GovSchemes({ lang, globalLocation }: Props) {
  const [crop, setCrop] = useState('paddy');
  const [district, setDistrict] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [filteredSchemes, setFilteredSchemes] = useState<GovScheme[] | null>(null);
  const t = translations[lang];

  const CROPS = ['all', 'tomato', 'brinjal', 'paddy', 'chili', 'watermelon', 'potato', 'onion', 'cucumber', 'betelLeaf'];

  const handleSearch = () => {
    setIsLoading(true);
    
    // Simulate a slight network delay for UX
    setTimeout(() => {
      const results = govSchemesDB.filter(scheme => {
        const cropMatch = scheme.crops.includes('all') || scheme.crops.includes(crop) || crop === 'all';
        const districtMatch = scheme.districts.includes('all') || scheme.districts.includes(district) || district === 'all';
        return cropMatch && districtMatch;
      });
      
      setFilteredSchemes(results);
      setIsLoading(false);
    }, 600);
  };

  // Auto-search on initial load
  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-5xl mx-auto"
    >
      <div className="text-center mb-12">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl mb-6 shadow-lg shadow-blue-200"
        >
          <Landmark className="w-10 h-10 text-white" />
        </motion.div>
        <h2 className="text-4xl font-black text-gray-900 mb-3 tracking-tight">{t.govSchemes}</h2>
        <p className="text-gray-500 text-xl font-medium max-w-2xl mx-auto">{t.govSchemesDesc}</p>
      </div>

      <div className="bg-white p-8 rounded-[40px] border border-blue-100 shadow-xl shadow-blue-50/50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">{t.produceType}</label>
            <select 
              value={crop} 
              onChange={(e) => setCrop(e.target.value)}
              className="w-full rounded-2xl border-blue-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-blue-50/30 p-4 border text-base font-bold text-gray-900 transition-all"
            >
              {CROPS.map(c => (
                <option key={c} value={c}>
                  {c === 'all' ? (lang === 'bn' ? 'সব ফসল' : 'All Crops') : t.crops[c as keyof typeof t.crops]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">{t.location}</label>
            <select 
              value={district} 
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full rounded-2xl border-blue-100 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-blue-50/30 p-4 border text-base font-bold text-gray-900 transition-all capitalize"
            >
              {DISTRICTS.map(d => (
                <option key={d} value={d}>
                  {d === 'all' ? (lang === 'bn' ? 'সারা বাংলাদেশ' : 'All Bangladesh') : d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSearch}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black py-5 px-6 rounded-2xl hover:shadow-lg hover:shadow-blue-200 disabled:opacity-50 flex items-center justify-center space-x-3 transition-all text-lg tracking-tight"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-7 h-7 animate-spin" />
              <span>{lang === 'bn' ? 'খোঁজা হচ্ছে...' : 'Searching...'}</span>
            </>
          ) : (
            <>
              <Search className="w-7 h-7" />
              <span>{lang === 'bn' ? 'সুবিধা খুঁজুন' : 'Find Schemes'}</span>
            </>
          )}
        </motion.button>
      </div>

      {filteredSchemes && filteredSchemes.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <Landmark className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">{lang === 'bn' ? 'কোনো প্রকল্প পাওয়া যায়নি' : 'No Schemes Found'}</h3>
          <p className="text-gray-500">{lang === 'bn' ? 'আপনার নির্বাচিত ফসল বা এলাকার জন্য বর্তমানে কোনো প্রকল্প নেই।' : 'There are currently no schemes for your selected crop or district.'}</p>
        </div>
      )}

      {filteredSchemes && filteredSchemes.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between mb-2 px-2">
            <h3 className="font-black text-gray-900 uppercase tracking-widest text-sm">
              {lang === 'bn' ? 'উপলব্ধ প্রকল্পসমূহ' : 'Available Schemes'}
            </h3>
            <span className="bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-full text-xs">
              {filteredSchemes.length} {lang === 'bn' ? 'টি পাওয়া গেছে' : 'Found'}
            </span>
          </div>
          
          {filteredSchemes.map((scheme, idx) => (
            <motion.div 
              key={scheme.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm hover:shadow-md transition-all"
            >
              <h3 className="text-2xl font-black text-gray-900 mb-4 text-blue-900 break-words">{scheme.title[lang]}</h3>
              <p className="text-gray-600 mb-6 leading-relaxed break-words">{scheme.description[lang]}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-blue-50/50 rounded-2xl p-5 border border-blue-100/50">
                  <div className="flex items-center space-x-2 mb-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-600" />
                    <h4 className="font-black text-blue-900 uppercase tracking-widest text-xs">{lang === 'bn' ? 'যোগ্যতা' : 'Eligibility'}</h4>
                  </div>
                  <p className="text-sm text-gray-700 font-medium break-words">{scheme.eligibility[lang]}</p>
                </div>
                
                <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100/50">
                  <div className="flex items-center space-x-2 mb-3">
                    <ExternalLink className="w-5 h-5 text-indigo-600" />
                    <h4 className="font-black text-indigo-900 uppercase tracking-widest text-xs">{lang === 'bn' ? 'কিভাবে আবেদন করবেন' : 'How to Apply'}</h4>
                  </div>
                  <p className="text-sm text-gray-700 font-medium break-words">{scheme.howToApply[lang]}</p>
                </div>
              </div>

              {scheme.sourceLinks && scheme.sourceLinks.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-50 flex flex-wrap gap-2">
                  {scheme.sourceLinks.map((link, linkIdx) => (
                    <a 
                      key={linkIdx} 
                      href={link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors flex items-center"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      {lang === 'bn' ? 'অফিসিয়াল ওয়েবসাইট' : 'Official Website'}
                    </a>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
