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
    <div className="w-full">
      {!isConnected && !isCalling ? (
        <button
          onClick={startCall}
          className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-lg hover:shadow-green-200 transition-all active:scale-95"
        >
          <Phone className="w-4 h-4" />
          <span>{lang === 'bn' ? 'ভয়েস কল করুন' : 'Call Expert'}</span>
        </button>
      ) : (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gray-900 rounded-2xl p-6 w-full shadow-2xl border border-gray-800 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-green-900/20 to-transparent pointer-events-none"></div>
          
          <div className="flex flex-col items-center space-y-6 relative z-10">
            <div className="text-center">
              <h4 className="text-white font-black text-lg tracking-tight">
                {lang === 'bn' ? 'কৃষি বিশেষজ্ঞ' : 'Agri Expert'}
              </h4>
              <p className="text-green-400 text-[10px] uppercase tracking-widest font-bold mt-1">
                {isCalling ? (lang === 'bn' ? 'সংযুক্ত হচ্ছে...' : 'Connecting...') : (lang === 'bn' ? 'সংযুক্ত' : 'Connected')}
              </p>
            </div>

            <div className="relative flex items-center justify-center w-full h-24">
              <div className="absolute inset-0 flex items-center justify-center gap-1">
                {audioLevel.map((level, i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      height: isSpeaking ? Math.max(4, level * 60) : 4,
                      opacity: isSpeaking ? 0.8 : 0.2
                    }}
                    className="w-1.5 bg-green-500 rounded-full"
                  />
                ))}
              </div>
              
              <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center border-2 border-gray-700 z-10 shadow-inner">
                {isCalling ? (
                  <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                ) : (
                  <Volume2 className={`w-8 h-8 transition-colors duration-300 ${isSpeaking ? 'text-green-400' : 'text-gray-500'}`} />
                )}
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <button
                onClick={toggleMute}
                disabled={isCalling}
                className={`p-4 rounded-full transition-all ${
                  isMuted 
                    ? 'bg-gray-800 text-red-400 hover:bg-gray-700' 
                    : 'bg-gray-800 text-white hover:bg-gray-700'
                } disabled:opacity-50`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
              </button>
              
              <button
                onClick={endCall}
                className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg shadow-red-500/30"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
