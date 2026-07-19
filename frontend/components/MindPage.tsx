import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { 
    RefreshCw, 
    ChevronRight, 
    Activity, 
    Brain,
    Check,
    ChevronLeft
} from 'lucide-react';
import BottomNav from './BottomNav';
import { 
    logMood, 
    uploadVoiceForMoodAnalysis,
    VoicePromptData,
    MoodSummary
} from '../services/api';
import { useMoodQuestions, useVoicePrompt, useMoodSummary } from '../hooks/queries';
import { queryClient } from '../services/queryClient';
import { connectToSolaceLive } from '../services/gemini';
import { SadFace, NeutralFace, GoodFace, HappyFace } from './MoodFaces';
type SessionStatus = 'idle' | 'loading' | 'connected' | 'speaking' | 'processing';
type ViewMode = 'hub' | 'mood' | 'voice';

const MindPage: React.FC = () => {
    const { isAuthenticated } = useAuth();

    // View state
    const [viewMode, setViewMode] = useState<ViewMode>('hub');

    // Fetch queries via React Query
    const { data: questionsData } = useMoodQuestions();
    const { data: voicePromptData } = useVoicePrompt();
    const { data: moodSummary } = useMoodSummary();

    const questions = questionsData?.questions || [];
    const promptData = voicePromptData || null;

    // Mood state
    const [currentStep, setCurrentStep] = useState<number>(0);
    const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [isLoggingMood, setIsLoggingMood] = useState(false);

    // Voice state
    const [voiceStatus, setVoiceStatus] = useState<SessionStatus>('idle');
    const [transcript, setTranscript] = useState('');
    const [voiceError, setVoiceError] = useState<string | null>(null);

    // Voice refs
    const sessionRef = useRef<any>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioQueueRef = useRef<AudioBuffer[]>([]);
    const isPlayingRef = useRef(false);

    const faceComponents = [SadFace, NeutralFace, GoodFace, HappyFace];
    const baseScores = [20, 50, 75, 95];
    const negativeIds = ['stress', 'anxiety'];
    const labelMap: Record<string, string[]> = {
        mood: ['Terrible', 'Okay', 'Good', 'Excellent'],
        stress: ['Very Stressed', 'Stressed', 'Mild', 'Relaxed'],
        anxiety: ['Very Anxious', 'Anxious', 'Mild', 'Calm'],
        energy: ['Exhausted', 'Low', 'Good', 'Energized'],
    };

    // Submit mood log
    useEffect(() => {
        if (currentStep === questions.length && questions.length > 0 && !isLoggingMood && viewMode === 'mood') {
            const submitMoodLog = async () => {
                setIsLoggingMood(true);
                try {
                    const moodScore = selectedAnswers['mood'];
                    const data = {
                        mood_score: moodScore,
                        stress: selectedAnswers['stress'],
                        anxiety: selectedAnswers['anxiety'],
                        energy: selectedAnswers['energy'],
                        sadness: 100 - moodScore,
                        logged_at: new Date().toISOString(),
                    };

                    await logMood(data);
                    await Promise.all([
                        queryClient.invalidateQueries({ queryKey: ['moodSummary'] }),
                        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
                        queryClient.invalidateQueries({ queryKey: ['moodHistoryChart'] }),
                    ]);

                    setTimeout(() => {
                        setViewMode('hub');
                        setCurrentStep(0);
                        setSelectedAnswers({});
                    }, 1500);
                } catch (error) {
                    console.error('Failed to log mood:', error);
                } finally {
                    setIsLoggingMood(false);
                }
            };
            submitMoodLog();
        }
    }, [currentStep, questions, selectedAnswers, isLoggingMood, viewMode]);

    // Canvas visualizer for voice
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let phase = 0;

        const render = () => {
            if (!canvas || !ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const centerY = canvas.height / 2;
            let amplitude = 10;
            let speed = 0.05;
            let color = 'rgba(142, 167, 233, 0.4)';

            if (voiceStatus === 'connected') {
                amplitude = 15;
                speed = 0.08;
                color = 'rgba(142, 167, 233, 0.6)';
            } else if (voiceStatus === 'speaking') {
                amplitude = 35;
                speed = 0.15;
                color = 'rgba(255, 182, 193, 0.7)';
            } else if (voiceStatus === 'processing') {
                amplitude = 20;
                speed = 0.2;
                color = 'rgba(255, 255, 255, 0.5)';
            }

            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                for (let x = 0; x < canvas.width; x++) {
                    const effectivePhase = phase + (i * 1.5);
                    const y = centerY + Math.sin(x * 0.02 + effectivePhase) * amplitude * Math.sin(phase * 0.5 + x * 0.005);
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            phase += speed;
            animationFrameId = requestAnimationFrame(render);
        };
        render();

        return () => cancelAnimationFrame(animationFrameId);
    }, [voiceStatus]);

    // Mood handlers
    const handleMoodSelect = (index: number) => {
        setSelectedIndex(index);
        const currentQuestion = questions[currentStep];
        const isPositive = !negativeIds.includes(currentQuestion.id);
        const score = isPositive ? baseScores[index] : baseScores[3 - index];
        setSelectedAnswers((prev) => ({ ...prev, [currentQuestion.id]: score }));

        setTimeout(() => {
            setSelectedIndex(null);
            setCurrentStep(currentStep + 1);
        }, 300);
    };

    // Voice handlers
    const playAudio = async (ctx: AudioContext, buffer: AudioBuffer) => {
        audioQueueRef.current.push(buffer);
        if (!isPlayingRef.current) {
            processAudioQueue(ctx);
        }
    };

    const processAudioQueue = async (ctx: AudioContext) => {
        if (audioQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            setVoiceStatus('connected');
            return;
        }

        isPlayingRef.current = true;
        setVoiceStatus('speaking');

        const buffer = audioQueueRef.current.shift()!;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        source.onended = () => {
            processAudioQueue(ctx);
        };

        source.start();
    };

    const startVoiceSession = async () => {
        if (!promptData) return;

        setVoiceStatus('loading');
        setVoiceError(null);

        try {
            const session = await connectToSolaceLive(
                promptData.system_prompt,
                (buffer: AudioBuffer) => {
                    const ctx = session.getOutputContext();
                    playAudio(ctx, buffer);
                },
                (text: string, role: 'user' | 'model', isTurnComplete: boolean) => {
                    if (text) {
                        setTranscript(text);
                        if (role === 'user') {
                            setVoiceStatus('processing');
                        }
                    }
                    if (isTurnComplete) {
                        setTranscript('');
                    }
                },
                () => {
                    setVoiceStatus('idle');
                },
                (errorMsg: string) => {
                    setVoiceError(errorMsg);
                    setVoiceStatus('idle');
                }
            );

            sessionRef.current = session;
            setVoiceStatus('connected');

        } catch (e: any) {
            console.error('Session start error:', e);
            setVoiceError('Failed to start session');
            setVoiceStatus('idle');
        }
    };

    const endVoiceSession = async () => {
        if (!sessionRef.current) return;

        setVoiceStatus('loading');

        try {
            const audioBlob = await sessionRef.current.getRecordedAudio();
            await sessionRef.current.disconnect();
            sessionRef.current = null;

            await uploadVoiceForMoodAnalysis(audioBlob);
            setVoiceStatus('idle');
            setViewMode('hub');

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['moodSummary'] }),
                queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
                queryClient.invalidateQueries({ queryKey: ['moodHistoryChart'] }),
            ]);

        } catch (e: any) {
            console.error('End session error:', e);
            setVoiceError('Failed to analyze mood');
            setVoiceStatus('idle');
        }
    };

    // Loading check
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen w-full bg-[#FFF5F5] flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="animate-spin mx-auto mb-4 text-pastel-blue" size={40} />
                    <p className="text-sm text-gray-500">Initializing...</p>
                </div>
            </div>
        );
    }

    // Hub view
    if (viewMode === 'hub') {
        return (
            <div className="min-h-screen w-full bg-[#FFF5F5] font-sans text-skin-text overflow-x-hidden pb-24">
                
                {/* Header */}
                <motion.nav 
                    className="sticky top-0 z-40 px-5 py-4 bg-[#FFF5F5]/95 backdrop-blur-md border-b border-gray-100"
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                >
                    <div className="flex justify-between items-center max-w-md mx-auto">
                        <div>
                            <h1 className="font-display font-bold text-2xl text-[#1A1A1A]">Mind</h1>
                            <p className="text-xs text-gray-400">Mood & Voice Support</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pastel-blue to-pastel-lavender flex items-center justify-center">
                            <Brain size={24} className="text-white" />
                        </div>
                    </div>
                </motion.nav>

                <div className="px-5 py-6 max-w-md mx-auto space-y-4">

                    {/* Mood Summary Card */}
                    {moodSummary && moodSummary.total_logs > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-5 shadow-md border border-blue-100"
                        >
                            <div className="flex items-center gap-2 mb-3">
                                <Activity size={20} className="text-blue-600" />
                                <h3 className="font-semibold text-gray-700">Your Mood Trends</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white/60 rounded-2xl p-3 text-center">
                                    <div className="text-2xl font-bold text-blue-600">
                                        {moodSummary.avg_mood 
                                            ? moodSummary.avg_mood >= 75 ? '😊'
                                            : moodSummary.avg_mood >= 50 ? '😌'
                                            : moodSummary.avg_mood >= 25 ? '😐'
                                            : '😔'
                                            : '—'}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {moodSummary.avg_mood
                                            ? moodSummary.avg_mood >= 75 ? 'Feeling great'
                                            : moodSummary.avg_mood >= 50 ? 'Steady'
                                            : moodSummary.avg_mood >= 25 ? 'Getting by'
                                            : 'Tough times'
                                            : 'Mood'}
                                    </div>
                                </div>
                                <div className="bg-white/60 rounded-2xl p-3 text-center">
                                    <div className="text-2xl font-bold text-purple-600">
                                        {moodSummary.avg_energy 
                                            ? moodSummary.avg_energy >= 75 ? '⚡'
                                            : moodSummary.avg_energy >= 50 ? '💪'
                                            : moodSummary.avg_energy >= 25 ? '🔋'
                                            : '😴'
                                            : '—'}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {moodSummary.avg_energy
                                            ? moodSummary.avg_energy >= 75 ? 'High energy'
                                            : moodSummary.avg_energy >= 50 ? 'Good energy'
                                            : moodSummary.avg_energy >= 25 ? 'Low energy'
                                            : 'Very tired'
                                            : 'Energy'}
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-3 text-center">
                                Based on {moodSummary.total_logs} check-ins
                            </p>
                        </motion.div>
                    )}

                    {/* Mood Check-In Card */}
                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setViewMode('mood')}
                        className="w-full bg-white rounded-3xl p-6 shadow-md border border-gray-100 text-left"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-100 to-pink-200 flex items-center justify-center">
                                        😊
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800 text-lg">Mood Check-In</h3>
                                        <p className="text-sm text-gray-500">Log how you're feeling</p>
                                    </div>
                                </div>
                            </div>
                            <ChevronRight size={24} className="text-gray-300 flex-shrink-0 mt-2" />
                        </div>
                    </motion.button>

                    {/* Voice Session Card */}
                    <motion.button
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setViewMode('voice')}
                        className="w-full bg-white rounded-3xl p-6 shadow-md border border-gray-100 text-left"
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
                                        🎙️
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800 text-lg">Voice Support</h3>
                                        <p className="text-sm text-gray-500">Talk with Solace AI</p>
                                    </div>
                                </div>
                                {promptData && (
                                    <div className="mt-3 ml-15 bg-purple-50 rounded-xl p-3">
                                        <p className="text-xs text-purple-600 font-medium mb-1">
                                            {promptData.prompt_name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            Current mood: {promptData.mood_category}
                                        </p>
                                    </div>
                                )}
                            </div>
                            <ChevronRight size={24} className="text-gray-300 flex-shrink-0 mt-2" />
                        </div>
                    </motion.button>

                </div>

                <BottomNav />
            </div>
        );
    }

    // Mood Check-In view
    if (viewMode === 'mood') {
        return (
            <div className="min-h-screen w-full bg-[#FFF5F5] font-sans text-skin-text pb-24 relative flex flex-col">

                {/* Header */}
                <div className="pt-8 px-5 mb-6 relative z-10">
                    <button
                        onClick={() => {
                            setViewMode('hub');
                            setCurrentStep(0);
                            setSelectedAnswers({});
                        }}
                        className="flex items-center gap-2 text-gray-500 mb-4"
                    >
                        <ChevronLeft size={20} />
                        <span className="text-sm">Back</span>
                    </button>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <h1 className="font-display text-3xl font-bold text-[#1A1A1A] mb-2">
                                {currentStep < questions.length 
                                    ? questions[currentStep]?.prompt 
                                    : 'Check-in Complete'}
                            </h1>
                            <p className="text-gray-500 text-sm">
                                {currentStep < questions.length 
                                    ? 'Select what best describes your state'
                                    : 'Your mood has been logged'}
                            </p>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-5 max-w-md mx-auto w-full relative z-10 pb-32">
                    <AnimatePresence mode="wait">
                        {currentStep < questions.length ? (
                            <motion.div 
                                key={currentStep} 
                                className="flex flex-col gap-3"
                                initial={{ opacity: 0, x: 20 }} 
                                animate={{ opacity: 1, x: 0 }} 
                                exit={{ opacity: 0, x: -20 }}
                            >
                                {faceComponents.map((Face, index) => {
                                    const currentLabels = labelMap[questions[currentStep].id] || ['Bad', 'Neutral', 'Good', 'Great'];
                                    const isSelected = selectedIndex === index;
                                    
                                    return (
                                        <motion.button
                                            key={index}
                                            onClick={() => handleMoodSelect(index)}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className={`
                                                relative w-full p-4 rounded-full flex items-center gap-4 transition-all
                                                ${isSelected
                                                    ? 'bg-white shadow-lg scale-[1.01]'
                                                    : 'bg-white/70 hover:bg-white/90 shadow-sm'
                                                }
                                            `}
                                        >
                                            <div className={`
                                                w-14 h-14 rounded-full flex items-center justify-center shrink-0
                                                ${isSelected ? 'bg-blue-50' : 'bg-gray-50'}
                                            `}>
                                                <Face />
                                            </div>
                                            <span className={`text-lg font-bold text-left flex-1 ${isSelected ? 'text-[#1A1A1A]' : 'text-gray-600'}`}>
                                                {currentLabels[index]}
                                            </span>
                                        </motion.button>
                                    );
                                })}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="success"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex items-center justify-center flex-col h-64"
                            >
                                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4 shadow-lg">
                                    {isLoggingMood ? (
                                        <RefreshCw className="animate-spin" size={48} />
                                    ) : (
                                        <Check size={48} />
                                    )}
                                </div>
                                <p className="text-gray-600 font-medium">
                                    {isLoggingMood ? 'Saving...' : 'Check-in saved!'}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <BottomNav />
            </div>
        );
    }

    // Voice Session view
    if (viewMode === 'voice') {
        const getVoiceStatusText = () => {
            if (voiceStatus === 'idle') return promptData ? 'Ready to start' : 'Loading...';
            if (voiceStatus === 'loading') return 'Connecting...';
            if (voiceStatus === 'connected') return transcript || 'Listening...';
            if (voiceStatus === 'speaking') return transcript || 'Speaking...';
            if (voiceStatus === 'processing') return 'Thinking...';
            return 'Ready';
        };

        return (
            <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 font-sans pb-24 relative overflow-hidden flex flex-col">

                {/* Header */}
                <div className="pt-8 px-5 mb-6 relative z-10">
                    <button
                        onClick={() => {
                            if (voiceStatus !== 'idle') {
                                endVoiceSession();
                            }
                            setViewMode('hub');
                        }}
                        className="flex items-center gap-2 text-gray-500 mb-4"
                    >
                        <ChevronLeft size={20} />
                        <span className="text-sm">Back</span>
                    </button>

                    <h1 className="font-display text-3xl font-bold text-[#1A1A1A] mb-2">
                        Solace Voice
                    </h1>
                    <p className="text-gray-500 text-sm">
                        AI-powered voice support
                    </p>
                </div>

                {/* Waveform Visualizer */}
                <div className="flex-1 flex items-center justify-center">
                    <canvas
                        ref={canvasRef}
                        width={400}
                        height={200}
                        className="w-full max-w-md h-48"
                    />
                </div>

                {/* Status Text */}
                <div className="px-5 text-center mb-8">
                    <motion.p
                        className="text-gray-600 font-medium text-lg"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        {getVoiceStatusText()}
                    </motion.p>
                    {voiceError && (
                        <p className="text-red-500 text-sm mt-2">{voiceError}</p>
                    )}
                </div>

                {/* Action Button */}
                <div className="px-5 max-w-md mx-auto w-full mb-8">
                    <motion.button
                        onClick={voiceStatus === 'idle' ? startVoiceSession : endVoiceSession}
                        disabled={voiceStatus === 'loading' || !promptData}
                        className={`
                            w-full px-8 py-4 rounded-full font-semibold text-white transition-all shadow-lg
                            ${voiceStatus === 'idle'
                                ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                                : 'bg-gradient-to-r from-red-500 to-orange-500'
                            }
                            ${(voiceStatus === 'loading' || !promptData) && 'opacity-50 cursor-not-allowed'}
                        `}
                        whileTap={{ scale: 0.95 }}
                    >
                        {voiceStatus === 'idle' ? 'Start Session' : 'End Session'}
                    </motion.button>

                    {promptData && voiceStatus === 'idle' && (
                        <div className="mt-4 text-center">
                            <p className="text-sm text-gray-500">{promptData.prompt_name}</p>
                            <p className="text-xs text-gray-400">Duration: {promptData.suggested_duration}</p>
                        </div>
                    )}
                </div>

                <BottomNav />
            </div>
        );
    }

    return null;
};

export default MindPage;