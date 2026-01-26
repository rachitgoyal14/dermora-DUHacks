import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAuth, useUser } from '@clerk/clerk-react';
import BottomNav from './BottomNav';
import {
  getVoicePrompt,
  uploadVoiceForMoodAnalysis,
  VoicePromptData
} from '../services/api';
import { connectToSolaceLive } from '../services/gemini';
import { RefreshCw } from 'lucide-react';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
/* ======================================================
   ANDROID-SAFE GLOBAL AUDIO STATE
====================================================== */
let sharedAudioContext: AudioContext | null = null;
let micStream: MediaStream | null = null;

type SessionStatus =
  | 'idle'
  | 'loading'
  | 'connected'
  | 'speaking'
  | 'processing';

const SolacePage: React.FC = () => {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();

  const [backendUserId, setBackendUserId] = useState<string | null>(null);
  const [promptData, setPromptData] = useState<VoicePromptData | null>(null);
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [debugMsg, setDebugMsg] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);

  const syncedRef = useRef(false);
  const sessionRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);

  /* ======================================================
     SYNC USER
  ====================================================== */
  useEffect(() => {
    if (!isSignedIn || !user || syncedRef.current) return;

    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/auth/sync-user`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        const data = await res.json();
        if (data.uuid) setBackendUserId(data.uuid);
        syncedRef.current = true;
      } catch (err) {
        console.error('User sync failed', err);
      }
    })();
  }, [isSignedIn, user, getToken]);

  /* ======================================================
     FETCH PROMPT
  ====================================================== */
  useEffect(() => {
    if (!backendUserId) return;

    (async () => {
      try {
        const token = await getToken();
        const data = await getVoicePrompt(token, backendUserId);
        setPromptData(data);
        setDebugMsg(
          `Ready. Mood: ${data.mood_category} (${data.mood_score.toFixed(0)}/100)`
        );
      } catch (e) {
        setError('Failed to load voice agent');
      }
    })();
  }, [backendUserId, getToken]);

  /* ======================================================
     MICROPHONE (ANDROID SAFE)
  ====================================================== */
  const ensureMicPermission = async () => {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      return true;
    } catch {
      setError('Microphone permission required');
      return false;
    }
  };

  /* ======================================================
     AUDIO PLAYBACK QUEUE
  ====================================================== */
  const playAudio = (ctx: AudioContext, buffer: AudioBuffer) => {
    audioQueueRef.current.push(buffer);
    if (!isPlayingRef.current) processQueue(ctx);
  };

  const processQueue = (ctx: AudioContext) => {
    if (!audioQueueRef.current.length) {
      isPlayingRef.current = false;
      setStatus('connected');
      return;
    }

    isPlayingRef.current = true;
    setStatus('speaking');

    const buffer = audioQueueRef.current.shift()!;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.onended = () => processQueue(ctx);
    src.start();
  };

  /* ======================================================
     CANVAS VISUALIZER (UNCHANGED)
  ====================================================== */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    let raf: number;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerY = canvas.height / 2;

      let amp = 10;
      let speed = 0.05;
      let color = 'rgba(142,167,233,0.4)';

      if (status === 'connected') {
        amp = 15;
        speed = 0.08;
        color = 'rgba(142,167,233,0.6)';
      } else if (status === 'speaking') {
        amp = 35;
        speed = 0.15;
        color = 'rgba(255,182,193,0.7)';
      } else if (status === 'processing') {
        amp = 20;
        speed = 0.2;
        color = 'rgba(255,255,255,0.5)';
      }

      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        for (let x = 0; x < canvas.width; x++) {
          const y =
            centerY +
            Math.sin(x * 0.02 + phase + i) *
              amp *
              Math.sin(phase * 0.5 + x * 0.005);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      phase += speed;
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf);
  }, [status]);

  /* ======================================================
     START SESSION
  ====================================================== */
  const startSession = async () => {
    if (!promptData || !sharedAudioContext) return;

    setStatus('loading');
    setDebugMsg('Connecting...');
    setError(null);

    try {
        const session = await connectToSolaceLive(
            promptData.system_prompt,
          
            (buffer: AudioBuffer) => {
              if (!sharedAudioContext) return;
              playAudio(sharedAudioContext, buffer);
            },
          
            (text, role, done) => {
              if (text) setTranscript(text);
              if (role === 'user') setStatus('processing');
              if (done) setTranscript('');
            },
          
            () => {
              setStatus('idle');
              setDebugMsg('Session ended');
            },
          
            (err) => {
              setError(err);
              setStatus('idle');
            }
          );
          

      sessionRef.current = session;
      setStatus('connected');
      setDebugMsg('Connected! Speak freely...');
    } catch (err) {
      console.error(err);
      setError('Failed to start session');
      setStatus('idle');
    }
  };

  /* ======================================================
     END SESSION
  ====================================================== */
  const endSession = async () => {
    if (!sessionRef.current || !backendUserId) return;

    setStatus('loading');
    setDebugMsg('Analyzing mood...');

    try {
      const audio = await sessionRef.current.getRecordedAudio();
      await sessionRef.current.disconnect();
      sessionRef.current = null;

      if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
      }

      const token = await getToken();
      await uploadVoiceForMoodAnalysis(audio, token, backendUserId);
      setStatus('idle');
    } catch {
      setError('Mood analysis failed');
      setStatus('idle');
    }
  };

  /* ======================================================
     BUTTON TAP HANDLER (CRITICAL)
  ====================================================== */
  const toggleSession = async () => {
    if (status === 'idle') {
      if (!sharedAudioContext) {
        sharedAudioContext = new AudioContext();
      }
      await sharedAudioContext.resume();

      const ok = await ensureMicPermission();
      if (!ok) return;

      startSession();
    } else {
      endSession();
    }
  };

  /* ======================================================
     UI (UNCHANGED)
  ====================================================== */
  if (!backendUserId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#FFF0F0] via-[#FDF5E6] to-[#F8F9FF] font-sans pb-24 relative overflow-hidden flex flex-col items-center justify-center">

      {/* DEBUG PANEL */}
      <div className="absolute top-4 left-4 bg-black/80 text-green-400 p-3 text-xs rounded z-50 font-mono max-w-[280px]">
        <p className="font-bold mb-1">Solace Debug</p>
        <p>Status: {status}</p>
        <p>User: {user?.firstName || '...'}</p>
        <p>Mood: {promptData?.mood_category || '...'}</p>
        <p className="mt-2 text-yellow-300">{debugMsg}</p>
        {error && <p className="text-red-400 mt-2">⚠ {error}</p>}
      </div>

      {/* MAIN */}
      <div className="relative z-10 w-full flex flex-col items-center justify-center h-full space-y-8">
        <canvas
          ref={canvasRef}
          width={400}
          height={256}
          className="w-full max-w-md h-full"
        />

        <motion.p className="text-gray-600 text-lg">
          {transcript || 'Tap to Start'}
        </motion.p>

        <motion.button
          onClick={toggleSession}
          disabled={status === 'loading'}
          whileTap={{ scale: 0.95 }}
          className={`px-8 py-3 rounded-full text-white ${
            status === 'idle'
              ? 'bg-gradient-to-r from-purple-500 to-pink-500'
              : 'bg-red-500'
          }`}
        >
          {status === 'idle' ? 'Start Session' : 'End Session'}
        </motion.button>

        <motion.h1 className="font-display text-sm tracking-[0.3em] uppercase opacity-60">
          Solace
        </motion.h1>
      </div>

      <BottomNav />
    </div>
  );
};

export default SolacePage;
