import React, { useEffect, useState } from 'react';
import { User, History, FileText, Award, Calendar, ChevronRight, UserCircle, TrendingUp } from 'lucide-react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthProvider';
import { translations, Language } from '../utils/translations';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

interface Props {
  lang: Language;
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
  location: string;
  createdAt: string;
  isAdvanced: boolean;
}

export default function Profile({ lang }: Props) {
  const { user, userProfile } = useAuth();
  const [diagnoses, setDiagnoses] = useState<DiagnosisRecord[]>([]);
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [marketQueries, setMarketQueries] = useState<MarketQueryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const t = translations[lang];

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
      <div className="text-center mb-16">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl mb-6 shadow-lg shadow-indigo-200"
        >
          <UserCircle className="w-10 h-10 text-white" />
        </motion.div>
        <h2 className="text-5xl font-black text-gray-900 tracking-tight mb-4 uppercase italic">{t.profile}</h2>
        <p className="text-gray-500 text-xl max-w-2xl mx-auto leading-relaxed font-medium">{t.profileDesc}</p>
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
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{mq.location} • {new Date(mq.createdAt).toLocaleDateString()}</p>
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
        </div>
      </div>
    </motion.div>
  );
}
