import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import BottomNav from './BottomNav';
import {
  getVoicePrompt,
  uploadVoiceForMoodAnalysis,
  VoicePromptData
} from '../services/api';
import { connectToSolaceLive } from '../services/gemini';
import { RefreshCw } from 'lucide-react';

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

/* ======================================================
   QUALITATIVE MOOD LABEL — no raw numbers shown to user
   Mirrors the bucketing used in Home.tsx (getMoodPhrase)
====================================================== */
function getMoodLabel(score: number): string {
  if (score >= 75) return 'Great';
  if (score >= 50) return 'Good';
  if (score >= 25) return 'Okay';
  return 'Tough';
}

const SolacePage: React.FC = () => {
  const { isAuthenticated, userId } = useAuth();

  const [promptData, setPromptData] = useState<VoicePromptData | null>(null);
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [transcript, setTranscript] = useState('');
  const [debugMsg, setDebugMsg] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextStartTimeRef = useRef(0);

  /* ======================================================
     FETCH PROMPT (no manual user sync needed — token has user ID)
  ====================================================== */
  useEffect(() => {
    if (!isAuthenticated) return;

    (async () => {
      try {
        // getVoicePrompt() now attaches Bearer token automatically via interceptor
        const data = await getVoicePrompt();
        setPromptData(data);
        // Use qualitative label — no raw score exposed to the debug panel or UI
        setDebugMsg(
          `Ready. Mood: ${data.mood_category} (${getMoodLabel(data.mood_score)})`
        );
      } catch (e) {
        setError('Failed to load voice agent');
      }
    })();
  }, [isAuthenticated]);

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
     AUDIO PLAYBACK QUEUE (GAPLESS PRECISE SCHEDULING)
  ====================================================== */
  const playAudio = (ctx: AudioContext, buffer: AudioBuffer) => {
    const now = ctx.currentTime;
    const startTime = Math.max(now, nextStartTimeRef.current);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(startTime);

    nextStartTimeRef.current = startTime + buffer.duration;

    setStatus('speaking');
    source.onended = () => {
      // Only flip back to 'connected' if this was the last scheduled chunk
      if (nextStartTimeRef.current <= ctx.currentTime + 0.05) {
        setStatus('connected');
      }
    };
  };

  /* ======================================================
     CANVAS VISUALIZER — recolored to the plum/ink Clay & Bone palette
  ====================================================== */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    let raf: number;

    const draw = () => {
      const centerY = canvas.height / 2;

      if (status === 'idle') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(42,36,32,0.12)'; // ink-900, faint — quiet baseline
        ctx.lineWidth = 2;
        ctx.moveTo(0, centerY);
        ctx.lineTo(canvas.width, centerY);
        ctx.stroke();
        return; // Pause the animation loop!
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let amp = 10;
      let speed = 0.05;
      let color = 'rgba(125,100,133,0.4)'; // plum-500 default

      if (status === 'connected') {
        amp = 15; speed = 0.08; color = 'rgba(125,100,133,0.45)'; // plum-500, listening
      } else if (status === 'speaking') {
        amp = 35; speed = 0.15; color = 'rgba(125,100,133,0.75)'; // plum-500, saturated — agent speaking
      } else if (status === 'processing') {
        amp = 20; speed = 0.2; color = 'rgba(122,113,104,0.55)'; // ink-500 — thinking
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
    nextStartTimeRef.current = 0;

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
          if (done) {
            setTranscript('');
            nextStartTimeRef.current = 0;
          }
        },
        () => { setStatus('idle'); setDebugMsg('Session ended'); },
        (err) => { setError(err); setStatus('idle'); }
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
    if (!sessionRef.current) return;

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

      // uploadVoiceForMoodAnalysis() attaches Bearer token via interceptor
      await uploadVoiceForMoodAnalysis(audio);
      setStatus('idle');
    } catch {
      setError('Mood analysis failed');
      setStatus('idle');
    }
  };

  /* ======================================================
     BUTTON TAP HANDLER
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
     LOADING STATE (while prompt fetches)
  ====================================================== */
  if (!promptData && !error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-bone-50">
        <RefreshCw className="animate-spin text-plum-500" size={36} />
        <p className="text-sm text-ink-500 font-sans">Setting up your session…</p>
      </div>
    );
  }

  /* ======================================================
     STATUS HELPERS
  ====================================================== */
  const statusLabel: Record<SessionStatus, string> = {
    idle: 'Ready when you are',
    loading: 'Connecting…',
    connected: 'Listening…',
    speaking: 'Solace is speaking…',
    processing: 'Processing…',
  };

  return (
    <div className="min-h-screen w-full bg-bone-50 font-sans pb-24 relative overflow-hidden flex flex-col">

      {/* Sticky header — matches other pages: title + eyebrow */}
      <div className="sticky top-0 bg-bone-50/80 backdrop-blur-lg z-40 pt-8 px-6 pb-4 border-b border-ink-900/8">
        <span className="eyebrow text-plum-500 block mb-0.5">Voice</span>
        <h1 className="font-display text-3xl text-ink-900 font-semibold leading-tight">Solace</h1>
      </div>

      {/* Subtle plum grain band — signature flourish for this feature */}
      <div className="grain absolute top-0 left-0 right-0 h-72 bg-gradient-to-b from-plum-100 to-transparent pointer-events-none" />

      {/* DEBUG PANEL — dev only, never seen by users in production */}
      {import.meta.env.DEV && (
        <div className="absolute top-20 left-4 bg-black/80 text-green-400 p-3 text-xs rounded z-50 font-mono max-w-[280px]">
          <p className="font-bold mb-1">Solace Debug</p>
          <p>Status: {status}</p>
          <p>User ID: {userId ? userId.slice(0, 8) + '...' : '...'}</p>
          <p>Mood: {promptData?.mood_category || '...'}</p>
          <p className="mt-2 text-yellow-300">{debugMsg}</p>
          {error && <p className="text-red-400 mt-2">⚠ {error}</p>}
        </div>
      )}

      {/* MAIN — immersive centered layout (intentional for voice UX) */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-md mx-auto px-6 py-8">

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-full mb-6 p-4 bg-amber-50 border border-amber-500/20 rounded-lg flex items-center gap-3"
            >
              <span className="text-amber-500 text-lg">⚠</span>
              <p className="text-sm text-ink-700 font-medium">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Session card */}
        <div className="card-voice shape-signature w-full p-6 flex flex-col items-center space-y-8">

          {/* Waveform visualizer */}
          <canvas
            ref={canvasRef}
            width={400}
            height={200}
            className="w-full max-w-md h-auto aspect-[400/200] rounded-lg"
          />

          {/* Status + transcript */}
          <AnimatePresence mode="wait">
            <motion.div
              key={transcript || statusLabel[status]}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="text-center"
            >
              {transcript ? (
                <p className="text-ink-700 text-base leading-relaxed">{transcript}</p>
              ) : (
                <p className="text-ink-500 text-sm font-medium">{statusLabel[status]}</p>
              )}
            </motion.div>
          </AnimatePresence>

          {/* CTA Button — follows btn-primary / btn-secondary pattern */}
          <motion.button
            onClick={toggleSession}
            disabled={status === 'loading'}
            whileTap={{ scale: 0.96 }}
            className={`px-8 py-3 rounded-full font-semibold transition-colors ${
              status === 'idle'
                ? 'bg-clay-500 hover:bg-clay-600 text-bone-50'
                : 'bg-ink-900 hover:bg-ink-700 text-bone-50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {status === 'loading' ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="animate-spin" size={16} />
                Connecting…
              </span>
            ) : status === 'idle' ? (
              'Start Session'
            ) : (
              'End Session'
            )}
          </motion.button>

        </div>

        {/* Mood context — qualitative only */}
        {promptData && (
          <p className="text-xs text-ink-500 mt-6 text-center">
            Today's mood: <span className="text-ink-700 font-medium">{promptData.mood_category}</span>
            {' · '}
            <span className="text-ink-600">{getMoodLabel(promptData.mood_score)}</span>
          </p>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default SolacePage;