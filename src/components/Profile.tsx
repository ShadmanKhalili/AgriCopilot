import React, { useEffect, useState } from 'react';
import { User, History, FileText, Award, Calendar, ChevronRight, UserCircle, TrendingUp, Database, Loader2, HelpCircle, Crown, Sprout } from 'lucide-react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { translations, Language } from '../utils/translations';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { seedGovSchemes } from '../data/seedSchemes';
import { useUsageTracking } from '../hooks/useUsageTracking';
import Tooltip from './Tooltip';

interface Props {
  lang: Language;
  onUpgrade: () => void;
}

interface DiagnosisRecord {
  id: string;
  crop: string;
  analysisType: string;
  createdAt: string;
  diagnosisText: string;
}

interface CertificateRecord {
  id: string;
  produce: string;
  grade: string;
  createdAt: string;
  estimatedPriceBdt: number;
}

interface MarketQueryRecord {
  id: string;
  produce: string;
  createdAt: string;
  isAdvanced: boolean;
}

interface PlantingIntentRecord {
  id: string;
  recommendedCrop: string;
  landSize: string;
  createdAt: string;
}

export default function Profile({ lang, onUpgrade }: Props) {
  const { user, userProfile, signIn } = useAuth();
  const { currentUsage, limit: usageLimit, tier } = useUsageTracking();
  const [diagnoses, setDiagnoses] = useState<DiagnosisRecord[]>([]);
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [marketQueries, setMarketQueries] = useState<MarketQueryRecord[]>([]);
  const [plantingIntents, setPlantingIntents] = useState<PlantingIntentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const t = translations[lang];

  const getTierName = () => {
    if (tier === 'premium') return t.premiumTier;
    if (tier === 'free') return t.freeTier;
    return t.anonTier;
  };

  const handleSeed = async () => {
    if (!window.confirm("Seed the curated government schemes database with initial PDF data?")) return;
    setSeeding(true);
    try {
      await seedGovSchemes();
      alert("Database seeded successfully!");
    } catch (error: any) {
      console.error("Seeding failed detailed error:", error);
      const errorMessage = error.message || String(error);
      alert(`Failed to seed database: ${errorMessage}`);
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;

      try {
        setLoading(true);
        
        // Fetch last 10 diagnoses
        const diagQuery = query(
          collection(db, 'diagnoses'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        const diagSnap = await getDocs(diagQuery);
        const diagData = diagSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as DiagnosisRecord[];
        setDiagnoses(diagData);

        // Fetch last 10 certificates
        const certQuery = query(
          collection(db, 'certificates'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        const certSnap = await getDocs(certQuery);
        const certData = certSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CertificateRecord[];
        setCertificates(certData);

        // Fetch last 10 market queries
        const marketQuery = query(
          collection(db, 'market_queries'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        const marketSnap = await getDocs(marketQuery);
        const marketData = marketSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as MarketQueryRecord[];
        setMarketQueries(marketData);

        // Fetch last 10 planting intents
        const intentQuery = query(
          collection(db, 'planting_intents'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        const intentSnap = await getDocs(intentQuery);
        const intentData = intentSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as PlantingIntentRecord[];
        setPlantingIntents(intentData);

      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <UserCircle className="w-16 h-16 mb-4 opacity-20" />
        <p>{t.signIn}</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="bg-white rounded-[40px] p-5 md:p-8 shadow-xl shadow-indigo-900/5 border border-indigo-100 mb-6 md:mb-8">
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="bg-indigo-50 p-3 md:p-4 rounded-2xl flex-shrink-0">
            <UserCircle className="w-6 h-6 md:w-8 h-8 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl md:text-3xl font-black text-gray-900 tracking-tight leading-tight">{t.profile}</h2>
            <p className="text-gray-500 text-xs md:text-base font-medium">{t.profileDesc}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Account Info */}
        <div className="lg:col-span-1 space-y-8">
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-10 rounded-[40px] border border-indigo-100 shadow-xl shadow-indigo-50/50 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 group-hover:opacity-80 transition-opacity"></div>
            
            <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-10 flex items-center">
              <div className="bg-indigo-50 p-2 rounded-xl mr-3">
                <User className="w-5 h-5" />
              </div>
              {t.accountInfo}
            </h3>
            
            <div className="space-y-8 relative z-10">
              <div className="group/item">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 group-hover/item:text-indigo-500 transition-colors">{t.email}</p>
                <p className="text-lg font-black text-gray-900 break-all tracking-tight">{user.email}</p>
              </div>
              <div className="group/item">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 group-hover/item:text-indigo-500 transition-colors">{t.role}</p>
                <div className="flex items-center space-x-2">
                  <p className="text-lg font-black text-gray-900 capitalize tracking-tight">{userProfile?.role || 'User'}</p>
                  {userProfile?.tier === 'premium' && (
                    <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest shadow-md">Premium</span>
                  )}
                </div>
              </div>
              <div className="group/item">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 group-hover/item:text-indigo-500 transition-colors">{t.memberSince}</p>
                <p className="text-lg font-black text-gray-900 tracking-tight">
                  {userProfile?.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>

              {/* Usage Stats (Moved from Sidebar) */}
              <div className="pt-8 border-t border-indigo-50">
                <div className="bg-indigo-50 rounded-[32px] p-6 border border-indigo-100 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{t.usage}</span>
                      <Tooltip content={t.tooltips.usage} position="top">
                        <HelpCircle className="w-3.5 h-3.5 text-indigo-400 cursor-help" />
                      </Tooltip>
                    </div>
                    <span className="text-[10px] font-black text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-100">
                      {currentUsage} / {usageLimit === Infinity ? '∞' : usageLimit}
                    </span>
                  </div>
                  <div className="w-full bg-white rounded-full h-3 overflow-hidden border border-indigo-100 p-0.5">
                    <motion.div 
                      className={`h-full rounded-full shadow-sm ${tier === 'premium' ? 'bg-gradient-to-r from-yellow-400 to-orange-400' : 'bg-gradient-to-r from-indigo-400 to-indigo-600'}`} 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((currentUsage / (usageLimit === Infinity ? 1 : usageLimit)) * 100, 100)}%` }}
                      transition={{ duration: 1.5, ease: "circOut" }}
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{getTierName()}</span>
                    {tier !== 'premium' && (
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onUpgrade}
                        className="flex items-center space-x-1.5 text-[10px] bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-black px-4 py-2 rounded-full shadow-lg shadow-orange-900/10 transition-all border border-yellow-400/20"
                      >
                        <Crown className="w-3 h-3" />
                        <span className="uppercase tracking-widest font-black">{t.upgrade}</span>
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>

              {(userProfile?.role === 'admin' || user?.email === 'sadmankhalili@gmail.com') && (
                <div className="pt-6 border-t border-indigo-50">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">Admin Controls</p>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSeed}
                    disabled={seeding}
                    className="w-full flex items-center justify-center space-x-2 bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 transition-colors disabled:opacity-50 text-xs uppercase tracking-widest"
                  >
                    {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                    <span>Seed Schemes DB</span>
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* History */}
        <div className="lg:col-span-2 space-y-10">
          {/* Diagnoses History */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-10 rounded-[40px] border border-green-100 shadow-xl shadow-green-50/50 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-green-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50"></div>
            
            <h3 className="text-xs font-black text-green-600 uppercase tracking-widest mb-10 flex items-center">
              <div className="bg-green-50 p-2 rounded-xl mr-3">
                <FileText className="w-5 h-5" />
              </div>
              {t.diagnosesHistory}
            </h3>
            
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-green-100 border-t-green-600 shadow-inner"></div>
              </div>
            ) : diagnoses.length > 0 ? (
              <div className="space-y-4 relative z-10">
                {diagnoses.map((diag) => (
                  <motion.div 
                    key={diag.id} 
                    whileHover={{ x: 5 }}
                    className="flex items-center justify-between p-6 bg-green-50/30 rounded-[24px] border border-green-100 hover:bg-green-50 transition-all group/card"
                  >
                    <div className="flex items-center space-x-5">
                      <div className="bg-white p-3 rounded-2xl shadow-sm group-hover/card:scale-110 transition-transform">
                        <Calendar className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-lg font-black text-gray-900 tracking-tight">{diag.crop}</p>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{new Date(diag.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black text-green-700 bg-green-100 px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-sm">
                        {diag.analysisType}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 relative z-10">
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs italic">{t.noHistory}</p>
              </div>
            )}
          </motion.div>

          {/* Certificates History */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-10 rounded-[40px] border border-blue-100 shadow-xl shadow-blue-50/50 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50"></div>
            
            <h3 className="text-xs font-black text-blue-600 uppercase tracking-widest mb-10 flex items-center">
              <div className="bg-blue-50 p-2 rounded-xl mr-3">
                <Award className="w-5 h-5" />
              </div>
              {t.certificatesHistory}
            </h3>
            
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-100 border-t-blue-600 shadow-inner"></div>
              </div>
            ) : certificates.length > 0 ? (
              <div className="space-y-4 relative z-10">
                {certificates.map((cert) => (
                  <motion.div 
                    key={cert.id} 
                    whileHover={{ x: 5 }}
                    className="flex items-center justify-between p-6 bg-blue-50/30 rounded-[24px] border border-blue-100 hover:bg-blue-50 transition-all group/card"
                  >
                    <div className="flex items-center space-x-5">
                      <div className="bg-white p-3 rounded-2xl shadow-sm group-hover/card:scale-110 transition-transform">
                        <Award className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-lg font-black text-gray-900 tracking-tight">{cert.produce}</p>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{new Date(cert.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-sm ${
                        cert.grade.includes('A') ? 'text-green-700 bg-green-100' : 
                        cert.grade.includes('B') ? 'text-yellow-700 bg-yellow-100' : 'text-red-700 bg-red-100'
                      }`}>
                        {cert.grade}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 relative z-10">
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs italic">{t.noHistory}</p>
              </div>
            )}
          </motion.div>

          {/* Market Queries History */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-10 rounded-[40px] border border-purple-100 shadow-xl shadow-purple-50/50 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-purple-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50"></div>
            
            <h3 className="text-xs font-black text-purple-600 uppercase tracking-widest mb-10 flex items-center">
              <div className="bg-purple-50 p-2 rounded-xl mr-3">
                <TrendingUp className="w-5 h-5" />
              </div>
              {t.marketInsights}
            </h3>
            
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-100 border-t-purple-600 shadow-inner"></div>
              </div>
            ) : marketQueries.length > 0 ? (
              <div className="space-y-4 relative z-10">
                {marketQueries.map((mq) => (
                  <motion.div 
                    key={mq.id} 
                    whileHover={{ x: 5 }}
                    className="flex items-center justify-between p-6 bg-purple-50/30 rounded-[24px] border border-purple-100 hover:bg-purple-50 transition-all group/card"
                  >
                    <div className="flex items-center space-x-5">
                      <div className="bg-white p-3 rounded-2xl shadow-sm group-hover/card:scale-110 transition-transform">
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-lg font-black text-gray-900 tracking-tight">{mq.produce}</p>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{new Date(mq.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {mq.isAdvanced && (
                        <span className="text-[10px] font-black text-yellow-700 bg-yellow-100 px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-sm">
                          Premium
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 relative z-10">
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs italic">{t.noHistory}</p>
              </div>
            )}
          </motion.div>

          {/* Planting Intents History */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-10 rounded-[40px] border border-emerald-100 shadow-xl shadow-emerald-50/50 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50"></div>
            
            <h3 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-10 flex items-center">
              <div className="bg-emerald-50 p-2 rounded-xl mr-3">
                <Sprout className="w-5 h-5" />
              </div>
              {lang === 'bn' ? 'রোপণের পরামর্শ' : 'Planting Recommendations'}
            </h3>
            
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-100 border-t-emerald-600 shadow-inner"></div>
              </div>
            ) : plantingIntents.length > 0 ? (
              <div className="space-y-4 relative z-10">
                {plantingIntents.map((intent) => (
                  <motion.div 
                    key={intent.id} 
                    whileHover={{ x: 5 }}
                    className="flex items-center justify-between p-6 bg-emerald-50/30 rounded-[24px] border border-emerald-100 hover:bg-emerald-50 transition-all group/card"
                  >
                    <div className="flex items-center space-x-5">
                      <div className="bg-white p-3 rounded-2xl shadow-sm group-hover/card:scale-110 transition-transform">
                        <Sprout className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-lg font-black text-gray-900 tracking-tight">{intent.recommendedCrop}</p>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{new Date(intent.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-xl uppercase tracking-widest shadow-sm">
                        {intent.landSize}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 relative z-10">
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs italic">{t.noHistory}</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
