import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Radar, AlertTriangle, MapPin, Calendar, Loader2, ShieldAlert } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { translations, Language } from '../utils/translations';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { useAuth } from './AuthProvider';

interface Props {
  lang: Language;
}

interface Alert {
  id: string;
  crop: string;
  analysisType: string;
  severity: number | string;
  createdAt: string;
  diagnosisText: string;
}

export default function CommunityRadar({ lang }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const t = translations[lang];
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    setIsLoading(true);
    // Fetch recent diagnoses for the current user to evaluate severe risks locally
    const q = query(
      collection(db, 'diagnoses'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedAlerts: Alert[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Client-side filter for severity (support both legacy numeric and new qualitative severity)
        let isSevere = false;
        let displaySeverity: number | string = 0;

        if (typeof data.severity === 'number' && data.severity >= 30) {
          isSevere = true;
          displaySeverity = data.severity;
        } else if (data.qualitativeSeverity && (data.qualitativeSeverity === 'High' || data.qualitativeSeverity === 'Medium')) {
          isSevere = true;
          displaySeverity = data.qualitativeSeverity;
        }

        if (isSevere) {
          fetchedAlerts.push({
            id: doc.id,
            crop: data.crop,
            analysisType: data.analysisType,
            severity: displaySeverity,
            createdAt: data.createdAt,
            diagnosisText: data.diagnosisText
          });
        }
      });
      
      // Take top 10 recent severe ones
      setAlerts(fetchedAlerts.slice(0, 10));
      setIsLoading(false);
    }, (error) => {
      setIsLoading(false);
      handleFirestoreError(error, OperationType.GET, 'diagnoses');
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-5xl mx-auto"
    >
      <div className="bg-white rounded-[40px] p-5 md:p-8 shadow-xl shadow-red-900/5 border border-red-100 mb-6 md:mb-8">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="bg-red-50 p-3 md:p-4 rounded-2xl flex-shrink-0">
            <Radar className="w-6 h-6 md:w-8 h-8 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl md:text-3xl font-black text-gray-900 tracking-tight leading-tight">{t.communityRadar}</h2>
            <p className="text-gray-500 text-xs md:text-base font-medium">{t.communityRadarDesc}</p>
          </div>
        </div>
      </div>

      <div className="bg-red-50/50 border border-red-100 rounded-3xl p-6 flex items-start space-x-4 mb-8">
        <ShieldAlert className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
        <div>
          <h4 className="font-black text-red-900 uppercase tracking-widest text-xs mb-1">
            {lang === 'bn' ? 'সতর্কতা' : 'Community Warning System'}
          </h4>
          <p className="text-sm text-red-800/80 font-medium leading-relaxed">
            {lang === 'bn' 
              ? 'এই রাডারে আপনার এলাকার অন্যান্য কৃষকদের দ্বারা শনাক্ত করা গুরুতর রোগ ও পোকার আক্রমণ দেখানো হচ্ছে। আপনার ফসলের সুরক্ষায় আগাম ব্যবস্থা নিন।' 
              : 'This radar shows high-severity diseases and pests recently detected by other farmers in the network. Use this to take preventative action for your own crops.'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-red-500 mb-4" />
          <p className="text-red-500 font-black uppercase tracking-widest text-xs animate-pulse">Scanning Network...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[40px] border border-gray-100 shadow-sm">
          <Radar className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Severe Alerts</h3>
          <p className="text-gray-500">The network is currently clear of severe outbreaks.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {alerts.map((alert, idx) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white rounded-3xl p-6 border border-red-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 opacity-50"></div>
              
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="flex items-center space-x-3">
                  <div className="bg-red-100 p-2.5 rounded-xl">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 text-lg capitalize">
                      {t.crops[alert.crop as keyof typeof t.crops] || alert.crop}
                    </h3>
                    <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                      {alert.analysisType === 'disease' ? t.disease : alert.analysisType === 'pest' ? t.pest : t.abiotic}
                    </span>
                  </div>
                </div>
                <div className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-100">
                  {typeof alert.severity === 'number' 
                    ? `${alert.severity}% Severe` 
                    : lang === 'bn' 
                      ? (alert.severity === 'High' ? 'উচ্চ ঝুঁকি' : 'মাঝারি ঝুঁকি')
                      : `${alert.severity} Severity`
                  }
                </div>
              </div>

              <p className="text-sm text-gray-600 line-clamp-3 mb-4 font-medium leading-relaxed">
                {alert.diagnosisText.replace(/[#*]/g, '')}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                <div className="flex items-center text-gray-400 text-xs font-bold">
                  <MapPin className="w-3.5 h-3.5 mr-1" />
                  <span>Bangladesh Network</span>
                </div>
                <div className="flex items-center text-gray-400 text-xs font-bold">
                  <Calendar className="w-3.5 h-3.5 mr-1" />
                  <span>
                    {(() => {
                      const diffInfo = Math.floor((new Date().getTime() - new Date(alert.createdAt).getTime()) / 60000);
                      if (diffInfo < 60) return `${diffInfo} ${lang === 'bn' ? 'মিনিট আগে' : 'minutes ago'}`;
                      const diffHours = Math.floor(diffInfo / 60);
                      if (diffHours < 24) return `${diffHours} ${lang === 'bn' ? 'ঘন্টা আগে' : 'hours ago'}`;
                      return new Date(alert.createdAt).toLocaleDateString();
                    })()}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
