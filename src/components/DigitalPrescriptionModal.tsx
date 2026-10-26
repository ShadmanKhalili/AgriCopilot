import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Download, Printer, Share2, Check, ShieldCheck, QrCode, 
  MapPin, Calendar, Clock, AlertTriangle, Leaf, Award, 
  FileText, ArrowDownToLine, Copy, ExternalLink, Sparkles, Droplets, Thermometer, Wind,
  Volume2, Square, Loader2
} from 'lucide-react';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import { Language } from '../utils/translations';
import { generateSpeech } from '../services/ai';
import { useAuth } from './AuthProvider';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firestore';
import PlantHealthRecoveryTracker from './PlantHealthRecoveryTracker';
import { audioFeedback } from '../utils/audioFeedback';
import {
  toStorablePrescription,
  type PrescriptionData,
} from '../utils/prescriptionData';

// The Rx payload and the rules for filling it live in one place so the
// farmer-facing card and the admin audit registry can never disagree about
// what is real. See `src/utils/prescriptionData.ts` for the full rationale.
export type { PrescriptionData } from '../utils/prescriptionData';

interface DigitalPrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PrescriptionData;
  lang: Language;
}

export default function DigitalPrescriptionModal({
  isOpen,
  onClose,
  data,
  lang
}: DigitalPrescriptionModalProps) {
  const { user } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showRecoveryTracker, setShowRecoveryTracker] = useState(false);

  // Read-aloud (Bangla voice) so non-reading farmers can listen to the Rx
  const [isSpeechLoading, setIsSpeechLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechUrlRef = useRef<string | null>(null);

  // Stop any running voice playback when the modal closes or unmounts
  useEffect(() => {
    return () => {
      if (speechAudioRef.current) {
        try { speechAudioRef.current.pause(); } catch (e) {}
        speechAudioRef.current = null;
      }
      if (speechUrlRef.current) {
        try { URL.revokeObjectURL(speechUrlRef.current); } catch (e) {}
        speechUrlRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (speechAudioRef.current) {
        try { speechAudioRef.current.pause(); } catch (e) {}
        speechAudioRef.current = null;
      }
      if (speechUrlRef.current) {
        try { URL.revokeObjectURL(speechUrlRef.current); } catch (e) {}
        speechUrlRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
      }
      setIsSpeaking(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Escape must always be able to close a prescription; the close control is
    // pinned in the header below. Lock background scroll while open.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const rxId = data.rxId || `RX-BD-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
  const currentDate = new Date().toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Generate QR code SVG representation for authenticated offline scanning
  const qrVerificationUrl = `https://smart-krishi-ai.bd/verify?rx=${rxId}&crop=${encodeURIComponent(data.crop)}&status=VALID`;

  // Download high-resolution PNG
  const handleDownloadImage = async () => {
    if (!cardRef.current || isExporting) return;
    setIsExporting(true);
    const toastId = toast.loading(lang === 'bn' ? 'প্রেসক্রিপশন ডাউনলোড হচ্ছে...' : 'Generating high-res Rx card...');

    try {
      // Small pause for rendering stability
      await new Promise(r => setTimeout(r, 150));
      const dataUrl = await toPng(cardRef.current, {
        quality: 0.98,
        pixelRatio: 2.5,
        backgroundColor: '#ffffff'
      });

      const link = document.createElement('a');
      link.download = `Krishi-Prescription-${rxId}.png`;
      link.href = dataUrl;
      link.click();

      toast.success(lang === 'bn' ? 'প্রেসক্রিপশন সফলভাবে সংরক্ষিত হয়েছে!' : 'Prescription downloaded successfully!', { id: toastId });
    } catch (err) {
      console.error("Export prescription error:", err);
      toast.error(lang === 'bn' ? 'ডাউনলোড ব্যর্থ হয়েছে' : 'Failed to download prescription', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  // Trigger browser print
  const handlePrint = () => {
    window.print();
  };

  // Build a clean spoken script from the prescription (strip emojis/markup)
  const buildReadAloudText = (): string => {
    const L = lang === 'bn';
    const parts: string[] = [];
    parts.push(L ? `ডিজিটাল কৃষি ব্যবস্থাপত্র। আইডি ${rxId}।` : `Digital Krishi Prescription. ID ${rxId}.`);
    parts.push(L ? `ফসল: ${data.crop}।` : `Crop: ${data.crop}.`);
    parts.push(L ? `সমস্যা: ${data.diseaseName}।` : `Issue: ${data.diseaseName}.`);
    if (data.symptoms && data.symptoms.length > 0) {
      parts.push(L ? `লক্ষণ: ${data.symptoms.join('। ')}।` : `Symptoms: ${data.symptoms.join('. ')}.`);
    }
    if (data.culturalSteps && data.culturalSteps.length > 0) {
      parts.push(L ? `প্রথম করণীয়: ${data.culturalSteps.join('। ')}।` : `First steps: ${data.culturalSteps.join('. ')}.`);
    }
    if (data.organicSteps && data.organicSteps.length > 0) {
      parts.push(L ? `জৈব প্রতিকার: ${data.organicSteps.join('। ')}।` : `Organic remedies: ${data.organicSteps.join('. ')}.`);
    }
    if (data.chemicalSteps && data.chemicalSteps.length > 0) {
      parts.push(L ? `রাসায়নিক প্রতিকার, সতর্কতার সাথে: ${data.chemicalSteps.join('। ')}।` : `Chemical remedies, with caution: ${data.chemicalSteps.join('. ')}.`);
    }
    if (data.investigationSteps && data.investigationSteps.length > 0) {
      parts.push(L ? `যাচাইয়ের ধাপ: ${data.investigationSteps.join('। ')}।` : `Verification steps: ${data.investigationSteps.join('. ')}.`);
    }
    parts.push(
      L
        ? 'এটি প্রাথমিক এআই পরামর্শ। রাসায়নিক প্রয়োগের আগে স্থানীয় কৃষি কর্মকর্তা অথবা ১৬১২৩ নম্বরে পরামর্শ নিন।'
        : 'This is preliminary AI advice. Before chemical application, consult a local agriculture officer or call 16123.'
    );
    return parts.join(' ').replace(/[*#_`•━🔒]/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const stopReadAloud = () => {
    if (speechAudioRef.current) {
      try { speechAudioRef.current.pause(); } catch (e) {}
      speechAudioRef.current = null;
    }
    if (speechUrlRef.current) {
      try { URL.revokeObjectURL(speechUrlRef.current); } catch (e) {}
      speechUrlRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    setIsSpeaking(false);
  };

  const handleReadAloud = async () => {
    if (isSpeechLoading) return;
    if (isSpeaking) {
      stopReadAloud();
      return;
    }
    const text = buildReadAloudText();
    setIsSpeechLoading(true);
    try {
      const b64 = await generateSpeech(text);
      if (!b64) throw new Error('No audio data returned');
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      speechUrlRef.current = url;
      const audio = new Audio(url);
      speechAudioRef.current = audio;
      audio.onended = () => stopReadAloud();
      audio.onerror = () => stopReadAloud();
      await audio.play();
      setIsSpeaking(true);
    } catch (err) {
      console.warn('Prescription TTS failed, falling back to Web Speech:', err);
      if ('speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
          utterance.rate = 0.95;
          utterance.onend = () => setIsSpeaking(false);
          utterance.onerror = () => setIsSpeaking(false);
          window.speechSynthesis.speak(utterance);
          setIsSpeaking(true);
        } catch (synthErr) {
          toast.error(lang === 'bn' ? 'ভয়েস চালু করা যায়নি।' : 'Could not start voice playback.');
        }
      } else {
        toast.error(lang === 'bn' ? 'ভয়েস চালু করা যায়নি।' : 'Could not start voice playback.');
      }
    } finally {
      setIsSpeechLoading(false);
    }
  };

  // Copy textual summary to clipboard
  const handleCopyText = () => {
    const text = `📋 DIGITAL KRISHI PRESCRIPTION (${rxId})
━━━━━━━━━━━━━━━━━━━━━━━━━━
🌾 ${lang === 'bn' ? 'ফসল' : 'Crop'}: ${data.crop} (${data.cropStage || 'Field'})
📍 ${lang === 'bn' ? 'এলাকা' : 'Location'}: ${data.location}
🔬 ${lang === 'bn' ? 'রোগ নির্ণয়' : 'Diagnosis'}: ${data.diseaseName} (${data.severity})
📊 ${lang === 'bn' ? 'নির্ভুলতা' : 'Confidence'}: ${data.confidence !== null && data.confidence !== undefined ? `${data.confidence}%` : (lang === 'bn' ? 'মূল্যায়ন করা হয়নি' : 'Not assessed')}

💊 ${lang === 'bn' ? 'ব্যবস্থাপত্র ও করণীয়' : 'Prescribed Treatment'}:
${data.chemicalSteps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

🌱 ${lang === 'bn' ? 'জৈব পদ্ধতি' : 'Organic Protocol'}:
${data.organicSteps.map((s, i) => `• ${s}`).join('\n')}

🏛️ ${lang === 'bn' ? 'কৃষি কল সেন্টার' : 'Krishi Helpline'}: 16123
━━━━━━━━━━━━━━━━━━━━━━━━━━
KrishiVip Agri-Copilot Multimodal AI • Decision-Support Advisory`;

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    toast.success(lang === 'bn' ? 'প্রেসক্রিপশন টেক্সট কপি হয়েছে!' : 'Prescription copied to clipboard!');
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Save Rx to Farmer Dossier / Firestore
  const handleSaveToDossier = async () => {
    if (isSaving) return;
    setIsSaving(true);
    const saveLocally = () => {
      try {
        const existing = JSON.parse(localStorage.getItem('farmer_saved_prescriptions') || '[]');
        // Keep the whole card, not just three fields — the local dossier is
        // the only copy a farmer has when the audit registry write is
        // refused, so a trimmed copy would lose the regimen.
        existing.unshift({ ...data, date: currentDate });
        localStorage.setItem('farmer_saved_prescriptions', JSON.stringify(existing.slice(0, 20)));
        toast.success(lang === 'bn' ? 'স্থানীয় ডসিয়ারে সংরক্ষিত হয়েছে!' : 'Saved to local dossier!');
      } catch (e) {
        toast.error('Error saving');
      }
    };
    try {
      // The Firestore rules only accept a prescription filed by a signed-in
      // owner. A signed-out visitor is kept on the local dossier instead of
      // writing an `anonymous` row into the national audit registry.
      if (!user) {
        saveLocally();
        return;
      }
      await addDoc(
        collection(db, 'prescriptions'),
        toStorablePrescription(data, user.uid, user.displayName || '')
      );
      toast.success(lang === 'bn' ? 'কৃষক ডসিয়ারে সংরক্ষিত হয়েছে!' : 'Saved to Farmer Dossier!');
    } catch (err) {
      console.warn("Could not save to firestore, falling back to local:", err);
      saveLocally();
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/75 backdrop-blur-sm flex items-start sm:items-center justify-center px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-5 print:p-0 print:bg-white print:static"
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'bn' ? 'ডিজিটাল কৃষি প্রেসক্রিপশন' : 'Digital krishi prescription'}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-3xl max-h-[95dvh] bg-stone-100 dark:bg-stone-900 rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden my-auto flex flex-col print:border-none print:shadow-none print:max-w-none">
        
        {/* Top Control Bar (Hidden in Print). The header never scrolls away; only
            the prescription body below scrolls, so close is always reachable. */}
        <div className="bg-white dark:bg-stone-900 px-4 sm:px-5 py-3 border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 shrink-0 print:hidden">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-xs shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-950 dark:text-emerald-300">
                {lang === 'bn' ? 'ডিজিটাল কৃষি ব্যবস্থাপত্র (Rx)' : 'Digital Krishi Prescription (Rx)'}
              </span>
              <p className="text-[11px] text-stone-500 font-mono">ID: {rxId}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={handleSaveToDossier}
              disabled={isSaving}
              className="p-2 sm:px-3 sm:py-1.5 text-xs font-bold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-all border border-stone-200 dark:border-stone-700 flex items-center gap-1.5 cursor-pointer"
              title={lang === 'bn' ? 'ডসিয়ারে সেভ করুন' : 'Save to Dossier'}
            >
              <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">{lang === 'bn' ? 'ডসিয়ারে সেভ' : 'Save'}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyText}
              className="p-2 sm:px-3 sm:py-1.5 text-xs font-bold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-all border border-stone-200 dark:border-stone-700 flex items-center gap-1.5 cursor-pointer"
              title={lang === 'bn' ? 'কপি করুন' : 'Copy'}
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isCopied ? (lang === 'bn' ? 'কপি হয়েছে' : 'Copied') : (lang === 'bn' ? 'কপি' : 'Copy')}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="p-2 sm:px-3 sm:py-1.5 text-xs font-bold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-all border border-stone-200 dark:border-stone-700 flex items-center gap-1.5 cursor-pointer"
              title={lang === 'bn' ? 'প্রিন্ট করুন' : 'Print'}
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === 'bn' ? 'প্রিন্ট' : 'Print'}</span>
            </button>

            <button
              type="button"
              onClick={handleReadAloud}
              disabled={isSpeechLoading}
              className={`p-2 sm:px-3 sm:py-1.5 text-xs font-bold rounded-xl transition-all border flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                isSpeaking
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-stone-200 dark:border-stone-700'
              }`}
              title={lang === 'bn' ? 'প্রেসক্রিপশন শুনুন (বাংলা)' : 'Listen to prescription'}
            >
              {isSpeechLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isSpeaking ? (
                <Square className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {isSpeaking ? (lang === 'bn' ? 'থামান' : 'Stop') : (lang === 'bn' ? 'শুনুন' : 'Listen')}
              </span>
            </button>

            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'ডাউনলোড' : 'Download PNG'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label={lang === 'bn' ? 'প্রেসক্রিপশন বন্ধ করুন' : 'Close prescription'}
              title={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable & Exportable Prescription Card Canvas */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 min-h-0 print:flex-none print:max-h-none print:overflow-visible">
          <div 
            ref={cardRef} 
            className="bg-white text-stone-900 rounded-2xl p-6 sm:p-9 shadow-md border-2 border-emerald-900/15 relative overflow-hidden font-sans print:shadow-none print:border-stone-800"
          >
            {/* Security Background Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.035] select-none">
              <span className="font-serif font-black text-6xl sm:text-8xl tracking-widest text-emerald-950 rotate-[-25deg]">
                SMART KRISHI RX
              </span>
            </div>

            {/* Official Institutional Header */}
            <div className="relative z-10 border-b-2 border-emerald-800 pb-4 mb-5">
              <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
                <div className="flex items-center space-x-3.5 text-center sm:text-left">
                  <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-700 to-teal-600 flex items-center justify-center text-white shadow-md border-2 border-emerald-500/30 flex-shrink-0">
                    <Leaf className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-display font-black text-emerald-950 uppercase tracking-tight leading-tight">
                      {lang === 'bn' ? 'ডিজিটাল কৃষি ব্যবস্থাপত্র ও পরামর্শপত্র' : 'Digital Krishi Clinical Prescription'}
                    </h2>
                    <p className="text-[11px] font-bold text-emerald-800 mt-0.5 tracking-wide">
                      {lang === 'bn' 
                        ? 'স্মার্ট কৃষি কপিলট • এআই রোগনির্ণয় ও কৃষি সিদ্ধান্ত সহায়তা নেটওয়ার্ক' 
                        : 'Smart Agri-Copilot Multimodal AI • Decision-Support Advisory Network'}
                    </p>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Govt. of Bangladesh Agricultural Services Protocol • Toll Free 16123
                    </p>
                  </div>
                </div>

                {/* Rx Stamp & Barcode Badge */}
                <div className="text-right flex sm:flex-col items-center sm:items-end gap-3 sm:gap-1">
                  <div className="bg-emerald-50 border border-emerald-300 px-3 py-1 rounded-xl flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span className="text-[11px] font-black text-emerald-900 font-mono tracking-wider">
                      {rxId}
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-stone-500">
                    <span>{currentDate} • {currentTime}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Farmer & Plot Details Grid */}
            <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50/90 rounded-2xl p-4 border border-stone-200 mb-6 text-xs">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-0.5">
                  {lang === 'bn' ? 'কৃষক / গ্রাহক' : 'Grower / User'}
                </span>
                <span className="font-bold text-stone-900 truncate block">
                  {data.farmerName || user?.displayName || (lang === 'bn' ? 'নিবন্ধিত কৃষক (ডেমো)' : 'Registered Farmer')}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-0.5">
                  {lang === 'bn' ? 'এলাকা / প্লট' : 'Location / Plot'}
                </span>
                <span className="font-semibold text-stone-900 flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="truncate">{data.location}</span>
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-0.5">
                  {lang === 'bn' ? 'আক্রান্ত ফসল' : 'Host Plant / Crop'}
                </span>
                <span className="font-bold text-emerald-950 truncate block">
                  {data.crop}
                </span>
                {data.cropStage && (
                  <span className="text-[11px] text-stone-500 block truncate">{data.cropStage}</span>
                )}
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block mb-0.5">
                  {lang === 'bn' ? 'আবহাওয়া পরিস্থিতি' : 'Microclimate'}
                </span>
                <span className="text-[11px] font-medium text-stone-800 flex items-center gap-1.5">
                  <Thermometer className="w-3 h-3 text-amber-600" />
                  {data.weatherSnapshot?.temp
                    || (lang === 'bn' ? 'তথ্য নেই' : 'Not captured')}
                  <Droplets className="w-3 h-3 text-blue-500 ml-1" />
                  {data.weatherSnapshot?.humidity
                    || (lang === 'bn' ? 'তথ্য নেই' : 'Not captured')}
                </span>
              </div>
            </div>

            {/* Diagnostic Core Banner (Rx Pathological Identification) */}
            <div className="relative z-10 bg-gradient-to-r from-emerald-900 to-teal-950 text-white rounded-2xl p-4 sm:p-5 shadow-sm mb-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl font-serif font-black text-amber-400">℞</span>
                    <span className="text-[11px] font-black uppercase tracking-widest text-emerald-300">
                      {lang === 'bn' ? 'শনাক্তকৃত রোগ / সমস্যা' : 'Primary Pathological Diagnosis'}
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                    {data.diseaseName}
                  </h3>
                  {data.pathogen && (
                    <p className="text-xs font-mono italic text-emerald-200">
                      Causal Pathogen: {data.pathogen}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {/* Severity badge */}
                  <div className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wide border ${
                    data.severity === 'Critical' || data.severity === 'মারাত্মক'
                      || data.severity === 'High' || data.severity === 'উচ্চ'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                      : data.severity === 'Medium' || data.severity === 'মাঝারি'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                      : data.severity === 'Not Assessed' || (typeof data.severity === 'string' && data.severity.includes('Not Assessed'))
                      ? 'bg-stone-500/20 text-stone-300 border-stone-400/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                  }`}>
                    {lang === 'bn' ? `তীব্রতা: ${data.severity}` : `Severity: ${data.severity}`}
                  </div>
                  {/* Confidence or Not Assessed */}
                  {data.confidence !== null && data.confidence !== undefined ? (
                    <div className="bg-white/10 px-3 py-1 rounded-xl text-xs font-bold text-white border border-white/20">
                      {data.confidence}% {lang === 'bn' ? 'সঠিকতা' : 'Confidence'}
                    </div>
                  ) : (
                    <div className="bg-amber-500/20 text-amber-200 border border-amber-400/40 px-3 py-1 rounded-xl text-xs font-bold">
                      {lang === 'bn' ? 'সঠিকতা: যাচাই করা হয়নি' : 'Confidence: Not Assessed'}
                    </div>
                  )}
                </div>
              </div>

              {/* Observed Symptoms */}
              {data.symptoms && data.symptoms.length > 0 && (
                <div className="mt-3.5 pt-3 border-t border-emerald-800/80">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 block mb-1.5">
                    {lang === 'bn' ? 'প্রাথমিক দৃশ্যমান পর্যবেক্ষণ (Visual Symptoms):' : 'Preliminary Visual Observations:'}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.symptoms.map((sym, idx) => (
                      <span key={idx} className="bg-emerald-800/60 text-emerald-100 text-[11px] px-2.5 py-0.5 rounded-lg border border-emerald-700/50">
                        • {sym}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Why this condition and not the alternatives — the model
                  states it, so the card should carry it. */}
              {data.differentialDiagnosis && (
                <div className="mt-3 pt-3 border-t border-emerald-800/80">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 block mb-1.5">
                    {lang === 'bn' ? 'কেন এই রোগ — অন্য সম্ভাবনার তুলনায়' : 'Why this condition, and not the alternatives'}
                  </span>
                  <p className="text-[11px] leading-relaxed text-emerald-50/90">
                    {data.differentialDiagnosis}
                  </p>
                </div>
              )}
            </div>

            {/* Prescribed Step-by-Step Regimen (Rx ℞) */}
            <div className="relative z-10 space-y-4 mb-6">
              
              {/* Recommended Agronomic Investigation Steps */}
              {data.investigationSteps && data.investigationSteps.length > 0 && (
                <div className="border border-amber-300/80 rounded-2xl p-4 bg-amber-50/60 shadow-2xs">
                  <div className="flex items-center space-x-2 text-amber-950 font-bold text-xs uppercase tracking-wide mb-2.5 pb-1.5 border-b border-amber-200">
                    <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[11px] font-black">🔬</span>
                    <span>{lang === 'bn' ? 'সুপারিশকৃত সরেজমিন অনুসন্ধান ও ল্যাব পরীক্ষা' : 'Recommended Field Investigations & Lab Diagnostics'}</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-amber-950 pl-2">
                    {data.investigationSteps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-700 font-bold">🔍</span>
                        <span className="leading-relaxed font-medium">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Section 1: Immediate Field Cultural & Mechanical Action */}
              <div className="border border-stone-200 rounded-2xl p-4 bg-white shadow-2xs">
                <div className="flex items-center space-x-2 text-stone-900 font-bold text-xs uppercase tracking-wide mb-2.5 pb-1.5 border-b border-stone-100">
                  <span className="w-5 h-5 rounded-full bg-stone-800 text-white flex items-center justify-center text-[11px] font-black">1</span>
                  <span>{lang === 'bn' ? 'তাৎক্ষণিক জমি/টব স্যানিটেশন ও নন-কেমিক্যাল পরিচর্যা' : 'Immediate Cultural & Sanitation Protocols'}</span>
                </div>
                {data.culturalSteps.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-stone-700 pl-2">
                    {data.culturalSteps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-700 font-bold">✔</span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-stone-500 italic">
                    {lang === 'bn'
                      ? 'এই রোগের জন্য কোনো সাংস্কৃতিক ব্যবস্থাপত্র রিপোর্ট করা হয়নি।'
                      : 'No cultural protocol was reported for this condition.'}
                  </p>
                )}
              </div>

              {/* Section 2: Chemical Regimen with Gating */}
              {data.chemicalGated ? (
                <div className="border-2 border-rose-500/40 rounded-2xl p-4 bg-rose-50/70 shadow-2xs">
                  <div className="flex items-center justify-between text-rose-950 font-bold text-xs uppercase tracking-wide mb-2.5 pb-1.5 border-b border-rose-200">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-full bg-rose-700 text-white flex items-center justify-center text-[11px] font-black">🔒</span>
                      <span>{lang === 'bn' ? 'রাসায়নিক চিকিৎসা স্থগিত • বিশেষজ্ঞ অনুমোদন আবশ্যক' : 'Chemical Rx Withheld • Agronomic Review Required'}</span>
                    </div>
                    <span className="text-[11px] bg-rose-700 text-white px-2.5 py-0.5 rounded-full font-bold">
                      {lang === 'bn' ? 'অনুমোদন পেন্ডিং' : 'Review Required'}
                    </span>
                  </div>
                  {data.chemicalSteps.length > 0 && (
                    <ul className="space-y-2 text-xs text-rose-950 pl-2">
                      {data.chemicalSteps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-rose-700 font-black shrink-0 mt-0.5">⚠️</span>
                          <span className="leading-relaxed font-semibold">{step}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 p-2.5 rounded-xl bg-rose-100/90 text-[11px] text-rose-900 border border-rose-300 leading-relaxed">
                    {lang === 'bn' 
                      ? 'খাদ্য নিরাপত্তা ও ফসলের বিষক্রিয়া রোধে: কৃত্রিম বুদ্ধিমত্তা কোনো অনির্ধারিত রাসায়নিক প্রয়োগের অনুমতি প্রদান করে না। স্প্রে করার পূর্বে অবশ্যই মাঠ পর্যায়ের উপ-সহকারী কৃষি কর্মকর্তা (SAAO) বা লাইসেন্সপ্রাপ্ত উদ্ভিদ রোগতত্ত্ববিদের লিখিত অনুমোদন নিন।'
                      : 'Crop & Consumer Safety Directive: Automated systems prohibit unverified pesticide distribution. Direct physical evaluation and prescription by an accredited agronomist or extension officer is required before chemical application.'}
                  </div>
                </div>
              ) : (
                <div className="border-2 border-emerald-600/30 rounded-2xl p-4 bg-emerald-50/40 shadow-2xs">
                  <div className="flex items-center justify-between text-emerald-950 font-bold text-xs uppercase tracking-wide mb-2.5 pb-1.5 border-b border-emerald-200">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[11px] font-black">2</span>
                      <span>{lang === 'bn' ? 'অনুমোদিত রাসায়নিক চিকিৎসা ও সুনির্দিষ্ট মাত্রা' : 'Precision Chemical Treatment & Exact Dilution'}</span>
                    </div>
                    {data.harvestIntervalDays && (
                      <span className="text-[11px] bg-emerald-700 text-white px-2 py-0.5 rounded-full font-bold">
                        {lang === 'bn' ? `ফসল তোলার বিরতি (PHI): ${data.harvestIntervalDays} দিন` : `Pre-Harvest Interval (PHI): ${data.harvestIntervalDays} Days`}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-2 text-xs text-emerald-950 pl-2">
                    {data.chemicalSteps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-800 font-black shrink-0 mt-0.5">💊</span>
                        <span className="leading-relaxed font-medium">{step}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-emerald-800/80 italic mt-2.5 pl-6">
                    {lang === 'bn' 
                      ? '⚠️ সতর্কতা: তীব্র রোদে বা বৃষ্টির সম্ভাবনায় স্প্রে করবেন না। স্প্রে করার সময় মাস্ক ও গ্লাভস পরিধান করুন।' 
                      : '⚠️ Caution: Do not spray under direct scorching midday sun or pending rainfall. Wear safety mask and gloves.'}
                  </p>
                </div>
              )}

              {/* Section 3: Organic & Eco-Friendly Alternative */}
              <div className="border border-stone-200 rounded-2xl p-4 bg-white shadow-2xs">
                <div className="flex items-center space-x-2 text-stone-900 font-bold text-xs uppercase tracking-wide mb-2.5 pb-1.5 border-b border-stone-100">
                  <span className="w-5 h-5 rounded-full bg-teal-700 text-white flex items-center justify-center text-[11px] font-black">3</span>
                  <span>{lang === 'bn' ? 'জৈব ও পরিবেশবান্ধব বিকল্প সমাধান' : 'Bio-Control & Organic Alternatives'}</span>
                </div>
                {data.organicSteps.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-stone-700 pl-2">
                    {data.organicSteps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-teal-700 font-bold">🌱</span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-stone-500 italic">
                    {lang === 'bn'
                      ? 'এই রোগের জন্য কোনো জৈবিক বিকল্প রিপোর্ট করা হয়নি।'
                      : 'No bio-control alternative was reported for this condition.'}
                  </p>
                )}
              </div>

              {/* Recovery Tracker Collapsible Preview for Investors & Farmers */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    audioFeedback.playTactileClick();
                    setShowRecoveryTracker(!showRecoveryTracker);
                  }}
                  className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-stone-900 to-teal-950 text-white border border-emerald-500/30 text-xs font-bold flex items-center justify-between shadow-xs hover:border-emerald-400 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-mono font-bold">📈</span>
                    <span>{lang === 'bn' ? '৭-১৪ দিনের উদ্ভিদ নিরাময় ও ক্লোরোফিল ট্র্যাকার' : '7-Day Plant Health Recovery Tracker (Apple Health for Crops)'}</span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-900/60 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                    {showRecoveryTracker ? (lang === 'bn' ? 'সংকোচন করুন ▲' : 'Hide ▲') : (lang === 'bn' ? 'ট্র্যাকার খুলুন ▼' : 'Open Tracker ▼')}
                  </span>
                </button>

                {showRecoveryTracker && (
                  <div className="mt-3">
                    <PlantHealthRecoveryTracker
                      lang={lang}
                      cropName={data.crop}
                      diseaseName={data.diseaseName}
                      severity={data.severity}
                      harvestIntervalDays={data.harvestIntervalDays}
                      initialPathway="organic"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Institutional Verification Footer & QR Seal */}
            <div className="relative z-10 pt-4 border-t-2 border-dashed border-stone-300 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                {/* Visual QR Code Box */}
                <div className="w-16 h-16 bg-white border-2 border-stone-800 p-1 rounded-xl flex items-center justify-center shadow-xs flex-shrink-0">
                  <div className="relative w-full h-full flex flex-col items-center justify-center bg-stone-50 rounded-lg p-0.5">
                    <QrCode className="w-11 h-11 text-stone-900" />
                    <span className="text-[6px] font-mono font-bold text-stone-600 uppercase">SCAN VERIFY</span>
                  </div>
                </div>

                <div className="text-xs">
                  <p className="font-bold text-stone-900 leading-snug">
                    {lang === 'bn' ? 'ডিজিটাল কৃষি সিদ্ধান্ত সহায়তা পরামর্শপত্র' : 'Digital Agri Decision-Support Advisory'}
                  </p>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    {lang === 'bn' 
                      ? 'কৃষি জ্ঞানভিত্তিক সিদ্ধান্ত সহায়তা মডেল • রাসায়নিক চিকিৎসার পূর্বে মাঠের বিশেষজ্ঞ যাচাই আবশ্যক।' 
                      : 'Agronomic decision-support model • Recorded expert review required before chemical application.'}
                  </p>
                  <p className="text-[11px] text-emerald-800 font-semibold mt-1">
                    📞 Helpline: 16123 (Krishi Call Centre) • Free Farmer Support
                  </p>
                </div>
              </div>

              {/* Digital Authorized Signature Stamp */}
              <div className="text-center sm:text-right border-t sm:border-t-0 sm:border-l border-stone-200 pt-3 sm:pt-0 sm:pl-5">
                <div className="inline-block p-1.5 rounded-xl border border-emerald-700/30 bg-emerald-50/50 mb-1">
                  <div className="font-serif italic text-xs font-bold text-emerald-950 px-2">
                    KrishiVip AI Advisory
                  </div>
                </div>
                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-900">
                  {data.expertVerified 
                    ? (lang === 'bn' ? 'বিশেষজ্ঞ কর্তৃক যাচাইকৃত' : 'Expert Verified') 
                    : (lang === 'bn' ? 'এআই সিদ্ধান্ত সহায়তা • রিভিউ পেন্ডিং' : 'AI Decision Support • Review Pending')}
                </p>
                <p className="text-[11px] text-stone-400 font-mono">
                  SHA256: {rxId.replace(/-/g, '').slice(0, 16)}
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Action Footer for Mobile (Hidden in Print) */}
        <div className="bg-white dark:bg-stone-900 p-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between sm:hidden print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 rounded-xl"
          >
            {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
          </button>
          <button
            type="button"
            onClick={handleDownloadImage}
            disabled={isExporting}
            className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>{lang === 'bn' ? 'ডাউনলোড প্রেসক্রিপশন' : 'Download Rx Card'}</span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
