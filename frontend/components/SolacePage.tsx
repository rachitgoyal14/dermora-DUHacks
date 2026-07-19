import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
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
        setDebugMsg(
          `Ready. Mood: ${data.mood_category} (${data.mood_score.toFixed(0)}/100)`
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
      <div className="min-h-screen flex items-center justify-center bg-bone-50">
        <RefreshCw className="animate-spin text-plum-500" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-bone-50 font-sans pb-24 relative overflow-hidden flex flex-col items-center justify-center">

      {/* Full-bleed grain-textured band — the one signature flourish for this page */}
      <div className="grain absolute top-0 left-0 right-0 h-72 bg-gradient-to-b from-plum-100 to-transparent pointer-events-none" />

      {/* DEBUG PANEL */}
      {import.meta.env.DEV && (
        <div className="absolute top-4 left-4 bg-black/80 text-green-400 p-3 text-xs rounded z-50 font-mono max-w-[280px]">
          <p className="font-bold mb-1">Solace Debug</p>
          <p>Status: {status}</p>
          <p>User ID: {userId ? userId.slice(0, 8) + '...' : '...'}</p>
          <p>Mood: {promptData?.mood_category || '...'}</p>
          <p className="mt-2 text-yellow-300">{debugMsg}</p>
          {error && <p className="text-red-400 mt-2">⚠ {error}</p>}
        </div>
      )}

      {/* MAIN */}
      <div className="relative z-10 w-full max-w-md mx-auto px-6 flex flex-col items-center">

        <span className="eyebrow text-plum-600 mb-6">Solace</span>

        <div className="card-voice shape-signature w-full p-6 flex flex-col items-center space-y-8">
          <canvas
            ref={canvasRef}
            width={400}
            height={256}
            className="w-full max-w-md h-auto aspect-[400/256] rounded-lg"
          />

          <motion.p className="text-ink-600 text-lg leading-relaxed text-center">
            {transcript || 'Tap to Start'}
          </motion.p>

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
            {status === 'idle' ? 'Start Session' : 'End Session'}
          </motion.button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default SolacePage;