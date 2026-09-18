import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, Mic, MicOff, PhoneOff, Video, VideoOff, RefreshCw, Zap, ZapOff, 
  Sparkles, AlertCircle, AlertTriangle, ShieldCheck, Activity, Volume2, 
  Scan, Info, Maximize2, Minimize2, ArrowRight, CheckCircle2, Loader2, Bot, User
} from 'lucide-react';
import { getAi, LIVE_API_MODEL } from '../services/ai';
import { LiveServerMessage, Modality } from '@google/genai';
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
  locationContext = "Cox's Bazar / Bangladesh",
  onCaptureFrameForDeepDiagnosis
}: LiveVideoCopilotProps) {
  const { user } = useAuth();
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
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
  const [latestSubtitle, setLatestSubtitle] = useState<{ text: string; role: 'user' | 'model' } | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const userAnalyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const sourceNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isMutedRef = useRef(false);

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
    const audioCtx = audioContextRef.current;
    if (!audioCtx) return;

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

      const startTime = Math.max(audioCtx.currentTime, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;

      sourceNodesRef.current.push(source);
      source.onended = () => {
        sourceNodesRef.current = sourceNodesRef.current.filter(n => n !== source);
      };
    } catch (err) {
      console.error("Audio chunk playback error:", err);
    }
  };

  // Send single video frame (1 FPS)
  const sendVideoFrame = (session: any) => {
    if (!videoRef.current || !canvasRef.current || !session) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 480;
    canvas.height = 360;
    ctx.drawImage(video, 0, 0, 480, 360);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.55);
    const base64Data = dataUrl.split(',')[1];
    if (base64Data) {
      try {
        session.sendRealtimeInput({
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
    setIsConnecting(true);
    setCameraError(null);

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
        return;
      }

      const stream = await startCamera();
      if (!stream) {
        setIsConnecting(false);
        return;
      }

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
        latencyHint: 'interactive'
      });
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      analyser.connect(audioCtx.destination);

      nextPlayTimeRef.current = audioCtx.currentTime;
      updateVisualizer();

      const ai = getAi();
      if (!ai) {
        throw new Error("Gemini AI instance unavailable");
      }

      const systemInstruction = `You are an elite Agronomist and Senior Plant Pathologist in Bangladesh observing a LIVE MULTIMODAL VIDEO STREAM from a farmer's phone in ${locationContext}.
      
YOUR CORE CAPABILITIES IN THIS LIVE MODE:
1. Continuous Visual Crop Inspection: You receive 1 JPEG video frame every second from the farmer's camera. Continuously examine plant leaves, stems, pods, soil moisture, discoloration, wilting, lesions, and pest activity.
2. Real-Time Verbal Interaction: The farmer speaks to you in ${lang === 'bn' ? 'Bangla' : 'English'}. Respond immediately with natural spoken ${lang === 'bn' ? 'Bangla' : 'English'}.
3. Proactive Observation: If you notice a visible agricultural problem (e.g. leaf curl, blast lesions, yellowing, stem borer hole, fungal spots) in the video frames even before the farmer asks, politely alert them in simple, clear language.
4. Chemical Safety & Legal Compliance:
   - Prioritize cultural, biological, and Integrated Pest Management (IPM) techniques.
   - STRICTLY FORBIDDEN: NEVER recommend banned or restricted chemicals in Bangladesh (Paraquat/গ্রামোক্সন, Carbofuran/ফুরাডান, Endosulfan/থিয়োডান, Monocrotophos).
   - Always state Pre-Harvest Intervals (PHI / অপেক্ষমাণ সময়) if advising any pesticide.
5. Tone & Structure: Speak warmly, concisely, and empathetically like a friendly mentor and agricultural extension officer. Keep spoken responses under 2-3 sentences at a time for natural conversation.`;

      const sessionPromise = ai.live.connect({
        model: LIVE_API_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: lang === 'bn' ? "Kore" : "Zephyr" }
            }
          },
          systemInstruction,
        },
        callbacks: {
          onopen: async () => {
            setIsConnecting(false);
            setIsSessionActive(true);
            playTone(880, 0.15, 0.08);

            // Connect microphone stream
            try {
              const audioSource = audioCtx.createMediaStreamSource(stream);
              const userAnalyser = audioCtx.createAnalyser();
              userAnalyser.fftSize = 64;
              userAnalyserRef.current = userAnalyser;
              audioSource.connect(userAnalyser);

              const processor = audioCtx.createScriptProcessor(512, 1, 1);
              processorRef.current = processor;

              processor.onaudioprocess = (e) => {
                if (isMutedRef.current) return;
                const inputData = e.inputBuffer.getChannelData(0);
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

                sessionPromise.then((sess: any) => {
                  sess.sendRealtimeInput({
                    audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
                  });
                });
              };

              audioSource.connect(processor);
              processor.connect(audioCtx.destination);

              // Launch 1 FPS Video Frame Loop
              frameIntervalRef.current = setInterval(() => {
                sessionPromise.then((sess: any) => {
                  sendVideoFrame(sess);
                });
              }, 1000);

              // Duration Timer
              durationIntervalRef.current = setInterval(() => {
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
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              playAudioChunk(base64Audio);
            }

            // Interruption handling
            if (message.serverContent?.interrupted) {
              sourceNodesRef.current.forEach(node => {
                try { node.stop(); } catch (e) {}
              });
              sourceNodesRef.current = [];
              if (audioContextRef.current) {
                nextPlayTimeRef.current = audioContextRef.current.currentTime;
              }
            }
          },

          onclose: () => {
            stopAllMedia();
          },

          onerror: (err: any) => {
            console.error("Gemini 3.8 Live Error:", err);
            toast.error(lang === 'bn' 
              ? "লাইভ ভিডিও সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।" 
              : "Live video stream error. Please try again.");
            stopAllMedia();
          }
        }
      });

      sessionRef.current = await sessionPromise;

    } catch (err: any) {
      console.error("Failed to start Live Video Copilot:", err);
      setIsConnecting(false);
      stopAllMedia();
    }
  };

  // Stop all media & connections
  const stopAllMedia = () => {
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

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    // Progressively save session summary to farmer profile if dialogue occurred
    if (transcripts.length > 0 || callDuration > 5) {
      const summaryText = transcripts.length > 0
        ? transcripts.map(t => `${t.role === 'user' ? 'কৃষক' : 'বিশেষজ্ঞ'}: ${t.text}`).slice(-4).join(' | ')
        : (lang === 'bn' ? 'লাইভ ভিডিও ও ভয়েস পরামর্শ সফলভাবে সম্পন্ন হয়েছে।' : 'Live video consultation session completed.');
      
      recordFarmerInteractionEvent({
        userId: user?.uid || 'guest_farmer_demo',
        fullName: user?.displayName || 'কৃষক ভাই (Farmer)',
        eventType: 'voice_consultation',
        title: lang === 'bn' ? 'লাইভ ভিডিও ও ভয়েস পরামর্শ সেশন' : 'Live Video Consultation Session',
        summary: summaryText.substring(0, 500),
        keyFacts: [
          `কলের ব্যাপ্তি: ${Math.max(1, Math.round(callDuration))} সেকেন্ড`,
          `পরামর্শের মাধ্যম: লাইভ ভিডিও এআই`,
          `অবস্থান: ${locationContext}`
        ],
        district: locationContext.includes('Cox') ? 'কক্সবাজার' : undefined,
        insight: lang === 'bn' ? 'লাইভ ক্যামেরা প্রদর্শন করে সরাসরি বিশেষজ্ঞ পরামর্শ নিয়েছেন।' : 'Conducted live visual crop consultation.'
      }).then(() => {
        toast.success(lang === 'bn' ? 'সেশনের সারসংক্ষেপ আপনার স্মার্ট কৃষক কার্ডে সংরক্ষিত হয়েছে!' : 'Session summary saved to your Krishi Dossier!');
      }).catch(err => console.warn(err));
    }

    setIsSessionActive(false);
    setIsConnecting(false);
    setIsCameraActive(false);
    setIsTorchOn(false);
    setCallDuration(0);
    setLiveState('idle');
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
                {lang === 'bn' 
                  ? 'আপনার ফোন ক্যামেরা ফসলের দিকে ধরুন এবং সরাসরি কথা বলুন। এআই সরাসরি ভিডিও দেখে তৎক্ষণাৎ রোগ নির্ণয় ও সমাধান জানাবে।' 
                  : 'Point your camera at the crop and speak naturally. The AI inspects the video in real-time and speaks back.'}
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={startLiveSession}
              disabled={isConnecting}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-gray-950 font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all flex items-center justify-center gap-2.5 mx-auto cursor-pointer"
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
              </div>

              <div className="flex items-center gap-2">
                <div className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider backdrop-blur-md shadow-lg ${
                  liveState === 'speaking' ? 'bg-emerald-500 text-gray-950 animate-pulse' :
                  liveState === 'listening' ? 'bg-blue-500 text-white' : 'bg-gray-900/80 text-gray-300'
                }`}>
                  {liveState === 'speaking' ? (lang === 'bn' ? '🎙️ এআই কথা বলছে' : '🎙️ AI Speaking') :
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
    </div>
  );
}
