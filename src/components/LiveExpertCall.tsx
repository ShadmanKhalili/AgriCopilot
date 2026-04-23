import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, PhoneOff, Phone, Loader2, Volume2 } from 'lucide-react';
import { getAi } from '../services/ai';
import { LiveServerMessage, Modality } from '@google/genai';
import { motion } from 'motion/react';

interface LiveExpertCallProps {
  diagnosisContext: string;
  lang: string;
  locationContext?: string;
}

export function LiveExpertCall({ diagnosisContext, lang, locationContext = "Bangladesh" }: LiveExpertCallProps) {
  const [isCalling, setIsCalling] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState<number[]>(new Array(16).fill(0));
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const sourceNodesRef = useRef<AudioBufferSourceNode[]>([]);

  const updateVisualizer = () => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Get 16 bars of data
    const newLevels = [];
    const step = Math.floor(dataArray.length / 16);
    for (let i = 0; i < 16; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += dataArray[i * step + j];
      }
      newLevels.push(sum / step / 255); // Normalize to 0-1
    }
    setAudioLevel(newLevels);
    
    // Update isSpeaking based on volume
    const average = newLevels.reduce((a, b) => a + b, 0) / newLevels.length;
    setIsSpeaking(average > 0.05);

    animationFrameRef.current = requestAnimationFrame(updateVisualizer);
  };

  const startCall = async () => {
    setIsCalling(true);
    try {
      const apiKey = (process.env as any).GEMINI_API_KEY;
      if (!apiKey) {
        alert(lang === 'bn' 
          ? "নিরাপত্তার কারণে ভয়েস কল বর্তমানে নিষ্ক্রিয় রয়েছে। অনুগ্রহ করে টাইপ করে পরামর্শ নিন।" 
          : "Voice Chat is currently restricted for security reasons. Please use the text chat instead.");
        setIsCalling(false);
        return;
      }
      
      const ai = getAi();
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate: 16000,
        latencyHint: 'interactive'
      });
      audioContextRef.current = audioCtx;
      
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
        model: "gemini-3.1-flash-live-preview",
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
              const processor = audioCtx.createScriptProcessor(2048, 1, 1);
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
    setIsCalling(false);
    setIsConnected(false);
    setIsSpeaking(false);
    
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
          className="bg-gray-900 rounded-[32px] p-8 w-full shadow-2xl border border-gray-800 relative overflow-hidden"
          role="dialog"
          aria-modal="false"
          aria-labelledby="expert-call-title"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-green-900/30 to-transparent pointer-events-none"></div>
          
          <div className="flex flex-col items-center space-y-8 relative z-10">
            <div className="text-center">
              <h4 id="expert-call-title" className="text-white font-black text-2xl tracking-tight mb-2">
                {lang === 'bn' ? 'কৃষি বিশেষজ্ঞ' : 'Agri Expert'}
              </h4>
              <div className="flex items-center justify-center space-x-2" role="status" aria-live="polite">
                {isCalling && <Loader2 className="w-4 h-4 text-green-400 animate-spin" aria-hidden="true" />}
                <p className={`text-xs uppercase tracking-widest font-black ${isCalling ? 'text-green-400 animate-pulse' : 'text-green-500'}`}>
                  {isCalling ? (lang === 'bn' ? 'সংযোগ স্থাপন করা হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...' : 'Establishing Connection, Please Wait...') : (lang === 'bn' ? 'সংযুক্ত - কথা বলুন' : 'Connected - Speak Now')}
                </p>
                <span className="sr-only">
                  {isSpeaking ? (lang === 'bn' ? 'বিশেষজ্ঞ কথা বলছেন' : 'Expert is speaking') : (lang === 'bn' ? 'শান্ত' : 'Silent')}
                </span>
              </div>
            </div>

            <div className="relative flex items-center justify-center w-full h-32" aria-hidden="true">
              <div className="absolute inset-0 flex items-center justify-center gap-1.5">
                {audioLevel.map((level, i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      height: isSpeaking ? Math.max(4, level * 80) : 4,
                      opacity: isSpeaking ? 1 : 0.3
                    }}
                    className="w-2 bg-gradient-to-t from-green-600 to-green-400 rounded-full"
                  />
                ))}
              </div>
              
              <div className={`w-28 h-28 rounded-full flex items-center justify-center z-10 shadow-inner transition-all duration-500 ${isCalling ? 'bg-gray-800 border-2 border-gray-700' : 'bg-green-900/40 border-2 border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)]'}`}>
                {isCalling ? (
                  <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
                ) : (
                  <Volume2 className={`w-12 h-12 transition-colors duration-300 ${isSpeaking ? 'text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'text-green-700'}`} />
                )}
              </div>
            </div>

            <div className="flex items-center justify-center space-x-8 w-full pt-4">
              <div className="flex flex-col items-center space-y-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  disabled={isCalling}
                  aria-pressed={isMuted}
                  aria-label={isMuted ? (lang === 'bn' ? 'আনমিউট করুন' : 'Unmute microphone') : (lang === 'bn' ? 'মিউট করুন' : 'Mute microphone')}
                  className={`p-6 rounded-full transition-all focus:ring-4 focus:ring-gray-600 outline-none ${
                    isMuted 
                      ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/50' 
                      : 'bg-gray-800 text-white hover:bg-gray-700 border border-gray-700'
                  } disabled:opacity-50`}
                >
                  {isMuted ? <MicOff className="w-8 h-8" aria-hidden="true" /> : <Mic className="w-8 h-8" aria-hidden="true" />}
                </button>
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400" aria-hidden="true">
                  {isMuted ? (lang === 'bn' ? 'আনমিউট' : 'Unmute') : (lang === 'bn' ? 'মিউট' : 'Mute')}
                </span>
              </div>
              
              <div className="flex flex-col items-center space-y-2">
                <button
                  type="button"
                  onClick={endCall}
                  aria-label={lang === 'bn' ? 'কল শেষ করুন' : 'End conversation'}
                  className="p-6 rounded-full bg-red-600 text-white hover:bg-red-500 transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] focus:ring-4 focus:ring-red-400 outline-none"
                >
                  <PhoneOff className="w-8 h-8" aria-hidden="true" />
                </button>
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400" aria-hidden="true">
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
