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
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-2xl mb-4">
          <UserCircle className="w-8 h-8 text-indigo-600" />
        </div>
        <h2 className="text-3xl font-extrabold text-gray-900 mb-2">{t.profile}</h2>
        <p className="text-gray-500 text-lg">{t.profileDesc}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Account Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-5 md:p-8 rounded-3xl border border-indigo-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
              <User className="w-5 h-5 mr-2 text-indigo-600" />
              {t.accountInfo}
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t.email}</p>
                <p className="text-gray-900 font-medium break-all">{user.email}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t.role}</p>
                <p className="text-gray-900 font-medium capitalize">{userProfile?.role || 'User'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{t.memberSince}</p>
                <p className="text-gray-900 font-medium">
                  {userProfile?.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="lg:col-span-2 space-y-8">
          {/* Diagnoses History */}
          <div className="bg-white p-5 md:p-8 rounded-3xl border border-green-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-green-600" />
              {t.diagnosesHistory}
            </h3>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
            ) : diagnoses.length > 0 ? (
              <div className="space-y-3">
                {diagnoses.map((diag) => (
                  <div key={diag.id} className="flex items-center justify-between p-4 bg-green-50/50 rounded-2xl border border-green-100 hover:bg-green-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="bg-white p-2 rounded-xl shadow-sm">
                        <Calendar className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{diag.crop}</p>
                        <p className="text-xs text-gray-500">{new Date(diag.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-lg uppercase tracking-tighter">
                        {diag.analysisType}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-400 text-sm italic">{t.noHistory}</p>
            )}
          </div>

          {/* Certificates History */}
          <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
              <Award className="w-5 h-5 mr-2 text-blue-600" />
              {t.certificatesHistory}
            </h3>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : certificates.length > 0 ? (
              <div className="space-y-3">
                {certificates.map((cert) => (
                  <div key={cert.id} className="flex items-center justify-between p-4 bg-blue-50/50 rounded-2xl border border-blue-100 hover:bg-blue-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="bg-white p-2 rounded-xl shadow-sm">
                        <Award className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{cert.produce}</p>
                        <p className="text-xs text-gray-500">{new Date(cert.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg uppercase tracking-tighter ${
                        cert.grade.includes('A') ? 'text-green-700 bg-green-100' : 
                        cert.grade.includes('B') ? 'text-yellow-700 bg-yellow-100' : 'text-red-700 bg-red-100'
                      }`}>
                        {cert.grade}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-400 text-sm italic">{t.noHistory}</p>
            )}
          </div>

          {/* Market Queries History */}
          <div className="bg-white p-6 rounded-3xl border border-purple-100 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-purple-600" />
              {t.marketInsights}
            </h3>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
              </div>
            ) : marketQueries.length > 0 ? (
              <div className="space-y-3">
                {marketQueries.map((mq) => (
                  <div key={mq.id} className="flex items-center justify-between p-4 bg-purple-50/50 rounded-2xl border border-purple-100 hover:bg-purple-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="bg-white p-2 rounded-xl shadow-sm">
                        <TrendingUp className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{mq.produce}</p>
                        <p className="text-xs text-gray-500">{mq.location} • {new Date(mq.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {mq.isAdvanced && (
                        <span className="text-[10px] font-bold text-yellow-700 bg-yellow-100 px-2 py-1 rounded-lg uppercase tracking-tighter">
                          Premium
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-400 text-sm italic">{t.noHistory}</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
