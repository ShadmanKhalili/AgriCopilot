import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, PhoneOff, Phone, Loader2, Volume2, Bot, BrainCircuit, Zap, Sparkles, ChevronDown, ChevronUp, Square } from 'lucide-react';
import { getAi, LIVE_API_MODEL, LIVE_EXTENDED_THINKING_MODEL } from '../services/ai';
import { LiveServerMessage, Modality, ThinkingLevel } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

interface LiveExpertCallProps {
  diagnosisContext: string;
  lang: string;
  locationContext?: string;
}

export function LiveExpertCall({ diagnosisContext, lang, locationContext = "Bangladesh" }: LiveExpertCallProps) {
  const [isCalling, setIsCalling] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isExtendedThinking, setIsExtendedThinking] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [audioLevel, setAudioLevel] = useState<number[]>(new Array(32).fill(0));
  const [callDuration, setCallDuration] = useState(0);
  const [liveThinkingText, setLiveThinkingText] = useState<string>('');
  const [showThinkingDetails, setShowThinkingDetails] = useState(false);
  const [userSpeechTranscript, setUserSpeechTranscript] = useState<string>('');
  const [liveTranscription, setLiveTranscription] = useState<string>('');
  
  const isMutedRef = useRef(false);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const userAnalyserRef = useRef<AnalyserNode | null>(null);
  const silenceStartRef = useRef<number>(Date.now());
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const sourceNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const lastAiSpeechEndTimeRef = useRef<number>(0);
  const userSpeakingHangoverRef = useRef<number>(0);
  const sessionIdRef = useRef<number>(0);
  const isStartingCallRef = useRef<boolean>(false);
  const isAiTurnInProgressRef = useRef<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sound effects generator
  const playSystemSound = (type: 'ring' | 'connect' | 'end' | 'hangup') => {
    const ctx = outputAudioContextRef.current || audioContextRef.current;
    if (!ctx) return;
    
    const playTone = (freq: number, duration: number, volume: number = 0.1, ramp: boolean = true) => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        if (ramp) {
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        }
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (e) {
        console.warn("Audio tone failed:", e);
      }
    };

    if (type === 'ring') {
      // European/Standard Ring-back: 400Hz + 450Hz mixed
      playTone(400, 1.2, 0.03);
      playTone(450, 1.2, 0.03);
    } else if (type === 'connect') {
      playTone(880, 0.1, 0.05);
      setTimeout(() => playTone(1320, 0.1, 0.05), 100);
    } else if (type === 'end') {
      playTone(440, 0.3, 0.1);
    } else if (type === 'hangup') {
      // Three rapid "busy" beeps
      for (let i = 0; i < 3; i++) {
        setTimeout(() => playTone(480, 0.15, 0.05, false), i * 300);
      }
    }
  };

  useEffect(() => {
    if (isConnected) {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallDuration(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isConnected]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const updateVisualizer = () => {
    let aiAvg = 0;
    let aiLevels: number[] = new Array(32).fill(0);
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      const newLevels = [];
      const step = Math.floor(dataArray.length / 32);
      for (let i = 0; i < 32; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += dataArray[i * step + j];
        }
        newLevels.push(sum / step / 255);
      }
      aiLevels = newLevels;
      aiAvg = newLevels.reduce((a, b) => a + b, 0) / newLevels.length;
    }
    
    let userAvg = 0;
    let userLevels: number[] = new Array(32).fill(0);
    if (userAnalyserRef.current && !isMutedRef.current) {
      const userDataArray = new Uint8Array(userAnalyserRef.current.frequencyBinCount);
      userAnalyserRef.current.getByteFrequencyData(userDataArray);

      const newLevels = [];
      const step = Math.floor(userDataArray.length / 32);
      for (let i = 0; i < 32; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += userDataArray[i * step + j];
        }
        newLevels.push(sum / step / 255);
      }
      userLevels = newLevels;
      userAvg = newLevels.reduce((a, b) => a + b, 0) / newLevels.length;
    }

    const aiSpeaking = aiAvg > 0.02;
    const userSpeaking = userAvg > 0.01;

    setIsSpeaking(aiSpeaking);

    setCallStatus(prev => {
      if (aiSpeaking) return 'speaking';
      if (userSpeaking) {
        silenceStartRef.current = Date.now();
        return 'listening';
      }
      if (prev === 'listening' && Date.now() - silenceStartRef.current > 1000) {
        return 'thinking';
      }
      if (prev === 'thinking' && Date.now() - silenceStartRef.current > 15000) {
        return 'listening';
      }
      return prev === 'idle' ? 'listening' : prev;
    });

    setAudioLevel(aiSpeaking ? aiLevels : (userSpeaking ? userLevels : new Array(32).fill(0)));

    animationFrameRef.current = requestAnimationFrame(updateVisualizer);
  };

  const startCall = async () => {
    if (isConnected || isCalling || isRinging || isStartingCallRef.current) {
      console.warn("Live call already in progress or ringing. Ignoring duplicate call request.");
      return;
    }
    isStartingCallRef.current = true;
    sessionIdRef.current += 1;
    const currentSessionId = sessionIdRef.current;

    // Clean up any previous call artifacts first
    endCall();
    setIsCalling(true);
    setIsRinging(true);
    
    try {
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
      
      // Start Ringing Loop (3-4 seconds delay)
      playSystemSound('ring');
      const ringInterval = setInterval(() => playSystemSound('ring'), 2500);
      
      // Wait for "Ringing" delay to complete for realism
      await new Promise(resolve => setTimeout(resolve, 4000));
      clearInterval(ringInterval);

      const apiKey = (process.env.GEMINI_API_KEY as string) || (import.meta.env.VITE_GEMINI_API_KEY as string) || '';
      if (!apiKey) {
        toast.error(lang === 'bn' 
          ? "ভয়েস কল ফিচারের জন্য GEMINI_API_KEY যুক্ত করতে হবে। আপাতত চ্যাট ব্যবহার করুন।" 
          : "Voice calls require GEMINI_API_KEY to be set in your environment. Please use text chat for now.");
        setIsCalling(false);
        return;
      }
      
      const ai = getAi(true);
      if (!ai) {
        throw new Error("Gemini AI instance unavailable");
      }
      
      const analyser = outputAudioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      analyser.connect(outputAudioCtx.destination);
      
      updateVisualizer();
      nextPlayTimeRef.current = outputAudioCtx.currentTime;

      // Model-specialized system prompt
      const systemInstruction = isExtendedThinking
        ? `You are a Chief Agronomic Scientist and Senior Plant Pathologist at Bangladesh Agricultural Research Institute (BARI / BRRI) conducting an in-depth clinical voice consultation.
CONTEXT: Deep diagnostic review regarding: "${diagnosisContext}".
LOCATION: ${locationContext}, Bangladesh.
MODE: GEMINI 3.8 LIVE EXTENDED THINKING (SUPER SPECIALIZED CLINICAL PATHOLOGY & DIFFERENTIAL DIAGNOSIS).

CRITICAL CONVERSATIONAL & SILENCE DIRECTIVE:
1. DO NOT GREET OR SPEAK FIRST ON CALL CONNECT. Stay completely silent when the call connects.
2. Start speaking ONLY after the caller speaks first. Listen attentively and reply directly in natural, authoritative spoken Bangla (বাংলা).
3. STRICT BAN ON META-ANNOUNCEMENTS: NEVER say robotic phrases like "আমি গভীর বৈজ্ঞানিক পর্যবেক্ষণের জন্য শুনছি", "আমি এআই সহকারী", or announce technical capabilities. Jump straight into the consultation like an expert doctor.
4. Switch to English ONLY if the user explicitly requests ("ইংরেজিতে বলুন" / "Speak in English").
5. Understand Bangladeshi regional farming terms and accents (Chittagong, Sylhet, Rangpur, Barisal, Jessore, Noakhali) effortlessly.

DEEP EXTENDED THINKING REASONING MANDATE (SUPER SPECIALIZED CLINICAL PATHOLOGY):
Before formulating your spoken response, leverage your thinking budget to execute:
1. Differential Diagnosis: Systematically evaluate symptoms against look-alike pathologies in Bangladesh:
   - Rice: Blast vs Bacterial Leaf Blight (BLB) vs Brown Spot vs Sheath Blight.
   - Vegetables (Eggplant/Tomato/Chili): Bacterial Wilt vs Fusarium Wilt vs Shoot & Fruit Borer damage.
   - Potato: Late Blight vs Early Blight.
   - Nutrient vs Environmental: Zinc deficiency (Khaira) vs Salinity tip scorch vs Moisture stress.
2. Agro-Ecological Context: Correlate with current Bangladeshi crop season (Kharif-1, Kharif-2, Rabi, Boro), soil characteristics, and weather in ${locationContext}.
3. Stepped IPM Hierarchy: Prioritize non-chemical cultural, biological, and physical remedies first (light traps, Trichoderma harzianum, neem oil extract, perching/ডাল পোতা, balanced Potash).
4. Agrochemical Safety & Precision Math:
   - ZERO TOLERANCE: NEVER suggest banned chemicals in Bangladesh (Paraquat/গ্রামোক্সন, Carbofuran/ফুরাডান, Monocrotophos, Endosulfan, Dichlorvos).
   - For safe approved remedies, state:
     a) Generic Active Ingredient + popular BD brand (e.g., ম্যানকোজেব যেমন ডাইথেন এম-৪৫, হেক্সাকোনাজল যেমন কন্টাফ ৫ ইসি, অ্যাজোক্সিস্ট্রবিন+ডাইফেনোকোনাজল যেমন এমিস্টার টপ).
     b) Exact dilution (e.g., ১ মিলি বা ২ গ্রাম প্রতি লিটার পানি, বা ১০ লিটার স্প্রেয়ার ড্রামে ১০-২০ মিলি).
     c) Pre-Harvest Interval (PHI / অপেক্ষমাণ সময়) and protective gear (মাস্ক ও গ্লাভস পরে স্প্রে করা).

SPOKEN DELIVERY CADENCE:
- Distill your clinical reasoning into 2 structured, crystal-clear spoken Bangla sentences explaining the root diagnosis and immediate recovery action.`
        : `You are a warm, highly knowledgeable Universal Green Companion & Agricultural Advisor (সবুজ পরামর্শক ও সার্বিক উদ্ভিদ বিশেষজ্ঞ) in Bangladesh conducting a real-time live phone call.
CONTEXT: General plant, gardening, or farming consultation: "${diagnosisContext}".
LOCATION: ${locationContext}, Bangladesh.
MODE: GEMINI 3.8 LIVE (FAST, BROAD & VERSATILE PLANT & GARDENING COMPANION).

BROAD MULTI-DOMAIN SCOPE & CAPABILITIES:
You naturally and warmly assist with ANY green-living, plant care, gardening, or agricultural question:
1. Rooftop & Balcony Gardening (ছাদ বাগান ও বারান্দা বাগান): Practical setup, lightweight potting soil mix (মাটি + ভার্মিকম্পোস্ট + কোকোপিট + বালি), tub/pot drainage holes, rooftop intense sun and heat protection, and natural homemade liquid fertilizers (সরিষার খৈল পচা পানি, কলার খোসা ভেজানো পটাশ পানি, ডিমের খোসার ক্যালসিয়াম).
2. Indoor Houseplants & Home Decor (ইনডোর গাছপালা): Helping users choose which plants to buy for apartments/offices (Money plant, Snake plant, ZZ plant, Peace lily, Spider plant, Aloe vera, Areca palm), light levels (low light vs bright indirect), simple watering rules (checking 1-inch dry soil before watering), air purifying benefits, and pet safety.
3. Kitchen Herbs & Vegetables: Growing chilis, tomatoes, mint (পুদিনা), coriander (ধনেপাতা), ginger, lemons in small balcony pots.
4. Farming, Crops & Orchards: Agricultural fields, seasonal planting, vegetative growth, and common garden pests (mealybugs, aphids, whiteflies, caterpillars).
5. Safe & Organic Remedies: Neem oil spray, mild dishwashing liquid spray, wood ash, composting kitchen peelings.

CRITICAL CONVERSATIONAL & SILENCE DIRECTIVE:
1. DO NOT GREET OR SPEAK FIRST ON CALL CONNECT. Stay completely silent when the call connects.
2. Start speaking ONLY after the caller speaks first. Respond directly, warmly, and concisely in natural spoken Bangla (বাংলা).
3. STRICT BAN ON META-ANNOUNCEMENTS: NEVER say robotic phrases like "আমি সরাসরি শুনছি", "আমি এআই", or announce call systems. Speak naturally like a friendly plant mentor on the line.
4. Switch to English only if the caller explicitly says "Speak in English" or "ইংরেজিতে বলুন".

LIVE CONVERSATIONAL CADENCE (GEMINI 3.8 LIVE):
- Ultra-low latency spoken turns: Keep responses short, punchy, and conversational (1-2 sentences at a time, strictly under 25 words). Act like a friendly, attentive human expert on the phone.
- Rapid Interactivity & Natural Dialogue: Answer directly, then invite them to speak (e.g., "আর কিছু জানতে চান?", "গাছের বয়স কত?"). Never deliver long lectures.
- IMMEDIATE BARGE-IN & INTERRUPTION YIELDING: If the user says "দাঁড়াও", "থামো", "Wait", "Stop", or interrupts by speaking, immediately cease previous points and answer their new topic directly.
- Active Listening: Acknowledge caller statements with brief conversational confirmations ("হ্যাঁ, বুঝতে পারছি", "অবশ্যই").
- If you need details, ask ONE simple, clarifying question at a time (e.g., "আপনার বারান্দায় দিনে কয় ঘণ্টা রোদ আসে?", "টবের মাটিতে কি পানি জমে থাকে?").
- Agrochemical Safety: For home gardens, indoor pots, and edible herbs, strongly prioritize safe organic remedies. Never recommend banned toxic chemicals (Paraquat, Carbofuran, Monocrotophos).
- SINGLE RESPONSE MANDATE: Deliver exactly ONE clear, complete spoken answer per inquiry. Never provide duplicate answers.`;

      const selectedLiveModel = isExtendedThinking ? LIVE_EXTENDED_THINKING_MODEL : LIVE_API_MODEL;

      const liveConfig: any = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: lang === 'bn' ? "Kore" : "Zephyr" } },
        },
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
            setIsConnected(true);
            setIsCalling(false);
            setIsRinging(false);
            isStartingCallRef.current = false;
            setCallStatus('listening');
            playSystemSound('connect');
            
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                  channelCount: 1,
                  sampleRate: 16000,
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                } 
              });
              streamRef.current = stream;
              
              const source = inputAudioCtx.createMediaStreamSource(stream);
              
              const userAnalyser = inputAudioCtx.createAnalyser();
              userAnalyser.fftSize = 64;
              userAnalyserRef.current = userAnalyser;
              source.connect(userAnalyser);

              const processor = inputAudioCtx.createScriptProcessor(2048, 1, 1);
              processorRef.current = processor;

              // Silent gain node keeps ScriptProcessor alive without echoing mic into speakers
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
                  setCallStatus('listening');
                } else if (isAiPlaying && !isUserSpeaking) {
                  // AI is speaking and user is quiet: drop low room leak so AI doesn't echo into itself
                  return;
                }

                // 4. Standard PCM 16 conversion
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

              source.connect(processor);
            } catch (err) {
              console.error("Microphone access denied:", err);
              endCall();
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (sessionIdRef.current !== currentSessionId) return;

            // 1. Audio stream playback
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts && parts.length > 0) {
              isAiTurnInProgressRef.current = true;
              for (const part of parts) {
                if (part.inlineData?.data) {
                  playAudioChunk(part.inlineData.data);
                  setCallStatus('speaking');
                }
              }
            }

            // 2. Separate Thinking thoughts from spoken speech parts
            if (parts && parts.length > 0) {
              for (const part of parts) {
                if ((part as any).thought && part.text) {
                  isAiTurnInProgressRef.current = true;
                  setCallStatus('thinking');
                  setLiveThinkingText(prev => (prev + ' ' + part.text).slice(-1200));
                }
              }
            }

            // 3. Spoken transcription from Live API
            const outputTransText = (message.serverContent as any)?.outputTranscription?.text;
            if (outputTransText && outputTransText.trim().length > 0) {
              isAiTurnInProgressRef.current = true;
              setLiveTranscription(prev => (prev ? prev + ' ' + outputTransText : outputTransText).slice(-300));
              setCallStatus('speaking');
            }

            const inputTransText = (message.serverContent as any)?.inputTranscription?.text;
            if (inputTransText) {
              setUserSpeechTranscript(inputTransText);
              setCallStatus('listening');
            }

            // 4. Turn Complete handling - naturally release lock
            if (message.serverContent?.turnComplete) {
              if (sourceNodesRef.current.length === 0) {
                isAiTurnInProgressRef.current = false;
                setCallStatus('listening');
              }
            }
            
            // 5. Interruption handling
            if (message.serverContent?.interrupted) {
              isAiTurnInProgressRef.current = false;
              sourceNodesRef.current.forEach(node => {
                try { node.stop(); } catch (e) {}
              });
              sourceNodesRef.current = [];
              if (outputAudioContextRef.current) {
                nextPlayTimeRef.current = outputAudioContextRef.current.currentTime;
              }
              setCallStatus('listening');
            }
          },
          onclose: () => {
            if (sessionIdRef.current === currentSessionId) {
              endCall();
            }
          },
          onerror: (err: any) => {
            if (sessionIdRef.current === currentSessionId) {
              console.error("Live API Error:", err);
              if (err?.message === 'Network error' || err instanceof Event) {
                 toast.error(lang === 'bn' ? "লাইভ এআই কল সংযোগ করতে পারেনি। দয়া করে নতুন উইন্ডোতে অ্যাপটি খুলুন বা একটু পরে আবার চেষ্টা করুন।" : "Live API connection failed. This might be due to iframe security policies. Please try opening the app in a new tab.");
              }
              endCall();
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
      isStartingCallRef.current = false;
      
    } catch (error) {
      console.error("Failed to start live call:", error);
      setIsCalling(false);
      isStartingCallRef.current = false;
      endCall();
    }
  };

  const playAudioChunk = (base64Audio: string) => {
    const audioCtx = audioContextRef.current;
    if (!audioCtx) return;

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
      // If queue fell behind current time, start at now.
      // NEVER reset nextPlayTime to now when it is ahead, as doing so causes future chunks
      // to play simultaneously over currently playing chunks!
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
          setCallStatus('listening');
        }
      };
    } catch (err) {
      console.error("Audio chunk playback error:", err);
    }
  };

  const endCall = () => {
    sessionIdRef.current += 1;
    isStartingCallRef.current = false;
    if (isConnected) {
      playSystemSound('end');
      setTimeout(() => playSystemSound('hangup'), 200);
    }
    
    setIsCalling(false);
    setIsRinging(false);
    setIsConnected(false);
    setCallStatus('idle');
    setLiveThinkingText('');
    setUserSpeechTranscript('');
    setLiveTranscription('');
    setShowThinkingDetails(false);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
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
    if (sessionRef.current) {
      try {
        if (sessionRef.current.close) sessionRef.current.close();
      } catch (e) {}
      sessionRef.current = null;
    }
    
    sourceNodesRef.current.forEach(node => {
      try { node.stop(); } catch (e) {}
    });
    sourceNodesRef.current = [];
  };

  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      isMutedRef.current = next;
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => {
          track.enabled = !next;
        });
      }
      return next;
    });
  };

  return (
    <div className="w-full mt-6 mb-4 space-y-3" role="region" aria-label={lang === 'bn' ? 'এআই বিশেষজ্ঞ কল সার্ভিস' : 'AI Expert Call Service'}>
      {!isConnected && !isCalling ? (
        <div className="space-y-3">
          {/* Simplified Consultation Mode Switch */}
          <div className="bg-slate-900/90 dark:bg-slate-900/90 border border-slate-700/60 rounded-2xl p-3 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`p-2 rounded-xl shrink-0 transition-colors ${
                  isExtendedThinking ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {isExtendedThinking ? <BrainCircuit className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block">
                    {isExtendedThinking 
                      ? (lang === 'bn' ? 'গভীর রোগ ও প্যাথলজি মোড' : 'Deep Clinical Pathology Mode')
                      : (lang === 'bn' ? 'দ্রুত ভয়েস কল (বাগান, ইনডোর ও সার্বিক উদ্ভিদ)' : 'Fast Voice Call (Gardens, Houseplants & Plants)')}
                  </span>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    {isExtendedThinking 
                      ? (lang === 'bn' ? 'সুপার স্পেশালাইজড: জটিল ফসলি রোগের বিশদ বৈজ্ঞানিক ব্যবচ্ছেদ ও নিখুঁত সমাধান' : 'Super specialized: Clinical plant pathology & precision differential diagnosis')
                      : (lang === 'bn' ? 'বিস্তৃত পরিধি: ছাদ বাগান, ইনডোর গাছ বাছাই, টবের মাটি ও তাৎক্ষণিক সহজ পরামর্শ' : 'Broad scope: Rooftop gardens, indoor plant buying, potting mix & instant tips')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsExtendedThinking(!isExtendedThinking)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isExtendedThinking ? 'bg-purple-600' : 'bg-gray-700'
                }`}
                role="switch"
                aria-checked={isExtendedThinking}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isExtendedThinking ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Quick Topic Guide Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-slate-800">
              <span className="text-[9px] px-2 py-0.5 rounded-md bg-slate-800 text-emerald-300 border border-slate-700/60">
                {lang === 'bn' ? '🌱 ছাদ ও বারান্দা বাগান' : '🌱 Rooftop & Balcony'}
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded-md bg-slate-800 text-emerald-300 border border-slate-700/60">
                {lang === 'bn' ? '🪴 ইনডোর গাছ বাছাই' : '🪴 Indoor Plants to Buy'}
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded-md bg-slate-800 text-emerald-300 border border-slate-700/60">
                {lang === 'bn' ? '🌿 টবের মাটি ও সার' : '🌿 Potting Mix & Care'}
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded-md bg-slate-800 text-emerald-300 border border-slate-700/60">
                {lang === 'bn' ? '🌾 ফসলি রোগবালাই' : '🌾 Crop Advisory'}
              </span>
            </div>
          </div>

          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={startCall}
            aria-label={lang === 'bn' ? 'এআই বিশেষজ্ঞের সাথে ভয়েস কল শুরু করুন' : 'Start voice chat with AI Expert'}
            className={`w-full flex flex-col items-center justify-center space-y-2 p-6 rounded-3xl shadow-xl transition-all cursor-pointer relative overflow-hidden group focus:ring-4 outline-none ${
              isExtendedThinking
                ? 'bg-gradient-to-br from-purple-700 via-indigo-800 to-emerald-900 text-white shadow-purple-950/30 border border-purple-500/40 focus:ring-purple-400'
                : 'bg-gradient-to-br from-green-600 to-emerald-800 text-white shadow-green-900/20 border border-green-500/30 focus:ring-green-400'
            }`}
          >
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <div className="bg-white/20 p-4 rounded-full group-hover:scale-110 transition-transform shadow-inner relative" aria-hidden="true">
              <motion.span 
                className="absolute -inset-1 rounded-full border border-white/30 pointer-events-none"
                animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
              />
              <Phone className="w-8 h-8 text-white relative z-10" />
            </div>
            <span className="font-black uppercase tracking-widest text-lg lg:text-xl drop-shadow-sm">
              {lang === 'bn' ? 'ভয়েস কল শুরু করুন' : 'Start Voice Chat'}
            </span>
            <span className="text-green-100 text-xs font-medium">
              {lang === 'bn' 
                ? (isExtendedThinking ? 'ক্লিনিক্যাল প্যাথলজিস্টের সাথে গভীর বৈজ্ঞানিক আলোচনা' : 'ছাদ বাগান, ইনডোর গাছ বা ফসল নিয়ে সরাসরি কথা বলুন') 
                : (isExtendedThinking ? 'Deep scientific consultation with Clinical Pathologist' : 'Ask about rooftop gardens, indoor plants, or crops')}
            </span>
          </motion.button>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="bg-gray-950 rounded-[40px] p-8 w-full shadow-2xl border border-white/5 relative overflow-hidden min-h-[500px] flex flex-col items-center justify-between"
          role="dialog"
          aria-modal="false"
          aria-labelledby="expert-call-title"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,197,94,0.15),transparent)] pointer-events-none"></div>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-3xl pointer-events-none"></div>
          
          <div className="flex flex-col items-center space-y-2 relative z-10 w-full pt-10">
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={
                callStatus === 'listening'
                  ? { 
                      scale: [1, 1.04, 1], 
                      boxShadow: [
                        "0 0 25px rgba(34,197,94,0.3)", 
                        "0 0 45px rgba(34,197,94,0.6)", 
                        "0 0 25px rgba(34,197,94,0.3)"
                      ] 
                    }
                  : callStatus === 'thinking'
                  ? { 
                      scale: [1, 0.97, 1], 
                      boxShadow: [
                        "0 0 20px rgba(45,212,191,0.3)", 
                        "0 0 40px rgba(99,102,241,0.6)", 
                        "0 0 20px rgba(45,212,191,0.3)"
                      ] 
                    }
                  : { scale: 1, boxShadow: "0 0 40px rgba(34,197,94,0.3)" }
              }
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              className="w-24 h-24 rounded-full bg-gradient-to-tr from-green-500 to-emerald-400 p-1 mb-4 relative"
            >
              <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center overflow-hidden relative">
                <Bot className="w-12 h-12 text-green-500" />
                {callStatus === 'thinking' && (
                  <motion.div 
                    className="absolute inset-0 bg-teal-500/10"
                    animate={{ opacity: [0.2, 0.6, 0.2] }}
                    transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
              </div>
            </motion.div>
            
            <div className="text-center">
              <h4 id="expert-call-title" className="text-white font-black text-3xl tracking-tight mb-1">
                {lang === 'bn' ? 'এআই কৃষি বিশেষজ্ঞ' : 'AI Agri-Expert'}
              </h4>
              <p className="text-green-500/80 text-sm font-medium tracking-widest uppercase flex items-center justify-center space-x-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span>
                  {isConnected 
                    ? formatDuration(callDuration) 
                    : isRinging 
                      ? (lang === 'bn' ? 'রিং হচ্ছে...' : 'Ringing...') 
                      : (lang === 'bn' ? 'সংযুক্ত করা হচ্ছে...' : 'Connecting...')}
                </span>
              </p>
              <p className="text-gray-400 text-[11px] mt-1.5 max-w-xs mx-auto">
                {lang === 'bn' 
                  ? 'লাইভ এআই ভয়েস পরামর্শক • সরকারি কৃষি সহায়তার জন্য ১৬১২৩ ডায়াল করুন' 
                  : 'Live AI Voice Assistant • For Gov Krishi Hotline dial 16123'}
              </p>

              {/* Active Model Indicator Badge */}
              <div className="flex items-center justify-center gap-2 mt-2.5">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border backdrop-blur-md shadow-sm ${
                  isExtendedThinking
                    ? 'bg-purple-950/70 border-purple-500/40 text-purple-200'
                    : 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                }`}>
                  {isExtendedThinking ? <BrainCircuit className="w-3.5 h-3.5 text-purple-400" /> : <Zap className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>
                    {isExtendedThinking 
                      ? (lang === 'bn' ? 'মডেল: Gemini 3.8 Live Extended Thinking' : 'Model: Gemini 3.8 Live Extended Thinking')
                      : (lang === 'bn' ? 'মডেল: Gemini 3.8 Live (ফাস্ট অডিও)' : 'Model: Gemini 3.8 Live (Fast Audio)')
                    }
                  </span>
                </div>
              </div>

              {/* Real-time Extended Thinking Inspector */}
              {isExtendedThinking && (liveThinkingText || callStatus === 'thinking') && (
                <div className="w-full max-w-md mx-auto mt-3 bg-purple-950/50 border border-purple-500/40 rounded-2xl p-3 backdrop-blur-md text-left shadow-lg">
                  <button
                    type="button"
                    onClick={() => setShowThinkingDetails(!showThinkingDetails)}
                    className="w-full flex items-center justify-between text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping shrink-0" />
                      <span className="text-[11px] font-bold text-purple-200 uppercase tracking-wider truncate">
                        {lang === 'bn' ? '🧠 লাইভ এগ্রোনমিক যুক্তি ও রোগ বিশ্লেষণ...' : '🧠 Live Agronomic Reasoning & Pathology...'}
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
                        className="mt-2 text-[11px] text-purple-100/95 font-mono bg-purple-900/40 p-2.5 rounded-xl border border-purple-500/30 max-h-32 overflow-y-auto leading-relaxed"
                      >
                        {liveThinkingText || (lang === 'bn' ? 'লক্ষণ, মাটি ও আবহাওয়া ডাটা তুলনা করা হচ্ছে...' : 'Comparing symptoms, soil profile, and meteorological stress...')}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Real-time Spoken Subtitles Preview */}
              {(userSpeechTranscript || liveTranscription) && (
                <div className="w-full max-w-md mx-auto mt-2.5 space-y-1.5">
                  {userSpeechTranscript && (
                    <div className="text-left bg-sky-950/60 border border-sky-500/30 rounded-xl px-3 py-1.5 text-[11px] text-sky-200 flex items-start gap-1.5">
                      <span className="font-bold shrink-0 text-sky-300">{lang === 'bn' ? '🗣️ আপনি:' : '🗣️ You:'}</span>
                      <span className="italic">{userSpeechTranscript}</span>
                    </div>
                  )}
                  {liveTranscription && (
                    <div className="text-left bg-emerald-950/60 border border-emerald-500/30 rounded-xl px-3 py-1.5 text-[11px] text-emerald-200 flex items-start gap-1.5">
                      <span className="font-bold shrink-0 text-emerald-300">{lang === 'bn' ? '🤖 বিশেষজ্ঞ:' : '🤖 Expert:'}</span>
                      <span>{liveTranscription}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="relative flex items-center justify-center w-full h-48 relative z-10" aria-hidden="true">
            <div className="flex items-center justify-center gap-1 w-full max-w-sm px-4">
              {audioLevel.map((level, i) => (
                <motion.div
                  key={i}
                  animate={{ 
                    height: isCalling ? (8 + Math.sin(Date.now()/100 + i) * 4) : Math.max(4, level * 120),
                    opacity: isCalling ? (0.2 + Math.sin(Date.now()/200 + i) * 0.1) : (level > 0 ? 1 : 0.2)
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className={`w-1 rounded-full ${callStatus === 'speaking' ? 'bg-green-500' : 'bg-indigo-500'}`}
                />
              ))}
            </div>
          </div>

          <div className="w-full flex flex-col items-center space-y-8 relative z-10 pb-6">
            <div className="flex flex-col items-center">
              {/* Instant Stop / Interrupt Button during AI speaking or thinking */}
              <AnimatePresence>
                {(callStatus === 'speaking' || isAiTurnInProgressRef.current) && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, y: -6 }}
                    className="mb-2"
                  >
                    <button
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
                        setCallStatus('listening');
                        toast(lang === 'bn' ? 'এআই থামানো হয়েছে' : 'AI speech stopped', { duration: 1200, icon: '✋' });
                      }}
                      className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-900/60 backdrop-blur-md border border-red-400 active:scale-95 transition-all cursor-pointer animate-pulse"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>{lang === 'bn' ? 'থামুন (ইন্টারাপ্ট)' : 'Stop / Interrupt'}</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <p className={`text-xs uppercase tracking-[0.2em] font-black transition-colors duration-500 ${isCalling || callStatus === 'thinking' ? 'text-green-400 animate-pulse' : 'text-gray-400'}`}>
                {isRinging
                  ? (lang === 'bn' ? 'বিশেষজ্ঞকে কল করা হচ্ছে...' : 'Ringing Expert...')
                  : isCalling 
                    ? (lang === 'bn' ? 'রাউটিং কল...' : 'Routing Call...') 
                    : callStatus === 'thinking' 
                      ? (lang === 'bn' ? 'সারাংশ খোঁজা হচ্ছে...' : 'Consulting Database...') 
                      : callStatus === 'speaking' 
                        ? (lang === 'bn' ? 'বিশেষজ্ঞ কথা বলছেন' : 'Expert Speaking') 
                        : callStatus === 'listening' 
                          ? (lang === 'bn' ? 'আপনার কথা শোনা হচ্ছে' : 'Listening to you') 
                          : (lang === 'bn' ? 'সংযুক্ত' : 'Connected')}
              </p>
            </div>

            <div className="flex items-center justify-center space-x-12">
              <div className="flex flex-col items-center space-y-3">
                <div className="relative flex items-center justify-center">
                  {/* Subtle motion animations when AI is listening */}
                  {!isMuted && callStatus === 'listening' && (
                    <>
                      <motion.span
                        className="absolute -inset-3.5 rounded-full border border-emerald-400/50 pointer-events-none"
                        animate={{
                          scale: [1, 1.45],
                          opacity: [0.7, 0]
                        }}
                        transition={{
                          duration: 1.8,
                          repeat: Infinity,
                          ease: "easeOut"
                        }}
                      />
                      <motion.span
                        className="absolute -inset-1.5 rounded-full bg-emerald-500/20 pointer-events-none"
                        animate={{
                          scale: [1, 1.25],
                          opacity: [0.5, 0]
                        }}
                        transition={{
                          duration: 1.8,
                          delay: 0.35,
                          repeat: Infinity,
                          ease: "easeOut"
                        }}
                      />
                    </>
                  )}

                  {/* Subtle motion animations when AI is processing / thinking */}
                  {!isMuted && callStatus === 'thinking' && (
                    <>
                      <motion.span
                        className="absolute -inset-3 rounded-full border-2 border-dashed border-teal-400/70 pointer-events-none"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
                      />
                      <motion.span
                        className="absolute -inset-1 rounded-full bg-gradient-to-tr from-teal-400/20 via-emerald-400/10 to-indigo-500/25 blur-sm pointer-events-none"
                        animate={{
                          opacity: [0.35, 0.8, 0.35],
                          scale: [0.98, 1.04, 0.98]
                        }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </>
                  )}

                  <motion.button
                    type="button"
                    onClick={toggleMute}
                    disabled={isCalling}
                    aria-pressed={isMuted}
                    aria-label={
                      isMuted
                        ? (lang === 'bn' ? 'মাইক্রোফোন চালু করুন' : 'Unmute microphone')
                        : callStatus === 'listening'
                          ? (lang === 'bn' ? 'এআই আপনার কথা শুনছে - মাইক্রোফোন বন্ধ করতে চাপুন' : 'AI is listening - tap to mute')
                          : callStatus === 'thinking'
                            ? (lang === 'bn' ? 'এআই উত্তর প্রসেসিং করছে - মিউট করতে চাপুন' : 'AI is processing - tap to mute')
                            : (lang === 'bn' ? 'মাইক্রোফোন মিউট করুন' : 'Mute microphone')
                    }
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.94 }}
                    animate={
                      isMuted
                        ? { scale: 1, boxShadow: "0 0 0px rgba(0,0,0,0)" }
                        : callStatus === 'listening'
                        ? {
                            scale: [1, 1.05, 1],
                            boxShadow: [
                              "0 0 15px rgba(16, 185, 129, 0.25)",
                              "0 0 35px rgba(16, 185, 129, 0.55)",
                              "0 0 15px rgba(16, 185, 129, 0.25)"
                            ]
                          }
                        : callStatus === 'thinking'
                        ? {
                            scale: [1, 0.97, 1],
                            boxShadow: [
                              "0 0 15px rgba(45, 212, 191, 0.25)",
                              "0 0 32px rgba(99, 102, 241, 0.5)",
                              "0 0 15px rgba(45, 212, 191, 0.25)"
                            ]
                          }
                        : { scale: 1, boxShadow: "0 0 10px rgba(255,255,255,0.05)" }
                    }
                    transition={{
                      duration: callStatus === 'thinking' ? 1.5 : 2,
                      repeat: (!isMuted && (callStatus === 'listening' || callStatus === 'thinking')) ? Infinity : 0,
                      ease: "easeInOut"
                    }}
                    className={`p-6 rounded-full transition-colors duration-300 border-2 relative z-10 ${
                      isMuted 
                        ? 'bg-red-500/10 border-red-500/50 text-red-500' 
                        : callStatus === 'listening'
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                          : callStatus === 'thinking'
                            ? 'bg-teal-500/15 border-teal-300 text-teal-200'
                            : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                    }`}
                  >
                    {isMuted ? (
                      <MicOff className="w-8 h-8" />
                    ) : (
                      <div className="relative">
                        <Mic className="w-8 h-8" />
                        {callStatus === 'listening' && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
                        )}
                        {callStatus === 'thinking' && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-teal-300 rounded-full animate-pulse" />
                        )}
                      </div>
                    )}
                  </motion.button>
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-[10px] uppercase font-black tracking-widest text-gray-500">
                    {isMuted ? (lang === 'bn' ? 'আনমিউট' : 'Unmute') : (lang === 'bn' ? 'মিউট' : 'Mute')}
                  </span>
                  {!isMuted && (callStatus === 'listening' || callStatus === 'thinking') && (
                    <motion.span 
                      initial={{ opacity: 0, y: 2 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`text-[9px] font-bold tracking-wider uppercase mt-1 flex items-center gap-1.5 ${
                        callStatus === 'listening' ? 'text-emerald-400' : 'text-teal-300'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${callStatus === 'listening' ? 'bg-emerald-400 animate-pulse' : 'bg-teal-300 animate-ping'}`} />
                      {callStatus === 'listening' 
                        ? (lang === 'bn' ? 'শুনছে...' : 'Listening...')
                        : (lang === 'bn' ? 'প্রসেসিং...' : 'Processing...')}
                    </motion.span>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-center space-y-3">
                <button
                  type="button"
                  onClick={endCall}
                  className="p-8 rounded-full bg-red-600 text-white hover:bg-red-500 transition-all transform active:scale-90 shadow-[0_0_40px_rgba(239,68,68,0.3)] border-4 border-red-600/20"
                >
                  <PhoneOff className="w-10 h-10" />
                </button>
                <span className="text-[10px] uppercase font-black tracking-widest text-red-500/70">
                  {lang === 'bn' ? 'কল কাটুন' : 'End Call'}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
