import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, PhoneOff, Phone, Loader2, Volume2, Bot } from 'lucide-react';
import { getAi, LIVE_API_MODEL } from '../services/ai';
import { LiveServerMessage, Modality } from '@google/genai';
import { motion } from 'motion/react';

interface LiveExpertCallProps {
  diagnosisContext: string;
  lang: string;
  locationContext?: string;
}

export function LiveExpertCall({ diagnosisContext, lang, locationContext = "Bangladesh" }: LiveExpertCallProps) {
  const [isCalling, setIsCalling] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [callStatus, setCallStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [audioLevel, setAudioLevel] = useState<number[]>(new Array(32).fill(0));
  const [callDuration, setCallDuration] = useState(0);
  
  const isMutedRef = useRef(false);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const userAnalyserRef = useRef<AnalyserNode | null>(null);
  const silenceStartRef = useRef<number>(Date.now());
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const sourceNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sound effects generator
  const playSystemSound = (type: 'ring' | 'connect' | 'end' | 'hangup') => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    
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
    setIsCalling(true);
    setIsRinging(true);
    
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate: 16000,
        latencyHint: 'interactive'
      });
      audioContextRef.current = audioCtx;
      
      // Start Ringing Loop (3-4 seconds delay)
      playSystemSound('ring');
      const ringInterval = setInterval(() => playSystemSound('ring'), 2500);
      
      // Wait for "Ringing" delay to complete for realism
      await new Promise(resolve => setTimeout(resolve, 4000));
      clearInterval(ringInterval);

      const apiKey = (process.env.GEMINI_API_KEY as string) || (import.meta.env.VITE_GEMINI_API_KEY as string) || '';
      if (!apiKey) {
        alert(lang === 'bn' 
          ? "ভয়েস কল ফিচারের জন্য GEMINI_API_KEY যুক্ত করতে হবে। আপাতত চ্যাট ব্যবহার করুন।" 
          : "Voice calls require GEMINI_API_KEY to be set in your environment. Please use text chat for now.");
        setIsCalling(false);
        return;
      }
      
      const ai = getAi();
      
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      analyser.connect(audioCtx.destination);
      
      updateVisualizer();
      nextPlayTimeRef.current = audioCtx.currentTime;

      const systemInstruction = `You are a Master Agronomist and a leading agricultural scientist in Bangladesh.
      CONTEXT: The user has just received the following smart planting recommendations:
      "${diagnosisContext}".
      
      TASK: Answer follow-up questions from the user via voice.
      - DO NOT just repeat what is in the text. Add DEPTH, NUANCE, and EXPERT SCIENTIFIC EXPLANATIONS.
      - Explain the 'why' and 'how'. For instance, if a crop is recommended, talk about specific soil treatments, micro-nutrients, precise planting dates, or advanced climate-smart techniques to maximize margin.
      - If asked about risks, provide nuanced mitigation strategies (e.g., biological pest control, specific irrigation intervals).
      - Use local context for ${locationContext}.
      - Respond fluently in ${lang === 'bn' ? 'Bangla' : 'English'}. If Bangla, ensure it uses accurate agricultural terminology while remaining natural and understandable for farmers.
      - Strike a balance: be thorough and insightful, but keep individual spoken responses concise enough for a comfortable phone conversation. Speak like an experienced, highly educated professor of agronomy.`;

      const sessionPromise = ai.live.connect({
        model: LIVE_API_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: lang === 'bn' ? "Kore" : "Zephyr" } },
          },
          systemInstruction,
        },
        callbacks: {
          onopen: async () => {
            setIsConnected(true);
            setIsCalling(false);
            setIsRinging(false);
            playSystemSound('connect');
            
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                  channelCount: 1,
                  sampleRate: 16000,
                  echoCancellation: true,
                  noiseSuppression: true,
                } 
              });
              streamRef.current = stream;
              
              const source = audioCtx.createMediaStreamSource(stream);
              
              const userAnalyser = audioCtx.createAnalyser();
              userAnalyser.fftSize = 64;
              userAnalyserRef.current = userAnalyser;
              source.connect(userAnalyser);

              const processor = audioCtx.createScriptProcessor(512, 1, 1);
              processorRef.current = processor;

              processor.onaudioprocess = (e) => {
                if (isMuted) return;
                
                const inputData = e.inputBuffer.getChannelData(0);
                const pcm16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                  let s = Math.max(-1, Math.min(1, inputData[i]));
                  pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                
                const buffer = new Uint8Array(pcm16.buffer);
                let binary = '';
                for (let i = 0; i < buffer.byteLength; i++) {
                  binary += String.fromCharCode(buffer[i]);
                }
                const base64 = btoa(binary);
                
                sessionPromise.then((session: any) => {
                  session.sendRealtimeInput({
                    audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
                  });
                });
              };

              source.connect(processor);
              processor.connect(audioCtx.destination);
            } catch (err) {
              console.error("Microphone access denied:", err);
              endCall();
            }
          },
          onmessage: (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              playAudioChunk(base64Audio);
            }
            
            if (message.serverContent?.interrupted) {
              // Stop current playback
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
            endCall();
          },
          onerror: (err: any) => {
            console.error("Live API Error:", err);
            if (err?.message === 'Network error' || err instanceof Event) {
               alert(lang === 'bn' ? "লাইভ এআই কল সংযোগ করতে পারেনি। দয়া করে নতুন উইন্ডোতে অ্যাপটি খুলুন বা একটু পরে আবার চেষ্টা করুন।" : "Live API connection failed. This might be due to iframe security policies. Please try opening the app in a new tab.");
            }
            endCall();
          }
        }
      });
      
      sessionRef.current = await sessionPromise;
      
    } catch (error) {
      console.error("Failed to start live call:", error);
      setIsCalling(false);
      endCall();
    }
  };

  const playAudioChunk = (base64Audio: string) => {
    const audioCtx = audioContextRef.current;
    if (!audioCtx) return;

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
  };

  const endCall = () => {
    if (isConnected) {
      playSystemSound('end');
      setTimeout(() => playSystemSound('hangup'), 200);
    }
    
    setIsCalling(false);
    setIsRinging(false);
    setIsConnected(false);
    
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
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
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
    setIsMuted(!isMuted);
  };

  return (
    <div className="w-full mt-6 mb-4" role="region" aria-label={lang === 'bn' ? 'এআই বিশেষজ্ঞ কল সার্ভিস' : 'AI Expert Call Service'}>
      {!isConnected && !isCalling ? (
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={startCall}
          aria-label={lang === 'bn' ? 'এআই বিশেষজ্ঞের সাথে ভয়েস কল শুরু করুন' : 'Start voice chat with AI Expert'}
          className="w-full flex flex-col items-center justify-center space-y-2 bg-gradient-to-br from-green-600 to-emerald-800 text-white p-6 rounded-3xl shadow-xl shadow-green-900/20 border border-green-500/30 transition-all cursor-pointer relative overflow-hidden group focus:ring-4 focus:ring-green-400 outline-none"
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="bg-white/20 p-4 rounded-full group-hover:scale-110 transition-transform shadow-inner" aria-hidden="true">
            <Phone className="w-8 h-8 text-white" />
          </div>
          <span className="font-black uppercase tracking-widest text-lg lg:text-xl drop-shadow-sm">
            {lang === 'bn' ? 'ভয়েস কল শুরু করুন' : 'Start Voice Chat'}
          </span>
          <span className="text-green-100 text-xs font-medium">
            {lang === 'bn' ? 'এগিয়ে যান এবং এআই বিশেষজ্ঞের সাথে কথা বলুন' : 'Tap to speak with your AI Agronomist'}
          </span>
        </motion.button>
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
              animate={{ scale: 1 }}
              className="w-24 h-24 rounded-full bg-gradient-to-tr from-green-500 to-emerald-400 p-1 mb-4 shadow-[0_0_40px_rgba(34,197,94,0.3)]"
            >
              <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center overflow-hidden">
                <Bot className="w-12 h-12 text-green-500" />
              </div>
            </motion.div>
            
            <div className="text-center">
              <h4 id="expert-call-title" className="text-white font-black text-3xl tracking-tight mb-1">
                {lang === 'bn' ? 'কৃষি বিশেষজ্ঞ' : 'Agri Expert'}
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
                <button
                  type="button"
                  onClick={toggleMute}
                  disabled={isCalling}
                  aria-pressed={isMuted}
                  className={`p-6 rounded-full transition-all duration-300 transform active:scale-95 border-2 ${
                    isMuted 
                      ? 'bg-red-500/10 border-red-500/50 text-red-500' 
                      : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                  }`}
                >
                  {isMuted ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </button>
                <span className="text-[10px] uppercase font-black tracking-widest text-gray-500">
                  {isMuted ? (lang === 'bn' ? 'আনমিউট' : 'Unmute') : (lang === 'bn' ? 'মিউট' : 'Mute')}
                </span>
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
