import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, Mic, MicOff, PhoneOff, Video, VideoOff, RefreshCw, Zap, ZapOff, 
  Sparkles, AlertCircle, AlertTriangle, ShieldCheck, Activity, Volume2, 
  Scan, Info, Maximize2, Minimize2, ArrowRight, CheckCircle2, Loader2, Bot, User,
  BrainCircuit, Cpu, ChevronDown, ChevronUp, Square
} from 'lucide-react';
import { getAi, LIVE_API_MODEL, LIVE_EXTENDED_THINKING_MODEL } from '../services/ai';
import { LiveServerMessage, Modality, ThinkingLevel } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { Language } from '../utils/translations';
import { useAuth } from './AuthProvider';
import { recordFarmerInteractionEvent } from '../utils/farmerProfiler';

interface LiveVideoCopilotProps {
  lang: Language;
  locationContext?: string;
  onCaptureFrameForDeepDiagnosis?: (imageDataUrl: string) => void;
}

interface TranscriptTurn {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export default function LiveVideoCopilot({
  lang,
  locationContext = "Bangladesh",
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
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(24).fill(0));
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
    duration?: number;
  } | null>(null);
  const [isSavingSummary, setIsSavingSummary] = useState(false);

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

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
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
      console.error("Camera access failed:", err);
      const msg = lang === 'bn' 
        ? "ক্যামেরা বা মাইক্রোফোন ব্যবহারের অনুমতি পাওয়া যায়নি। ব্রাউজার সেটিংসে অনুমতি নিশ্চিত করুন।" 
        : "Camera or microphone permission was denied. Please allow access in your browser.";
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

  // Flip Camera
  const flipCamera = async () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    await startCamera(nextMode);
  };

  // Visualizer Loop
  const updateVisualizer = () => {
    let aiLevels: number[] = new Array(24).fill(0);
    let userLevels: number[] = new Array(24).fill(0);
    let aiSum = 0;
    let userSum = 0;

    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      for (let i = 0; i < 24; i++) {
        const val = (dataArray[i * 2] || 0) / 255;
        aiLevels[i] = val;
        aiSum += val;
      }
    }

    if (userAnalyserRef.current && !isMutedRef.current) {
      const dataArray = new Uint8Array(userAnalyserRef.current.frequencyBinCount);
      userAnalyserRef.current.getByteFrequencyData(dataArray);
      for (let i = 0; i < 24; i++) {
        const val = (dataArray[i * 2] || 0) / 255;
        userLevels[i] = val;
        userSum += val;
      }
    }

    const aiSpeaking = aiSum > 0.8;
    const userSpeaking = userSum > 0.6;

    if (aiSpeaking) {
      setLiveState('speaking');
      setAudioLevels(aiLevels);
    } else if (userSpeaking) {
      setLiveState('listening');
      setAudioLevels(userLevels);
    } else {
      setLiveState('idle');
      setAudioLevels(new Array(24).fill(0.08));
    }

    animFrameRef.current = requestAnimationFrame(updateVisualizer);
  };

  // Play incoming 24kHz audio chunk from Gemini 3.8 Live
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
    if (!videoRef.current || !canvasRef.current || !activeSession) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState < 2) return;

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
    ctx.drawImage(video, 0, 0, 480, 360);

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

  // Start Gemini 3.8 Live Multimodal Stream
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
      const apiKey = (process.env.GEMINI_API_KEY as string) || (import.meta.env.VITE_GEMINI_API_KEY as string) || '';
      if (!apiKey) {
        toast.error(lang === 'bn' 
          ? "লাইভ ভিডিও ফিচারের জন্য GEMINI_API_KEY কনফিগার থাকতে হবে।" 
          : "Live video assistant requires GEMINI_API_KEY.");
        setIsConnecting(false);
        isStartingSessionRef.current = false;
        return;
      }

      const stream = await startCamera();
      if (!stream) {
        setIsConnecting(false);
        isStartingSessionRef.current = false;
        return;
      }

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

      const ai = getAi(true);
      if (!ai) {
        throw new Error("Gemini AI instance unavailable");
      }

      const selectedLiveModel = isExtendedThinking ? LIVE_EXTENDED_THINKING_MODEL : LIVE_API_MODEL;

      const systemInstruction = isExtendedThinking
        ? `You are an elite Senior Plant Pathologist and Agronomic Scientist at BARI/BRRI in Bangladesh observing a LIVE MULTIMODAL VIDEO STREAM from a farmer's smartphone in ${locationContext}.
MODE: GEMINI 3.8 LIVE EXTENDED THINKING (SUPER SPECIALIZED CLINICAL PATHOLOGY & DIFFERENTIAL DIAGNOSIS).

CRITICAL CONVERSATIONAL & SILENCE DIRECTIVE:
1. DO NOT GREET OR SPEAK FIRST ON CONNECTION. Stay completely silent when the session starts.
2. Even as video frames arrive from the camera, DO NOT speak, do not greet, and do not describe what you see until the farmer actually speaks first or asks a question.
3. Start speaking ONLY after the user talks to you. When the farmer speaks, respond directly and concisely in natural spoken Bangla (বাংলা).
4. NEVER say robotic meta-announcements like "আমি আপনার ভিডিও দেখছি", "ক্যামেরা ফুটেজ দেখছি", or announce that you are an AI. Act as an expert agronomist in the field.
5. Switch to English ONLY if the user explicitly requests ("ইংরেজিতে বলুন" / "Speak in English").
6. Understand Bangladeshi regional farming terms and accents (Chittagong, Sylhet, Rangpur, Barisal, Jessore) effortlessly.

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
- Distill your clinical diagnosis into 1-2 structured, crystal-clear spoken Bangla sentences explaining the root diagnosis and the single most urgent recovery step.`
        : `You are a warm, highly knowledgeable Universal Plant, Gardening & Agriculture Companion (সবুজ পরামর্শক ও সার্বিক উদ্ভিদ বিশেষজ্ঞ) in Bangladesh observing a REAL-TIME LIVE MULTIMODAL VIDEO STREAM from a user's smartphone in ${locationContext}.
MODE: GEMINI 3.8 LIVE (FAST, BROAD & VERSATILE GREEN COMPANION).

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
4. NEVER say robotic meta-announcements like "আমি আপনার ভিডিও দেখছি" or announce looking at camera footage. Jump straight into answering the user's question.
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

      const liveConfig: any = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: lang === 'bn' ? "Kore" : "Zephyr" }
          }
        },
        outputAudioTranscription: {},
        systemInstruction,
      };

      if (isExtendedThinking) {
        liveConfig.thinkingConfig = {
          thinkingLevel: ThinkingLevel.LOW,
          includeThoughts: true
        };
      }

      let activeLiveSession: any = null;

      const sessionPromise = ai.live.connect({
        model: selectedLiveModel,
        config: liveConfig,
        callbacks: {
          onopen: async () => {
            if (sessionIdRef.current !== currentSessionId) return;
            setIsConnecting(false);
            isStartingSessionRef.current = false;
            setIsSessionActive(true);
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
                  sourceNodesRef.current.forEach(node => {
                    try { node.stop(); } catch (err) {}
                  });
                  sourceNodesRef.current = [];
                  if (outCtx) {
                    nextPlayTimeRef.current = outCtx.currentTime;
                  }
                  isAiTurnInProgressRef.current = false;
                  clearSubtitles();
                  setLiveState('listening');
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

            // 3. Capture internal thoughts when Extended Thinking is active
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if ((part as any).thought && part.text) {
                  isAiTurnInProgressRef.current = true;
                  setLiveThinkingText(prev => (prev + ' ' + part.text).slice(-1200));
                  setLiveState('analyzing');
                }
              }
            }

            // 4. Flush remaining buffer and gracefully release acoustic lock after audio playback finishes
            if (message.serverContent?.turnComplete) {
              flushRemainingModelText();
              if (sourceNodesRef.current.length === 0) {
                isAiTurnInProgressRef.current = false;
                setLiveState('listening');
              }
            }

            // 5. Interruption handling
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
              console.error("Gemini 3.8 Live Error:", err);
              toast.error(lang === 'bn' 
                ? "লাইভ ভিডিও সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।" 
                : "Live video stream error. Please try again.");
              stopAllMedia();
            }
          }
        }
      });

      const activeSession = await sessionPromise;
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
    const effectiveUid = user?.uid || 'guest_farmer_demo';
    const effectiveName = user?.displayName || '';

    // 1. If dialogue occurred, distill an executive summary via server-side AI proxy
    if (dialogueTurns.length > 0) {
      const dialogueText = dialogueTurns
        .map(t => `${t.role === 'user' ? 'কৃষক' : 'কৃষি বিশেষজ্ঞ'}: ${t.text}`)
        .join('\n');

      const prompt = `You are a certified senior agronomist and agricultural data auditor in Bangladesh.
A live video and voice consultation session just took place between a farmer and an AI agronomist.
Session Duration: ${Math.round(duration)} seconds.
Location context: ${locationContext}.
Language: ${lang === 'bn' ? 'Bangla' : 'English'}.

CONVERSATION CONTEXT:
${dialogueText}

CRITICAL PRIVACY & SUMMARY REQUIREMENT:
- DO NOT save or output verbatim dialogue or quotes. 
- Distill ONLY a clean, professional, synthesized 2-3 sentence agricultural summary and key factual bullet points.
- If a crop or disease was not mentioned, leave crop null.

Return a JSON object with this exact structure:
{
  "crop": "Detected crop (e.g., টমেটো, মরিচ, ধান, বেগুন, আলু) or null",
  "diseaseOrIssue": "Identified disease, pest, or problem or null",
  "sessionTitle": "Concise, descriptive title for this session (in ${lang === 'bn' ? 'Bangla' : 'English'})",
  "comprehensiveSummary": "A clear, professional synthesized 2-3 sentence summary of the crop condition and advice given. DO NOT include verbatim dialogue or farmer quotes.",
  "keyFacts": ["Array of 3-5 concise factual bullet points (e.g., 'ফসল: মরিচ', 'লক্ষণ: পাতা কুঁকড়ে যাওয়া', 'পরামর্শ: নিম তেল স্প্রে') in ${lang === 'bn' ? 'Bangla' : 'English'}"],
  "insightForCreditProfile": "Credit & farm management observation in ${lang === 'bn' ? 'Bangla' : 'English'}"
}`;

      try {
        const proxyResp = await fetch('/api/ai-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gemini-3.5-flash-lite',
            contents: prompt,
            config: {
              responseMimeType: 'application/json'
            }
          })
        });

        if (proxyResp.ok) {
          const proxyData = await proxyResp.json();
          const parsed = JSON.parse(proxyData.text || '{}');
          const title = parsed.sessionTitle || (lang === 'bn' ? 'লাইভ ভিডিও ও ভয়েস পরামর্শ সেশন' : 'Live Video & Voice Consultation Session');
          const summary = parsed.comprehensiveSummary || (lang === 'bn' 
            ? 'সরাসরি ভিডিও ক্যামেরায় ফসলের স্বাস্থ্য পর্যবেক্ষণ করা হয়েছে এবং বালাই ব্যবস্থাপনার পরামর্শ প্রদান করা হয়েছে।'
            : 'Visual crop health inspection completed with IPM management advisory provided.');
          const keyFacts: string[] = Array.isArray(parsed.keyFacts) && parsed.keyFacts.length > 0 
            ? parsed.keyFacts 
            : [
                `কলের ব্যাপ্তি: ${Math.max(1, Math.round(duration))} সেকেন্ড`,
                `পদ্ধতি: লাইভ ক্যামেরা ভিজ্যুয়াল মূল্যায়ন`,
                ...(parsed.crop ? [`ফসল: ${parsed.crop}`] : [])
              ];
          const crop = parsed.crop || undefined;
          const insight = parsed.insightForCreditProfile || (lang === 'bn' ? 'লাইভ ক্যামেরায় বিশেষজ্ঞ পরামর্শ নিয়েছেন' : 'Conducted live visual consultation');

          await recordFarmerInteractionEvent({
            userId: effectiveUid,
            fullName: effectiveName,
            eventType: 'voice_consultation',
            title,
            summary,
            keyFacts,
            crop,
            insight
          });

          setLastSavedSession({
            title,
            summary,
            crop,
            keyFacts,
            duration: Math.max(1, Math.round(duration))
          });

          toast.success(lang === 'bn' 
            ? 'পরামর্শের সারসংক্ষেপ আপনার স্মার্ট কৃষক কার্ডে সংরক্ষিত হয়েছে!' 
            : 'Consultation summary saved to your Krishi Dossier!');
          return;
        }
      } catch (aiErr) {
        console.warn("AI summary generation error, falling back to clean synthesis:", aiErr);
      }
    }

    // 2. Factual fallback summary (NO verbatim transcripts saved)
    const summaryText = dialogueTurns.length > 0
      ? (lang === 'bn' 
          ? `কৃষক এবং এআই কৃষিবিদের মধ্যে ${Math.max(1, Math.round(duration))} সেকেন্ডের লাইভ ভিডিও পরামর্শ সম্পন্ন হয়েছে। সরাসরি ক্যামেরায় ফসলের দৃশ্যমান লক্ষণ পর্যবেক্ষণ করে আইপিএম ও সার ব্যবস্থাপনার প্রয়োজনীয় নির্দেশনা প্রদান করা হয়েছে।`
          : `Live video and voice agronomic consultation completed (${Math.max(1, Math.round(duration))}s). Real-time visual crop assessment was conducted and tailored IPM guidance was provided.`)
      : (lang === 'bn' 
          ? `কৃষক ${Math.max(1, Math.round(duration))} সেকেন্ডের জন্য লাইভ ক্যামেরা পরিদর্শন সম্পন্ন করেছেন। কোনো নির্দিষ্ট রোগের বিবরণ রেকর্ড করা হয়নি।` 
          : `Farmer conducted a ${Math.max(1, Math.round(duration))}s visual crop inspection.`);

    const title = lang === 'bn' ? 'লাইভ ক্যামেরা পরিদর্শন সেশন' : 'Live Camera Field Inspection';
    const keyFacts = [
      `কলের ব্যাপ্তি: ${Math.max(1, Math.round(duration))} সেকেন্ড`,
      `পদ্ধতি: লাইভ ক্যামেরা ভিজ্যুয়াল চেক`
    ];

    await recordFarmerInteractionEvent({
      userId: effectiveUid,
      fullName: effectiveName,
      eventType: 'voice_consultation',
      title,
      summary: summaryText,
      keyFacts,
      insight: lang === 'bn' ? 'নিয়মিত লাইভ ক্যামেরা পরিদর্শন সম্পন্ন করেছেন' : 'Conducted live camera inspection'
    });

    setLastSavedSession({
      title,
      summary: summaryText,
      keyFacts,
      duration: Math.max(1, Math.round(duration))
    });

    toast.success(lang === 'bn' 
      ? 'পরামর্শের সারসংক্ষেপ আপনার স্মার্ট কৃষক কার্ডে সংরক্ষিত হয়েছে!' 
      : 'Consultation summary logged to your Krishi Dossier!');
  };

  // Stop all media & connections
  const stopAllMedia = () => {
    sessionIdRef.current += 1;
    isStartingSessionRef.current = false;
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

    // Capture duration and transcripts for persistent dossier compounding (Strictly >= 90 seconds requirement)
    const currentTranscripts = [...transcriptsRef.current];
    const currentDuration = callDurationRef.current || callDuration;

    if (currentDuration >= 90) {
      setIsSavingSummary(true);
      saveLiveSessionDossier(currentTranscripts, currentDuration)
        .finally(() => setIsSavingSummary(false));
    } else {
      if (currentDuration >= 5) {
        toast(
          lang === 'bn' 
            ? `সেশনটি ${Math.round(currentDuration)} সেকেন্ড স্থায়ী ছিল। স্মার্ট কৃষক কার্ডে সংরক্ষণের জন্য ন্যূনতম ৯০ সেকেন্ড দীর্ঘ সেশন প্রয়োজন।` 
            : `Session was ${Math.round(currentDuration)}s. Minimum 90s required to save to Smart Krishi Card.`,
          { icon: 'ℹ️' }
        );
      }
    }

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

  // Handle tap-to-focus
  const handleTapVideo = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
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

    setTimeout(() => {
      setFocusPoint(null);
    }, 1200);
  };
  const handleCaptureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
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
          className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''} ${!isCameraActive ? 'hidden' : ''}`}
        />

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
              <h3 className="text-xl sm:text-2xl font-black font-display tracking-tight text-white">
                {lang === 'bn' ? 'লাইভ ক্যামেরা ও ভয়েস সহকারী' : 'Live Camera & Voice Copilot'}
              </h3>
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

            {/* Analysis Depth & Scope Toggle */}
            <div className="bg-gray-900/80 p-3 rounded-2xl border border-gray-800 backdrop-blur-md text-left">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-2 rounded-xl shrink-0 transition-colors ${
                    isExtendedThinking ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}>
                    {isExtendedThinking ? <BrainCircuit className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block">
                      {isExtendedThinking 
                        ? (lang === 'bn' ? 'গভীর রোগ ও প্যাথলজি মোড' : 'Deep Clinical Pathology Mode')
                        : (lang === 'bn' ? 'দ্রুত পরামর্শ মোড (বাগান, ইনডোর ও ফসল)' : 'Fast Mode (Gardens, Houseplants & Crops)')}
                    </span>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                      {isExtendedThinking
                        ? (lang === 'bn' ? 'সুপার স্পেশালাইজড: জটিল ফসলি রোগের বিশদ কারণ ও বৈজ্ঞানিক ব্যবচ্ছেদ' : 'Super specialized: In-depth clinical pathology & differential diagnosis')
                        : (lang === 'bn' ? 'বিস্তৃত পরিধি: ছাদ বাগান, ইনডোর গাছ বাছাই, টবের মাটি ও তাৎক্ষণিক সমাধান' : 'Broad scope: Rooftop gardens, indoor plant buying, potting mix & quick tips')}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsExtendedThinking(!isExtendedThinking)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isExtendedThinking ? 'bg-purple-600' : 'bg-gray-700'
                  }`}
                  role="switch"
                  aria-checked={isExtendedThinking}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isExtendedThinking ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Quick Topic Guide Chips */}
              <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-gray-800/80">
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-800/80 text-emerald-300 border border-gray-700/50">
                  {lang === 'bn' ? '🌱 ছাদ ও বারান্দা বাগান' : '🌱 Rooftop & Balcony'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-800/80 text-emerald-300 border border-gray-700/50">
                  {lang === 'bn' ? '🪴 ইনডোর গাছ বাছাই' : '🪴 Indoor Plants to Buy'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-800/80 text-emerald-300 border border-gray-700/50">
                  {lang === 'bn' ? '🌿 টবের মাটি ও সার' : '🌿 Potting Mix & Care'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-800/80 text-emerald-300 border border-gray-700/50">
                  {lang === 'bn' ? '🌾 ফসলি রোগবালাই' : '🌾 Crop Advisory'}
                </span>
              </div>
            </div>

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
              <span>{lang === 'bn' ? 'লাইভ স্ট্রিম শুরু করুন' : 'Start Live Stream'}</span>
            </motion.button>
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
                <div className="flex items-center gap-1.5 bg-red-600/90 text-white text-[10px] font-black font-mono px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>LIVE 1 FPS</span>
                </div>
                <div className="bg-gray-900/80 backdrop-blur-md text-emerald-400 text-[10px] font-mono font-bold px-3 py-1 rounded-full border border-emerald-500/30">
                  ⏱️ {formatDuration(callDuration)}
                </div>
                <div className={`hidden sm:flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border backdrop-blur-md ${
                  isExtendedThinking 
                    ? 'bg-purple-900/70 border-purple-500/40 text-purple-200'
                    : 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                }`}>
                  {isExtendedThinking ? <BrainCircuit className="w-3 h-3 text-purple-300" /> : <Zap className="w-3 h-3 text-emerald-300" />}
                  <span>{isExtendedThinking ? (lang === 'bn' ? 'গভীর বিশ্লেষণ' : 'Extended Thinking') : (lang === 'bn' ? 'ফাস্ট লাইভ' : 'Fast Live')}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
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
                        sourceNodesRef.current.forEach(node => {
                          try { node.stop(); } catch (err) {}
                        });
                        sourceNodesRef.current = [];
                        if (outputAudioContextRef.current) {
                          nextPlayTimeRef.current = outputAudioContextRef.current.currentTime;
                        }
                        clearSubtitles();
                        setLiveState('listening');
                        toast(lang === 'bn' ? 'এআই থামানো হয়েছে' : 'AI speech stopped', { duration: 1200, icon: '✋' });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] uppercase tracking-wider shadow-lg shadow-red-900/60 backdrop-blur-md border border-red-400 active:scale-90 transition-all cursor-pointer animate-pulse"
                      title={lang === 'bn' ? 'এআই থামান' : 'Stop AI'}
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>{lang === 'bn' ? 'থামুন' : 'Stop'}</span>
                    </motion.button>
                  )}
                </AnimatePresence>

                <div className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider backdrop-blur-md shadow-lg ${
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
                      <span className={`text-[10px] uppercase tracking-wider font-black ${latestSubtitle.role === 'user' ? 'text-sky-300' : 'text-emerald-400'}`}>
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
              {audioLevels.map((lvl, idx) => (
                <motion.div
                  key={idx}
                  animate={{ height: Math.max(4, lvl * 52) }}
                  transition={{ duration: 0.08 }}
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

              {/* Center: Large Shutter / Capture Button */}
              <div className="flex items-center justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCaptureSnapshot();
                  }}
                  type="button"
                  className="relative group p-1.5 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md transition-all active:scale-92 cursor-pointer shadow-2xl"
                  title={lang === 'bn' ? 'প্রেসক্রিপশন নিন' : 'Capture Diagnostic Report'}
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 border-4 border-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                    <Camera className="w-6 h-6 sm:w-7 sm:h-7 text-gray-950" />
                  </div>
                  {isFullscreen && (
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-black uppercase text-emerald-300 whitespace-nowrap drop-shadow-md">
                      {lang === 'bn' ? 'প্রেসক্রিপশন' : 'Prescription'}
                    </span>
                  )}
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
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider">
              {lang === 'bn' ? 'সংরক্ষিত' : 'Verified'}
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

          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/50 text-[11px] text-gray-500 dark:text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>
              {lang === 'bn' 
                ? 'গোপনীয়তা সুরক্ষা: কথপোকথনের হুবহু উক্তি সংরক্ষণ না করে শুধুমাত্র অনুমোদিত সারসংক্ষেপ সংরক্ষণ করা হয়েছে।' 
                : 'Privacy Protected: Verbatim dialogue is not saved; only the distilled agronomic summary is stored.'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
