import React, { useState, useEffect } from 'react';
import { 
  Users, 
  User,
  Leaf, 
  TrendingUp, 
  AlertTriangle, 
  Map as MapIcon, 
  Calendar, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight,
  Activity,
  Database,
  ShieldCheck,
  Search,
  Crown,
  Sprout,
  MessageSquare,
  Globe,
  Radio,
  Clock,
  Eye,
  Mail,
  Filter,
  Download,
  Terminal,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';

interface Stats {
  totalUsers: number;
  totalDiagnoses: number;
  premiumUsers: number;
  dailyActive: number;
  helpfulRatio: number;
}

type AdminTab = 'command' | 'users' | 'intelligence';

export default function AdminDashboard({ lang }: { lang: 'en' | 'bn' }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('command');
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalDiagnoses: 0,
    premiumUsers: 0,
    dailyActive: 0,
    helpfulRatio: 0
  });
  const [loading, setLoading] = useState(true);
  const [diagnoses, setDiagnoses] = useState<any[]>([]);
  const [userGrowth, setUserGrowth] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [outbreaks, setOutbreaks] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch Users
      const usersSnap = await getDocs(collection(db, 'users'));
      const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllUsers(users);
      
      // Fetch Diagnoses
      const diagnosesSnap = await getDocs(query(collection(db, 'diagnoses'), orderBy('createdAt', 'desc'), limit(100)));
      const diagnosesData = diagnosesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const totalUsers = users.length;
      const premiumUsers = users.filter((u: any) => u.tier === 'premium').length;
      const helpfulCount = diagnosesData.filter((d: any) => d.helpful === true).length;
      const totalRatings = diagnosesData.filter((d: any) => d.helpful !== undefined).length;
      
      const todayStr = new Date().toISOString().split('T')[0];
      const dailyActive = users.filter((u: any) => u.lastUsedDate === todayStr).length;

      // Real Time-Series Aggregation for last 7 days
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
      }

      const growth = days.map(day => {
        const dayUsers = users.filter((u: any) => u.createdAt?.startsWith(day)).length;
        const dayDiagnoses = diagnosesData.filter((diag: any) => {
          const createdAt = diag.createdAt;
          let dateStr = '';
          if (typeof createdAt === 'string') dateStr = createdAt;
          else if (createdAt?.toDate) dateStr = createdAt.toDate().toISOString();
          return dateStr.startsWith(day);
        }) as any[];

        return {
          name: new Date(day).toLocaleDateString(undefined, { weekday: 'short' }),
          users: dayUsers,
          diagnoses: dayDiagnoses.length,
          helpful: dayDiagnoses.filter((d: any) => d.helpful).length
        };
      });

      // Process intelligence data
      const cropTrends: any = {};
      diagnosesData.forEach((d: any) => {
        if (d.crop) cropTrends[d.crop] = (cropTrends[d.crop] || 0) + 1;
      });
      const intelligenceData = Object.entries(cropTrends)
        .map(([name, value]) => ({ name, value }))
        .sort((a: any, b: any) => b.value - a.value);

      setStats({
        totalUsers,
        totalDiagnoses: diagnosesData.length,
        premiumUsers,
        dailyActive,
        helpfulRatio: totalRatings > 0 ? (helpfulCount / totalRatings) * 100 : 0
      });
      setDiagnoses(diagnosesData);
      setUserGrowth(growth);
      setOutbreaks(intelligenceData.length > 0 ? intelligenceData : [{ name: 'No Data', value: 0 }]);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Platform Users', value: stats.totalUsers, icon: Users, color: 'blue', trend: 'Live', up: true },
    { label: 'Intelligence Satisfaction', value: `${stats.helpfulRatio.toFixed(1)}%`, icon: Zap, color: 'yellow', trend: 'Live', up: true },
    { label: 'Premium Conversion', value: `${((stats.premiumUsers / (stats.totalUsers || 1)) * 100).toFixed(1)}%`, icon: ShieldCheck, color: 'purple', trend: 'Live', up: true },
    { label: 'Daily Active Bio-Security', value: stats.dailyActive, icon: Radio, color: 'red', trend: 'Live', up: true },
  ];

  const adminTabs: { id: AdminTab, label: string, icon: any }[] = [
    { id: 'command', label: 'Command Center', icon: Terminal },
    { id: 'users', label: 'User Directory', icon: Users },
    { id: 'intelligence', label: 'Risk Intelligence', icon: AlertTriangle },
  ];

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-20 animate-pulse">
        <Database className="w-12 h-12 text-gray-200 mb-4" />
        <div className="text-gray-400 font-mono text-[10px] uppercase tracking-[0.3em]">Synching Neural Analytics...</div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-12"
    >
      {/* Navigation Header */}
      <div className="bg-gray-900 p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-green-500 rounded-full blur-[120px] -mr-48 -mt-48 opacity-20"></div>
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div className="flex items-center space-x-6">
              <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-xl border border-white/10">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-4xl font-display font-black text-white tracking-tighter leading-none mb-2 uppercase">AGRI-OPS HUB</h1>
                <div className="flex items-center space-x-3 text-[9px] font-mono font-bold text-gray-400 uppercase tracking-[0.3em]">
                  <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></div> SYSTEM LIVE</span>
                  <span className="opacity-30">|</span>
                  <span>v3.0.42_STABLE</span>
                </div>
              </div>
            </div>
            <div className="flex items-center p-1.5 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
              {adminTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-xl text-[10px] uppercase tracking-widest font-black transition-all ${
                    activeTab === tab.id 
                    ? 'bg-white text-gray-900 shadow-xl' 
                    : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {statCards.map((stat, i) => (
              <div key={i} className="bg-white/5 p-6 rounded-[32px] border border-white/10 backdrop-blur-sm group hover:bg-white/10 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2.5 rounded-xl bg-white/10`}>
                    <stat.icon className={`w-4 h-4 text-white`} />
                  </div>
                  <div className={`flex items-center space-x-1 text-[9px] font-black ${stat.up ? 'text-green-400' : 'text-red-400'}`}>
                    <span>{stat.trend}</span>
                  </div>
                </div>
                <div className="text-3xl font-display font-black text-white mb-1 tracking-tight">{stat.value}</div>
                <div className="text-[9px] font-mono font-bold text-gray-400 uppercase tracking-[0.2em]">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'command' && (
          <motion.div
            key="command"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between mb-10">
                  <div>
                    <h3 className="font-display font-black text-sm uppercase tracking-[0.3em] text-gray-400 flex items-center space-x-3 mb-2">
                      <TrendingUp className="w-5 h-5 text-green-500" />
                      <span>Platform Scaling Velocity</span>
                    </h3>
                    <p className="text-gray-500 text-xs font-bold leading-relaxed max-w-sm">Comparing user onboarding vs active bio-security diagnoses on a weekly rolling basis.</p>
                  </div>
                </div>
                <div className="h-[340px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={userGrowth}>
                      <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorDiag" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 700}} />
                      <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '16px' }} />
                      <Area type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorUsers)" />
                      <Area type="monotone" dataKey="diagnoses" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorDiag)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="lg:col-span-4 bg-gray-900 p-8 rounded-[40px] text-white overflow-hidden relative group">
                <h3 className="font-display font-black text-xs uppercase tracking-[0.3em] text-gray-500 mb-8">AI Satisfaction index</h3>
                <div className="flex-1 flex flex-col justify-center items-center">
                  <div className="relative w-48 h-48 mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Helpful', value: stats.helpfulRatio || 0.001 },
                            { name: 'Needs Work', value: (100 - stats.helpfulRatio) || 0.001 }
                          ]}
                          innerRadius={65}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="rgba(255,255,255,0.05)" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-display font-black tracking-tighter">{stats.helpfulRatio.toFixed(0)}%</span>
                      <span className="text-[8px] font-mono font-bold text-green-400 uppercase tracking-widest">{stats.helpfulRatio > 0 ? 'Positive' : 'No Data'}</span>
                    </div>
                  </div>
                  <div className="space-y-4 w-full">
                    <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                      <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Verified Advice</span>
                      <span className="text-xs font-black text-green-400">{stats.totalDiagnoses > 0 ? 'Active' : 'Offline'}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                      <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Growth Phase</span>
                      <span className="text-xs font-black text-blue-400">{stats.totalUsers < 100 ? 'Initial' : 'Scaling'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                <h3 className="font-display font-black text-xs uppercase tracking-[0.3em] text-gray-400">Live Global Protocol Log</h3>
                <div className="flex items-center space-x-2">
                   <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                   <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Direct Stream Active</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-8 py-4 text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Identity_ID</th>
                      <th className="px-8 py-4 text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Entity_Type</th>
                      <th className="px-8 py-4 text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Operational_Status</th>
                      <th className="px-8 py-4 text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Sat_Feedback</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {diagnoses.map((diag, i) => (
                      <tr key={i} className="hover:bg-gray-50/20 transition-all group">
                        <td className="px-8 py-5">
                          <div className="font-mono text-[10px] text-gray-400 leading-none mb-1">USER_{diag.userId?.slice(0, 8)}</div>
                          <div className="text-[10px] font-bold text-gray-300">
                             {diag.createdAt ? (typeof diag.createdAt === 'string' ? new Date(diag.createdAt).toLocaleString() : diag.createdAt.toDate().toLocaleString()) : 'N/A'}
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center space-x-3">
                            <Leaf className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-xs font-black text-gray-900 uppercase tracking-tight">{diag.crop}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="text-xs font-medium text-gray-600 line-clamp-1 italic">"{diag.diagnosisText?.slice(0, 45)}..."</div>
                        </td>
                        <td className="px-8 py-5">
                          {diag.helpful !== undefined ? (
                            <div className={`inline-flex items-center space-x-1.5 px-2 py-1 rounded-lg ${diag.helpful ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                              {diag.helpful ? <TrendingUp className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                              <span className="text-[9px] font-black uppercase tracking-widest">{diag.helpful ? 'Helpful' : 'Flagged'}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-mono text-gray-300">UNRATED</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div
            key="users"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="p-8 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center space-x-4">
                <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-900/20">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-display font-black text-gray-900 tracking-tight uppercase">User Directory</h3>
                  <p className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest leading-none mt-1">Personnel Management & Role Assignments</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search UID / Email / Entity" 
                    className="bg-gray-50 border-2 border-transparent focus:border-blue-600 rounded-2xl py-3 pl-12 pr-6 text-xs font-bold transition-all outline-none md:w-64"
                  />
                </div>
                <button className="p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors border border-gray-100">
                  <Filter className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-8 py-5 text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Entity Info</th>
                    <th className="px-8 py-5 text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Protocol Type</th>
                    <th className="px-8 py-5 text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Sync_Status</th>
                    <th className="px-8 py-5 text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Access_Level</th>
                    <th className="px-8 py-5 text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allUsers.map((u, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-6">
                        <div className="flex items-center space-x-4">
                          <div className={`w-10 h-10 rounded-2xl ${u.tier === 'premium' ? 'bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg shadow-orange-950/10' : 'bg-gray-100'} flex items-center justify-center`}>
                            <User className={`w-5 h-5 ${u.tier === 'premium' ? 'text-white' : 'text-gray-400'}`} />
                          </div>
                          <div>
                            <div className="text-sm font-black text-gray-900 tracking-tight">{u.name || 'ANON_ENTITY'}</div>
                            <div className="text-[10px] font-mono font-bold text-gray-400 lowercase">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-[10px] font-mono font-black text-gray-500 uppercase tracking-widest bg-gray-100 px-3 py-1.5 rounded-lg border border-gray-200">
                          {u.role || 'Farmer'}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            <span className="text-[10px] font-black text-gray-900 uppercase">ACTIVE</span>
                          </div>
                          <span className="text-[9px] font-mono text-gray-400 uppercase">Last Sync: {u.lastUsedDate || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl border ${u.tier === 'premium' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-gray-50 text-gray-500 border-gray-100'}`}>
                          {u.tier === 'premium' ? <Crown className="w-3.5 h-3.5" /> : <Sprout className="w-3.5 h-3.5" />}
                          <span className="text-[10px] font-black uppercase tracking-widest">{u.tier || 'Free'}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <button className="p-2.5 bg-white border border-gray-100 text-gray-400 hover:text-blue-600 hover:border-blue-200 rounded-xl transition-all shadow-sm">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'intelligence' && (
          <motion.div
            key="intelligence"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            <div className="lg:col-span-12 bg-white p-10 rounded-[40px] border border-gray-100 shadow-sm relative overflow-hidden">
               <div className="flex items-center justify-between mb-12">
                 <div className="flex items-center space-x-5">
                    <div className="bg-red-600 p-4 rounded-3xl shadow-xl shadow-red-900/20">
                      <AlertTriangle className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-display font-black text-gray-900 tracking-tight uppercase">Pathogen Outbreak Intelligence</h3>
                      <p className="text-[10px] font-mono font-bold text-red-500 uppercase tracking-[0.2em] leading-none mt-2">Critical Crop-Risk Cluster Detection</p>
                    </div>
                 </div>
                 <button className="flex items-center space-x-2 px-6 py-3 bg-red-50 text-red-700 font-bold text-[10px] uppercase tracking-widest rounded-2xl hover:bg-red-100 transition-all border border-red-100">
                    <Download className="w-4 h-4" />
                    <span>Export Risk Report</span>
                 </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12">
                 <div className="lg:col-span-8 h-[400px]">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={outbreaks}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                       <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 800}} dy={10} />
                       <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 800}} />
                       <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)' }} />
                       <Bar dataKey="value" fill="#ef4444" radius={[8, 8, 0, 0]} barSize={40}>
                         {outbreaks.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#f87171'} />
                         ))}
                       </Bar>
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
                 <div className="lg:col-span-4 space-y-6">
                    <div className="p-8 bg-gray-50 rounded-[32px] border border-gray-100">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Threat Intensity</h4>
                      <div className="space-y-6">
                        {outbreaks.slice(0, 4).map((o, i) => (
                          <div key={i} className="space-y-2">
                             <div className="flex justify-between items-center text-xs font-bold">
                               <span className="uppercase text-gray-900">{o.name} Cluster</span>
                               <span className="text-red-600">{((o.value / stats.totalDiagnoses) * 100).toFixed(0)}%</span>
                             </div>
                             <div className="h-1.5 w-full bg-white rounded-full overflow-hidden border border-gray-100">
                               <motion.div 
                                 initial={{ width: 0 }}
                                 animate={{ width: `${(o.value / stats.totalDiagnoses) * 100}%` }}
                                 transition={{ delay: i * 0.1, duration: 1 }}
                                 className="h-full bg-red-500 rounded-full"
                               />
                             </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="p-8 bg-gray-900 rounded-[32px] text-white">
                      <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Risk Status</h4>
                      <p className="text-xs font-medium leading-relaxed mb-6 italic opacity-80">
                        {outbreaks.length > 0 && outbreaks[0].name !== 'No Data' 
                          ? `Cluster detected in ${outbreaks[0].name}. Advisories recommended.` 
                          : "No significant pathogen clusters detected in recent sessions."}
                      </p>
                      <button className="w-full py-4 bg-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-950/20">Analyze Clusters</button>
                    </div>
                 </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
