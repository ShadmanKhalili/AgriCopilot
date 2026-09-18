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
      className="space-y-4 md:space-y-6 w-full"
    >
      <div className="bg-white rounded-[24px] md:rounded-[32px] p-4 md:p-6 shadow-xl shadow-red-900/5 border border-red-100 mb-4 md:mb-6">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="bg-red-50 p-2 md:p-3 rounded-xl flex-shrink-0">
            <Radar className="w-6 h-6 md:w-7 h-7 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg md:text-2xl font-black text-gray-900 tracking-tight leading-tight">{t.communityRadar}</h2>
            <p className="text-gray-500 text-[10px] md:text-sm font-medium">{t.communityRadarDesc}</p>
          </div>
        </div>
      </div>

      <div className="bg-red-50/70 border border-red-200/70 rounded-2xl md:rounded-3xl p-3.5 sm:p-5 flex items-start space-x-3 sm:space-x-4 mb-4 sm:mb-6">
        <div className="p-2 bg-red-100 rounded-xl text-red-600 shrink-0">
          <ShieldAlert className="w-5 h-5 text-red-600" />
        </div>
        <div className="min-w-0">
          <h4 className="font-black text-red-900 uppercase tracking-widest text-xs mb-0.5">
            {lang === 'bn' ? 'সতর্কতা ও কমিউনিটি রাডার' : 'Community Warning System'}
          </h4>
          <p className="text-xs sm:text-sm text-red-800/80 font-medium leading-relaxed">
            {lang === 'bn' 
              ? 'এই রাডারে আপনার এলাকার অন্যান্য কৃষকদের দ্বারা শনাক্ত করা গুরুতর রোগ ও পোকার আক্রমণ দেখানো হচ্ছে। আপনার ফসলের সুরক্ষায় আগাম ব্যবস্থা নিন।' 
              : 'This radar shows high-severity diseases and pests recently detected by other farmers in the network. Use this to take preventative action for your own crops.'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-9 h-9 animate-spin text-red-500 mb-3" />
          <p className="text-red-600 font-bold uppercase tracking-wider text-xs">
            {lang === 'bn' ? 'তথ্য অনুসন্ধান করা হচ্ছে...' : 'Checking pest alerts...'}
          </p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm p-6">
          <Radar className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
            {lang === 'bn' ? 'কোনো গুরুতর সতর্কতা নেই' : 'No Severe Alerts'}
          </h3>
          <p className="text-gray-500 text-xs sm:text-sm">
            {lang === 'bn' ? 'আপনার এলাকায় বর্তমানে কোনো বড় ধরনের বালাই প্রাদুর্ভাব পাওয়া যায়নি।' : 'No major pest outbreaks currently reported in your area.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-5">
          {alerts.map((alert, idx) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-2xl md:rounded-3xl p-4 sm:p-5 border border-red-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3 opacity-50 pointer-events-none"></div>
              
              <div>
                <div className="flex justify-between items-start gap-2 mb-3 relative z-10">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="bg-red-100 p-2 rounded-xl shrink-0">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    </div>
                    <div className="min-w-0 truncate">
                      <h3 className="font-black text-gray-900 text-base sm:text-lg capitalize truncate">
                        {t.crops[alert.crop as keyof typeof t.crops] || alert.crop}
                      </h3>
                      <span className="text-[10px] font-black text-red-600 uppercase tracking-widest block truncate">
                        {alert.analysisType === 'disease' ? t.disease : alert.analysisType === 'pest' ? t.pest : t.abiotic}
                      </span>
                    </div>
                  </div>
                  <div className="bg-red-50 text-red-700 px-2.5 py-1 rounded-full text-[11px] font-bold border border-red-100 shrink-0 whitespace-nowrap">
                    {typeof alert.severity === 'number' 
                      ? `${alert.severity}% Severe` 
                      : lang === 'bn' 
                        ? (alert.severity === 'High' ? 'উচ্চ ঝুঁকি' : 'মাঝারি ঝুঁকি')
                        : `${alert.severity} Severity`
                    }
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-gray-600 line-clamp-3 mb-4 font-medium leading-relaxed">
                  {alert.diagnosisText.replace(/[#*]/g, '')}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100/80 text-[11px] font-bold text-gray-400">
                <div className="flex items-center truncate mr-2">
                  <MapPin className="w-3 h-3 mr-1 text-emerald-600 shrink-0" />
                  <span className="truncate">Bangladesh Network</span>
                </div>
                <div className="flex items-center shrink-0">
                  <Calendar className="w-3 h-3 mr-1 text-gray-400 shrink-0" />
                  <span>
                    {(() => {
                      const diffInfo = Math.floor((new Date().getTime() - new Date(alert.createdAt).getTime()) / 60000);
                      if (diffInfo < 60) return `${diffInfo} ${lang === 'bn' ? 'মিনিট আগে' : 'min ago'}`;
                      const diffHours = Math.floor(diffInfo / 60);
                      if (diffHours < 24) return `${diffHours} ${lang === 'bn' ? 'ঘন্টা আগে' : 'hr ago'}`;
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
