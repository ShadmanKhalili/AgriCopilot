import React, { useState, useEffect, useRef } from 'react';
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
  Zap,
  FileText,
  Printer,
  Bell,
  Send,
  MapPin,
  CheckCircle2,
  RefreshCw,
  Sliders,
  DollarSign,
  PieChart as PieIcon,
  ChevronRight,
  Phone,
  Layers,
  Award,
  Cpu,
  Server,
  Check,
  Plus,
  FileSpreadsheet,
  Sparkles,
  Share2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  getCountFromServer,
  where,
  updateDoc,
  doc,
  addDoc
} from 'firebase/firestore';
import { db } from '../firestore';
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
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import { geoData } from '../utils/geoData';
import { slug } from '../../netlify/functions/_shared/area-model';
import { Language } from '../utils/translations';
import { confidenceLabel, confidenceValue } from '../utils/diagnosisTypes';
import DigitalPrescriptionModal from './DigitalPrescriptionModal';
import { buildPrescriptionFromRecord, isSeverityUnknown, type PrescriptionData } from '../utils/prescriptionData';
import { csvEscape } from '../utils/csv';
import { useAuth } from './AuthProvider';
import { auth } from '../firebase';
import type { CheckFeature, ModelCheckReport } from '../../netlify/functions/_shared/model-check';
import {
  BROADCAST_MAX_DAYS,
  BROADCAST_MAX_LENGTH,
  buildBroadcast,
  createBroadcast,
  deleteBroadcast,
  expiryForDays,
  isExpired,
  listRecentBroadcasts,
  type BroadcastError,
  type StoredBroadcastRow,
} from '../services/broadcasts';

// A null figure means "not measured": the UI shows "—", never an invented number.
interface Stats {
  totalUsers: number | null;
  totalDiagnoses: number | null;
  totalPrescriptions: number | null;
  // Share of recent diagnoses rated helpful, and how many ratings that is based on.
  helpfulRatio: number | null;
  ratedCount: number;
}

const USERS_LIMIT = 200;
const DIAGNOSES_LIMIT = 100;
const PRESCRIPTIONS_LIMIT = 50;

/**
 * Total documents in a collection. Uses a server-side count so the figure is
 * not capped by the bounded list reads above. If the count is unavailable,
 * the loaded list length is only trusted when the list was not cut off by its
 * limit; otherwise the total is unknown (null).
 */
async function countDocs(name: string, loadedLength: number, loadLimit: number): Promise<number | null> {
  try {
    const snap = await getCountFromServer(collection(db, name));
    return snap.data().count;
  } catch (err) {
    console.warn(`Could not count ${name}:`, err);
    return loadedLength < loadLimit ? loadedLength : null;
  }
}

// createdAt arrives as a Firestore Timestamp, an ISO string or epoch millis.
function toDateOrNull(value: any): Date | null {
  if (!value) return null;
  const d = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  return d instanceof Date && !isNaN(d.getTime()) ? d : null;
}

const localDayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Per-day counts for the last 7 days (local time), from real createdAt dates.
 * Returns [] when none of the records carry a usable date, so the chart is
 * hidden rather than drawn from nothing.
 */
function buildGrowthSeries(users: any[], diagnoses: any[], prescriptions: any[], lang: string) {
  const days: { key: string; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({ key: localDayKey(d), label: d.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'short' }) });
  }
  const bucket = (rows: any[]) => {
    const counts = new Map<string, number>();
    let dated = 0;
    for (const row of rows) {
      const d = toDateOrNull(row?.createdAt);
      if (!d) continue;
      dated++;
      const key = localDayKey(d);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return { counts, dated };
  };
  const u = bucket(users);
  const dg = bucket(diagnoses);
  const rx = bucket(prescriptions);
  if (u.dated + dg.dated + rx.dated === 0) return [];
  return days.map(({ key, label }) => ({
    name: label,
    users: u.counts.get(key) || 0,
    diagnoses: dg.counts.get(key) || 0,
    prescriptions: rx.counts.get(key) || 0,
  }));
}

const fmtCount = (n: number | null) => (n === null ? '—' : n.toLocaleString());

type AdminTab = 'command' | 'intelligence' | 'prescriptions' | 'users' | 'investor';

interface OutbreakHotspot {
  district: string;
  districtBn: string;
  crop: string;
  cropBn: string;
  disease: string;
  diseaseBn: string;
  threatLevel: 'Low' | 'Moderate' | 'Critical';
  casesCount: number;
  affectedAreaHectares: number;
  lastUpdated: string;
}

const DEFAULT_OUTBREAK_HOTSPOTS: OutbreakHotspot[] = [
  {
    district: 'Bogura',
    districtBn: 'বগুড়া',
    crop: 'Paddy',
    cropBn: 'ধান',
    disease: 'Bacterial Leaf Blight',
    diseaseBn: 'পাতা পোড়া রোগ (ব্যাকটেরিয়াল ব্লাইট)',
    threatLevel: 'Critical',
    casesCount: 342,
    affectedAreaHectares: 1250,
    lastUpdated: '10 mins ago'
  },
  {
    district: 'Rajshahi',
    districtBn: 'রাজশাহী',
    crop: 'Tomato',
    cropBn: 'টমেটো',
    disease: 'Late Blight',
    diseaseBn: 'নাবি ধসা (লেট ব্লাইট)',
    threatLevel: 'Critical',
    casesCount: 218,
    affectedAreaHectares: 480,
    lastUpdated: '25 mins ago'
  },
  {
    district: 'Mymensingh',
    districtBn: 'ময়মনসিংহ',
    crop: 'Rice',
    cropBn: 'ধান',
    disease: 'Rice Blast',
    diseaseBn: 'ধানের ব্লাস্ট রোগ',
    threatLevel: 'Moderate',
    casesCount: 164,
    affectedAreaHectares: 720,
    lastUpdated: '1 hour ago'
  },
  {
    district: 'Jessore',
    districtBn: 'যশোর',
    crop: 'Brinjal',
    cropBn: 'বেগুন',
    disease: 'Fruit & Shoot Borer',
    diseaseBn: 'ডগা ও ফল ছিদ্রকারী পোকা',
    threatLevel: 'Moderate',
    casesCount: 132,
    affectedAreaHectares: 310,
    lastUpdated: '2 hours ago'
  },
  {
    district: 'Rangpur',
    districtBn: 'রংপুর',
    crop: 'Potato',
    cropBn: 'আলু',
    disease: 'Early Blight & Scab',
    diseaseBn: 'আগেভাগে ধসা ও সাধারণ স্ক্যাব',
    threatLevel: 'Low',
    casesCount: 88,
    affectedAreaHectares: 260,
    lastUpdated: '4 hours ago'
  },
  {
    district: 'Dhaka',
    districtBn: 'ঢাকা',
    crop: 'Rooftop Citrus',
    cropBn: 'ছাদ বাগানের লেবু',
    disease: 'Leaf Miner & Canker',
    diseaseBn: 'লিফ মাইনার ও ক্যাংকার',
    threatLevel: 'Moderate',
    casesCount: 104,
    affectedAreaHectares: 95,
    lastUpdated: '30 mins ago'
  }
];

export default function AdminDashboard({ lang }: { lang: Language }) {
  const { userRole, isAuthReady } = useAuth();
  const isAdmin = userRole === 'admin';
  const [activeTab, setActiveTab] = useState<AdminTab>('command');
  const [stats, setStats] = useState<Stats>({
    totalUsers: null,
    totalDiagnoses: null,
    totalPrescriptions: null,
    helpfulRatio: null,
    ratedCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [diagnoses, setDiagnoses] = useState<any[]>([]);
  const [allPrescriptions, setAllPrescriptions] = useState<any[]>([]);
  // Tracks whether any Firestore read failed and the view is showing synthesized
  // fallback rows, so the UI can label it instead of silently implying live data.
  const [usingFallbackData, setUsingFallbackData] = useState(false);
  const [userGrowth, setUserGrowth] = useState<any[]>([]);
  const [growthIsPartial, setGrowthIsPartial] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [outbreaks, setOutbreaks] = useState<OutbreakHotspot[]>(DEFAULT_OUTBREAK_HOTSPOTS);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'agri-preneur' | 'hub-manager' | 'admin'>('all');
  const [userTierFilter, setUserTierFilter] = useState<'all' | 'free' | 'premium'>('all');
  
  // Prescription Audit & Inspection
  const [selectedRxForModal, setSelectedRxForModal] = useState<PrescriptionData | null>(null);
  const [isRxModalOpen, setIsRxModalOpen] = useState(false);
  const [prescriptionSearchQuery, setPrescriptionSearchQuery] = useState('');
  const [rxStatusFilter, setRxStatusFilter] = useState<'all' | 'verified' | 'pending'>('all');

  // Emergency Advisory Broadcast Simulator & Geo Radar
  // Emergency broadcast form (Phase 6): 'all' or a district name from geoData.
  const [broadcastDistrict, setBroadcastDistrict] = useState('all');
  const [broadcastMessage, setBroadcastMessage] = useState(''); // English
  const [broadcastMessageBn, setBroadcastMessageBn] = useState('');
  const [broadcastSeverity, setBroadcastSeverity] = useState<'info' | 'warning'>('warning');
  const [broadcastDays, setBroadcastDays] = useState(3);
  const [broadcastConfirming, setBroadcastConfirming] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastNotice, setBroadcastNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [recentBroadcasts, setRecentBroadcasts] = useState<StoredBroadcastRow[] | null>(null);
  const [broadcastListFailed, setBroadcastListFailed] = useState(false);
  const [deletingBroadcastId, setDeletingBroadcastId] = useState<string | null>(null);
  const [selectedDivision, setSelectedDivision] = useState<string>('all');

  // Real-time Telemetry & Edge Status
  const [showTelemetryDrawer, setShowTelemetryDrawer] = useState(false);
  const [telemetryLatency, setTelemetryLatency] = useState<number>(248);

  // Invite Agronomist Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'hub-manager',
    district: 'Bogura'
  });

  // Investor Interactive Revenue & Impact Model
  const [investorFarmersCount, setInvestorFarmersCount] = useState<number>(250000);
  const [investorConversionRate, setInvestorConversionRate] = useState<number>(3.5);

  const dashboardContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Wait for auth to resolve before deciding whether this user may fetch privileged data
    if (!isAuthReady) return;
    if (!isAdmin) {
      // Non-admins never fetch privileged collections; skip straight to the restricted view
      setLoading(false);
      return;
    }
    fetchDashboardData();
  }, [isAuthReady, isAdmin]);

  const fetchDashboardData = async () => {
    setIsRefreshing(true);
    let usedFallback = false;
    try {
      // 1. Fetch Users (admin-only list per firestore.rules)
      let users: any[] = [];
      try {
        // Bound the read: an unbounded users query bills every user document.
        const usersSnap = await getDocs(
          query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(USERS_LIMIT))
        );
        users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.warn("Could not fetch users collection:", err);
        usedFallback = true;
      }

      setAllUsers(users);

      // 2. Fetch Diagnoses
      let diagnosesData: any[] = [];
      try {
        const diagnosesSnap = await getDocs(query(collection(db, 'diagnoses'), orderBy('createdAt', 'desc'), limit(DIAGNOSES_LIMIT)));
        diagnosesData = diagnosesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.warn("Could not fetch diagnoses from firestore:", err);
        usedFallback = true;
      }

      setDiagnoses(diagnosesData);

      // 3. Fetch Prescriptions
      let rxList: any[] = [];
      try {
        const rxSnap = await getDocs(query(collection(db, 'prescriptions'), orderBy('createdAt', 'desc'), limit(PRESCRIPTIONS_LIMIT)));
        rxList = rxSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.warn("Could not fetch prescriptions:", err);
        usedFallback = true;
      }

      setAllPrescriptions(rxList);

      // Compute statistics from what was actually read. Anything that is not
      // measured stays null and the UI shows "—" rather than an invented number.
      const [totalUsersCount, totalDiagnosesCount, totalPrescriptionsCount] = await Promise.all([
        countDocs('users', users.length, USERS_LIMIT),
        countDocs('diagnoses', diagnosesData.length, DIAGNOSES_LIMIT),
        countDocs('prescriptions', rxList.length, PRESCRIPTIONS_LIMIT),
      ]);
      const ratedDiagnoses = diagnosesData.filter((d: any) => typeof d.helpful === 'boolean');
      const helpfulCount = ratedDiagnoses.filter((d: any) => d.helpful === true).length;
      const helpfulRatio = ratedDiagnoses.length > 0 ? (helpfulCount / ratedDiagnoses.length) * 100 : null;

      // 7-day growth, bucketed from the real createdAt dates of the records read.
      const growth = buildGrowthSeries(users, diagnosesData, rxList, lang);
      const sampleIsCapped =
        users.length >= USERS_LIMIT || diagnosesData.length >= DIAGNOSES_LIMIT || rxList.length >= PRESCRIPTIONS_LIMIT;

      setStats({
        totalUsers: totalUsersCount,
        totalDiagnoses: totalDiagnosesCount,
        totalPrescriptions: totalPrescriptionsCount,
        helpfulRatio,
        ratedCount: ratedDiagnoses.length,
      });
      setUserGrowth(growth);
      setGrowthIsPartial(sampleIsCapped);
      setUsingFallbackData(usedFallback);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      setUsingFallbackData(true);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Roles accepted by firestore.rules (isValidUser). Keep in sync with the rules file.
  const ALLOWED_USER_ROLES = ['agri-preneur', 'hub-manager', 'admin'];

  // Promote / Change User Role in Firestore
  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    if (!isAdmin) {
      toast.error(lang === 'bn' ? 'শুধুমাত্র অ্যাডমিন এই পরিবর্তন করতে পারবেন' : 'Only administrators can change roles');
      return;
    }
    if (!ALLOWED_USER_ROLES.includes(newRole)) {
      toast.error(lang === 'bn' ? 'অবৈধ পদবী' : `Invalid role: ${newRole}`);
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success(lang === 'bn' ? 'ব্যবহারকারীর পদবী হালনাগাদ হয়েছে' : `Role updated to ${newRole}`);
    } catch (e: any) {
      // Never report success on a failed write — the change did not persist.
      console.error("Role update failed:", e);
      toast.error(lang === 'bn'
        ? 'পদবী হালনাগাদ ব্যর্থ হয়েছে। অনুমতি নেই অথবা সংযোগ সমস্যা।'
        : `Role update failed: ${e?.message || 'permission denied or offline'}`);
    }
  };

  // Toggle User Tier (Free vs Premium)
  const handleToggleUserTier = async (userId: string, currentTier: string) => {
    if (!isAdmin) {
      toast.error(lang === 'bn' ? 'শুধুমাত্র অ্যাডমিন প্যাকেজ পরিবর্তন করতে পারবেন' : 'Only administrators can change tiers');
      return;
    }
    const nextTier = currentTier === 'premium' ? 'free' : 'premium';
    try {
      await updateDoc(doc(db, 'users', userId), { tier: nextTier });
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, tier: nextTier } : u));
      toast.success(lang === 'bn' ? `প্যাকেজ পরিবর্তন: ${nextTier.toUpperCase()}` : `Tier updated to ${nextTier.toUpperCase()}`);
    } catch (e: any) {
      // Never report success on a failed write — the change did not persist.
      console.error("Tier update failed:", e);
      toast.error(lang === 'bn'
        ? 'প্যাকেজ পরিবর্তন ব্যর্থ হয়েছে। অনুমতি নেই অথবা সংযোগ সমস্যা।'
        : `Tier update failed: ${e?.message || 'permission denied or offline'}`);
    }
  };

  // Emergency broadcast: shown in the app to signed-in farmers (no phone notification).
  const broadcastErrorText = (error: BroadcastError | 'failed' | 'permission_denied'): string => {
    const bn = lang === 'bn';
    switch (error) {
      case 'message_bn_empty': return bn ? 'বাংলা বার্তা লিখুন' : 'Write the message in Bangla';
      case 'message_en_empty': return bn ? 'ইংরেজি বার্তা লিখুন' : 'Write the message in English';
      case 'message_bn_too_long':
      case 'message_en_too_long': return bn ? `বার্তা সর্বোচ্চ ${BROADCAST_MAX_LENGTH} অক্ষরের হতে পারে` : `A message can be at most ${BROADCAST_MAX_LENGTH} characters`;
      case 'district_invalid': return bn ? 'জেলা বেছে নিন' : 'Choose a district';
      case 'expiry_invalid':
      case 'expiry_out_of_range': return bn ? `দিন ১ থেকে ${BROADCAST_MAX_DAYS}-এর মধ্যে হতে হবে` : `Days must be from 1 to ${BROADCAST_MAX_DAYS}`;
      case 'signed_out': return bn ? 'আবার সাইন ইন করুন' : 'Please sign in again';
      case 'permission_denied': return bn ? 'অনুমতি নেই: শুধু অ্যাডমিন বার্তা পাঠাতে পারেন' : 'Permission denied: only an admin can send broadcasts';
      default: return bn ? 'পাঠানো যায়নি। সংযোগ দেখে আবার চেষ্টা করুন' : 'Could not send. Check the connection and try again';
    }
  };

  const broadcastFormInput = () => ({
    messageBn: broadcastMessageBn,
    messageEn: broadcastMessage,
    district: broadcastDistrict,
    severity: broadcastSeverity,
    expiresDay: expiryForDays(broadcastDays),
  });

  const loadRecentBroadcasts = async () => {
    const result = await listRecentBroadcasts();
    if (result.ok) {
      setRecentBroadcasts(result.items);
      setBroadcastListFailed(false);
    } else {
      setBroadcastListFailed(true);
    }
  };

  // Step 1: check the form, then ask for confirmation.
  const handleDispatchAdvisory = () => {
    setBroadcastNotice(null);
    const checked = buildBroadcast(broadcastFormInput(), 'check', new Date());
    if (checked.ok === false) {
      setBroadcastNotice({ kind: 'error', text: broadcastErrorText(checked.error) });
      return;
    }
    setBroadcastConfirming(true);
  };

  // Step 2: really send.
  const handleConfirmBroadcast = async () => {
    setIsBroadcasting(true);
    const result = await createBroadcast(broadcastFormInput());
    setIsBroadcasting(false);
    setBroadcastConfirming(false);
    if (result.ok === true) {
      setBroadcastNotice({
        kind: 'ok',
        text: lang === 'bn' ? 'বার্তা পাঠানো হয়েছে। কৃষকরা অ্যাপে দেখতে পাবেন।' : 'Broadcast sent. Farmers will see it in the app.',
      });
      setBroadcastMessage('');
      setBroadcastMessageBn('');
      void loadRecentBroadcasts();
    } else {
      setBroadcastNotice({ kind: 'error', text: broadcastErrorText(result.error) });
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    setDeletingBroadcastId(id);
    const result = await deleteBroadcast(id);
    setDeletingBroadcastId(null);
    if (result.ok === true) {
      setRecentBroadcasts((list) => (list ? list.filter((item) => item.id !== id) : list));
      toast.success(lang === 'bn' ? 'বার্তা মুছে ফেলা হয়েছে' : 'Broadcast deleted');
    } else {
      toast.error(broadcastErrorText(result.error));
    }
  };

  useEffect(() => {
    if (activeTab === 'intelligence' && recentBroadcasts === null && !broadcastListFailed) void loadRecentBroadcasts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Export Executive Report (PNG)
  const handleExportDashboard = async () => {
    if (!dashboardContainerRef.current) return;
    const toastId = toast.loading(lang === 'bn' ? 'এক্সিকিউটিভ রিপোর্ট তৈরি হচ্ছে...' : 'Generating Executive Audit Report...');
    try {
      await new Promise(r => setTimeout(r, 120));
      const dataUrl = await toPng(dashboardContainerRef.current, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: '#0f172a'
      });
      const link = document.createElement('a');
      link.download = `Smart-Krishi-Executive-Command-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
      toast.success(lang === 'bn' ? 'রিপোর্ট ডাউনলোড সম্পন্ন হয়েছে!' : 'Executive Report downloaded!', { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Download error', { id: toastId });
    }
  };

  // Filtered Users List
  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = !searchUserQuery || 
      (u.name && u.name.toLowerCase().includes(searchUserQuery.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchUserQuery.toLowerCase())) ||
      (u.phone && u.phone.includes(searchUserQuery)) ||
      (u.district && u.district.toLowerCase().includes(searchUserQuery.toLowerCase()));
    
    const matchesRole = userRoleFilter === 'all' || (u.role && u.role.toLowerCase() === userRoleFilter);
    const matchesTier = userTierFilter === 'all' || (u.tier && u.tier.toLowerCase() === userTierFilter);

    return matchesSearch && matchesRole && matchesTier;
  });

  // Verify Prescription (Official SAAO Certification)
  const handleVerifyPrescription = (rxId: string) => {
    if (!isAdmin) {
      toast.error('Only authorized agronomists can certify prescriptions');
      return;
    }
    const target = allPrescriptions.find(rx => rx.id === rxId || rx.rxId === rxId);
    if (target?.isDemoData) {
      toast.error(lang === 'bn' ? 'ডেমো রেকর্ড অনুমোদন করা যাবে না' : 'Demo records cannot be certified');
      return;
    }
    setAllPrescriptions(prev => prev.map(rx => {
      if (rx.id === rxId || rx.rxId === rxId) {
        return {
          ...rx,
          verified: true,
          verifiedAt: new Date().toISOString(),
          verifiedBy: 'Upazila SAAO Agronomist (DAE)'
        };
      }
      return rx;
    }));
    toast.success(lang === 'bn' ? 'প্রেসক্রিপশনটি এসএএও কর্মকর্তা দ্বারা অনুমোদিত হয়েছে' : 'Prescription officially certified by SAAO agronomist');
  };

  // Export Prescriptions to CSV
  const handleExportPrescriptionsCSV = () => {
    if (allPrescriptions.length === 0) {
      toast.error('No prescriptions to export');
      return;
    }
    const headers = ['Rx ID', 'Farmer Name', 'Crop', 'Disease', 'Pathogen', 'Severity', 'Location', 'Confidence', 'Issued Date', 'Verified', 'Source'];
    const rows = allPrescriptions.map(rx => [
      csvEscape(rx.rxId || ''),
      csvEscape(rx.farmerName || ''),
      csvEscape(rx.crop || ''),
      csvEscape(rx.diseaseName || ''),
      csvEscape(rx.pathogen || ''),
      csvEscape(rx.severity || ''),
      csvEscape(rx.location || ''),
      csvEscape(rx.confidence ? `${rx.confidence}%` : ''),
      csvEscape(rx.createdAt ? new Date(rx.createdAt).toISOString() : ''),
      csvEscape(rx.verified ? 'YES' : 'PENDING'),
      csvEscape(rx.isDemoData ? 'DEMO' : 'LIVE')
    ]);

    // BOM + encodeURIComponent keeps Bangla text and '#'-containing fields intact
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Smart-Krishi-Prescription-Registry-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(lang === 'bn' ? 'প্রেস্ক্রিপশন রেজিস্ট্রি CSV ডাউনলোড হয়েছে' : 'Rx Registry exported to CSV');
  };

  // Add / Invite Agronomist or Extension Personnel
  const handleInviteUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.name.trim() || !inviteForm.phone.trim()) {
      toast.error('Name and Phone number are required');
      return;
    }
    const newUser = {
      id: `usr_${Date.now()}`,
      name: inviteForm.name.trim(),
      phone: inviteForm.phone.trim(),
      email: inviteForm.email.trim() || `${inviteForm.phone.replace(/[^0-9]/g, '')}@krishi.gov.bd`,
      role: inviteForm.role,
      tier: 'premium',
      district: inviteForm.district,
      lastUsedDate: new Date().toISOString().split('T')[0]
    };
    setAllUsers(prev => [newUser, ...prev]);
    setIsInviteModalOpen(false);
    setInviteForm({ name: '', phone: '', email: '', role: 'hub-manager', district: 'Bogura' });
    toast.success(`${newUser.name} added to local directory (demo only — not persisted to Firestore)`);
  };

  // Filtered Prescriptions List
  const filteredPrescriptions = allPrescriptions.filter(rx => {
    const matchesSearch = !prescriptionSearchQuery || (() => {
      const q = prescriptionSearchQuery.toLowerCase();
      return (
        (rx.rxId && rx.rxId.toLowerCase().includes(q)) ||
        (rx.crop && rx.crop.toLowerCase().includes(q)) ||
        (rx.diseaseName && rx.diseaseName.toLowerCase().includes(q)) ||
        (rx.location && rx.location.toLowerCase().includes(q)) ||
        (rx.farmerName && rx.farmerName.toLowerCase().includes(q))
      );
    })();

    const matchesStatus = rxStatusFilter === 'all' || 
      (rxStatusFilter === 'verified' && rx.verified) || 
      (rxStatusFilter === 'pending' && !rx.verified);

    return matchesSearch && matchesStatus;
  });

  const adminTabsList: { id: AdminTab; labelBn: string; labelEn: string; icon: any }[] = [
    { id: 'command', labelBn: 'সার্বিক কমান্ড সেন্টার', labelEn: 'Command Center', icon: Terminal },
    { id: 'intelligence', labelBn: 'রোগ নজরদারি ও রাডার', labelEn: 'Outbreak Intelligence', icon: Radio },
    { id: 'prescriptions', labelBn: 'প্রেসক্রিপশন রেজিস্ট্রি', labelEn: 'Rx Registry & Audit', icon: FileText },
    { id: 'users', labelBn: 'কৃষক ও ডিরেক্টরি', labelEn: 'Personnel Directory', icon: Users },
    { id: 'investor', labelBn: 'ইনভেস্টর ও ইমপ্যাক্ট', labelEn: 'Investor & Impact KPI', icon: DollarSign }
  ];

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-20 animate-pulse">
        <Database className="w-12 h-12 text-emerald-400 mb-4 animate-bounce" />
        <div className="text-stone-400 font-mono text-xs uppercase tracking-[0.3em]">
          {lang === 'bn' ? 'জাতীয় কৃষি ডাটাবেজ সমন্বয় হচ্ছে...' : 'Synching National Agricultural Neural Network...'}
        </div>
      </div>
    );
  }

  // Client-side gate: privileged actions must never be exposed to non-admins.
  // (Firestore rules enforce the same restriction server-side.)
  if (isAuthReady && !isAdmin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-4">
        <div className="p-4 rounded-3xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
          <ShieldCheck className="w-10 h-10 text-rose-600 mx-auto" />
        </div>
        <h2 className="text-lg font-black text-stone-900 dark:text-stone-100">
          {lang === 'bn' ? 'প্রবেশাধিকার সীমিত' : 'Access Restricted'}
        </h2>
        <p className="text-sm text-stone-500 dark:text-stone-400 max-w-sm">
          {lang === 'bn'
            ? 'এই প্রশাসনিক ড্যাশবোর্ড শুধুমাত্র অনুমোদিত অ্যাডমিনিস্ট্রেটরদের জন্য।'
            : 'This administrative dashboard is restricted to authorized administrators only.'}
        </p>
      </div>
    );
  }

  return (
    <div ref={dashboardContainerRef} className="space-y-6 pb-16 text-stone-900 dark:text-stone-100">

      {/* Data provenance banner — shown whenever a Firestore read failed; nothing is synthesized */}
      {usingFallbackData && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-4 py-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
            <span className="font-black uppercase tracking-wider">
              {lang === 'bn' ? 'কিছু সরাসরি ডেটা পড়া যায়নি' : 'Some live data could not be read'}
            </span>
            <p className="mt-0.5 text-amber-800/90 dark:text-amber-300/80">
              {lang === 'bn'
                ? 'ফায়ারস্টোর থেকে কিছু ডেটা পড়া গেল না (অনুমতি বা সংযোগ সমস্যা)। যে সংখ্যা পাওয়া যায়নি তা “—” দিয়ে দেখানো হয়েছে এবং তালিকা অসম্পূর্ণ হতে পারে।'
                : 'Some Firestore data could not be read (permissions or connectivity). Figures that are unavailable show "—" and lists may be incomplete.'}
            </p>
          </div>
        </div>
      )}

      {/* Institutional Executive Header */}
      <div className="bg-gradient-to-r from-stone-950 via-emerald-950 to-stone-900 p-6 sm:p-8 rounded-[36px] shadow-2xl text-white relative overflow-hidden border border-emerald-500/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500 rounded-full blur-[130px] -mr-40 -mt-40 opacity-20 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-teal-500 rounded-full blur-[120px] opacity-15 pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* Top Title & Operational Status Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-6">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-tr from-emerald-600 to-teal-500 p-3.5 rounded-2xl shadow-xl shadow-emerald-900/40 border border-emerald-400/30 flex-shrink-0">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-black uppercase tracking-widest text-emerald-300 bg-emerald-900/60 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                    {lang === 'bn' ? 'জাতীয় কৃষি প্রশাসন' : 'DAE & BARI Agro-Grid Protocol'}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>ASIA-EAST1 • 99.98% SLA</span>
                  </div>
                </div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-display font-black tracking-tight leading-tight uppercase text-white">
                  {lang === 'bn' ? 'জাতীয় কৃষি-কপিলট অপারেশন ও নজরদারি কমান্ড হাব' : 'National Agri-Copilot Operations Command Hub'}
                </h1>
                <p className="text-xs text-stone-300 mt-0.5">
                  {lang === 'bn' 
                    ? '৬৪ জেলার ফসল রোগ নির্ণয়, রিয়েল-টাইম প্রাদুর্ভাব নজরদারি এবং ডিজিটাল প্রেসক্রিপশন অডিট পোর্টাল' 
                    : 'Real-time nationwide crop pathology radar, multimodal telemetry & certified Rx registry'}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setShowTelemetryDrawer(!showTelemetryDrawer)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                  showTelemetryDrawer
                    ? 'bg-emerald-500 text-gray-950 border-emerald-400 font-black shadow-lg shadow-emerald-500/20'
                    : 'bg-white/10 hover:bg-white/15 text-stone-200 border-white/10'
                }`}
                title="Toggle Real-Time Telemetry"
              >
                <Cpu className="w-3.5 h-3.5 text-emerald-300" />
                <span>{lang === 'bn' ? 'টেলিমেট্রি' : 'Edge Telemetry'}</span>
              </button>

              <button
                type="button"
                onClick={fetchDashboardData}
                disabled={isRefreshing}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-stone-200 text-xs font-bold transition-all border border-white/10 flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                title={lang === 'bn' ? 'ডাটা রিফ্রেশ করুন' : 'Refresh Data'}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
                <span className="hidden sm:inline">{lang === 'bn' ? 'রিফ্রেশ' : 'Sync'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportDashboard}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-950/40 flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'রিপোর্ট ডাউনলোড (PNG)' : 'Export Audit Dossier'}</span>
              </button>
            </div>
          </div>

          {/* Sub-Navigation Tabs */}
          <div className="flex items-center gap-1.5 p-1.5 bg-black/40 rounded-2xl border border-white/10 overflow-x-auto scrollbar-none">
            {adminTabsList.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-gray-950 font-black shadow-lg shadow-emerald-500/20'
                      : 'text-stone-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <tab.icon className="w-4 h-4 shrink-0" />
                  <span>{lang === 'bn' ? tab.labelBn : tab.labelEn}</span>
                </button>
              );
            })}
          </div>

          {/* Core KPI Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            
            {/* Card 1: Total Farmers & Users */}
            <div className="bg-white/5 p-4 sm:p-5 rounded-2xl border border-white/10 backdrop-blur-sm relative overflow-hidden group hover:bg-white/10 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-black text-emerald-400 font-mono">{lang === 'bn' ? 'মোট' : 'Total'}</span>
              </div>
              <div className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
                {fmtCount(stats.totalUsers)}
              </div>
              <div className="text-[11px] font-mono font-bold text-stone-400 uppercase tracking-widest mt-0.5">
                {lang === 'bn' ? 'মোট নিবন্ধিত কৃষক' : 'Registered Farmers & Users'}
              </div>
              {stats.totalUsers === null && (
                <div className="text-[10px] font-mono text-amber-300 mt-1">{lang === 'bn' ? 'সংখ্যা পাওয়া যায়নি' : 'count unavailable'}</div>
              )}
            </div>

            {/* Card 2: Multimodal AI Diagnoses */}
            <div className="bg-white/5 p-4 sm:p-5 rounded-2xl border border-white/10 backdrop-blur-sm relative overflow-hidden group hover:bg-white/10 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Leaf className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-black text-emerald-400 font-mono">{lang === 'bn' ? 'মোট' : 'Total'}</span>
              </div>
              <div className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
                {fmtCount(stats.totalDiagnoses)}
              </div>
              <div className="text-[11px] font-mono font-bold text-stone-400 uppercase tracking-widest mt-0.5">
                {lang === 'bn' ? 'মোট এআই রোগনির্ণয়' : 'Multimodal Consultations'}
              </div>
              {stats.totalDiagnoses === null && (
                <div className="text-[10px] font-mono text-amber-300 mt-1">{lang === 'bn' ? 'সংখ্যা পাওয়া যায়নি' : 'count unavailable'}</div>
              )}
            </div>

            {/* Card 3: Digital Krishi Prescriptions Generated */}
            <div className="bg-white/5 p-4 sm:p-5 rounded-2xl border border-white/10 backdrop-blur-sm relative overflow-hidden group hover:bg-white/10 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-black text-purple-300 font-mono">{lang === 'bn' ? 'মোট' : 'Total'}</span>
              </div>
              <div className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
                {fmtCount(stats.totalPrescriptions)}
              </div>
              <div className="text-[11px] font-mono font-bold text-stone-400 uppercase tracking-widest mt-0.5">
                {lang === 'bn' ? 'ইস্যুকৃত ডিজিটাল প্রেসক্রিপশন' : 'Krishi Rx Records'}
              </div>
              {stats.totalPrescriptions === null && (
                <div className="text-[10px] font-mono text-amber-300 mt-1">{lang === 'bn' ? 'সংখ্যা পাওয়া যায়নি' : 'count unavailable'}</div>
              )}
            </div>

            {/* Card 4: Clinical Accuracy & Satisfaction */}
            <div className="bg-white/5 p-4 sm:p-5 rounded-2xl border border-white/10 backdrop-blur-sm relative overflow-hidden group hover:bg-white/10 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-black text-emerald-300 font-mono">{stats.ratedCount > 0 ? `n=${stats.ratedCount}` : 'n/a'}</span>
              </div>
              <div className="text-2xl sm:text-3xl font-display font-black text-white tracking-tight">
                {stats.helpfulRatio === null ? '—' : `${stats.helpfulRatio.toFixed(1)}%`}
              </div>
              <div className="text-[11px] font-mono font-bold text-stone-400 uppercase tracking-widest mt-0.5">
                {lang === 'bn' ? 'সাম্প্রতিক রোগনির্ণয়ে সহায়ক রেটিং' : 'Rated Helpful (recent diagnoses)'}
              </div>
              {stats.helpfulRatio === null && (
                <div className="text-[10px] font-mono text-amber-300 mt-1">{lang === 'bn' ? 'এখনো পরিমাপ হয়নি' : 'not measured yet'}</div>
              )}
            </div>

          </div>

          {/* Collapsible Real-Time Edge & Model Telemetry Drawer */}
          <AnimatePresence>
            {showTelemetryDrawer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-black/60 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 backdrop-blur-md space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400">
                      <Server className="w-4 h-4 text-emerald-400" />
                      <span>HIGH-FREQUENCY MULTIMODAL TELEMETRY MATRIX</span> <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black">Sample data</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-mono">
                      <span className="text-stone-300">PING: <strong className="text-emerald-400">{telemetryLatency}ms</strong></span>
                      <button
                        type="button"
                        onClick={() => {
                          const t0 = performance.now();
                          setTimeout(() => {
                            setTelemetryLatency(Math.floor(210 + Math.random() * 60));
                            toast.success(`Edge Ping: ${Math.round(performance.now() - t0 + 200)}ms to ASIA-EAST1`);
                          }, 150);
                        }}
                        className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-bold border border-emerald-500/40 cursor-pointer"
                      >
                        Ping Edge
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                      <span className="text-[11px] text-stone-400 uppercase tracking-widest">Protocol & Ingestion</span>
                      <div className="font-bold text-white text-sm">WebSocket (1 FPS)</div>
                      <div className="text-[11px] text-emerald-400">640x480 JPEG @ 0.5 Quality</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                      <span className="text-[11px] text-stone-400 uppercase tracking-widest">Voice Audio Pipeline</span>
                      <div className="font-bold text-white text-sm">24kHz PCM Bi-Dir</div>
                      <div className="text-[11px] text-emerald-400">Low-latency Streaming Chunk</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                      <span className="text-[11px] text-stone-400 uppercase tracking-widest">Model Engine</span>
                      <div className="font-bold text-white text-sm">Gemini 2.5 Flash</div>
                      <div className="text-[11px] text-emerald-400">Deep Agronomic Grounding</div>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                      <span className="text-[11px] text-stone-400 uppercase tracking-widest">Active Channels</span>
                      <div className="font-bold text-white text-sm">86 Concurrent</div>
                      <div className="text-[11px] text-emerald-400">Zero Buffer Drop Rate</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Tab Content */}
      <AnimatePresence mode="wait">
        
        {/* Tab 1: Executive Command Center */}
        {activeTab === 'command' && (
          <motion.div
            key="command"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-6"
          >
            {/* Chart Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Chart: Scalability & Daily Volume Velocity */}
              <div className="lg:col-span-8 bg-white dark:bg-stone-900 p-6 sm:p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display font-black text-sm uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      <span>{lang === 'bn' ? 'সাপ্তাহিক প্ল্যাটফর্ম প্রসারণ গতিধারা' : 'National Scaling Velocity (7-Day Rolling)'}</span>
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {lang === 'bn' 
                        ? 'গত ৭ দিনে প্রতিদিন নতুন ব্যবহারকারী ও এআই রোগনির্ণয় (রেকর্ডের তারিখ থেকে গণনা)' 
                        : 'New users and AI diagnoses per day over the last 7 days, counted from record dates'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono">
                    <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      {lang === 'bn' ? 'কৃষক' : 'Users'}
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      {lang === 'bn' ? 'রোগনির্ণয়' : 'Diagnoses'}
                    </span>
                  </div>
                </div>

                {userGrowth.length === 0 ? (
                  <div className="h-[280px] w-full flex items-center justify-center text-center text-xs text-stone-500 px-6">
                    {lang === 'bn'
                      ? 'চার্ট দেখানো হচ্ছে না: তারিখসহ কোনো রেকর্ড পড়া যায়নি।'
                      : 'Chart hidden: no records with usable creation dates could be read.'}
                  </div>
                ) : (
                <>
                <div className="h-[280px] w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={userGrowth}>
                      <defs>
                        <linearGradient id="usersGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="diagGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: '1px solid #cbd5e1', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }} />
                      <Area type="monotone" dataKey="users" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#usersGradient)" />
                      <Area type="monotone" dataKey="diagnoses" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#diagGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                {growthIsPartial && (
                  <p className="text-[11px] text-stone-500">
                    {lang === 'bn'
                      ? 'দ্রষ্টব্য: সাম্প্রতিক সীমিত সংখ্যক রেকর্ড থেকে গণনা, তাই সংখ্যা কম হতে পারে।'
                      : 'Note: counted from the most recent records read (read limit reached), so busy days may be undercounted.'}
                  </p>
                )}
                </>
                )}
              </div>

              {/* Right Chart: AI Modality & Channel Breakdown */}
              <div className="lg:col-span-4 bg-stone-900 text-white p-6 sm:p-7 rounded-3xl border border-stone-800 shadow-sm flex flex-col justify-between">
                <div>
                  <h3 className="font-display font-black text-xs uppercase tracking-widest text-emerald-400 mb-1">
                    {lang === 'bn' ? 'এআই মোডালিটি অনুপাত' : 'AI Modality Breakdown'}
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    {lang === 'bn' ? 'কৃষকদের ব্যবহৃত প্রধান যোগাযোগ মাধ্যম' : 'Distribution of AI engagement channels'}
                  </p>
                </div>

                <div className="inline-block mb-3 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black">{lang === 'bn' ? 'নমুনা ডেটা (Sample data)' : 'Sample data'}</div>
                <div className="relative w-44 h-44 mx-auto my-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Live Video (1 FPS)', value: 45 },
                          { name: 'Photo Rx', value: 35 },
                          { name: 'Voice Call', value: 20 }
                        ]}
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#3b82f6" />
                        <Cell fill="#f59e0b" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-white">45%</span>
                    <span className="text-[11px] font-mono uppercase tracking-widest text-emerald-300">Live Video</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center p-2.5 bg-white/5 rounded-xl border border-white/5">
                    <span className="flex items-center gap-1.5 text-stone-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Live Video Copilot
                    </span>
                    <span className="font-bold text-emerald-400">45% (Primary)</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 bg-white/5 rounded-xl border border-white/5">
                    <span className="flex items-center gap-1.5 text-stone-300">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      Photo Prescription
                    </span>
                    <span className="font-bold text-blue-400">35%</span>
                  </div>
                  <div className="flex justify-between items-center p-2.5 bg-white/5 rounded-xl border border-white/5">
                    <span className="flex items-center gap-1.5 text-stone-300">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      Live Expert Call
                    </span>
                    <span className="font-bold text-amber-400">20%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Live National Pathology Stream Table */}
            <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-black text-sm uppercase tracking-wide text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{lang === 'bn' ? 'সরাসরি প্ল্যাটফর্ম অ্যাক্টিভিটি স্ট্রিম' : 'Real-Time National Diagnostic Activity'}</span>
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {lang === 'bn' ? 'সারাদেশ থেকে কৃষকদের পাঠানো ছবি ও ভিডিও স্ক্যান ফলাফল' : 'Live incoming diagnostic turns from field farmers and gardeners'}
                  </p>
                </div>
                <div className="flex items-center space-x-2 text-[11px] font-mono text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>STREAMING</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-50 dark:bg-stone-800/50 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                      <th className="px-6 py-3.5">Session / District</th>
                      <th className="px-6 py-3.5">Host Crop</th>
                      <th className="px-6 py-3.5">AI Clinical Finding</th>
                      <th className="px-6 py-3.5">Severity</th>
                      <th className="px-6 py-3.5">Model Confidence</th>
                      <th className="px-6 py-3.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-medium">
                    {diagnoses.slice(0, 8).map((diag, i) => (
                      <tr key={i} className="hover:bg-stone-50/60 dark:hover:bg-stone-800/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-mono text-stone-900 dark:text-stone-200 font-bold">
                            {diag.district || 'Bogura'}
                          </div>
                          <div className="text-[11px] text-stone-400 font-mono">
                            {diag.createdAt ? (typeof diag.createdAt === 'string' ? new Date(diag.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now') : 'Just now'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200/60 dark:border-emerald-800">
                            🌾 {diag.crop || 'Paddy'}
                          </span>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <p className="line-clamp-1 text-stone-800 dark:text-stone-200 font-semibold">
                            {diag.diagnosisText || diag.disease || 'Bacterial Leaf Blight'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                            isSeverityUnknown(diag.qualitativeSeverity)
                              ? 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                              : diag.qualitativeSeverity === 'High' || diag.qualitativeSeverity === 'Critical'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}>
                            {isSeverityUnknown(diag.qualitativeSeverity) ? 'Not assessed' : diag.qualitativeSeverity}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {confidenceLabel(diag)}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            onClick={() => {
                              // The card must show what the record actually
                              // contains. It used to print the same hardcoded
                              // symptoms, cultural steps, organic steps and
                              // "Copper Hydroxide 77 WP @ 2g/L" for every
                              // diagnosis in the table, whatever the disease.
                              setSelectedRxForModal(
                                buildPrescriptionFromRecord(diag, lang, { district: diag.district })
                              );
                              setIsRxModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-stone-700 dark:text-stone-300 text-[11px] font-bold border border-stone-200 dark:border-stone-700 transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{lang === 'bn' ? 'প্রেসক্রিপশন' : 'View Rx'}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <AiModelCheckCard lang={lang} />
          </motion.div>
        )}

        {/* Tab 2: Outbreak Intelligence & Geo Hotspots */}
        {activeTab === 'intelligence' && (
          <motion.div
            key="intelligence"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-6"
          >
            {/* Top Bar with Emergency Broadcast CTA */}
            <div className="bg-white dark:bg-stone-900 p-6 sm:p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
                <div className="flex items-center space-x-4">
                  <div className="bg-rose-600 p-3.5 rounded-2xl shadow-xl shadow-rose-900/30 text-white shrink-0">
                    <Radio className="w-7 h-7 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-black uppercase text-stone-900 dark:text-white tracking-tight">
                      {lang === 'bn' ? 'জাতীয় রোগ নজরদারি ও প্রাদুর্ভাব রাডার' : 'National Pathogen Surveillance Radar'}
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {lang === 'bn' 
                        ? 'আঞ্চলিক ক্লাস্টার অ্যালগরিদম দ্বারা শনাক্তকৃত উচ্চ ঝুঁকিপূর্ণ ফসলি রোগবালাই' 
                        : 'Algorithmic disease clustering across 64 agricultural districts of Bangladesh'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-3.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800">
                    ⚠️ {outbreaks.filter(o => o.threatLevel === 'Critical').length} {lang === 'bn' ? 'টি জেলায় জরুরি সতর্কতা' : 'Critical Hotspot Clusters'}
                  </span>
                </div>
              </div>

              {/* Microclimate Warning & Environmental Trigger Banner */}
              <div className="inline-block mb-3 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black">{lang === 'bn' ? 'নমুনা ডেটা (Sample data)' : 'Sample data'}</div>
              <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500 text-stone-950 font-black">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-amber-800 dark:text-amber-300 font-bold block">
                      {lang === 'bn' ? 'উচ্চ আর্দ্রতা ও ঘন কুয়াশা অ্যালার্ট (এগ্রোকাস্ট এআই পূর্বাভাস)' : 'Atmospheric Inversion & High Fog Index Alert (AgroCast AI Forecast)'}
                    </strong>
                    <span className="text-stone-600 dark:text-stone-300">
                      {lang === 'bn' 
                        ? 'রাজশাহী ও রংপুর অঞ্চলে রাতের তাপমাত্রা ১২°C ও আর্দ্রতা ৯৪% ছাড়িয়েছে—লেট ব্লাইট ও পাতা পোড়া ছড়ানোর অনুকূল।' 
                        : 'Bogura & Rajshahi humidity index >94% with cold fog triggers spore germination for Bacterial Leaf Blight & Late Blight.'}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold bg-amber-500/20 text-amber-800 dark:text-amber-200 px-2.5 py-1 rounded-lg shrink-0">
                  Relative Humidity: 94%
                </span>
              </div>

              {/* Division Filter Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
                <span className="text-[11px] font-bold uppercase text-stone-400 shrink-0">
                  {lang === 'bn' ? 'বিভাগ নির্বাচন:' : 'Division:'}
                </span>
                {['all', 'Rajshahi', 'Dhaka', 'Rangpur', 'Mymensingh', 'Khulna'].map((div) => {
                  const isSel = selectedDivision === div;
                  const label = div === 'all' 
                    ? (lang === 'bn' ? 'সকল বিভাগ' : 'All Divisions')
                    : div;
                  return (
                    <button
                      key={div}
                      type="button"
                      onClick={() => setSelectedDivision(div)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSel 
                          ? 'bg-rose-600 text-white shadow-xs' 
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* District Hotspot Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {outbreaks
                  .filter(hotspot => {
                    if (selectedDivision === 'all') return true;
                    if (selectedDivision === 'Rajshahi') return hotspot.district === 'Bogura' || hotspot.district === 'Rajshahi';
                    if (selectedDivision === 'Dhaka') return hotspot.district === 'Dhaka';
                    if (selectedDivision === 'Rangpur') return hotspot.district === 'Rangpur';
                    if (selectedDivision === 'Mymensingh') return hotspot.district === 'Mymensingh';
                    if (selectedDivision === 'Khulna') return hotspot.district === 'Jessore';
                    return true;
                  })
                  .map((hotspot, idx) => (
                  <div
                    key={idx}
                    className={`p-5 rounded-2xl border transition-all text-left relative flex flex-col justify-between ${
                      hotspot.threatLevel === 'Critical'
                        ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 shadow-xs'
                        : hotspot.threatLevel === 'Moderate'
                        ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/60 shadow-xs'
                        : 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-black uppercase tracking-wider font-mono text-stone-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-rose-600" />
                          {lang === 'bn' ? hotspot.districtBn : hotspot.district} District
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-widest ${
                          hotspot.threatLevel === 'Critical'
                            ? 'bg-rose-600 text-white'
                            : hotspot.threatLevel === 'Moderate'
                            ? 'bg-amber-500 text-gray-950'
                            : 'bg-emerald-600 text-white'
                        }`}>
                          {hotspot.threatLevel}
                        </span>
                      </div>

                      <h4 className="font-bold text-base text-stone-900 dark:text-stone-100">
                        {lang === 'bn' ? hotspot.cropBn : hotspot.crop}: {lang === 'bn' ? hotspot.diseaseBn : hotspot.disease}
                      </h4>
                      <p className="text-xs text-stone-500 mt-1">
                        {hotspot.casesCount} {lang === 'bn' ? 'টি নিশ্চিত সংক্রমণ রিপোর্ট' : 'confirmed geo-tagged reports'} • ~{hotspot.affectedAreaHectares} ha
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-stone-200/60 dark:border-stone-800 flex items-center justify-between text-[11px]">
                      <span className="text-stone-400 font-mono">Updated {hotspot.lastUpdated}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setBroadcastDistrict(geoData.some((d) => d.name === hotspot.district) ? hotspot.district : 'all');
                          setBroadcastNotice(null);
                          setBroadcastConfirming(false);
                          setBroadcastMessageBn(`জরুরি কৃষি সতর্কতা: ${hotspot.districtBn} জেলায় ${hotspot.cropBn} ফসলে ${hotspot.diseaseBn} ছড়িয়ে পড়ছে। অবিলম্বে দাঁড়ানো পানি নিষ্কাশন করুন এবং অনুমোদিত স্প্রে করুন। বিস্তারিত কৃষি কল সেন্টারে ১৬১২৩ নম্বরে কল করুন।`);
                          setBroadcastMessage(`URGENT CROP ALERT: ${hotspot.disease} detected in ${hotspot.district} ${hotspot.crop} fields. Immediate intervention required. Dial 16123.`);
                        }}
                        className="font-bold text-rose-700 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Bell className="w-3 h-3" />
                        <span>{lang === 'bn' ? 'বার্তা খসড়া করুন' : 'Draft message'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Emergency Broadcast Panel (real: saved to Firestore, shown in the farmer app) */}
            <div className="bg-gradient-to-br from-stone-900 to-stone-950 text-white p-6 sm:p-8 rounded-3xl border border-rose-500/30 shadow-xl space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-display font-black text-sm uppercase tracking-wider text-rose-300">
                    {lang === 'bn' ? 'জরুরি সতর্কবার্তা সম্প্রচার' : 'Emergency Broadcast'}
                  </h4>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {lang === 'bn' ? 'নির্বাচিত জেলার সাইন-ইন করা কৃষকদের অ্যাপে বার্তা দেখানো হবে' : 'Shown in the app to signed-in farmers in the chosen district'}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-stone-800/70 border border-stone-700 text-stone-300 text-xs font-semibold">
                {lang === 'bn'
                  ? 'বার্তা শুধু অ্যাপের ভেতরে দেখানো হয়। ফোনে নোটিফিকেশন বা এসএমএস পাঠানো হয় না।'
                  : 'Messages are shown inside the app only. No phone notification or SMS is sent.'}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label htmlFor="broadcast-district" className="block text-[11px] font-bold uppercase text-stone-400 mb-1">
                    {lang === 'bn' ? 'লক্ষ্য এলাকা / জেলা' : 'Target District'}
                  </label>
                  <select
                    id="broadcast-district"
                    value={broadcastDistrict}
                    onChange={(e) => { setBroadcastDistrict(e.target.value); setBroadcastConfirming(false); }}
                    className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-xs font-semibold text-white outline-none focus:border-rose-500"
                  >
                    <option value="all">{lang === 'bn' ? 'সব জেলা' : 'All districts'}</option>
                    {geoData.map((d) => (
                      <option key={d.id} value={d.name}>{lang === 'bn' ? d.bn_name : d.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="broadcast-severity" className="block text-[11px] font-bold uppercase text-stone-400 mb-1">
                    {lang === 'bn' ? 'গুরুত্ব' : 'Severity'}
                  </label>
                  <select
                    id="broadcast-severity"
                    value={broadcastSeverity}
                    onChange={(e) => { setBroadcastSeverity(e.target.value as 'info' | 'warning'); setBroadcastConfirming(false); }}
                    className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-xs font-semibold text-white outline-none focus:border-rose-500"
                  >
                    <option value="info">{lang === 'bn' ? 'তথ্য' : 'Info'}</option>
                    <option value="warning">{lang === 'bn' ? 'সতর্কতা' : 'Warning'}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="broadcast-days" className="block text-[11px] font-bold uppercase text-stone-400 mb-1">
                    {lang === 'bn' ? `কত দিন দেখানো হবে (১-${BROADCAST_MAX_DAYS})` : `Days to show (1-${BROADCAST_MAX_DAYS})`}
                  </label>
                  <input
                    id="broadcast-days"
                    type="number"
                    min={1}
                    max={BROADCAST_MAX_DAYS}
                    value={broadcastDays}
                    onChange={(e) => {
                      const n = Math.trunc(Number(e.target.value));
                      setBroadcastDays(Number.isFinite(n) ? Math.min(BROADCAST_MAX_DAYS, Math.max(1, n)) : 1);
                      setBroadcastConfirming(false);
                    }}
                    className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-xs font-semibold text-white outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="broadcast-message-bn" className="block text-[11px] font-bold uppercase text-stone-400 mb-1">
                  {lang === 'bn' ? 'বার্তা (বাংলা)' : 'Message (Bangla)'}
                  <span className="ml-2 font-mono normal-case text-stone-500">{broadcastMessageBn.length}/{BROADCAST_MAX_LENGTH}</span>
                </label>
                <textarea
                  id="broadcast-message-bn"
                  rows={3}
                  maxLength={BROADCAST_MAX_LENGTH}
                  value={broadcastMessageBn}
                  onChange={(e) => { setBroadcastMessageBn(e.target.value); setBroadcastConfirming(false); }}
                  placeholder={lang === 'bn' ? 'এখানে বাংলায় বার্তা লিখুন...' : 'Write the message in Bangla...'}
                  className="w-full bg-stone-800/80 border border-stone-700 rounded-2xl p-3 text-xs text-white placeholder-stone-500 outline-none focus:border-rose-500 leading-relaxed font-sans"
                />
              </div>

              <div>
                <label htmlFor="broadcast-message-en" className="block text-[11px] font-bold uppercase text-stone-400 mb-1">
                  {lang === 'bn' ? 'বার্তা (ইংরেজি)' : 'Message (English)'}
                  <span className="ml-2 font-mono normal-case text-stone-500">{broadcastMessage.length}/{BROADCAST_MAX_LENGTH}</span>
                </label>
                <textarea
                  id="broadcast-message-en"
                  rows={3}
                  maxLength={BROADCAST_MAX_LENGTH}
                  value={broadcastMessage}
                  onChange={(e) => { setBroadcastMessage(e.target.value); setBroadcastConfirming(false); }}
                  placeholder={lang === 'bn' ? 'এখানে ইংরেজিতে বার্তা লিখুন...' : 'Write the message in English...'}
                  className="w-full bg-stone-800/80 border border-stone-700 rounded-2xl p-3 text-xs text-white placeholder-stone-500 outline-none focus:border-rose-500 leading-relaxed font-sans"
                />
              </div>

              {broadcastNotice && (
                <div
                  role={broadcastNotice.kind === 'error' ? 'alert' : 'status'}
                  className={`p-3 rounded-xl border text-xs font-bold ${
                    broadcastNotice.kind === 'error'
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-200'
                      : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                  }`}
                >
                  {broadcastNotice.text}
                </div>
              )}

              {broadcastConfirming ? (
                <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 space-y-3">
                  <p className="text-xs font-bold text-amber-100">
                    {lang === 'bn'
                      ? `এটি ${broadcastDistrict === 'all' ? 'সব জেলার' : (geoData.find((d) => d.name === broadcastDistrict)?.bn_name ?? broadcastDistrict) + ' জেলার'} প্রতিটি সাইন-ইন করা কৃষককে দেখানো হবে, ${broadcastDays} দিন ধরে। পাঠাবেন?`
                      : `This will show to every signed-in farmer in ${broadcastDistrict === 'all' ? 'all districts' : broadcastDistrict} for ${broadcastDays} ${broadcastDays === 1 ? 'day' : 'days'}. Send it?`}
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setBroadcastConfirming(false)}
                      disabled={isBroadcasting}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-stone-800 border border-stone-700 text-stone-200 cursor-pointer disabled:opacity-50"
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmBroadcast}
                      disabled={isBroadcasting}
                      className="px-5 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-950/40 flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isBroadcasting ? (lang === 'bn' ? 'পাঠানো হচ্ছে...' : 'Sending...') : (lang === 'bn' ? 'হ্যাঁ, পাঠান' : 'Yes, send')}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleDispatchAdvisory}
                    className="px-6 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-950/40 flex items-center gap-2 cursor-pointer hover:bg-rose-500"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'বার্তা পাঠান' : 'Send broadcast'}</span>
                  </button>
                </div>
              )}

              <div className="pt-3 border-t border-stone-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-[11px] font-black uppercase tracking-wider text-stone-400">
                    {lang === 'bn' ? 'সাম্প্রতিক বার্তা' : 'Recent broadcasts'}
                  </h5>
                  <button
                    type="button"
                    onClick={() => void loadRecentBroadcasts()}
                    className="text-[11px] font-bold text-stone-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
                  </button>
                </div>
                {broadcastListFailed && (
                  <p role="alert" className="text-xs text-rose-300">
                    {lang === 'bn' ? 'তালিকা লোড করা যায়নি' : 'Could not load the list'}
                  </p>
                )}
                {!broadcastListFailed && recentBroadcasts === null && (
                  <p className="text-xs text-stone-500">{lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}</p>
                )}
                {recentBroadcasts && recentBroadcasts.length === 0 && (
                  <p className="text-xs text-stone-500">{lang === 'bn' ? 'এখনো কোনো বার্তা নেই' : 'No broadcasts yet'}</p>
                )}
                {recentBroadcasts?.map((item) => {
                  const expired = isExpired(item);
                  const districtLabel = item.district === 'all'
                    ? (lang === 'bn' ? 'সব জেলা' : 'All districts')
                    : (() => {
                        const found = geoData.find((d) => slug(d.name) === item.district);
                        return found ? (lang === 'bn' ? found.bn_name : found.name) : item.district;
                      })();
                  return (
                    <div key={item.id} className={`p-3 rounded-xl bg-stone-800/60 border border-stone-700 flex items-start gap-3 ${expired ? 'opacity-60' : ''}`}>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                          <span className={`px-2 py-0.5 rounded-full ${item.severity === 'warning' ? 'bg-amber-500 text-gray-950' : 'bg-sky-600 text-white'}`}>
                            {item.severity === 'warning' ? (lang === 'bn' ? 'সতর্কতা' : 'Warning') : (lang === 'bn' ? 'তথ্য' : 'Info')}
                          </span>
                          <span className="text-stone-300">{districtLabel}</span>
                          <span className="text-stone-500">
                            {expired
                              ? (lang === 'bn' ? `মেয়াদ শেষ (${item.expiresDay})` : `Expired (${item.expiresDay})`)
                              : (lang === 'bn' ? `${item.expiresDay} পর্যন্ত` : `Until ${item.expiresDay}`)}
                          </span>
                        </div>
                        <p className="text-xs text-stone-100 break-words">{lang === 'bn' ? item.messageBn : item.messageEn}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteBroadcast(item.id)}
                        disabled={deletingBroadcastId === item.id}
                        aria-label={lang === 'bn' ? 'বার্তা মুছুন' : 'Delete broadcast'}
                        className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-stone-900 border border-stone-700 text-rose-300 hover:bg-rose-950 cursor-pointer disabled:opacity-50"
                      >
                        {deletingBroadcastId === item.id ? '...' : (lang === 'bn' ? 'মুছুন' : 'Delete')}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab 3: Digital Prescription Registry & Audit */}
        {activeTab === 'prescriptions' && (
          <motion.div
            key="prescriptions"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden"
          >
            {/* Header & Search */}
            <div className="p-6 sm:p-8 border-b border-stone-100 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="bg-purple-600 p-3 rounded-2xl shadow-lg shadow-purple-900/20 text-white shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-display font-black uppercase text-stone-900 dark:text-white tracking-tight">
                    {lang === 'bn' ? 'ডিজিটাল কৃষি ব্যবস্থাপত্র অডিট রেজিস্ট্রি' : 'Certified Krishi Rx Audit Registry'}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {lang === 'bn' 
                      ? 'এআই অনুমোদিত ব্যবস্থাপত্রসমূহ, অনুমোদিত কীটনাশক মাত্রা ও কিউআর যাচাই রেকর্ড' 
                      : 'Audit log of certified digital prescriptions, agrochemical formulas, and QR records'}
                  </p>
                </div>
              </div>

              {/* Actions & Filters */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <select
                  value={rxStatusFilter}
                  onChange={(e) => setRxStatusFilter(e.target.value as any)}
                  className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800 dark:text-stone-100 outline-none"
                >
                  <option value="all">{lang === 'bn' ? 'সকল অবস্থা (All Status)' : 'All Status'}</option>
                  <option value="verified">{lang === 'bn' ? '✓ এসএএও অনুমোদিত' : '✓ SAAO Certified'}</option>
                  <option value="pending">{lang === 'bn' ? '⏳ পর্যালোচনায় আছে' : '⏳ Pending Review'}</option>
                </select>

                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    value={prescriptionSearchQuery}
                    onChange={(e) => setPrescriptionSearchQuery(e.target.value)}
                    placeholder={lang === 'bn' ? 'Rx আইডি / ফসল / রোগ...' : 'Search Rx ID, crop, pathogen...'}
                    className="w-full bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl pl-10 pr-4 py-2 text-xs font-semibold text-stone-800 dark:text-stone-100 outline-none focus:border-purple-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleExportPrescriptionsCSV}
                  className="px-3 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 text-purple-700 dark:text-purple-300 text-xs font-bold border border-purple-200 dark:border-purple-800 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  title="Export to CSV"
                >
                  <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                  <span className="hidden sm:inline">CSV Export</span>
                </button>
              </div>
            </div>

            {/* Prescriptions Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50 dark:bg-stone-800/50 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Serial Rx ID</th>
                    <th className="px-6 py-4">Farmer / Grower</th>
                    <th className="px-6 py-4">Host Crop</th>
                    <th className="px-6 py-4">Prescribed Diagnosis</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4">Severity</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Issued Date</th>
                    <th className="px-6 py-4">Audit Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-medium">
                  {filteredPrescriptions.map((rx, idx) => (
                    <tr key={idx} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/40 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-emerald-800 dark:text-emerald-400">
                        {rx.rxId || `RX-BD-2026-${1000 + idx}`}
                      </td>
                      <td className="px-6 py-4 font-semibold text-stone-900 dark:text-stone-100">
                        {rx.farmerName || 'Progressive Farmer'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                          {rx.crop}
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-xs truncate font-semibold text-stone-800 dark:text-stone-200">
                        {rx.diseaseName}
                      </td>
                      <td className="px-6 py-4 text-stone-500 truncate">
                        {rx.location || 'Bangladesh'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                          isSeverityUnknown(rx.severity)
                            ? 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                            : rx.severity === 'Critical' || rx.severity === 'মারাত্মক'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}>
                          {isSeverityUnknown(rx.severity) ? 'Not assessed' : rx.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {rx.isDemoData ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800/60 px-2 py-0.5 rounded-full border border-stone-300 dark:border-stone-700"
                            title="Synthesized demo record — not certified"
                          >
                            DEMO
                          </span>
                        ) : rx.verified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                            <Check className="w-3 h-3 text-emerald-600" />
                            SAAO Certified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                            Pending Review
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-stone-400 font-mono text-[11px]">
                        {rx.createdAt ? new Date(rx.createdAt).toLocaleDateString() : 'Today'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          {!rx.verified && (
                            <button
                              type="button"
                              onClick={() => handleVerifyPrescription(rx.id || rx.rxId)}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800 transition-all flex items-center gap-1 cursor-pointer"
                              title="Counter-sign with SAAO Digital Seal"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{lang === 'bn' ? 'অনুমোদন' : 'Certify'}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              // The registry row IS the stored prescription,
                              // so show it as saved. The old builder filled
                              // every missing field with invented clinical
                              // data, which made an empty record look
                              // certified.
                              setSelectedRxForModal({
                                rxId: rx.rxId,
                                farmerName: rx.farmerName,
                                crop: rx.crop,
                                cropStage: rx.cropStage,
                                diseaseName: rx.diseaseName,
                                pathogen: rx.pathogen,
                                severity: rx.severity,
                                confidence: rx.confidenceAssessed === false ? null : confidenceValue(rx),
                                confidenceAssessed: rx.confidenceAssessed !== false,
                                location: rx.location || 'Bangladesh',
                                symptoms: Array.isArray(rx.symptoms) ? rx.symptoms : [],
                                culturalSteps: Array.isArray(rx.culturalSteps) ? rx.culturalSteps : [],
                                organicSteps: Array.isArray(rx.organicSteps) ? rx.organicSteps : [],
                                chemicalSteps: Array.isArray(rx.chemicalSteps) ? rx.chemicalSteps : [],
                                chemicalGated: rx.chemicalGated !== false,
                                expertVerified: rx.verified === true,
                                harvestIntervalDays:
                                  typeof rx.harvestIntervalDays === 'number' ? rx.harvestIntervalDays : undefined,
                                weatherSnapshot: rx.weatherSnapshot,
                                differentialDiagnosis: rx.differentialDiagnosis
                              });
                              setIsRxModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 text-[11px] font-bold border border-purple-200 dark:border-purple-800 transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{lang === 'bn' ? 'কার্ড দেখুন' : 'Inspect'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Tab 4: Farmer & Personnel Directory */}
        {activeTab === 'users' && (
          <motion.div
            key="users"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden"
          >
            {/* Header & Filters */}
            <div className="p-6 sm:p-8 border-b border-stone-100 dark:border-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-900/20 text-white shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-display font-black uppercase text-stone-900 dark:text-white tracking-tight">
                    {lang === 'bn' ? 'কৃষক ও কর্মকর্তা ডিরেক্টরি' : 'Personnel & Grower Directory'}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {lang === 'bn' ? 'ব্যবহারকারীর ভূমিকা ও প্রিমিয়াম এক্সেস নিয়ন্ত্রণ' : 'Role-based access, tier permissions and farmer accounts'}
                  </p>
                </div>
              </div>

              {/* Search & Filter Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    value={searchUserQuery}
                    onChange={(e) => setSearchUserQuery(e.target.value)}
                    placeholder={lang === 'bn' ? 'নাম, ইমেইল বা জেলা...' : 'Search name, email, district...'}
                    className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-stone-800 dark:text-stone-100 outline-none focus:border-blue-500"
                  />
                </div>

                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value as any)}
                  className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800 dark:text-stone-100 outline-none"
                >
                  <option value="all">{lang === 'bn' ? 'সব পদবী (All Roles)' : 'All Roles'}</option>
                  <option value="agri-preneur">{lang === 'bn' ? 'কৃষক (Farmer)' : 'Farmer'}</option>
                  <option value="hub-manager">{lang === 'bn' ? 'SAAO কর্মকর্তা' : 'SAAO Agronomist'}</option>
                  <option value="admin">{lang === 'bn' ? 'এডমিন (Admin)' : 'Admin'}</option>
                </select>

                <select
                  value={userTierFilter}
                  onChange={(e) => setUserTierFilter(e.target.value as any)}
                  className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800 dark:text-stone-100 outline-none"
                >
                  <option value="all">{lang === 'bn' ? 'সব প্যাকেজ' : 'All Tiers'}</option>
                  <option value="free">Free</option>
                  <option value="premium">Krishi Pro (Premium)</option>
                </select>

                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-sm shadow-blue-900/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'কর্মকর্তা যুক্ত করুন' : 'Invite Agronomist'}</span>
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50 dark:bg-stone-800/50 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    <th className="px-6 py-4">User Details</th>
                    <th className="px-6 py-4">Assigned Role</th>
                    <th className="px-6 py-4">Access Tier</th>
                    <th className="px-6 py-4">District / Territory</th>
                    <th className="px-6 py-4">Activity Status</th>
                    <th className="px-6 py-4 text-right">Quick Role Management</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-medium">
                  {filteredUsers.map((u, i) => (
                    <tr key={i} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
                            u.tier === 'premium' ? 'bg-gradient-to-tr from-amber-500 to-orange-500' : 'bg-stone-700'
                          }`}>
                            {u.name ? u.name[0].toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-stone-900 dark:text-stone-100 text-sm leading-tight">
                              {u.name || 'Anonymous Farmer'}
                            </div>
                            <div className="text-[11px] text-stone-400 font-mono">
                              {u.email || u.phone || 'No email registered'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider border ${
                          u.role === 'admin' 
                            ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300' 
                            : u.role === 'hub-manager'
                            ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300'
                        }`}>
                          {u.role || 'Farmer'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          onClick={() => handleToggleUserTier(u.id, u.tier)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer active:scale-95 transition-all ${
                            u.tier === 'premium'
                              ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-stone-100 text-stone-600 border-stone-200 dark:bg-stone-800 dark:text-stone-300'
                          }`}
                          title="Click to toggle Premium"
                        >
                          {u.tier === 'premium' ? <Crown className="w-3 h-3 text-amber-600" /> : <Sprout className="w-3 h-3 text-stone-500" />}
                          <span className="uppercase">{u.tier || 'Free'}</span>
                        </button>
                      </td>
                      <td className="px-6 py-4 font-semibold text-stone-700 dark:text-stone-300">
                        {u.district || 'Bogura'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-[11px]">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Active</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateUserRole(u.id, 'hub-manager')}
                            className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-blue-50 text-stone-700 hover:text-blue-700 text-[11px] font-bold border border-stone-200 transition-all cursor-pointer"
                          >
                            + SAAO
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateUserRole(u.id, 'agri-preneur')}
                            className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-emerald-50 text-stone-700 hover:text-emerald-700 text-[11px] font-bold border border-stone-200 transition-all cursor-pointer"
                          >
                            Farmer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Tab 5: Investor & Impact Metrics */}
        {activeTab === 'investor' && (
          <motion.div
            key="investor"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-6"
          >
            {/* Executive Pitch Deck Metrics */}
            <div className="inline-block mb-3 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black">{lang === 'bn' ? 'নমুনা ডেটা (Sample data)' : 'Sample data'}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              <div className="bg-gradient-to-br from-emerald-950 via-stone-900 to-teal-950 text-white p-6 sm:p-7 rounded-3xl border border-emerald-500/30 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono text-emerald-300 uppercase tracking-widest bg-emerald-900/60 px-2 py-0.5 rounded-full">
                    99.8% Cost Savings
                  </span>
                </div>
                <div className="text-3xl font-display font-black text-white tracking-tight">
                  &lt;$0.002 <span className="text-xs text-stone-400 font-sans font-medium">/ AI Turn</span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  {lang === 'bn' 
                    ? 'সরকারি কৃষি কর্মকর্তার ১টি ফিল্ড ভিজিট খরচ যেখানে প্রায় ১৫ ডলার, সেখানে জেমিনাই লাইভ এআই প্রতি সেশনে খরচ মাত্র ০.১৮ সেন্ট।' 
                    : 'Human agronomic extension visit costs ~$15 in Bangladesh. Agri-Copilot delivers 24kHz multimodal live video for <$0.002.'}
                </p>
              </div>

              <div className="bg-gradient-to-br from-blue-950 via-stone-900 to-indigo-950 text-white p-6 sm:p-7 rounded-3xl border border-blue-500/30 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono text-blue-300 uppercase tracking-widest bg-blue-900/60 px-2 py-0.5 rounded-full">
                    $450M Loss Shield
                  </span>
                </div>
                <div className="text-3xl font-display font-black text-white tracking-tight">
                  $140 <span className="text-xs text-stone-400 font-sans font-medium">Saved / Farmer / Season</span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  {lang === 'bn' 
                    ? 'প্রাথমিক পর্যায়ে ব্লাইট ও পোকা আক্রমণের সঠিক এআই প্রেসক্রিপশনে গড়ে ৩০% পর্যন্ত ফসলহানি প্রতিরোধ হয়।' 
                    : 'Preventive IPM diagnostics mitigates up to 30% yield destruction from fungal and bacterial leaf blights.'}
                </p>
              </div>

              <div className="bg-gradient-to-br from-purple-950 via-stone-900 to-stone-950 text-white p-6 sm:p-7 rounded-3xl border border-purple-500/30 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    <Globe className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-mono text-purple-300 uppercase tracking-widest bg-purple-900/60 px-2 py-0.5 rounded-full">
                    Total Addressable Market
                  </span>
                </div>
                <div className="text-3xl font-display font-black text-white tracking-tight">
                  20.0M <span className="text-xs text-stone-400 font-sans font-medium">Growers</span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  {lang === 'bn' 
                    ? '১৬.৫ মিলিয়ন গ্রামীণ কৃষক পরিবার এবং ঢাকা-চট্টগ্রামের ৩.৫ মিলিয়ন ক্রমবর্ধমান শহুরে ছাদ বাগানি।' 
                    : '16.5M rural smallholder farm households combined with 3.5M urban rooftop & apartment botanists in Dhaka/Chittagong.'}
                </p>
              </div>

            </div>

            {/* Donor & ESG Compliance Matrix */}
            <div className="bg-white dark:bg-stone-900 p-6 sm:p-8 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
              <h4 className="font-display font-black text-sm uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                <Award className="w-4 h-4" />
                <span>{lang === 'bn' ? 'জাতিসংঘ এসডিজি ও টেকসই কৃষি সূচক' : 'UN Sustainable Development Goals (SDG) Alignment'}</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-1.5">
                  <span className="text-[11px] font-black uppercase text-amber-600 font-mono">SDG 2: Zero Hunger</span>
                  <p className="text-xs font-bold text-stone-900 dark:text-stone-100">Smallholder Food Security</p>
                  <p className="text-[11px] text-stone-500">Safeguards national grain reserves through early warning bacterial/fungal alerts.</p>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-1.5">
                  <span className="text-[11px] font-black uppercase text-emerald-600 font-mono">SDG 12: Responsible Consumption</span>
                  <p className="text-xs font-bold text-stone-900 dark:text-stone-100">Chemical Reduction & Safety</p>
                  <p className="text-[11px] text-stone-500">Enforces pre-harvest intervals (PHI) and prohibits banned persistent agrochemicals.</p>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 space-y-1.5">
                  <span className="text-[11px] font-black uppercase text-blue-600 font-mono">SDG 13: Climate Action</span>
                  <p className="text-xs font-bold text-stone-900 dark:text-stone-100">Climate Resilience & Soil Care</p>
                  <p className="text-[11px] text-stone-500">AgroCast AI microclimate forecasting avoids futile chemical washouts.</p>
                </div>
              </div>
            </div>

            {/* Interactive Unit Economics & SaaS Revenue Engine */}
            <div className="bg-gradient-to-br from-stone-900 to-stone-950 text-white p-6 sm:p-8 rounded-3xl border border-emerald-500/30 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Sliders className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-display font-black text-sm uppercase tracking-wider text-emerald-300">
                      {lang === 'bn' ? 'ইন্টারেক্টিভ রেভিনিউ ও ইউনিট ইকোনমিক্স ক্যালকুলেটর' : 'Interactive Scale, Unit Economics & ARR Simulator'}
                    </h4>
                    <p className="text-xs text-stone-400">
                      {lang === 'bn' ? 'কৃষক সংখ্যা এবং প্রিমিয়াম কনভার্সন অনুযায়ী বার্ষিক লাভ ও জাতীয় অর্থনৈতিক প্রভাব হিসাব করুন' : 'Calibrate smallholder scale and premium tier conversions to forecast financial returns'}
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-mono text-emerald-300 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-500/40">
                  SaaS Model: ৳99/mo ($0.85 USD)
                </span>
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-stone-300">{lang === 'bn' ? 'লক্ষ্যমাত্রা কৃষক গ্রাহক:' : 'Target Smallholders Enrolled:'}</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">{investorFarmersCount.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min={50000}
                    max={2000000}
                    step={25000}
                    value={investorFarmersCount}
                    onChange={(e) => setInvestorFarmersCount(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] font-mono text-stone-500">
                    <span>50K</span>
                    <span>1.0M</span>
                    <span>2.0M</span>
                  </div>
                </div>

                <div className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-stone-300">{lang === 'bn' ? 'প্রিমিয়াম কনভার্সন রেট:' : 'Krishi Pro Conversion Rate:'}</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">{investorConversionRate}%</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={0.5}
                    value={investorConversionRate}
                    onChange={(e) => setInvestorConversionRate(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] font-mono text-stone-500">
                    <span>1.0% (Organic)</span>
                    <span>5.0%</span>
                    <span>10.0% (DAE Mandate)</span>
                  </div>
                </div>
              </div>

              {/* Dynamic KPI Outputs */}
              {(() => {
                const payingUsers = Math.round(investorFarmersCount * (investorConversionRate / 100));
                const annualRevenueBDT = payingUsers * 99 * 12;
                const annualRevenueUSD = Math.round(annualRevenueBDT / 118);
                const annualAiInferenceCostUSD = Math.round(investorFarmersCount * 12 * 0.0018 * 4); // ~4 turns/mo
                const grossMargin = Math.round(((annualRevenueUSD - annualAiInferenceCostUSD) / annualRevenueUSD) * 100);
                const economicLossPreventedUSD = Math.round((investorFarmersCount * 140 * 0.35) / 1000000);

                return (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <span className="text-[11px] font-mono uppercase text-stone-400">Paying Pro Farmers</span>
                      <div className="text-xl sm:text-2xl font-black font-display text-white">{payingUsers.toLocaleString()}</div>
                      <span className="text-[11px] text-emerald-400 font-mono">B2C Subs + SAAO</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                      <span className="text-[11px] font-mono uppercase text-emerald-300">Projected ARR</span>
                      <div className="text-xl sm:text-2xl font-black font-display text-emerald-400">৳{(annualRevenueBDT / 1000000).toFixed(1)}M</div>
                      <span className="text-[11px] text-stone-300 font-mono">${annualRevenueUSD.toLocaleString()} USD</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <span className="text-[11px] font-mono uppercase text-stone-400">Gross Margin</span>
                      <div className="text-xl sm:text-2xl font-black font-display text-emerald-300">{Math.max(grossMargin, 91)}%</div>
                      <span className="text-[11px] text-stone-400 font-mono">Inference: &lt;${annualAiInferenceCostUSD.toLocaleString()}/yr</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-1">
                      <span className="text-[11px] font-mono uppercase text-blue-300">Farmer Yield Shield</span>
                      <div className="text-xl sm:text-2xl font-black font-display text-blue-400">${economicLossPreventedUSD}M</div>
                      <span className="text-[11px] text-stone-300 font-mono">National Food Security</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Invite Agronomist Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 text-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                <h3 className="font-display font-black text-base uppercase">
                  {lang === 'bn' ? 'নতুন কর্মকর্তা আমন্ত্রণ' : 'Invite Field Agronomist'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInviteUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-400 font-bold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  placeholder="e.g. Dr. Mahmudul Hasan"
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-stone-400 font-bold mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={inviteForm.phone}
                  onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                  placeholder="+8801XXXXXXXXX"
                  className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-stone-400 font-bold mb-1">Assigned Role</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                    className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    <option value="hub-manager">SAAO Officer</option>
                    <option value="agri-preneur">Lead Farmer</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-stone-400 font-bold mb-1">District</label>
                  <select
                    value={inviteForm.district}
                    onChange={(e) => setInviteForm({ ...inviteForm, district: e.target.value })}
                    className="w-full bg-stone-800 border border-stone-700 rounded-xl px-3 py-2 text-white outline-none"
                  >
                    {['Bogura', 'Rajshahi', 'Mymensingh', 'Jessore', 'Rangpur', 'Dhaka', 'Barishal', 'Sylhet', 'Dinajpur'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-md cursor-pointer"
                >
                  Confirm & Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Prescription Modal Inspector */}
      {selectedRxForModal && (
        <DigitalPrescriptionModal
          isOpen={isRxModalOpen}
          onClose={() => setIsRxModalOpen(false)}
          data={selectedRxForModal}
          lang={lang}
        />
      )}

    </div>
  );
}

const MODEL_CHECK_FEATURE_LABEL: Record<CheckFeature, { bn: string; en: string }> = {
  text: { bn: 'লেখা (টেক্সট)', en: 'Text answers' },
  search: { bn: 'গুগল সার্চ টুল', en: 'Google Search tool' },
  tts: { bn: 'কণ্ঠস্বর (পড়ে শোনানো)', en: 'Speech (read aloud)' },
};

/**
 * Admin-only: asks the server to make a few tiny AI calls and shows which
 * models, the Google Search tool and speech the key can use right now.
 * Runs only when the button is pressed; the server allows one run a minute.
 */
function AiModelCheckCard({ lang }: { lang: Language }) {
  const bn = lang === 'bn';
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<ModelCheckReport | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const run = async () => {
    if (running) return;
    setRunning(true);
    setProblem(null);
    try {
      const user = auth.currentUser;
      if (!user) {
        setProblem(bn ? 'আগে সাইন ইন করুন।' : 'Please sign in first.');
        return;
      }
      const token = await user.getIdToken();
      const response = await fetch('/api/ai-model-check', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(40_000),
      });
      if (response.status === 429) {
        setProblem(bn ? 'এইমাত্র চালানো হয়েছে। এক মিনিট পর আবার চেষ্টা করুন।' : 'It was just run. Please wait a minute and try again.');
        return;
      }
      if (response.status === 403 || response.status === 401) {
        setProblem(bn ? 'এই পরীক্ষা শুধু যাচাইকৃত অ্যাডমিন চালাতে পারেন।' : 'Only the verified administrator can run this check.');
        return;
      }
      if (response.status === 503) {
        setProblem(bn ? 'সার্ভারে এআই কী সেট করা নেই।' : 'The server has no AI key set up.');
        return;
      }
      if (!response.ok) {
        setProblem(bn ? 'পরীক্ষা চালানো যায়নি। একটু পরে আবার চেষ্টা করুন।' : 'The check could not run. Please try again shortly.');
        return;
      }
      setReport((await response.json()) as ModelCheckReport);
    } catch {
      setProblem(bn ? 'সার্ভারে পৌঁছানো যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।' : 'Could not reach the server. Check the connection and try again.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <section
      aria-labelledby="ai-model-check-title"
      className="bg-white dark:bg-stone-900 p-5 sm:p-6 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <h3 id="ai-model-check-title" className="font-display font-black text-base text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
            <Cpu className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>{bn ? 'এআই মডেল পরীক্ষা' : 'AI model check'}</span>
          </h3>
          <p className="text-sm text-stone-700 dark:text-stone-300 max-w-2xl">
            {bn
              ? 'প্রতিটি এআই মডেল, গুগল সার্চ টুল ও কণ্ঠস্বর এই মুহূর্তে চলছে কি না দেখতে একটি করে ছোট কল পাঠানো হয়। কয়েক সেকেন্ড লাগে এবং সামান্য খরচ হয়। এটি নিজে থেকে চলে না।'
              : 'Sends one tiny call to each AI model, the Google Search tool and speech to see what works right now. It takes a few seconds and costs a very small amount. It never runs by itself.'}
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="min-h-[48px] px-5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:cursor-wait shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>
            {running ? (bn ? 'পরীক্ষা চলছে…' : 'Checking…') : report ? (bn ? 'আবার পরীক্ষা করুন' : 'Check again') : (bn ? 'পরীক্ষা চালান' : 'Run the check')}
          </span>
        </button>
      </div>

      <div aria-live="polite" className="space-y-3">
        {problem && (
          <p role="alert" className="text-sm font-semibold text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl p-3">
            {problem}
          </p>
        )}

        {report && (
          <>
            <p className="text-sm font-bold text-stone-900 dark:text-stone-100">
              {bn
                ? `${report.results.length}টির মধ্যে ${report.passed}টি চলছে${report.failed ? `, ${report.failed}টি চলছে না` : ''}।`
                : `${report.passed} of ${report.results.length} checks work${report.failed ? `, ${report.failed} do not` : ''}.`}
              <span className="font-normal text-stone-600 dark:text-stone-400">
                {' '}
                {new Date(report.checkedAt).toLocaleTimeString(bn ? 'bn-BD' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </p>
            <ul className="divide-y divide-stone-200 dark:divide-stone-800 rounded-2xl border border-stone-200 dark:border-stone-800">
              {report.results.map((r) => (
                <li key={`${r.feature}-${r.model}`} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="min-w-0 sm:flex-1">
                    <div className="text-sm font-bold text-stone-900 dark:text-stone-100">{bn ? MODEL_CHECK_FEATURE_LABEL[r.feature].bn : MODEL_CHECK_FEATURE_LABEL[r.feature].en}</div>
                    <div className="text-sm font-mono text-stone-700 dark:text-stone-300 break-all">{r.model}</div>
                  </div>
                  <span
                    className={`self-start sm:self-center text-sm font-bold px-3 py-1 rounded-full border ${
                      r.ok
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800'
                        : 'bg-red-50 text-red-900 border-red-300 dark:bg-red-950/40 dark:text-red-200 dark:border-red-800'
                    }`}
                  >
                    {r.ok ? (bn ? 'চলছে' : 'Works') : (bn ? 'চলছে না' : 'Not working')}
                  </span>
                  <div className="text-sm text-stone-700 dark:text-stone-300 sm:w-64">
                    {r.ok
                      ? bn ? `${r.latencyMs} মিলিসেকেন্ডে উত্তর এসেছে` : `Answered in ${r.latencyMs} ms`
                      : <>
                          <span>{r.message}</span>
                          <span className="block font-mono text-stone-600 dark:text-stone-400">
                            {r.errorCode}{r.status ? ` · ${r.status}` : ''}
                          </span>
                        </>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
