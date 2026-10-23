import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { 
  Camera, Mic, MicOff, PhoneOff, Video, VideoOff, RefreshCw, Zap, ZapOff, 
  Sparkles, AlertCircle, AlertTriangle, ShieldCheck, Activity, Volume2, 
  Scan, Info, Maximize2, Minimize2, ArrowRight, CheckCircle2, Loader2, Bot, User,
  BrainCircuit, Cpu, ChevronDown, ChevronUp, Square, Briefcase, FileText, Download, Play, Layers, Award,
  CalendarDays, HelpCircle, ListChecks, Share2, X
} from 'lucide-react';
import { getLiveAiClient, generateSpeech, LIVE_API_MODEL, LIVE_EXTENDED_THINKING_MODEL } from '../services/ai';
import { buildFarmMemoryContext } from '../utils/farmMemory';
import { fetchWithTimeout, readJsonWithTimeout } from '../utils/fetchWithTimeout';
import type { LiveServerMessage } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';

// Inline the two enum values used by the live config. Importing the SDK for
// its runtime enums would pull ~280 KB into the first screen; the SDK itself
// is loaded on demand by getLiveAiClient() when a session actually starts.
const Modality = { AUDIO: 'AUDIO' } as const;
const ThinkingLevel = { LOW: 'LOW' } as const;
import toast from 'react-hot-toast';
import { Language } from '../utils/translations';
import { useAuth } from './AuthProvider';
import { recordFarmerInteractionEvent } from '../utils/farmerProfiler';
import { INVESTOR_DEMO_PRESETS, DemoPreset } from '../data/investorDemoPresets';
import type { PrescriptionData } from './DigitalPrescriptionModal';

const DigitalPrescriptionModal = lazy(() => import('./DigitalPrescriptionModal'));

interface LiveVideoCopilotProps {
  lang: Language;
  locationContext?: string;
  globalLocation?: { latitude: number; longitude: number } | null;
  onCaptureFrameForDeepDiagnosis?: (imageDataUrl: string) => void;
}

interface TranscriptTurn {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

// Low-literacy friendly diagnostic questions: big tap-buttons instead of typing.
// Tapping an answer streams it into the live conversation as user text input.
interface DiagnosticQuestion {
  key: string;
  qBn: string;
  qEn: string;
  options: { bn: string; en: string }[];
}

const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  {
    key: 'crop_age',
    qBn: 'ফসলের বয়স কত?',
    qEn: 'Crop age?',
    options: [
      { bn: 'নতুন চারা (২ সপ্তাহের কম)', en: 'Young seedling (<2 weeks)' },
      { bn: 'বাড়ন্ত (২-৬ সপ্তাহ)', en: 'Growing (2-6 weeks)' },
      { bn: 'ফুল/ফল বা পরিপক্ব', en: 'Flowering/fruiting/mature' }
    ]
  },
  {
    key: 'problem_days',
    qBn: 'সমস্যা কত দিন ধরে?',
    qEn: 'How long has the problem?',
    options: [
      { bn: 'আজ বা গতকাল শুরু', en: 'Since today/yesterday' },
      { bn: '৩-৭ দিন', en: '3-7 days' },
      { bn: '১ সপ্তাহের বেশি', en: 'More than a week' }
    ]
  },
  {
    key: 'recent_input',
    qBn: 'শেষ কী দিয়েছেন?',
    qEn: 'Last input applied?',
    options: [
      { bn: 'কিছুই দিইনি', en: 'Nothing applied' },
      { bn: 'সার দিয়েছি', en: 'Fertilizer applied' },
      { bn: 'ওষুধ/স্প্রে করেছি', en: 'Pesticide/spray applied' }
    ]
  }
];

// --- Live audio visualizer --------------------------------------------------
// The visualizer runs inside a requestAnimationFrame loop. The levels live in
// a ref and the bars are painted through direct DOM writes, so the 2700+ line
// component is not re-rendered ~60 times per second on a budget Android phone.
const VISUALIZER_BAR_COUNT = 24;
const IDLE_AUDIO_LEVELS = new Array(VISUALIZER_BAR_COUNT).fill(0.08);
// The height easing the previous motion tween used (80 ms ease-out) plus the
// colour transition Tailwind's `transition-colors` provides.
const VISUALIZER_BAR_TRANSITION =
  'height 80ms ease-out, color 150ms cubic-bezier(0.4, 0, 0.2, 1), background-color 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), text-decoration-color 150ms cubic-bezier(0.4, 0, 0.2, 1), fill 150ms cubic-bezier(0.4, 0, 0.2, 1), stroke 150ms cubic-bezier(0.4, 0, 0.2, 1)';

export default function LiveVideoCopilot({
  lang,
  locationContext = "Bangladesh",
  globalLocation = null,
  onCaptureFrameForDeepDiagnosis
}: LiveVideoCopilotProps) {
  const { user } = useAuth();
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isExtendedThinking, setIsExtendedThinking] = useState(true);
  const [liveThinkingText, setLiveThinkingText] = useState<string>('');
  const [showThinkingDetails, setShowThinkingDetails] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [streamFps, setStreamFps] = useState(1);
  const [totalFramesSent, setTotalFramesSent] = useState(0);
  const [liveState, setLiveState] = useState<'idle' | 'listening' | 'analyzing' | 'speaking'>('idle');
  // The live levels live in a ref: the rAF loop mutates them in place and
  // paints the bars through direct DOM writes, so no React state update (and
  // no re-render of this component) happens per animation frame.
  const audioLevelsRef = useRef<number[]>(new Array(VISUALIZER_BAR_COUNT).fill(0));
  const visualizerBarRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [transcripts, setTranscripts] = useState<TranscriptTurn[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [latestSubtitle, setLatestSubtitle] = useState<{ id?: string; text: string; role: 'user' | 'model' } | null>(null);
  const [lastSavedSession, setLastSavedSession] = useState<{
    title: string;
    summary: string;
    crop?: string;
    keyFacts: string[];
    actionSteps?: string[];
    duration?: number;
  } | null>(null);
  const [isSavingSummary, setIsSavingSummary] = useState(false);

  // Farm Memory indicator + low-literacy tap-to-answer chips
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  const [chipAnswers, setChipAnswers] = useState<Record<string, string>>({});
  const [showQuestionPanel, setShowQuestionPanel] = useState(false);

  // Post-session action card voice playback
  const [isActionAudioLoading, setIsActionAudioLoading] = useState(false);
  const [isActionAudioPlaying, setIsActionAudioPlaying] = useState(false);
  const actionAudioRef = useRef<HTMLAudioElement | null>(null);
  const actionAudioUrlRef = useRef<string | null>(null);

  // Investor Pitch Presets & 1-Click Digital Rx State
  const [activeDemoPreset, setActiveDemoPreset] = useState<DemoPreset | null>(null);
  const [showInvestorPresetsBar, setShowInvestorPresetsBar] = useState(false);
  // Investor demo is a boardroom tool, not a farmer feature: the panel stays
  // collapsed behind a tiny ghost button for the general public.
  const [showInvestorPanel, setShowInvestorPanel] = useState(false);
  const [showPitchCheatSheet, setShowPitchCheatSheet] = useState(false);
  const [isRxModalOpen, setIsRxModalOpen] = useState(false);
  const [currentRxData, setCurrentRxData] = useState<PrescriptionData | null>(null);
  const presetImageRef = useRef<HTMLImageElement | null>(null);
  const isAiTurnCancelledRef = useRef<boolean>(false);
  const [measuredInterruptionLatencyMs, setMeasuredInterruptionLatencyMs] = useState<number | null>(null);

  // ---- Mobile risk fix #1: Wake Lock -------------------------------------
  // On phones, an auto-locked screen suspends the audio pipeline and silently
  // drops the Gemini Live WebSocket mid-diagnosis. Hold the screen wake lock
  // for the duration of an active session only.
  const wakeLockRef = useRef<any>(null);
  const acquireWakeLock = async () => {
    try {
      const wakeLockApi = (navigator as any).wakeLock;
      if (!wakeLockApi?.request) return; // unsupported (older iOS, some desktops) — degrade silently
      wakeLockRef.current = await wakeLockApi.request('screen');
      wakeLockRef.current?.addEventListener?.('release', () => {
        wakeLockRef.current = null;
      });
    } catch (e) {
      // Battery saver active or permission denied — the session still works,
      // only screen-sleep protection is absent.
    }
  };
  const releaseWakeLock = async () => {
    try {
      await wakeLockRef.current?.release?.();
    } catch (e) {
      // Already released (e.g. the browser auto-released it while backgrounded)
    }
    wakeLockRef.current = null;
  };

  // Pre-load SVG image when demo preset changes
  useEffect(() => {
    if (activeDemoPreset) {
      const img = new Image();
      img.src = activeDemoPreset.svgImage;
      img.onload = () => {
        presetImageRef.current = img;
      };
    } else {
      presetImageRef.current = null;
    }
  }, [activeDemoPreset]);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const userAnalyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const sourceNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const lastAiSpeechEndTimeRef = useRef<number>(0);
  const userSpeakingHangoverRef = useRef<number>(0);
  const sessionIdRef = useRef<number>(0);
  const isStartingSessionRef = useRef<boolean>(false);
  const isAiTurnInProgressRef = useRef<boolean>(false);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isMutedRef = useRef(false);
  const speechRecognitionRef = useRef<any>(null);
  const transcriptsRef = useRef<TranscriptTurn[]>([]);
  const callDurationRef = useRef<number>(0);

  // Subtitle Sentence Queue & Interval Management
  const subtitleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const breakTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subtitleQueueRef = useRef<Array<{ id: string; role: 'user' | 'model'; text: string; readingTimeMs: number }>>([]);
  const isDisplayingSubtitleRef = useRef<boolean>(false);
  const modelTextBufferRef = useRef<string>('');

  // Clear all pending subtitles and reset buffer
  const clearSubtitles = useCallback(() => {
    if (subtitleTimeoutRef.current) {
      clearTimeout(subtitleTimeoutRef.current);
      subtitleTimeoutRef.current = null;
    }
    if (breakTimeoutRef.current) {
      clearTimeout(breakTimeoutRef.current);
      breakTimeoutRef.current = null;
    }
    subtitleQueueRef.current = [];
    isDisplayingSubtitleRef.current = false;
    modelTextBufferRef.current = '';
    setLatestSubtitle(null);
  }, []);

  // Play next queued sentence after the previous one disappears with a distinct visual break
  const playNextSubtitleInQueue = useCallback(() => {
    if (subtitleQueueRef.current.length === 0) {
      isDisplayingSubtitleRef.current = false;
      return;
    }

    const nextItem = subtitleQueueRef.current.shift()!;
    isDisplayingSubtitleRef.current = true;
    setLatestSubtitle({
      id: nextItem.id,
      role: nextItem.role,
      text: nextItem.text
    });

    subtitleTimeoutRef.current = setTimeout(() => {
      // 1. Sentence finishes its reading duration -> disappears
      setLatestSubtitle(null);
      subtitleTimeoutRef.current = null;

      // 2. Clear break before next sentence pops up
      breakTimeoutRef.current = setTimeout(() => {
        breakTimeoutRef.current = null;
        playNextSubtitleInQueue();
      }, 450);
    }, nextItem.readingTimeMs);
  }, []);

  // Enqueue a sentence to show with clean lifecycle (appear -> reading duration -> disappear -> break -> next)
  const enqueueSubtitleSentence = useCallback((sentence: string, role: 'user' | 'model') => {
    const clean = sentence.trim();
    if (!clean) return;

    const id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    // Adaptive reading duration: ~65ms per character, min 2200ms, max 4200ms
    const readingTimeMs = Math.min(4200, Math.max(2200, clean.length * 65));
    const item = { id, role, text: clean, readingTimeMs };

    if (role === 'user') {
      // Farmer query takes immediate stage
      if (subtitleTimeoutRef.current) clearTimeout(subtitleTimeoutRef.current);
      if (breakTimeoutRef.current) clearTimeout(breakTimeoutRef.current);
      subtitleQueueRef.current = [];
      isDisplayingSubtitleRef.current = true;
      setLatestSubtitle({ id, role, text: clean });

      subtitleTimeoutRef.current = setTimeout(() => {
        // Disappear farmer subtitle after reading duration
        setLatestSubtitle(null);
        subtitleTimeoutRef.current = null;
        isDisplayingSubtitleRef.current = false;
      }, readingTimeMs);
      return;
    }

    // Model sentence
    if (!isDisplayingSubtitleRef.current && !latestSubtitle) {
      isDisplayingSubtitleRef.current = true;
      setLatestSubtitle({ id, role, text: clean });

      subtitleTimeoutRef.current = setTimeout(() => {
        // Disappear sentence
        setLatestSubtitle(null);
        subtitleTimeoutRef.current = null;

        // Distinct visual break (450ms) before next sentence
        breakTimeoutRef.current = setTimeout(() => {
          breakTimeoutRef.current = null;
          playNextSubtitleInQueue();
        }, 450);
      }, readingTimeMs);
    } else {
      subtitleQueueRef.current.push(item);
    }
  }, [latestSubtitle, playNextSubtitleInQueue]);

  // Process incoming streaming tokens into clean grammatical sentences
  const processIncomingModelText = useCallback((text: string) => {
    modelTextBufferRef.current += text;
    let buffer = modelTextBufferRef.current;

    // Delimiters: Bengali dāri (।), period (.), question mark (?), exclamation mark (!), double newline
    const delimiterRegex = /([।?!.\n]+)/;
    let match: RegExpExecArray | null;

    while ((match = delimiterRegex.exec(buffer)) !== null) {
      const boundaryIndex = match.index + match[0].length;
      const sentence = buffer.slice(0, boundaryIndex).trim();
      buffer = buffer.slice(boundaryIndex);

      if (sentence.length > 0) {
        const turn: TranscriptTurn = {
          id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          role: 'model',
          text: sentence,
          timestamp: new Date().toISOString()
        };
        transcriptsRef.current.push(turn);
        setTranscripts(prev => [...prev, turn]);
        enqueueSubtitleSentence(sentence, 'model');
      }
    }

    // Secondary safety: If streaming a very long clause (> 80 chars) without standard punctuation
    if (buffer.length > 80) {
      const lastComma = buffer.lastIndexOf(',', 80);
      const lastSpace = buffer.lastIndexOf(' ', 80);
      const splitIdx = lastComma > 30 ? lastComma + 1 : (lastSpace > 30 ? lastSpace : -1);

      if (splitIdx > 0) {
        const sentence = buffer.slice(0, splitIdx).trim();
        buffer = buffer.slice(splitIdx);
        if (sentence.length > 0) {
          const turn: TranscriptTurn = {
            id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            role: 'model',
            text: sentence,
            timestamp: new Date().toISOString()
          };
          transcriptsRef.current.push(turn);
          setTranscripts(prev => [...prev, turn]);
          enqueueSubtitleSentence(sentence, 'model');
        }
      }
    }

    modelTextBufferRef.current = buffer;
  }, [enqueueSubtitleSentence]);

  // Flush remaining buffer at the end of model response
  const flushRemainingModelText = useCallback(() => {
    const remaining = modelTextBufferRef.current.trim();
    if (remaining.length > 0) {
      modelTextBufferRef.current = '';
      const turn: TranscriptTurn = {
        id: `ai_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        role: 'model',
        text: remaining,
        timestamp: new Date().toISOString()
      };
      transcriptsRef.current.push(turn);
      setTranscripts(prev => [...prev, turn]);
      enqueueSubtitleSentence(remaining, 'model');
    }
  }, [enqueueSubtitleSentence]);

  // Sync ref
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllMedia();
    };
  }, []);

  // System sounds
  const playTone = useCallback((freq: number, duration: number, volume: number = 0.05) => {
    try {
      if (!audioContextRef.current) return;
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio tone fallback
    }
  }, []);

  // Initialize Camera Feed
  const startCamera = async (targetFacingMode: 'environment' | 'user' = facingMode) => {
    try {
      setCameraError(null);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: targetFacingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (camErr: any) {
        console.warn("Camera video stream unavailable or denied, falling back to audio-only microphone stream:", camErr?.name || camErr?.message || camErr);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: constraints.audio
          });
          toast(lang === 'bn' 
            ? 'ক্যামেরা সংযোগ ছাড়া শুধুমাত্র অডিও মোডে সংযুক্ত হচ্ছে...' 
            : 'Camera stream unavailable; continuing in voice-only copilot mode...', { icon: '🎙️' });
        } catch (audioErr: any) {
          console.warn("Microphone stream unavailable:", audioErr?.name || audioErr?.message || audioErr);
          throw camErr;
        }
      }

      mediaStreamRef.current = stream;

      if (videoRef.current && stream.getVideoTracks().length > 0) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setIsCameraActive(true);

      // Check torch support
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities: any = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        setIsTorchSupported(!!capabilities.torch);
      }
      return stream;
    } catch (err: any) {
      console.warn("Camera/microphone permission notice:", err?.name || err?.message || err);
      const isDenied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      const msg = lang === 'bn' 
        ? (isDenied
            ? "ক্যামেরা বা মাইক্রোফোন ব্যবহারের অনুমতি পাওয়া যায়নি। ব্রাউজারের লক আইকনে ক্লিক করে অনুমতি দিন অথবা নমুনা প্রিসেট ব্যবহার করুন।" 
            : "ক্যামেরা ডিভাইসটি খুঁজে পাওয়া যায়নি। নিচে উল্লেখিত নমুনা প্রিসেট দিয়ে পরীক্ষা করতে পারেন।")
        : (isDenied
            ? "Camera or microphone permission was denied. Please allow access in browser permissions or select a sample preset below."
            : "Camera or audio device not detected. You can select one of the sample presets below to test the copilot.");
      setCameraError(msg);
      toast.error(msg);
      return null;
    }
  };

  // Toggle Torch/Flashlight
  const toggleTorch = async () => {
    if (!mediaStreamRef.current) return;
    const videoTrack = mediaStreamRef.current.getVideoTracks()[0];
    if (videoTrack && isTorchSupported) {
      try {
        const nextState = !isTorchOn;
        await (videoTrack as any).applyConstraints({
          advanced: [{ torch: nextState }]
        });
        setIsTorchOn(nextState);
        toast.success(nextState 
          ? (lang === 'bn' ? 'ফ্ল্যাশলাইট চালু' : 'Flashlight on')
          : (lang === 'bn' ? 'ফ্ল্যাশলাইট বন্ধ' : 'Flashlight off'));
      } catch (e) {
        console.warn("Torch failed:", e);
      }
    }
  };

  // Flip Camera - safely replaces ONLY the video track so audio pipeline is never broken
  const flipCamera = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);

    if (mediaStreamRef.current && isCameraActive) {
      try {
        const oldVideoTracks = mediaStreamRef.current.getVideoTracks();
        const newVideoStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: nextMode,
            width: { ideal: 640 },
            height: { ideal: 480 },
          }
        });
        const newVideoTrack = newVideoStream.getVideoTracks()[0];
        if (newVideoTrack) {
          // Stop and remove old video track; keep audio tracks 100% active and connected
          oldVideoTracks.forEach(t => {
            t.stop();
            mediaStreamRef.current?.removeTrack(t);
          });
          mediaStreamRef.current.addTrack(newVideoTrack);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStreamRef.current;
            await videoRef.current.play().catch(() => {});
          }
          const capabilities: any = newVideoTrack.getCapabilities ? newVideoTrack.getCapabilities() : {};
          setIsTorchSupported(!!capabilities.torch);
          setIsTorchOn(false);
          toast.success(lang === 'bn' 
            ? (nextMode === 'user' ? 'সামনের ক্যামেরা চালু' : 'পেছনের ক্যামেরা চালু') 
            : (nextMode === 'user' ? 'Front camera active' : 'Rear camera active'));
          return;
        }
      } catch (flipErr) {
        console.warn("Track-level camera flip fallback:", flipErr);
      }
    }
    await startCamera(nextMode);
  };

  // Visualizer Loop
  const updateVisualizer = () => {
    let aiLevels: number[] = new Array(VISUALIZER_BAR_COUNT).fill(0);
    let userLevels: number[] = new Array(VISUALIZER_BAR_COUNT).fill(0);
    let aiSum = 0;
    let userSum = 0;

    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      for (let i = 0; i < VISUALIZER_BAR_COUNT; i++) {
        const val = (dataArray[i * 2] || 0) / 255;
        aiLevels[i] = val;
        aiSum += val;
      }
    }

    if (userAnalyserRef.current && !isMutedRef.current) {
      const dataArray = new Uint8Array(userAnalyserRef.current.frequencyBinCount);
      userAnalyserRef.current.getByteFrequencyData(dataArray);
      for (let i = 0; i < VISUALIZER_BAR_COUNT; i++) {
        const val = (dataArray[i * 2] || 0) / 255;
        userLevels[i] = val;
        userSum += val;
      }
    }

    const aiSpeaking = aiSum > 0.8;
    const userSpeaking = userSum > 0.6;

    let nextLevels: number[];
    if (aiSpeaking) {
      setLiveState('speaking');
      nextLevels = aiLevels;
    } else if (userSpeaking) {
      setLiveState('listening');
      nextLevels = userLevels;
    } else {
      setLiveState('idle');
      nextLevels = IDLE_AUDIO_LEVELS;
    }

    // Mutate the shared level buffer in place (same array identity) and paint
    // the bars directly. A fresh array in React state would re-render this
    // whole component on every animation frame.
    const levels = audioLevelsRef.current;
    for (let i = 0; i < VISUALIZER_BAR_COUNT; i++) {
      levels[i] = nextLevels[i];
    }

    const bars = visualizerBarRefs.current;
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      if (bar) bar.style.height = `${Math.max(4, levels[i] * 52)}px`;
    }

    animFrameRef.current = requestAnimationFrame(updateVisualizer);
  };

  // Play incoming 24kHz audio chunk from Gemini 3.8 Live Extended
  const playAudioChunk = (base64Audio: string) => {
    const audioCtx = outputAudioContextRef.current || audioContextRef.current;
    if (!audioCtx || audioCtx.state === 'closed') return;

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    try {
      const binary = atob(base64Audio);
      const pcmData = new Int16Array(binary.length / 2);
      for (let i = 0; i < pcmData.length; i++) {
        const lsb = binary.charCodeAt(i * 2);
        const msb = binary.charCodeAt(i * 2 + 1);
        pcmData[i] = (msb << 8) | lsb;
      }

      const audioBuffer = audioCtx.createBuffer(1, pcmData.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = pcmData[i] / 32768.0;
      }

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;

      if (analyserRef.current) {
        source.connect(analyserRef.current);
      } else {
        source.connect(audioCtx.destination);
      }

      const now = audioCtx.currentTime;
      // CRITICAL FIX: Schedule strictly sequentially for gapless audio.
      // If the queue fell behind the current audio clock (e.g., initial chunk or after a pause),
      // catch up to 'now'. NEVER reset nextPlayTime to 'now' when it is in the future, as doing so
      // causes future chunks to play simultaneously right over currently playing speech!
      if (nextPlayTimeRef.current < now) {
        nextPlayTimeRef.current = now;
      }

      const startTime = nextPlayTimeRef.current;
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;

      sourceNodesRef.current.push(source);
      source.onended = () => {
        sourceNodesRef.current = sourceNodesRef.current.filter(n => n !== source);
        const ctx = outputAudioContextRef.current || audioContextRef.current;
        if (sourceNodesRef.current.length === 0 && ctx && ctx.currentTime >= nextPlayTimeRef.current - 0.05) {
          isAiTurnInProgressRef.current = false;
          setLiveState('listening');
        }
      };
    } catch (err) {
      console.error("Audio chunk playback error:", err);
    }
  };

  // Send single video frame (1 FPS)
  const sendVideoFrame = (session: any) => {
    const activeSession = session || sessionRef.current;
    if (!canvasRef.current || !activeSession) return;
    const canvas = canvasRef.current;

    // Check if we have either a preset image or an active video stream
    const hasPreset = !!(activeDemoPreset && presetImageRef.current);
    const hasVideo = !!(videoRef.current && videoRef.current.readyState >= 2);
    if (!hasPreset && !hasVideo) return;

    // Never stream video frames while AI is generating/speaking OR while farmer is speaking (prevents split/double turns)
    const outAudio = outputAudioContextRef.current || audioContextRef.current;
    const isAiSpeaking = isAiTurnInProgressRef.current || 
                         sourceNodesRef.current.length > 0 || 
                         (outAudio ? outAudio.currentTime < nextPlayTimeRef.current + 0.08 : false);
    const isUserSpeaking = Date.now() < userSpeakingHangoverRef.current;
    if (isAiSpeaking || isUserSpeaking) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 480;
    canvas.height = 360;

    if (hasPreset && presetImageRef.current) {
      ctx.drawImage(presetImageRef.current, 0, 0, 480, 360);
    } else if (hasVideo && videoRef.current) {
      ctx.drawImage(videoRef.current, 0, 0, 480, 360);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.55);
    const base64Data = dataUrl.split(',')[1];
    if (base64Data) {
      try {
        activeSession.sendRealtimeInput({
          video: {
            data: base64Data,
            mimeType: 'image/jpeg'
          }
        });
        setTotalFramesSent(prev => prev + 1);
      } catch (err) {
        console.warn("Video frame streaming dropped:", err);
      }
    }
  };

  // Auto fullscreen on mobile when starting live stream
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Re-acquire the wake lock when the app returns to the foreground: browsers
  // auto-release the lock while backgrounded, but the Live session keeps
  // running when the farmer switches apps and comes back.
  useEffect(() => {
    if (!isSessionActive) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isSessionActive]);

  // Belt-and-braces: never leave a wake lock held after the component unmounts.
  useEffect(() => {
    return () => { releaseWakeLock(); };
  }, []);

  // Start Gemini 3.8 Live Extended Multimodal Stream
  const startLiveSession = async () => {
    if (isSessionActive || isConnecting || isStartingSessionRef.current) {
      console.warn("Live session already active or connecting. Ignoring duplicate start request.");
      return;
    }
    // Ensure clean slate before opening new session
    isStartingSessionRef.current = true;
    stopAllMedia();
    setIsConnecting(true);
    setCameraError(null);

    sessionIdRef.current += 1;
    const currentSessionId = sessionIdRef.current;

    // Auto-enter fullscreen on mobile screens for native camera app feel
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsFullscreen(true);
    }

    try {
      // The Live session authenticates with a single-use ephemeral token minted
      // server-side (/api/gemini/live-token), so no client-side API key is needed.
      const stream = await startCamera();
      if (!stream) {
        setIsConnecting(false);
        isStartingSessionRef.current = false;
        return;
      }

      // Explicitly reset session transcript refs to guarantee clear session boundaries
      transcriptsRef.current = [];
      setTranscripts([]);
      callDurationRef.current = 0;
      setCallDuration(0);

      // Output AudioContext (24kHz for crystal-clear model speech playback)
      const outputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
        latencyHint: 'interactive'
      });
      if (outputAudioCtx.state === 'suspended') {
        await outputAudioCtx.resume();
      }
      outputAudioContextRef.current = outputAudioCtx;

      // Input AudioContext (16kHz for microphone capture)
      const inputAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
        latencyHint: 'interactive'
      });
      if (inputAudioCtx.state === 'suspended') {
        await inputAudioCtx.resume();
      }
      audioContextRef.current = inputAudioCtx;

      const analyser = outputAudioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      analyser.connect(outputAudioCtx.destination);

      nextPlayTimeRef.current = outputAudioCtx.currentTime;
      lastAiSpeechEndTimeRef.current = 0;
      userSpeakingHangoverRef.current = 0;
      isAiTurnInProgressRef.current = false;
      updateVisualizer();

      let ai: any = null;
      try {
        ai = await getLiveAiClient();
      } catch (err: any) {
        console.error("Live AI client connection failed:", err);
        toast.error(lang === 'bn' 
          ? "লাইভ ভিডিও সেশন সার্ভারের সাথে সংযুক্ত হতে পারেনি। অনুগ্রহ করে আবার চেষ্টা করুন।" 
          : "Could not establish secure Live video session. Please try again.");
        setIsConnecting(false);
        isStartingSessionRef.current = false;
        return;
      }

      if (!ai) {
        throw new Error("Gemini AI instance unavailable");
      }

      const selectedLiveModel = isExtendedThinking ? LIVE_EXTENDED_THINKING_MODEL : LIVE_API_MODEL;

      // Farm Memory: silently gather today's weather + saved farm history so the
      // session can answer "can I spray today?" with real numbers and refer back
      // to past consultations. Best-effort: never blocks session start for long.
      setChipAnswers({});
      setShowQuestionPanel(false);
      let farmMemoryBlock = '';
      try {
        farmMemoryBlock = await buildFarmMemoryContext({
          userId: user?.uid || null,
          locationContext,
          globalLocation,
          lang,
        });
      } catch (memErr) {
        console.warn('Farm memory unavailable:', memErr);
      }
      setMemoryLoaded(!!farmMemoryBlock);

      const systemInstruction = isExtendedThinking
        ? `You are KrishiVip Multimodal AI Assistant (কৃষিভিপ মাল্টিমোডাল এআই সহকারী), an intelligent real-time agricultural decision-support tool observing a LIVE MULTIMODAL VIDEO STREAM from a smartphone in ${locationContext}.
MODE: GEMINI 3.8 LIVE EXTENDED THINKING (CLINICAL PATHOLOGY & DIFFERENTIAL DECISION-SUPPORT).

ROLE & IDENTITY TRANSPARENCY:
You are an AI agricultural assistant providing preliminary visual scouting and decision-support guidance. You are NOT an employee, representative, or official of BARI (Bangladesh Agricultural Research Institute) or BRRI (Bangladesh Rice Research Institute), and your suggestions are decision-support indications, not official government certifications. Always advise farmers to have critical plant symptoms verified by local Sub-Assistant Agriculture Officers (SAAO) or authorized agronomy specialists before applying regulated chemical pesticides.

CRITICAL CONVERSATIONAL & SILENCE DIRECTIVE:
1. DO NOT GREET OR SPEAK FIRST ON CONNECTION. Stay completely silent when the session starts.
2. Even as video frames arrive from the camera, DO NOT speak, do not greet, and do not describe what you see until the farmer actually speaks first or asks a question.
3. Start speaking ONLY after the user talks to you. When the farmer speaks, respond directly and concisely in natural spoken Bangla (বাংলা).
4. CLEAR, EVIDENCE-BASED GUIDANCE: Jump straight into the diagnostic assessment like an attentive agronomic advisor.
5. IMMEDIATE VALUE MANDATE:
   - If symptoms are visible or described, state the possible preliminary diagnosis and safe cultural/sanitary step immediately.
   - If inquiry is broad, ask ONE targeted diagnostic question with 2 options.
6. Switch to English ONLY if the user explicitly requests ("ইংরেজিতে বলুন" / "Speak in English").
7. Understand Bangladeshi regional farming terms and accents (Chittagong, Sylhet, Rangpur, Barisal, Jessore) effortlessly.

CAMERA & VISUAL COACHING DIRECTIVE:
- Actively coach the farmer for optimal diagnostic video:
  * If too far or blurry: "ক্যামেরাটি আক্রান্ত পাতার আরেকটু কাছে (৫-৬ ইঞ্চি) নিয়ে ২ সেকেন্ড স্থির রাখুন।"
  * If back-lit or dark: "সূর্যের আলো যাতে পাতার ওপর পড়ে সেভাবে দাঁড়ান, যাতে ছায়া না পড়ে।"
  * For hidden pests: "পাতার উল্টো পিঠ উল্টে ক্যামেরায় দেখান, নিচে পোকা বা ডিম থাকতে পারে।"

DEEP EXTENDED THINKING REASONING MANDATE (SUPER SPECIALIZED CLINICAL PATHOLOGY):
Before formulating your spoken response, quickly evaluate:
1. Visual Pathological Inspection: lesions, margins, curling, wilting, or insect damage.
2. Differential Diagnosis: distinguish look-alikes (e.g. Blast vs BLB, Mites vs Thrips, Late vs Early Blight).
3. Stepped IPM Hierarchy: Non-chemical cultural remedies first, followed by safe chemical dosages if necessary.
4. Chemical Safety: NEVER suggest banned chemicals (Paraquat, Carbofuran, Monocrotophos). For approved remedies, state generic active ingredient + popular BD brand, exact water ratio, and safety precaution.

SPOKEN DELIVERY CADENCE:
- Distill your clinical diagnosis into 1-2 structured, crystal-clear spoken Bangla sentences explaining the root diagnosis and the single most urgent recovery step. Do NOT narrate thoughts out loud.`
        : `You are a warm, highly knowledgeable Universal Plant, Gardening & Agriculture Companion (সবুজ পরামর্শক ও সার্বিক উদ্ভিদ বিশেষজ্ঞ) in Bangladesh observing a REAL-TIME LIVE MULTIMODAL VIDEO STREAM from a user's smartphone in ${locationContext}.
MODE: GEMINI 3.8 LIVE EXTENDED (FAST, BROAD & VERSATILE GREEN COMPANION).

BROAD MULTI-DOMAIN SCOPE & CAPABILITIES:
You naturally and enthusiastically help with ANY green space, gardening, or farming inquiry:
1. Rooftop & Balcony Gardening (ছাদ বাগান ও বারান্দা বাগান): Pot/container selection, container drainage (ইটের খোয়া/খোলামকুচি), lightweight potting mix ratios (বেলে-দোআঁশ মাটি, ভার্মিকম্পোস্ট/গোবর সার, কোকোপিট, বালি), rooftop heat & wind protection, and organic liquid boosters (সরিষার খৈল পচা পানি, কলার খোসা ভেজানো পানি).
2. Indoor Houseplants & Home Decor (ইনডোর গাছপালা): Suggesting best indoor plants for homes, bedrooms, and offices in Bangladesh (Money Plant/Pothos, Snake Plant/Sansevieria, ZZ Plant, Peace Lily, Spider Plant, Aloe Vera, Areca Palm), light suitability (low light, bright indirect sun), watering frequency (checking topsoil with finger), and air-purification qualities.
3. Kitchen Gardens & Herbs: Chili (মরিচ), tomato, coriander (ধনেপাতা), mint (পুদিনা), lemon (কাগজি লেবু), ginger in pots or small verandas.
4. Farming, Crops & Orchards: Agricultural fields, seasonal planting calendar, healthy leaf checks, and garden pests (mealybugs/ছাতরা পোকা, aphids/জাব পোকা, whiteflies, caterpillars).
5. Eco-friendly & Kitchen Remedies: Neem oil + soap water spray, wood ash (ছাই), compost tea, natural insect repellents.

CRITICAL CONVERSATIONAL & SILENCE DIRECTIVE:
1. DO NOT GREET OR SPEAK FIRST ON CONNECTION. Stay completely silent when the session starts.
2. Even as video frames arrive from the camera, DO NOT speak, do not greet, and do not describe what you see until the user actually speaks first or asks a question.
3. Start speaking ONLY after the user speaks. Respond directly, warmly, and concisely in natural spoken Bangla (বাংলা).
4. STRICT BAN ON META-ANNOUNCEMENTS & FILLERS: NEVER say robotic phrases like "আমি আপনার ভিডিও দেখছি", "উপায়গুলো দেখছি", "আমি এআই", or announce looking at camera footage. Jump straight into answering the user's question.
5. Switch to English ONLY if the user explicitly says "Speak in English" or "ইংরেজিতে বলুন".

LIVE CONVERSATIONAL & VISUAL SCOUTING CADENCE:
1. Continuous Multimodal Observation: You receive 1 JPEG video frame every second from the camera. Continuously observe whatever the user shows—whether it is an indoor decorative pot, a rooftop planter, a balcony railing pot, kitchen garden herb, seedling, leaf, or farm crop.
2. Ultra-low latency spoken turns: Keep responses short, natural, and conversational (1-2 sentences at a time, strictly under 25 words). Act like a friendly, attentive human mentor in the garden with them.
3. Rapid Interactivity & Natural Dialogue: Answer directly, then invite them to speak (e.g., "আর কিছু দেখতে চান?", "জল দেওয়া হয়েছে?"). Never give long speeches.
4. IMMEDIATE BARGE-IN & INTERRUPTION YIELDING: If the user says "দাঁড়াও", "থামো", "Wait", "Stop", or speaks while you are talking, immediately stop your previous sentence and address their new question without repeating earlier words.
5. Helpful Camera Guidance:
   * "ক্যামেরাটি পাতা বা টবের আরেকটু কাছে আনুন।"
   * "টবের মাটি বা পাতার নিচের দিকটা একটু দেখান।"
   * "রোদের বিপরীতে ধরুন যাতে পাতা স্পষ্ট দেখা যায়।"
6. If you need details, ask ONE simple, friendly question at a time (e.g., "টবে কি দিনে রোদ পায়?", "মাটি কি বেশি ভেজা নাকি শুকনা?").
7. Plant & Chemical Safety: For home gardens, indoor pots, and edible herbs, strongly prioritize safe organic remedies. Never recommend banned toxic chemicals (Paraquat, Carbofuran, Monocrotophos).
8. SINGLE RESPONSE MANDATE: Give exactly ONE concise, complete spoken answer per inquiry. Never repeat or restart your answer.`;

      // Append the silent Farm Memory block (weather + saved history) when available
      const systemInstructionWithMemory = farmMemoryBlock
        ? `${systemInstruction}\n\n${farmMemoryBlock}`
        : systemInstruction;

      const liveConfig: any = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: lang === 'bn' ? "Kore" : "Zephyr" }
          }
        },
        outputAudioTranscription: {},
        inputAudioTranscription: {},
        systemInstruction: systemInstructionWithMemory,
      };

      if (isExtendedThinking) {
        liveConfig.thinkingConfig = {
          thinkingLevel: ThinkingLevel.LOW
        };
      }

      let activeLiveSession: any = null;

      const liveCallbacks = {
        onopen: async () => {
          if (sessionIdRef.current !== currentSessionId) return;
          setIsConnecting(false);
          isStartingSessionRef.current = false;
          setIsSessionActive(true);
          acquireWakeLock();
          setLiveState('listening');
          playTone(880, 0.15, 0.08);

          // Connect microphone stream
          try {
            const audioSource = inputAudioCtx.createMediaStreamSource(stream);
            const userAnalyser = inputAudioCtx.createAnalyser();
            userAnalyser.fftSize = 64;
            userAnalyserRef.current = userAnalyser;
            audioSource.connect(userAnalyser);

            const processor = inputAudioCtx.createScriptProcessor(2048, 1, 1);
            processorRef.current = processor;

            // Silent gain node keeps ScriptProcessor active without routing mic to speakers
            const muteGain = inputAudioCtx.createGain();
            muteGain.gain.value = 0;
            processor.connect(muteGain);
            muteGain.connect(inputAudioCtx.destination);

            processor.onaudioprocess = (e) => {
              if (isMutedRef.current || sessionIdRef.current !== currentSessionId) return;
              const inputData = e.inputBuffer.getChannelData(0);

              // 1. Calculate microphone RMS volume
              let sum = 0;
              for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
              }
              const rms = Math.sqrt(sum / inputData.length);

              const outCtx = outputAudioContextRef.current;
              const isAiPlaying = sourceNodesRef.current.length > 0 || 
                                 (outCtx ? outCtx.currentTime < nextPlayTimeRef.current : false);
              const isAiActive = isAiTurnInProgressRef.current || isAiPlaying;

              // 2. Active User Speech Detection
              const isUserSpeaking = rms > 0.02;
              if (isUserSpeaking) {
                userSpeakingHangoverRef.current = Date.now() + 800;
              }

              // 3. INSTANT BARGE-IN & INTERRUPTION
              // If user speaks deliberately while AI is active -> immediately cut local audio playback!
              if (isAiActive && rms > 0.035) {
                const interruptStart = performance.now();
                sourceNodesRef.current.forEach(node => {
                  try { node.stop(); } catch (err) {}
                });
                sourceNodesRef.current = [];
                if (outCtx) {
                  nextPlayTimeRef.current = outCtx.currentTime;
                }
                isAiTurnInProgressRef.current = false;
                isAiTurnCancelledRef.current = true;
                clearSubtitles();
                setLiveState('listening');
                const measuredLatency = Math.round(performance.now() - interruptStart);
                setMeasuredInterruptionLatencyMs(measuredLatency);
              } else if (isAiPlaying && !isUserSpeaking) {
                // AI is speaking and user is quiet: drop low room leak so AI doesn't echo into itself
                return;
              }

              // 4. Standard PCM 16 conversion & stream transmission
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }

              const buffer = new Uint8Array(pcm16.buffer);
              let binary = '';
              for (let i = 0; i < buffer.byteLength; i++) {
                binary += String.fromCharCode(buffer[i]);
              }
              const base64 = btoa(binary);

              const currentSession = activeLiveSession || sessionRef.current;
              if (currentSession && sessionIdRef.current === currentSessionId) {
                try {
                  currentSession.sendRealtimeInput({
                    audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
                  });
                } catch (err) {
                  console.warn("Realtime audio send error:", err);
                }
              }
            };

            audioSource.connect(processor);

            // Launch 1 FPS Video Frame Loop (paused during active user or AI speaking)
            frameIntervalRef.current = setInterval(() => {
              const currentSession = activeLiveSession || sessionRef.current;
              if (currentSession && sessionIdRef.current === currentSessionId) {
                sendVideoFrame(currentSession);
              }
            }, 1000);

            // Duration Timer
            durationIntervalRef.current = setInterval(() => {
              callDurationRef.current += 1;
              setCallDuration(prev => prev + 1);
            }, 1000);

            toast.success(lang === 'bn' 
              ? '🔴 লাইভ মাল্টিমোডাল এআই সেশন সংযুক্ত হয়েছে!' 
              : '🔴 Live Multimodal AI session connected!');

          } catch (mediaErr) {
            console.error("Audio pipeline error:", mediaErr);
            stopAllMedia();
          }
        },

        onmessage: (message: LiveServerMessage) => {
          if (sessionIdRef.current !== currentSessionId) return;

          // Discard subsequent chunks if the response was cancelled or stopped by user
          if (isAiTurnCancelledRef.current) {
            if (message.serverContent?.turnComplete || message.serverContent?.interrupted) {
              isAiTurnCancelledRef.current = false;
            }
            return;
          }

          // 1. Play all audio parts in this model turn
          const parts = message.serverContent?.modelTurn?.parts;
          if (parts && parts.length > 0) {
            isAiTurnInProgressRef.current = true;
            for (const part of parts) {
              if (part.inlineData?.data) {
                playAudioChunk(part.inlineData.data);
                setLiveState('speaking');
              }
            }
          }

          // 2. Extract spoken transcription returned by Gemini Live
          const spokenText = message.serverContent?.outputTranscription?.text;
          if (spokenText && spokenText.trim().length > 0) {
            isAiTurnInProgressRef.current = true;
            processIncomingModelText(spokenText);
          }

          // 3. Extract farmer input transcription returned by Gemini Live
          const userSpokenText = (message.serverContent as any)?.inputTranscription?.text;
          if (userSpokenText && userSpokenText.trim().length > 0) {
            const userTurn: TranscriptTurn = {
              id: `usr_${Date.now()}`,
              role: 'user',
              text: userSpokenText.trim(),
              timestamp: new Date().toISOString()
            };
            transcriptsRef.current.push(userTurn);
            setTranscripts(prev => [...prev, userTurn]);
            enqueueSubtitleSentence(userSpokenText.trim(), 'user');
          }

          // 4. Capture internal thoughts when Extended Thinking is active
          if (message.serverContent?.modelTurn?.parts) {
            for (const part of message.serverContent.modelTurn.parts) {
              if ((part as any).thought && part.text) {
                isAiTurnInProgressRef.current = true;
                setLiveThinkingText(prev => (prev + ' ' + part.text).slice(-1200));
                setLiveState('analyzing');
              }
            }
          }

          // 5. Flush remaining buffer and gracefully release acoustic lock after audio playback finishes
          if (message.serverContent?.turnComplete) {
            flushRemainingModelText();
            if (sourceNodesRef.current.length === 0) {
              isAiTurnInProgressRef.current = false;
              setLiveState('listening');
            }
          }

          // 6. Interruption handling
          if (message.serverContent?.interrupted) {
            isAiTurnInProgressRef.current = false;
            clearSubtitles();
            sourceNodesRef.current.forEach(node => {
              try { node.stop(); } catch (e) {}
            });
            sourceNodesRef.current = [];
            if (outputAudioContextRef.current) {
              nextPlayTimeRef.current = outputAudioContextRef.current.currentTime;
            }
            setLiveState('listening');
          }
        },

        onclose: () => {
          if (sessionIdRef.current === currentSessionId) {
            stopAllMedia();
          }
        },

        onerror: (err: any) => {
          if (sessionIdRef.current === currentSessionId) {
            console.error("Gemini 3.8 Live Extended Error:", err);
            toast.error(lang === 'bn' 
              ? "লাইভ ভিডিও সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।" 
              : "Live video stream error. Please try again.");
            stopAllMedia();
          }
        }
      };

      let activeSession: any = null;
      try {
        activeSession = await ai.live.connect({
          model: selectedLiveModel,
          config: liveConfig,
          callbacks: liveCallbacks
        });
      } catch (connectError) {
        if (isExtendedThinking && sessionIdRef.current === currentSessionId) {
          console.warn("Live Video Extended Thinking connection error, falling back to Gemini 3.8 Live Extended:", connectError);
          toast(lang === 'bn' 
            ? 'লাইভ এক্সটেন্ডেড মডেলে (Gemini 3.8 Live Extended) ভিডিও সংযোগ করা হচ্ছে...' 
            : 'Connecting via Gemini 3.8 Live Extended video mode...', { icon: '⚡' });
          const fallbackConfig = { ...liveConfig };
          delete fallbackConfig.thinkingConfig;
          activeSession = await ai.live.connect({
            model: LIVE_API_MODEL,
            config: fallbackConfig,
            callbacks: liveCallbacks
          });
        } else {
          throw connectError;
        }
      }
      activeLiveSession = activeSession;
      if (sessionIdRef.current !== currentSessionId) {
        try { activeSession.close(); } catch (e) {}
        return;
      }
      sessionRef.current = activeSession;
      isStartingSessionRef.current = false;

    } catch (err: any) {
      console.error("Failed to start Live Video Copilot:", err);
      setIsConnecting(false);
      isStartingSessionRef.current = false;
      stopAllMedia();
    }
  };

  // Extraction of live session data into farmer profile & credit dossier (Summary Only - Never verbatim)
  const saveLiveSessionDossier = async (dialogueTurns: TranscriptTurn[], duration: number) => {
    // Isolated temporary guest session to prevent attribution to shared identifiers
    let guestSessionId = typeof window !== 'undefined' ? sessionStorage.getItem('agri_temp_guest_session_id') : null;
    if (!guestSessionId) {
      guestSessionId = `guest_session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('agri_temp_guest_session_id', guestSessionId);
      }
    }
    const isGuest = !user?.uid;
    const effectiveUid = user?.uid || guestSessionId;
    const effectiveName = user?.displayName || (isGuest ? (lang === 'bn' ? 'অতিথি কৃষক' : 'Guest Farmer') : '');

    // Safe generic fallback steps when the model could not distill specific ones
    const defaultActionSteps = lang === 'bn'
      ? ['সন্দেহজনক আক্রান্ত পাতা আলাদা করে ফেলুন', 'পরিষ্কার ছবি তুলে সংরক্ষণ করুন', '৩ দিন পর আবার লাইভ ভিডিওতে দেখান']
      : ['Isolate suspicious affected leaves', 'Keep clear photos for comparison', 'Re-check with live video in 3 days'];

    // 1. If dialogue occurred, distill an executive summary via server-side AI proxy with explicit provenance
    if (dialogueTurns.length > 0) {
      const dialogueText = dialogueTurns
        .map(t => `${t.role === 'user' ? 'কৃষক' : 'কৃষি এআই'}: ${t.text}`)
        .join('\n');

      const prompt = `You are an AI agricultural assistant and data auditor in Bangladesh.
A live video and voice consultation session just took place between a farmer and an AI agronomist.
Session Duration: ${Math.max(1, Math.round(duration))} seconds.
Location context: ${locationContext}.
Language: ${lang === 'bn' ? 'Bangla' : 'English'}.

CONVERSATION CONTEXT:
${dialogueText}

CRITICAL PRIVACY & PROVENANCE REQUIREMENT:
- DO NOT save or output verbatim dialogue or quotes. 
- Distill ONLY a clean, professional, synthesized 2-3 sentence agricultural summary and key factual bullet points.
- Identify the origin of facts:
  * Farmer-stated symptoms -> [Self-reported]
  * AI visual suggestions -> [AI-generated, unverified]
- If a crop or disease was not mentioned, leave crop null.

Return a JSON object with this exact structure:
{
  "crop": "Detected crop (e.g., টমেটো, মরিচ, ধান, বেগুন, আলু) or null",
  "diseaseOrIssue": "Identified disease, pest, or problem or null",
  "sessionTitle": "Concise, descriptive title for this session (in ${lang === 'bn' ? 'Bangla' : 'English'})",
  "comprehensiveSummary": "A clear, professional synthesized 2-3 sentence summary labeled as preliminary AI guidance. DO NOT include verbatim dialogue.",
  "keyFacts": ["Array of 3-5 concise factual bullet points labeled with origin [Self-reported] or [AI-generated, unverified]"],
  "insightForCreditProfile": "Credit & farm management observation in ${lang === 'bn' ? 'Bangla' : 'English'}",
  "actionSteps": "Array of exactly 2-3 extremely short imperative action steps for TODAY/THIS WEEK in ${lang === 'bn' ? 'Bangla' : 'English'} (max 8 words each, priority order, based only on what was discussed; at most ONE chemical step and only if clearly needed, phrased with a safety caution; never include banned chemicals)"
}`;

      try {
        const proxyResp = await fetchWithTimeout('/api/ai-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gemini-3.5-flash-lite',
            contents: prompt,
            config: {
              responseMimeType: 'application/json'
            }
          }),
          timeoutMs: 45000,
          retries: 0
        });

        if (proxyResp.ok) {
          const proxyData = await readJsonWithTimeout<any>(proxyResp, 45000);
          const parsed = JSON.parse(proxyData.text || '{}');
          const title = parsed.sessionTitle || (lang === 'bn' ? 'লাইভ ভিডিও ও ভয়েস পরামর্শ সেশন' : 'Live Video & Voice Consultation Session');
          const summary = parsed.comprehensiveSummary || (lang === 'bn' 
            ? 'সরাসরি ভিডিও ক্যামেরায় ফসলের স্বাস্থ্য পর্যবেক্ষণ করা হয়েছে এবং বালাই ব্যবস্থাপনার প্রাথমিক পরামর্শ প্রদান করা হয়েছে (এআই অনুমান, অপ্রমাণিত)।'
            : 'Visual crop health inspection completed with IPM management advisory provided (AI-generated, unverified).');
          const keyFacts: string[] = Array.isArray(parsed.keyFacts) && parsed.keyFacts.length > 0 
            ? parsed.keyFacts 
            : [
                `কলের ব্যাপ্তি: ${Math.max(1, Math.round(duration))} সেকেন্ড [সিস্টেম রেকর্ড]`,
                `পদ্ধতি: লাইভ ক্যামেরা ভিজ্যুয়াল মূল্যায়ন [AI-generated, unverified]`,
                ...(parsed.crop ? [`ফসল: ${parsed.crop} [AI visual identification]`] : [])
              ];
          const crop = parsed.crop || undefined;
          const insight = parsed.insightForCreditProfile || (lang === 'bn' ? 'লাইভ ক্যামেরায় ডিজিটাল পরামর্শ গ্রহণ' : 'Conducted live visual consultation');
          const actionSteps: string[] = Array.isArray(parsed.actionSteps)
            ? parsed.actionSteps
                .slice(0, 3)
                .map((s: any) => String(s).trim())
                .filter((s: string) => s.length > 0)
            : [];

          await recordFarmerInteractionEvent({
            userId: effectiveUid,
            fullName: effectiveName,
            eventType: 'voice_consultation',
            title,
            summary,
            keyFacts,
            crop,
            insight,
            origin: isGuest ? 'demo_excluded' : 'ai_unverified',
            evidenceStatus: isGuest ? 'Demo, excluded from assessment' : 'AI-generated, unverified',
            isDemoOrGuest: isGuest
          });

          setLastSavedSession({
            title,
            summary,
            crop,
            keyFacts,
            actionSteps: actionSteps.length > 0 ? actionSteps : defaultActionSteps,
            duration: Math.max(1, Math.round(duration))
          });

          toast.success(
            isGuest 
              ? (lang === 'bn' 
                  ? 'পরামর্শের সারসংক্ষেপ প্রস্তুত (অতিথি সেশন - ডাটাবেজ থেকে সুরক্ষিত)!' 
                  : 'Consultation summary prepared (Guest session - isolated from database)!')
              : (lang === 'bn' 
                  ? 'পরামর্শের সারসংক্ষেপ আপনার স্মার্ট কৃষক কার্ডে সংরক্ষিত হয়েছে (AI-generated, unverified)!' 
                  : 'Consultation summary logged to your Krishi Dossier (AI-generated, unverified)!')
          );
          return;
        }
      } catch (aiErr) {
        console.warn("AI summary generation error, falling back to clean synthesis:", aiErr);
      }
    }

    // 2. Factual fallback summary (NO verbatim transcripts saved)
    const summaryText = dialogueTurns.length > 0
      ? (lang === 'bn' 
          ? `কৃষক এবং এআই কৃষি সহকারীর মধ্যে ${Math.max(1, Math.round(duration))} সেকেন্ডের লাইভ ভিডিও পর্যবেক্ষণ সম্পন্ন হয়েছে। সরাসরি ক্যামেরায় দৃশ্যমান লক্ষণ আলোচনা করা হয়েছে (AI-generated, unverified)।`
          : `Live video agronomic scouting completed (${Math.max(1, Math.round(duration))}s). Real-time visual crop symptoms discussed (AI-generated, unverified).`)
      : (lang === 'bn' 
          ? `কৃষক ${Math.max(1, Math.round(duration))} সেকেন্ডের জন্য লাইভ ক্যামেরা পরিদর্শন সম্পন্ন করেছেন। কোনো নির্দিষ্ট রোগের বিবরণ রেকর্ড করা হয়নি।` 
          : `Farmer conducted a ${Math.max(1, Math.round(duration))}s visual crop inspection.`);

    const title = lang === 'bn' ? 'লাইভ ক্যামেরা পরিদর্শন সেশন' : 'Live Camera Field Inspection';
    const keyFacts = [
      `কলের ব্যাপ্তি: ${Math.max(1, Math.round(duration))} সেকেন্ড [সিস্টেম রেকর্ড]`,
      `উৎস: লাইভ ক্যামেরা ভিজ্যুয়াল চেক [AI-generated, unverified]`
    ];

    await recordFarmerInteractionEvent({
      userId: effectiveUid,
      fullName: effectiveName,
      eventType: 'voice_consultation',
      title,
      summary: summaryText,
      keyFacts,
      insight: lang === 'bn' ? 'লাইভ ক্যামেরা পরিদর্শন সম্পন্ন করেছেন' : 'Conducted live camera inspection',
      origin: isGuest ? 'demo_excluded' : 'ai_unverified',
      evidenceStatus: isGuest ? 'Demo, excluded from assessment' : 'AI-generated, unverified',
      isDemoOrGuest: isGuest
    });

    setLastSavedSession({
      title,
      summary: summaryText,
      keyFacts,
      actionSteps: defaultActionSteps,
      duration: Math.max(1, Math.round(duration))
    });

    toast.success(
      isGuest
        ? (lang === 'bn' 
            ? 'পরিদর্শনের সারসংক্ষেপ সংরক্ষিত (অতিথি সেশন - ডাটাবেজ বহির্ভূত)' 
            : 'Inspection summary stored (Guest session - isolated)')
        : (lang === 'bn' 
            ? 'পরিদর্শন খতিয়ান স্মার্ট কৃষক কার্ডে সংরক্ষিত হয়েছে (AI-generated, unverified)' 
            : 'Inspection summary logged to your Krishi Dossier (AI-generated, unverified)')
    );
  };

  // Stop all media & connections
  const stopAllMedia = () => {
    sessionIdRef.current += 1;
    isStartingSessionRef.current = false;
    releaseWakeLock();
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }

    sourceNodesRef.current.forEach(node => {
      try { node.stop(); } catch (e) {}
    });
    sourceNodesRef.current = [];

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch (e) {}
      sessionRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }

    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      try {
        outputAudioContextRef.current.close();
      } catch (e) {}
      outputAudioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    // Capture duration and transcripts for persistent dossier compounding (Meaningful evidence gate, NOT arbitrary 90s)
    const currentTranscripts = [...transcriptsRef.current];
    const currentDuration = callDurationRef.current || callDuration;

    // A session is eligible for summary only if meaningful dialogue / crop symptoms were exchanged
    const hasMeaningfulDialogue = currentTranscripts.some(t => t.text && t.text.trim().length > 3);

    if (hasMeaningfulDialogue) {
      setIsSavingSummary(true);
      saveLiveSessionDossier(currentTranscripts, currentDuration)
        .finally(() => setIsSavingSummary(false));
    } else {
      if (currentDuration >= 2) {
        toast(
          lang === 'bn' 
            ? 'কোনো ফসলের লক্ষণ বা বার্তা বিনিময় হয়নি বলে কৃষক খতিয়ানে কোনো অনুমান সংরক্ষণ করা হয়নি।' 
            : 'No crop inquiry or dialogue was exchanged; no speculative entry was logged.',
          { icon: 'ℹ️' }
        );
      }
    }

    // Explicitly reset session and transcript state to prevent bleed across sessions
    transcriptsRef.current = [];
    setIsSessionActive(false);
    setIsConnecting(false);
    setIsCameraActive(false);
    setIsTorchOn(false);
    setCallDuration(0);
    callDurationRef.current = 0;
    setLiveState('idle');
    setLiveThinkingText('');
    setShowThinkingDetails(false);
    clearSubtitles();
  };

  // Handle tap-to-focus: applies hardware autofocus constraints where supported
  const handleTapVideo = async (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    } else {
      return;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    setFocusPoint({ x, y });
    playTone(900, 0.05, 0.03);

    // Apply supported camera hardware focus controls
    const videoTrack = mediaStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      try {
        const capabilities: any = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
        if (capabilities.focusMode && Array.isArray(capabilities.focusMode)) {
          const mode = capabilities.focusMode.includes('continuous') 
            ? 'continuous' 
            : capabilities.focusMode.includes('single-shot') 
            ? 'single-shot' 
            : null;
          if (mode) {
            await (videoTrack as any).applyConstraints({
              advanced: [{ focusMode: mode }]
            });
          }
        }
      } catch (focusErr) {
        console.debug("Optical autofocus constraint notice:", focusErr);
      }
    }

    setTimeout(() => {
      setFocusPoint(null);
    }, 1200);
  };
  const handleSelectPreset = (preset: DemoPreset | null) => {
    setActiveDemoPreset(preset);
    if (preset) {
      const img = new Image();
      img.src = preset.svgImage;
      img.onload = () => {
        presetImageRef.current = img;
        if (sessionRef.current && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            canvasRef.current.width = 480;
            canvasRef.current.height = 360;
            ctx.drawImage(img, 0, 0, 480, 360);
            const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.6);
            const b64 = dataUrl.split(',')[1];
            if (b64) {
              try {
                sessionRef.current.sendRealtimeInput({
                  video: { data: b64, mimeType: 'image/jpeg' }
                });
              } catch (e) {}
            }
          }
        }
      };
      toast.success(lang === 'bn' 
        ? `💼 ডেমো প্রিসেট চালু: ${preset.nameBn}` 
        : `💼 Demo Preset Active: ${preset.nameEn}`);
    } else {
      presetImageRef.current = null;
      toast(lang === 'bn' ? '📷 ক্যামেরা ফিডে ফেরত যাওয়া হয়েছে' : '📷 Switched back to Live Camera');
    }
  };

  const handleOpenPrescriptionForPreset = (preset: DemoPreset) => {
    setCurrentRxData({
      rxId: `RX-BD-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
      crop: lang === 'bn' ? preset.cropBn : preset.cropEn,
      cropStage: lang === 'bn' ? preset.stageBn : preset.stageEn,
      location: preset.location,
      diseaseName: lang === 'bn' ? preset.diseaseBn : preset.diseaseEn,
      pathogen: preset.pathogen,
      severity: lang === 'bn' ? preset.severityBn : preset.severityEn,
      confidence: preset.confidence,
      symptoms: lang === 'bn' ? preset.symptomsBn : preset.symptomsEn,
      culturalSteps: lang === 'bn' ? preset.culturalStepsBn : preset.culturalStepsEn,
      organicSteps: lang === 'bn' ? preset.organicStepsBn : preset.organicStepsEn,
      chemicalSteps: lang === 'bn' ? preset.chemicalStepsBn : preset.chemicalStepsEn,
      harvestIntervalDays: preset.harvestIntervalDays,
      weatherSnapshot: preset.weatherSnapshot,
      sampleImage: preset.svgImage
    });
    setIsRxModalOpen(true);
  };

  const handleOpenCurrentLivePrescription = () => {
    if (activeDemoPreset) {
      handleOpenPrescriptionForPreset(activeDemoPreset);
      return;
    }
    setCurrentRxData({
      rxId: `RX-BD-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
      crop: lastSavedSession?.crop || (lang === 'bn' ? 'শনাক্তকৃত ফসল / উদ্ভিদ' : 'Observed Crop / Plant'),
      cropStage: lang === 'bn' ? 'মাঠ পর্যায় (লাইভ স্ক্যান)' : 'Field Stage (Live Multimodal Scan)',
      location: locationContext || 'Bangladesh',
      diseaseName: lastSavedSession?.title || (lang === 'bn' ? 'সম্ভাব্য রোগের লক্ষণ (প্রাথমিক পর্যবেক্ষণ)' : 'Preliminary Visual Symptom Observation'),
      pathogen: lang === 'bn' ? 'অনির্ধারিত (সরেজমিন পর্যবেক্ষণ আবশ্যক)' : 'Unconfirmed (Field Agronomic Inspection Required)',
      severity: lang === 'bn' ? 'যাচাই করা হয়নি (Not Assessed)' : 'Not Assessed',
      confidence: null,
      chemicalGated: true,
      symptoms: lastSavedSession?.keyFacts && lastSavedSession.keyFacts.length > 0 
        ? lastSavedSession.keyFacts 
        : [
            lang === 'bn' ? 'লাইভ ভিডিওতে পাতার রঙ ও কলার প্রাথমিক অস্বাভাবিকতা পরিলক্ষিত' : 'Preliminary foliar discoloration noticed on live video'
          ],
      investigationSteps: [
        lang === 'bn' ? 'আক্রান্ত পাতার তাজা নমুনা সংগ্রহ করে নিকটস্থ উপজেলা কৃষি অফিসে (DAE/SAAO) প্রদর্শন করুন।' : 'Collect fresh leaf sample for physical inspection by Upazila Agriculture Officer (DAE/SAAO).',
        lang === 'bn' ? 'পাতার নিচের পিঠ ও কাণ্ডে ম্যাগনিফায়িং গ্লাস বা হ্যান্ড লেন্স দিয়ে জীবাণু বা ডিম্ব গুচ্ছ পরীক্ষা করুন।' : 'Examine foliar undersides with a hand lens for mycelia, spores, or insect egg clusters.',
        lang === 'bn' ? 'জমি বা টবের ড্রেনেজ ব্যবস্থা ও মাটির আর্দ্রতা পরীক্ষা করে শিকড়ের স্বাস্থ্য পর্যবেক্ষণ করুন।' : 'Check furrow drainage, soil compaction, and root health.'
      ],
      culturalSteps: [
        lang === 'bn' ? 'আক্রান্ত পাতা সাবধানে কেটে ধ্বংস করুন এবং জমি বা টবের ড্রেনেজ নিশ্চিত করুন।' : 'Prune severely infected leaves safely and ensure adequate container drainage.',
        lang === 'bn' ? 'ইউরিয়া সারের অতিরিক্ত প্রয়োগ সাময়িক স্থগিত রাখুন।' : 'Temporarily suspend high-nitrogen urea fertilizer.'
      ],
      organicSteps: [
        lang === 'bn' ? 'প্রাথমিক জৈব সুরক্ষা হিসেবে নিম তেলের নির্যাস (৫ মিলি/লিটার সাবান পানিসহ) ব্যবহার করতে পারেন।' : 'Apply botanical Neem oil spray (5ml/L with mild soapy water) as safe organic protection.'
      ],
      chemicalSteps: [
        lang === 'bn' ? '🔒 রাসায়নিক চিকিৎসা স্থগিত: মাঠ পর্যায়ের অনুমোদিত কৃষি কর্মকর্তা বা উদ্ভিদ রোগতত্ত্ববিদের সরেজমিন যাচাই ও প্রেসক্রিপশন ব্যতিরেকে কোনো রাসায়নিক কীটনাশক প্রয়োগ করবেন না।' : '🔒 Chemical Rx Withheld: Direct field verification by an authorised agricultural extension officer or plant pathologist is required before chemical application.'
      ],
      harvestIntervalDays: undefined,
      weatherSnapshot: undefined
    });
    setIsRxModalOpen(true);
  };

  // Tap-to-answer: stream the farmer's tapped answer into the live conversation
  const handleChipAnswer = (qKey: string, qBn: string, qEn: string, optBn: string, optEn: string) => {
    const session = sessionRef.current;
    if (!session) {
      toast.error(lang === 'bn' ? 'সেশন এখনো প্রস্তুত নয়।' : 'Session is not ready yet.');
      return;
    }
    const question = lang === 'bn' ? qBn : qEn;
    const answer = lang === 'bn' ? optBn : optEn;
    try {
      session.sendRealtimeInput({
        text: `[কৃষকের ট্যাপ-উত্তর / Tapped answer] ${question} → ${answer}`
      });
      setChipAnswers(prev => ({ ...prev, [qKey]: answer }));
      playTone(1400, 0.08, 0.08);
    } catch (err) {
      console.warn('Could not send tapped answer:', err);
      toast.error(lang === 'bn' ? 'উত্তর পাঠানো যায়নি, আবার চেষ্টা করুন।' : 'Could not send the answer, please try again.');
    }
  };

  // Post-session action card: stop any running voice playback and free the blob URL
  const stopActionAudio = () => {
    if (actionAudioRef.current) {
      try {
        actionAudioRef.current.pause();
        actionAudioRef.current.currentTime = 0;
      } catch (e) {}
      actionAudioRef.current = null;
    }
    if (actionAudioUrlRef.current) {
      try { URL.revokeObjectURL(actionAudioUrlRef.current); } catch (e) {}
      actionAudioUrlRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    setIsActionAudioPlaying(false);
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount: stop voice + free URL
      if (actionAudioRef.current) {
        try { actionAudioRef.current.pause(); } catch (e) {}
        actionAudioRef.current = null;
      }
      if (actionAudioUrlRef.current) {
        try { URL.revokeObjectURL(actionAudioUrlRef.current); } catch (e) {}
        actionAudioUrlRef.current = null;
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
      }
    };
  }, []);

  // Read the post-session action card aloud in Bangla (Gemini TTS with Web Speech fallback)
  const handleSpeakActionCard = async () => {
    if (!lastSavedSession || isActionAudioLoading) return;
    if (isActionAudioPlaying) {
      stopActionAudio();
      return;
    }
    const L = lang === 'bn';
    const parts = [
      lastSavedSession.title,
      lastSavedSession.summary,
      ...(lastSavedSession.actionSteps || []).map((s, i) => `${L ? `${i + 1}। ` : `${i + 1}. `}${s}`),
      L
        ? 'এটি প্রাথমিক কৃত্রিম বুদ্ধিমত্তার পরামর্শ; প্রয়োগের আগে যাচাই করে নিন।'
        : 'This is preliminary AI advice; please verify before acting.',
    ];
    const text = parts.join(' ');
    setIsActionAudioLoading(true);
    try {
      const b64 = await generateSpeech(text);
      if (!b64) throw new Error('No audio data returned');
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      actionAudioUrlRef.current = url;
      const audio = new Audio(url);
      actionAudioRef.current = audio;
      audio.onended = () => stopActionAudio();
      audio.onerror = () => stopActionAudio();
      await audio.play();
      setIsActionAudioPlaying(true);
    } catch (err) {
      console.warn('Action card TTS failed, falling back to Web Speech:', err);
      if ('speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text.replace(/[*#_`🔒]/g, ''));
          utterance.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
          utterance.rate = 0.95;
          utterance.onend = () => setIsActionAudioPlaying(false);
          utterance.onerror = () => setIsActionAudioPlaying(false);
          window.speechSynthesis.speak(utterance);
          setIsActionAudioPlaying(true);
        } catch (synthErr) {
          toast.error(lang === 'bn' ? 'ভয়েস চালু করা যায়নি।' : 'Could not start voice playback.');
        }
      } else {
        toast.error(lang === 'bn' ? 'ভয়েস চালু করা যায়নি।' : 'Could not start voice playback.');
      }
    } finally {
      setIsActionAudioLoading(false);
    }
  };

  // Download a 3-day follow-up reminder (.ics) that opens in the phone calendar
  const handleDownloadReminder = () => {
    if (!lastSavedSession) return;
    try {
      const start = new Date(Date.now() + 3 * 86400000);
      start.setHours(8, 0, 0, 0);
      const end = new Date(start.getTime() + 30 * 60000);
      const fp = (n: number) => n.toString().padStart(2, '0');
      const fmtLocal = (d: Date) =>
        `${d.getFullYear()}${fp(d.getMonth() + 1)}${fp(d.getDate())}T${fp(d.getHours())}${fp(d.getMinutes())}00`;
      const fmtUtc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const esc = (s: string) =>
        (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
      const title = lang === 'bn'
        ? `🌾 ফসল আবার দেখুন: ${lastSavedSession.title}`
        : `🌾 Re-check crop: ${lastSavedSession.title}`;
      const desc = [
        lastSavedSession.summary,
        ...(lastSavedSession.actionSteps || []).map((s, i) => `${i + 1}. ${s}`),
        lang === 'bn' ? 'Agri-Copilot (এআই-পরামর্শ, যাচাইকৃত নয়)' : 'Agri-Copilot (AI advice, unverified)',
      ].join('\n');
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//AgriCopilot//Krishi Reminder//BN',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `UID:krishi-${Date.now()}@agri-copilot.netlify.app`,
        `DTSTAMP:${fmtUtc(new Date())}`,
        `DTSTART:${fmtLocal(start)}`,
        `DTEND:${fmtLocal(end)}`,
        `SUMMARY:${esc(title)}`,
        `DESCRIPTION:${esc(desc)}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT30M',
        'ACTION:DISPLAY',
        `DESCRIPTION:${esc(title)}`,
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'krishi-reminder-3din.ics';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast.success(
        lang === 'bn'
          ? '📅 রিমাইন্ডার ফাইল তৈরি হয়েছে — খুলে ফোনের ক্যালেন্ডারে সেভ করুন (৩ দিন পর, সকাল ৮টা)।'
          : '📅 Reminder file ready — open it to save to your phone calendar (in 3 days, 8 AM).',
        { duration: 6000 }
      );
    } catch (err) {
      console.error('Reminder generation failed:', err);
      toast.error(lang === 'bn' ? 'রিমাইন্ডার তৈরি করা যায়নি।' : 'Could not create the reminder.');
    }
  };

  // Share the session outcome with family on WhatsApp (text only, honest label)
  const handleShareSessionWhatsApp = () => {
    if (!lastSavedSession) return;
    const stepsText = (lastSavedSession.actionSteps || []).map((s, i) => `${i + 1}. ${s}`).join('\n');
    const lines: string[] = [`🌾 ${lastSavedSession.title}`, '', lastSavedSession.summary];
    if (stepsText) {
      lines.push('', `✅ ${lang === 'bn' ? 'আজ যা করবেন' : 'To do'}:`, stepsText);
    }
    lines.push(
      '',
      lang === 'bn' ? '— Agri-Copilot (এআই পরামর্শ, যাচাইকৃত নয়)' : '— Agri-Copilot (AI advice, unverified)',
      'https://agri-copilot.netlify.app'
    );
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  };

  const handleCaptureSnapshot = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // drawImage throws unless the source actually holds decodable pixels:
    // images need `complete`, video needs HAVE_CURRENT_DATA (readyState >= 2).
    if (activeDemoPreset && presetImageRef.current) {
      const presetImg = presetImageRef.current;
      if (!presetImg.complete || presetImg.naturalWidth === 0) {
        toast.error(lang === 'bn' ? 'ডেমো ছবি এখনো লোড হয়নি, একটু পরে চেষ্টা করুন।' : 'Demo image is still loading, please try again shortly.');
        return;
      }
      ctx.drawImage(presetImg, 0, 0, 640, 480);
    } else if (videoRef.current) {
      if (videoRef.current.readyState < 2) {
        toast.error(lang === 'bn' ? 'ক্যামেরা ফ্রেম এখনো প্রস্তুত নেই, একটু পরে চেষ্টা করুন।' : 'Camera frame is not ready yet, please try again shortly.');
        return;
      }
      ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    } else {
      toast.error(lang === 'bn' ? 'ক্যাপচার করার জন্য কোনো ফ্রেম নেই।' : 'No frame available to capture.');
      return;
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    playTone(1200, 0.1, 0.1);
    toast.success(lang === 'bn' ? '📸 ফ্রেম ক্যাপচার করা হয়েছে! প্রেসক্রিপশনে যুক্ত হচ্ছে...' : '📸 Snapshot captured! Transferring to prescription engine...');

    if (onCaptureFrameForDeepDiagnosis) {
      onCaptureFrameForDeepDiagnosis(dataUrl);
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4 w-full">
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Viewfinder Container: Seamlessly toggles between inline card & immersive full-screen viewport */}
      <div 
        onClick={isSessionActive ? handleTapVideo : undefined}
        className={isFullscreen 
          ? "fixed inset-0 z-[100] bg-black flex flex-col justify-between overflow-hidden touch-none select-none animate-in fade-in duration-300"
          : `relative rounded-[28px] overflow-hidden bg-gray-950 border-2 border-emerald-500/30 shadow-2xl flex items-center justify-center transition-all duration-300 ${
              isCameraActive 
                ? "aspect-[4/3] sm:aspect-[16/10] max-h-[540px]" 
                : "min-h-[420px] sm:min-h-[460px] py-8 px-4"
            }`
        }
      >
        {/* Video stream element */}
        <video 
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''} ${!isCameraActive || activeDemoPreset ? 'hidden' : ''}`}
        />

        {/* If Investor Demo Preset active: render live simulated specimen in viewfinder */}
        {activeDemoPreset && (
          <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden">
            <img 
              src={activeDemoPreset.svgImage} 
              alt={activeDemoPreset.nameEn}
              className="w-full h-full object-cover select-none pointer-events-none"
            />
            {/* Specimen Tag HUD */}
            <div className="absolute top-16 left-4 z-20 bg-black/80 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-emerald-500/40 text-left shadow-xl max-w-[260px] sm:max-w-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
                  {lang === 'bn' ? '💼 ইনভেস্টর ডেমো স্পেসিমেন' : '💼 Investor Pitch Specimen'}
                </span>
              </div>
              <p className="text-xs font-bold text-white mt-0.5 leading-snug">
                {lang === 'bn' ? activeDemoPreset.cropBn : activeDemoPreset.cropEn} • {lang === 'bn' ? activeDemoPreset.diseaseBn : activeDemoPreset.diseaseEn}
              </p>
              <p className="text-[11px] text-emerald-300/80 font-mono mt-0.5 truncate">
                {activeDemoPreset.pathogen}
              </p>
            </div>
          </div>
        )}

        {/* Tap-To-Focus Target Animation */}
        <AnimatePresence>
          {focusPoint && (
            <motion.div
              initial={{ scale: 1.5, opacity: 1 }}
              animate={{ scale: 1, opacity: 0.8 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.25 }}
              style={{ left: focusPoint.x - 24, top: focusPoint.y - 24 }}
              className="absolute w-12 h-12 border-2 border-emerald-400 rounded-xl pointer-events-none z-30 shadow-[0_0_12px_rgba(52,211,153,0.8)]"
            >
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full absolute inset-0 m-auto" />
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold text-emerald-300 bg-black/80 px-1.5 py-0.5 rounded backdrop-blur-xs pointer-events-none">
                {lang === 'bn' ? 'ফোকাস এরিয়া' : 'Target area'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Inactive Camera State / Start CTA */}
        {!isCameraActive && !isConnecting && (
          <div className="p-4 sm:p-6 text-center text-white space-y-4 max-w-md mx-auto z-10 my-auto">
            <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-0.5 shadow-xl shadow-emerald-500/20">
              <div className="w-full h-full rounded-[18px] sm:rounded-[22px] bg-gray-900/90 flex items-center justify-center">
                <Video className="w-7 h-7 sm:w-9 sm:h-9 text-emerald-400 animate-pulse" />
              </div>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                {lang === 'bn' ? 'লাইভ মাল্টিমোডাল এআই' : 'Live Multimodal AI'}
              </div>
              {/* H2 (not H3) keeps the document outline sequential after the page H1 */}
              <h2 className="text-xl sm:text-2xl font-black font-display tracking-tight text-white">
                {lang === 'bn' ? 'লাইভ ক্যামেরা ও ভয়েস সহকারী' : 'Live Camera & Voice Copilot'}
              </h2>
              <p className="text-xs sm:text-sm text-gray-300 mt-1.5 leading-relaxed">
                {isExtendedThinking
                  ? (lang === 'bn' 
                      ? 'ক্যামেরা আক্রান্ত পাতার দিকে স্থির রাখুন। এআই গভীর প্যাথলজি বিশ্লেষণ ও সুনির্দিষ্ট প্রেসক্রিপশন দেবে।' 
                      : 'Hold camera steady at diseased plant parts for deep clinical pathology & precision IPM solutions.')
                  : (lang === 'bn' 
                      ? 'ফোন ক্যামেরা ছাদ বাগান, বারান্দার টব, ইনডোর গাছ বা ফসলের দিকে ধরুন এবং সরাসরি কথা বলুন।' 
                      : 'Point camera at rooftop pots, balcony gardens, indoor houseplants or crops and speak freely.')}
              </p>
            </div>

            {/* Analysis depth — one quiet line (default behavior unchanged) */}
            <button
              type="button"
              onClick={() => setIsExtendedThinking(!isExtendedThinking)}
              className={`w-full flex items-center justify-between gap-2 px-3 min-h-[44px] py-1.5 rounded-xl border backdrop-blur-md text-left transition-colors cursor-pointer ${
                isExtendedThinking
                  ? 'bg-purple-950/40 border-purple-500/30 hover:bg-purple-950/60'
                  : 'bg-gray-900/60 border-gray-800/80 hover:bg-gray-800/60'
              }`}
              role="switch"
              aria-checked={isExtendedThinking}
              aria-label={lang === 'bn'
                ? (isExtendedThinking ? 'গভীর রোগ ও প্যাথলজি মোড বন্ধ করুন' : 'গভীর রোগ ও প্যাথলজি মোড চালু করুন')
                : (isExtendedThinking ? 'Turn off Deep Clinical Pathology Mode' : 'Turn on Deep Clinical Pathology Mode')}
            >
              <span className="flex items-center gap-2 min-w-0">
                {isExtendedThinking
                  ? <BrainCircuit className="w-3.5 h-3.5 text-purple-300 shrink-0" aria-hidden="true" />
                  : <Zap className="w-3.5 h-3.5 text-emerald-300 shrink-0" aria-hidden="true" />}
                <span className={`text-[11px] font-bold truncate ${isExtendedThinking ? 'text-purple-200' : 'text-emerald-200'}`}>
                  {isExtendedThinking
                    ? (lang === 'bn' ? 'গভীর রোগ বিশ্লেষণ' : 'Deep pathology mode')
                    : (lang === 'bn' ? 'দ্রুত পরামর্শ' : 'Quick advice')}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors duration-200 ${
                  isExtendedThinking ? 'bg-purple-500' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none mt-0.5 ml-0.5 inline-block h-3 w-3 rounded-full bg-white shadow transition-transform duration-200 ${
                    isExtendedThinking ? 'translate-x-3' : ''
                  }`}
                />
              </span>
            </button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={startLiveSession}
              disabled={isConnecting}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl text-gray-950 font-black text-sm uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2.5 mx-auto cursor-pointer ${
                isExtendedThinking
                  ? 'bg-gradient-to-r from-purple-400 via-teal-400 to-emerald-400 shadow-purple-500/30 hover:shadow-purple-500/50'
                  : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 shadow-emerald-500/30 hover:shadow-emerald-500/50'
              }`}
            >
              <Video className="w-4 h-4" />
              <span>
                {activeDemoPreset 
                  ? (lang === 'bn' ? `ডেমো ফিড দিয়ে শুরু করুন (${activeDemoPreset.cropBn})` : `Start with Demo Feed (${activeDemoPreset.cropEn})`) 
                  : (lang === 'bn' ? 'লাইভ স্ট্রিম শুরু করুন' : 'Start Live Stream')}
              </span>
            </motion.button>

            {/* Investor demo — collapsed behind a tiny ghost control (boardroom tool, no public use) */}
            {showInvestorPanel ? (
            <div className="pt-2 text-left">
              <div className="bg-gradient-to-br from-amber-500/10 via-emerald-950/40 to-teal-950/40 p-3.5 rounded-2xl border border-amber-500/30 backdrop-blur-md">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center space-x-2 min-w-0">
                    <div className="p-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                      <Briefcase className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-black text-amber-200 uppercase tracking-wider block truncate">
                        {lang === 'bn' ? 'ইনভেস্টর ডেমো প্রিসেট (বোর্ডরুম ব্যাকআপ)' : 'Investor Demo Presets (Pitch Backup)'}
                      </span>
                      <p className="text-[11px] text-stone-300 truncate">
                        {lang === 'bn' ? 'মিটিং রুমে বাস্তব ফসল না থাকলেও ১০০% নির্ভরযোগ্য লাইভ এআই ডেমো' : 'Foolproof live AI demo without real crops in meeting room'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowPitchCheatSheet(!showPitchCheatSheet)}
                      className="text-[11px] font-bold text-amber-300 hover:text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 px-2 py-1 rounded-lg border border-amber-400/30 transition-all cursor-pointer"
                    >
                      {showPitchCheatSheet ? (lang === 'bn' ? 'চিটশিট লুকান' : 'Hide Stats') : (lang === 'bn' ? 'ইনভেস্টর চিটশিট 📊' : 'Pitch Stats 📊')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInvestorPanel(false)}
                      aria-label={lang === 'bn' ? 'ডেমো প্যানেল লুকান' : 'Hide demo panel'}
                      title={lang === 'bn' ? 'ডেমো প্যানেল লুকান' : 'Hide demo panel'}
                      className="p-1 text-amber-300/70 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg border border-amber-400/20 transition-all cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Pitch Cheat Sheet Accordion */}
                <AnimatePresence>
                  {showPitchCheatSheet && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-3 p-2.5 rounded-xl bg-black/70 border border-amber-500/30 text-[11px] space-y-1.5 font-mono text-amber-100"
                    >
                      <div className="flex justify-between border-b border-amber-500/20 pb-1">
                        <span className="text-stone-400">Multimodal Latency:</span>
                        <span className="font-bold text-emerald-400">~120ms (Real-time Video)</span>
                      </div>
                      <div className="flex justify-between border-b border-amber-500/20 pb-1">
                        <span className="text-stone-400">Audio Synthesis:</span>
                        <span className="font-bold text-teal-300">24kHz PCM Bi-directional</span>
                      </div>
                      <div className="flex justify-between border-b border-amber-500/20 pb-1">
                        <span className="text-stone-400">Unit Cost per Consult:</span>
                        <span className="font-bold text-amber-300">&lt;$0.002 vs $15 Field Officer</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-400">Total Addressable Market:</span>
                        <span className="font-bold text-purple-300">16.5M Farmers + 3.5M Urban</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 4 Demo Preset Cards */}
                <div className="grid grid-cols-2 gap-2">
                  {INVESTOR_DEMO_PRESETS.map((preset) => {
                    const isSelected = activeDemoPreset?.id === preset.id;
                    return (
                      <div
                        key={preset.id}
                        className={`p-2.5 rounded-xl border transition-all text-left relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-emerald-950/90 border-emerald-400 text-white shadow-md shadow-emerald-500/20'
                            : 'bg-black/50 hover:bg-black/70 border-stone-700/60 text-stone-200'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                              {preset.category === 'staple' ? '🌾 Staple' : 
                               preset.category === 'cash_crop' ? '🍅 Cash Crop' : 
                               preset.category === 'rooftop' ? '🍋 Rooftop' : '🪴 Indoor'}
                            </span>
                            {isSelected && (
                              <span className="text-[11px] bg-emerald-500 text-gray-950 px-1 py-0.2 rounded font-black">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold leading-tight line-clamp-1">
                            {lang === 'bn' ? preset.cropBn : preset.cropEn}
                          </p>
                          <p className="text-[11px] text-stone-400 line-clamp-1">
                            {lang === 'bn' ? preset.diseaseBn : preset.diseaseEn}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => handleSelectPreset(isSelected ? null : preset)}
                            className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold text-center transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-500 text-gray-950 hover:bg-emerald-400'
                                : 'bg-white/10 hover:bg-white/20 text-white'
                            }`}
                          >
                            {isSelected 
                              ? (lang === 'bn' ? '✓ অ্যাক্টিভ' : '✓ Active') 
                              : (lang === 'bn' ? 'ফিড নির্বাচন' : 'Set Feed')}
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleOpenPrescriptionForPreset(preset)}
                            className="p-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 transition-all cursor-pointer"
                            title={lang === 'bn' ? 'ডিজিটাল প্রেসক্রিপশন দেখুন' : 'View Digital Rx'}
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            ) : (
              <div className="pt-1 flex justify-end pr-0.5">
                <button
                  type="button"
                  onClick={() => setShowInvestorPanel(true)}
                  aria-label={lang === 'bn' ? 'ইনভেস্টর ডেমো প্যানেল খুলুন' : 'Open investor demo panel'}
                  title={lang === 'bn' ? 'ইনভেস্টর ডেমো' : 'Investor demo'}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-stone-500/60 hover:text-stone-300 hover:bg-white/5 transition-all cursor-pointer select-none"
                >
                  <Briefcase className="w-3 h-3" aria-hidden="true" />
                  <span>{lang === 'bn' ? 'ডেমো' : 'Demo'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Connecting Spinner Overlay */}
        {isConnecting && (
          <div className="absolute inset-0 bg-gray-950/90 backdrop-blur-md flex flex-col items-center justify-center text-white space-y-4 z-20">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
              <Sparkles className="w-6 h-6 text-emerald-400 absolute inset-0 m-auto" />
            </div>
            <div className="text-center px-4">
              <h4 className="text-base font-bold text-white">
                {lang === 'bn' ? 'লাইভ এআই এর সাথে যুক্ত হচ্ছে...' : 'Connecting to Live AI...'}
              </h4>
              <p className="text-xs text-gray-400 mt-1">
                {lang === 'bn' ? 'ক্যামেরা ও দ্বি-মুখী অডিও চ্যানেল প্রস্তুত হচ্ছে' : 'Initializing bidirectional camera & audio stream'}
              </p>
            </div>
          </div>
        )}

        {/* Active Session Overlay & Scanning HUD */}
        {isSessionActive && (
          <>
            {/* Animated Laser Scanning Line */}
            <motion.div 
              animate={{ y: ['0%', '100%', '0%'] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_rgba(52,211,153,0.8)] pointer-events-none z-10"
            />

            {/* Targeting Reticle Corners */}
            <div className={`absolute pointer-events-none z-10 flex flex-col justify-between ${
              isFullscreen ? 'inset-12 sm:inset-20' : 'inset-6 sm:inset-10'
            }`}>
              <div className="flex justify-between">
                <div className="w-8 h-8 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg opacity-80" />
                <div className="w-8 h-8 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg opacity-80" />
              </div>
              <div className="flex justify-between">
                <div className="w-8 h-8 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg opacity-80" />
                <div className="w-8 h-8 border-b-2 border-r-2 border-emerald-400 rounded-br-lg opacity-80" />
              </div>
            </div>

            {/* Top Status & Controls Bar */}
            <div className={`absolute top-0 left-0 right-0 flex items-center justify-between gap-2 z-30 ${
              isFullscreen 
                ? 'pt-[max(env(safe-area-inset-top),0.75rem)] px-4 sm:px-6 bg-gradient-to-b from-black/80 via-black/40 to-transparent pb-6' 
                : 'pt-4 px-4'
            }`}>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-red-600/90 text-white text-[11px] font-black font-mono px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>LIVE 1 FPS</span>
                </div>
                <div className="bg-gray-900/80 backdrop-blur-md text-emerald-400 text-[11px] font-mono font-bold px-3 py-1 rounded-full border border-emerald-500/30">
                  ⏱️ {formatDuration(callDuration)}
                </div>
                <div className={`hidden sm:flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border backdrop-blur-md ${
                  isExtendedThinking 
                    ? 'bg-purple-900/70 border-purple-500/40 text-purple-200'
                    : 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                }`}>
                  {isExtendedThinking ? <BrainCircuit className="w-3 h-3 text-purple-300" /> : <Zap className="w-3 h-3 text-emerald-300" />}
                  <span>{isExtendedThinking ? (lang === 'bn' ? 'গভীর বিশ্লেষণ' : 'Extended Thinking') : (lang === 'bn' ? 'ফাস্ট লাইভ' : 'Fast Live')}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Investor Demo Preset Switcher in Active Call */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowInvestorPresetsBar(!showInvestorPresetsBar);
                    }}
                    className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border backdrop-blur-md transition-all cursor-pointer ${
                      activeDemoPreset 
                        ? 'bg-amber-500/90 text-gray-950 border-amber-300 shadow-amber-500/30'
                        : 'bg-gray-900/80 text-amber-300 border-amber-500/30 hover:bg-gray-800'
                    }`}
                    title={lang === 'bn' ? 'ডেমো প্রিসেট পরিবর্তন' : 'Demo Presets'}
                  >
                    <Briefcase className="w-3 h-3" />
                    <span className="hidden sm:inline">
                      {activeDemoPreset 
                        ? (lang === 'bn' ? activeDemoPreset.cropBn : activeDemoPreset.cropEn)
                        : (lang === 'bn' ? 'ডেমো প্রিসেট' : 'Presets')}
                    </span>
                  </button>

                  <AnimatePresence>
                    {showInvestorPresetsBar && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        className="absolute right-0 top-8 z-40 bg-gray-950/95 border border-amber-500/40 p-2 rounded-2xl shadow-2xl backdrop-blur-md min-w-[220px] space-y-1"
                      >
                        <div className="px-2 py-1 text-[11px] font-black uppercase text-amber-300 border-b border-gray-800">
                          {lang === 'bn' ? 'লাইভ স্যাম্পল পরিবর্তন' : 'Switch Live Specimen'}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectPreset(null);
                            setShowInvestorPresetsBar(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-between ${
                            !activeDemoPreset ? 'bg-emerald-600 text-white' : 'text-stone-300 hover:bg-gray-800'
                          }`}
                        >
                          <span>📷 {lang === 'bn' ? 'বাস্তব ক্যামেরা ফিড' : 'Real Camera Feed'}</span>
                        </button>
                        {INVESTOR_DEMO_PRESETS.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              handleSelectPreset(p);
                              setShowInvestorPresetsBar(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-between ${
                              activeDemoPreset?.id === p.id ? 'bg-amber-500 text-gray-950' : 'text-stone-300 hover:bg-gray-800'
                            }`}
                          >
                            <span className="truncate">{lang === 'bn' ? p.cropBn : p.cropEn}</span>
                            <span className="text-[11px] opacity-75 font-mono ml-1">{p.severityEn}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Instant Stop / Interrupt Button during AI speech */}
                <AnimatePresence>
                  {(liveState === 'speaking' || isAiTurnInProgressRef.current) && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        isAiTurnInProgressRef.current = false;
                        isAiTurnCancelledRef.current = true; // Signals onmessage to discard any trailing incoming chunks
                        sourceNodesRef.current.forEach(node => {
                          try { node.stop(); } catch (err) {}
                        });
                        sourceNodesRef.current = [];
                        if (outputAudioContextRef.current) {
                          nextPlayTimeRef.current = outputAudioContextRef.current.currentTime;
                        }
                        clearSubtitles();
                        setLiveState('listening');

                        // Send client turn cancellation / interrupt message to halt server generation
                        const currentSession = sessionRef.current;
                        if (currentSession && typeof currentSession.sendRealtimeInput === 'function') {
                          try {
                            currentSession.sendRealtimeInput({
                              clientContent: { turns: [], turnComplete: true }
                            });
                          } catch (cancelErr) {
                            console.debug("Session cancellation signal handled:", cancelErr);
                          }
                        }

                        toast(lang === 'bn' ? 'এআই উত্তর বাতিল করা হয়েছে' : 'AI speech response cancelled', { duration: 1200, icon: '✋' });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] uppercase tracking-wider shadow-lg shadow-red-900/60 backdrop-blur-md border border-red-400 active:scale-90 transition-all cursor-pointer animate-pulse"
                      title={lang === 'bn' ? 'এআই উত্তর বাতিল করুন' : 'Cancel AI Response'}
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>{lang === 'bn' ? 'থামুন' : 'Stop'}</span>
                    </motion.button>
                  )}
                </AnimatePresence>

                <div className={`text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wider backdrop-blur-md shadow-lg ${
                  liveState === 'speaking' ? 'bg-emerald-500 text-gray-950 animate-pulse' :
                  liveState === 'analyzing' ? 'bg-purple-600 text-white animate-pulse' :
                  liveState === 'listening' ? 'bg-blue-500 text-white' : 'bg-gray-900/80 text-gray-300'
                }`}>
                  {liveState === 'speaking' ? (lang === 'bn' ? '🎙️ এআই কথা বলছে' : '🎙️ AI Speaking') :
                   liveState === 'analyzing' ? (lang === 'bn' ? '🧠 যুক্তি বিশ্লেষণ...' : '🧠 Reasoning...') :
                   liveState === 'listening' ? (lang === 'bn' ? '👂 শুনছে...' : '👂 Listening...') :
                   (lang === 'bn' ? '👀 পর্যবেক্ষণ করছে' : '👀 Inspecting')}
                </div>

                {/* Fullscreen / Minimize Toggle Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFullscreen(!isFullscreen);
                  }}
                  className="p-2 rounded-xl bg-gray-900/80 hover:bg-gray-800 text-white backdrop-blur-md border border-gray-700/60 transition-all cursor-pointer shadow-lg"
                  title={isFullscreen ? (lang === 'bn' ? 'মিনিমাইজ' : 'Exit Fullscreen') : (lang === 'bn' ? 'ফুলস্ক্রিন' : 'Fullscreen')}
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4 text-emerald-400" /> : <Maximize2 className="w-4 h-4 text-emerald-400" />}
                </button>
              </div>
            </div>

            {/* Real-time Extended Thinking Inspector for Live Video */}
            {isExtendedThinking && (liveThinkingText || liveState === 'analyzing') && (
              <div className="absolute top-16 left-4 right-4 z-30 flex justify-center pointer-events-auto">
                <div className="w-full max-w-md bg-purple-950/85 border border-purple-500/40 rounded-2xl p-2.5 backdrop-blur-md shadow-2xl text-left">
                  <button
                    type="button"
                    onClick={() => setShowThinkingDetails(!showThinkingDetails)}
                    className="w-full flex items-center justify-between text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping shrink-0" />
                      <span className="text-[11px] font-bold text-purple-200 uppercase tracking-wider truncate">
                        {lang === 'bn' ? '🧠 লাইভ রোগ ও কৃষিবিদ্যা বিশ্লেষণ...' : '🧠 Live Agronomic Reasoning...'}
                      </span>
                    </div>
                    {showThinkingDetails ? <ChevronUp className="w-4 h-4 text-purple-300 shrink-0" /> : <ChevronDown className="w-4 h-4 text-purple-300 shrink-0" />}
                  </button>
                  <AnimatePresence>
                    {showThinkingDetails && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-2 text-[11px] text-purple-100 font-mono bg-purple-900/40 p-2.5 rounded-xl border border-purple-500/30 max-h-32 overflow-y-auto leading-relaxed"
                      >
                        {liveThinkingText || (lang === 'bn' ? 'লক্ষণ, মাটি ও আবহাওয়া ডাটা তুলনা করা হচ্ছে...' : 'Inspecting visual frame markers and comparing pathology patterns...')}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Live Realtime Subtitles Overlay with sentence-by-sentence animation and distinct pauses */}
            <div className={`absolute left-4 right-4 flex justify-center z-25 pointer-events-none ${
              isFullscreen ? 'bottom-36 sm:bottom-40' : 'bottom-24 sm:bottom-28'
            }`}>
              <AnimatePresence mode="wait">
                {latestSubtitle && latestSubtitle.text && (
                  <motion.div
                    key={latestSubtitle.id || latestSubtitle.text}
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96, transition: { duration: 0.22 } }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="max-w-md sm:max-w-xl px-4 py-2.5 rounded-2xl bg-black/85 backdrop-blur-md border border-white/20 text-center shadow-2xl"
                  >
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <span className={`inline-block w-2 h-2 rounded-full ${latestSubtitle.role === 'user' ? 'bg-sky-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
                      <span className={`text-[11px] uppercase tracking-wider font-black ${latestSubtitle.role === 'user' ? 'text-sky-300' : 'text-emerald-400'}`}>
                        {latestSubtitle.role === 'user' 
                          ? (lang === 'bn' ? '🗣️ কৃষক' : '🗣️ Farmer') 
                          : (lang === 'bn' ? '🤖 এআই কৃষিবিদ' : '🤖 AI Agronomist')}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-white leading-relaxed tracking-wide drop-shadow-md">
                      {latestSubtitle.text}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bottom Audio Waveform Overlay */}
            <div className={`absolute left-4 right-4 flex items-center justify-center gap-1 z-20 pointer-events-none ${
              isFullscreen ? 'bottom-28 sm:bottom-32' : 'bottom-16 sm:bottom-20'
            }`}>
              {Array.from({ length: VISUALIZER_BAR_COUNT }, (_, idx) => (
                <motion.div
                  key={idx}
                  ref={(el: HTMLDivElement | null) => {
                    visualizerBarRefs.current[idx] = el;
                    if (el) el.style.height = `${Math.max(4, (audioLevelsRef.current[idx] || 0) * 52)}px`;
                  }}
                  style={{ transition: VISUALIZER_BAR_TRANSITION }}
                  className={`w-1 rounded-full transition-colors ${
                    liveState === 'speaking' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' :
                    liveState === 'listening' ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'bg-gray-600/60'
                  }`}
                />
              ))}
            </div>

            {/* Bottom Floating Native Shutter / Action Dock */}
            <div className={`absolute bottom-0 left-0 right-0 flex items-center justify-between gap-3 z-30 ${
              isFullscreen 
                ? 'pb-[max(env(safe-area-inset-bottom),1.25rem)] px-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-8' 
                : 'pb-3 px-4'
            }`}>
              {/* Left group: Camera & Torch */}
              <div className="flex items-center gap-2">
                {/* Flip Camera */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    flipCamera();
                  }}
                  type="button"
                  className="p-3 rounded-2xl bg-gray-900/90 hover:bg-gray-800 text-white backdrop-blur-md border border-gray-700/60 transition-all cursor-pointer shadow-lg active:scale-90"
                  title={lang === 'bn' ? 'ক্যামেরা পরিবর্তন' : 'Flip Camera'}
                >
                  <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Torch Toggle */}
                {isTorchSupported && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTorch();
                    }}
                    type="button"
                    className={`p-3 rounded-2xl backdrop-blur-md border transition-all cursor-pointer shadow-lg active:scale-90 ${
                      isTorchOn 
                        ? 'bg-amber-400 text-gray-950 border-amber-300 shadow-amber-400/30' 
                        : 'bg-gray-900/90 hover:bg-gray-800 text-white border-gray-700/60'
                    }`}
                    title={lang === 'bn' ? 'ফ্ল্যাশলাইট' : 'Torch'}
                  >
                    {isTorchOn ? <Zap className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <ZapOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                )}
              </div>

              {/* Center: Large Shutter / Capture Button & 1-Click Digital Rx */}
              <div className="flex items-center justify-center gap-2.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCaptureSnapshot();
                  }}
                  type="button"
                  className="relative group p-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md transition-all active:scale-92 cursor-pointer shadow-2xl"
                  title={lang === 'bn' ? 'ক্যাপচার করুন' : 'Capture Diagnostic Frame'}
                >
                  <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 border-4 border-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                    <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-gray-950" />
                  </div>
                  {isFullscreen && (
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[11px] font-black uppercase text-emerald-300 whitespace-nowrap drop-shadow-md">
                      {lang === 'bn' ? 'ক্যাপচার' : 'Capture'}
                    </span>
                  )}
                </button>

                {/* 1-Click Digital Krishi Prescription Card Generator */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenCurrentLivePrescription();
                  }}
                  type="button"
                  className="p-3 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white border border-teal-400/60 backdrop-blur-md shadow-lg shadow-teal-900/40 transition-all active:scale-90 cursor-pointer flex items-center justify-center"
                  title={lang === 'bn' ? '১-ক্লিক ডিজিটাল প্রেসক্রিপশন তৈরি করুন' : '1-Click Digital Krishi Rx Card'}
                >
                  <FileText className="w-5 h-5" />
                </button>
              </div>

              {/* Right group: Mic & End Call */}
              <div className="flex items-center gap-2">
                {/* Mic Mute */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMuted(!isMuted);
                  }}
                  type="button"
                  className={`p-3 rounded-2xl backdrop-blur-md border transition-all cursor-pointer shadow-lg active:scale-90 ${
                    isMuted 
                      ? 'bg-red-500 text-white border-red-400' 
                      : 'bg-gray-900/90 hover:bg-gray-800 text-white border-gray-700/60'
                  }`}
                  title={isMuted ? (lang === 'bn' ? 'আনমিউট করুন' : 'Unmute') : (lang === 'bn' ? 'মিউট করুন' : 'Mute')}
                >
                  {isMuted ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>

                {/* End Call Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    stopAllMedia();
                  }}
                  type="button"
                  className="p-3 rounded-2xl bg-red-600 hover:bg-red-500 text-white border border-red-500/80 backdrop-blur-md shadow-lg shadow-red-600/30 transition-all active:scale-90 cursor-pointer"
                  title={lang === 'bn' ? 'কল কাটুন' : 'End Call'}
                >
                  <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Low-literacy Tap-to-Answer Questions (active session only) */}
      {isSessionActive && !activeDemoPreset && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-emerald-500/20 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setShowQuestionPanel(!showQuestionPanel)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                {lang === 'bn' ? '৩টি প্রশ্নের উত্তর দিন (ট্যাপ করুন)' : 'Answer 3 quick questions (tap)'}
              </span>
              {memoryLoaded && (
                <span className="hidden sm:inline-flex text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                  🧠 {lang === 'bn' ? 'খামার-স্মৃতি যুক্ত' : 'Farm memory on'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {Object.keys(chipAnswers).length > 0 && (
                <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-300">
                  {Object.keys(chipAnswers).length}/3 ✓
                </span>
              )}
              {showQuestionPanel ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
          </button>

          <AnimatePresence>
            {showQuestionPanel && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700/60"
              >
                <div className="pt-3 space-y-3">
                  {DIAGNOSTIC_QUESTIONS.map(q => (
                    <div key={q.key}>
                      <div className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
                        {chipAnswers[q.key] ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        )}
                        {lang === 'bn' ? q.qBn : q.qEn}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {q.options.map(opt => {
                          const label = lang === 'bn' ? opt.bn : opt.en;
                          const isPicked = chipAnswers[q.key] === label;
                          return (
                            <button
                              key={opt.en}
                              type="button"
                              onClick={() => handleChipAnswer(q.key, q.qBn, q.qEn, opt.bn, opt.en)}
                              className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition-all active:scale-95 cursor-pointer ${
                                isPicked
                                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                                  : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
                    💡 {lang === 'bn'
                      ? 'ট্যাপ করলেই এআই আপনার উত্তর জেনে নেবে — টাইপ করার দরকার নেই। চাইলে মুখেও উত্তর দিতে পারেন।'
                      : 'Tapping tells the AI instantly — no typing needed. You can also answer by speaking.'}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Institutional Legal & SAAO Advisory Notice */}
      <div className="bg-emerald-50/80 rounded-2xl p-3.5 border border-emerald-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-900">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700 flex-shrink-0" />
          <span className="font-bold">
            {lang === 'bn' 
              ? 'নিরাপত্তা নীতি: এআই কোনো ক্ষতিকর বা নিষিদ্ধ কীটনাশক সুপারিশ করে না।' 
              : 'Safety Policy: The AI never recommends banned or restricted chemicals.'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-black text-emerald-800 bg-emerald-100/80 px-3 py-1 rounded-xl">
          <span>🏛️ সরকারি হটলাইন: ১৬১২৩</span>
        </div>
      </div>

      {/* Realtime / Post-Session Insights Card */}
      {isSavingSummary && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3 text-emerald-800 dark:text-emerald-300 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-600 shrink-0" />
          <span className="font-semibold">
            {lang === 'bn' 
              ? 'সেশনের বিস্তারিত কথপোকথন বিশ্লেষণ করা হচ্ছে এবং স্মার্ট কৃষক প্রোফাইলে সংযুক্ত হচ্ছে...' 
              : 'Analyzing live consultation dialogue and updating Smart Farmer Dossier...'}
          </span>
        </div>
      )}

      {lastSavedSession && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 border border-emerald-500/20 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-700 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  {lastSavedSession.title}
                </h4>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {lang === 'bn' ? 'সরাসরি লাইভ সেশন থেকে সংগৃহীত ও স্মার্ট কৃষক কার্ডে সংরক্ষিত' : 'Extracted from live stream & saved to Krishi Dossier'}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-[11px] font-black uppercase tracking-wider">
              {lang === 'bn' ? 'সংরক্ষিত' : 'Saved'}
            </span>
          </div>

          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
            {lastSavedSession.summary}
          </p>

          {lastSavedSession.keyFacts.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                {lang === 'bn' ? 'সংগৃহীত মূল তথ্যসমূহ:' : 'Key Extracted Facts:'}
              </div>
              <div className="flex flex-wrap gap-2">
                {lastSavedSession.keyFacts.map((fact, idx) => (
                  <span 
                    key={idx}
                    className="text-xs px-2.5 py-1 rounded-xl bg-gray-100 dark:bg-gray-700/60 text-gray-800 dark:text-gray-200 border border-gray-200/60 dark:border-gray-600"
                  >
                    • {fact}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Today's Action Card: max 3 icon steps, listenable, shareable */}
          {lastSavedSession.actionSteps && lastSavedSession.actionSteps.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <ListChecks className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  {lang === 'bn' ? 'আজ যা করবেন (এআই-পরামর্শ, যাচাইকৃত নয়)' : 'Do This Now (AI advice, unverified)'}
                </div>
                <button
                  type="button"
                  onClick={handleSpeakActionCard}
                  disabled={isActionAudioLoading}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black border transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    isActionAudioPlaying
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/60'
                  } disabled:opacity-50`}
                >
                  {isActionAudioLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : isActionAudioPlaying ? (
                    <Square className="w-3 h-3 fill-current" />
                  ) : (
                    <Volume2 className="w-3 h-3" />
                  )}
                  {isActionAudioPlaying
                    ? (lang === 'bn' ? 'থামান' : 'Stop')
                    : (lang === 'bn' ? 'শুনুন' : 'Listen')}
                </button>
              </div>
              {lastSavedSession.actionSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 bg-emerald-50/70 dark:bg-emerald-900/20 border border-emerald-200/70 dark:border-emerald-800/40 rounded-xl px-3 py-2.5"
                >
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-black flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-snug">
                    {step}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 1-Click Digital Krishi Prescription Action in Post-Session Card */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700/50 space-y-3">
            <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>
                {lang === 'bn' ? 'গোপনীয়তা সুরক্ষা: সারসংক্ষেপ সংরক্ষিত (মূল কথপোকথন সংরক্ষণ করা হয় না)।' : 'Privacy Protected: summary saved (verbatim dialogue is never stored).'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleDownloadReminder}
                className="w-full sm:w-auto px-4 py-2 bg-white dark:bg-gray-700/60 hover:bg-amber-50 dark:hover:bg-gray-700 text-amber-900 dark:text-amber-200 border border-amber-300/70 dark:border-amber-700/60 rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <CalendarDays className="w-4 h-4" />
                <span>{lang === 'bn' ? '৩ দিন পরে মনে করিয়ে দিন' : 'Remind me in 3 days'}</span>
              </button>

              <button
                type="button"
                onClick={handleShareSessionWhatsApp}
                className="w-full sm:w-auto px-4 py-2 bg-white dark:bg-gray-700/60 hover:bg-emerald-50 dark:hover:bg-gray-700 text-emerald-900 dark:text-emerald-200 border border-emerald-300/70 dark:border-emerald-700/60 rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>{lang === 'bn' ? 'পরিবারের সাথে শেয়ার' : 'Share with family'}</span>
              </button>

              <button
                type="button"
                onClick={handleOpenCurrentLivePrescription}
                className="w-full sm:w-auto sm:ml-auto px-4 py-2 bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/20 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>{lang === 'bn' ? 'ডিজিটাল প্রেসক্রিপশন দেখুন (Rx Card)' : 'Open Digital Rx Prescription'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1-Click Certified Digital Krishi Prescription Modal */}
      {currentRxData && (
        <Suspense fallback={null}>
        <DigitalPrescriptionModal
          isOpen={isRxModalOpen}
          onClose={() => setIsRxModalOpen(false)}
          data={currentRxData}
          lang={lang}
        />
        </Suspense>
      )}
    </div>
  );
}
