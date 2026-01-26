// MoodPage.tsx - Updated with Clerk Authentication
// Fetches questions from backend, logs mood with authenticated user

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth, useUser } from '@clerk/clerk-react';
import { SadFace, NeutralFace, GoodFace, HappyFace } from './MoodFaces';
import BottomNav from './BottomNav';
import { logMood, getMoodQuestions } from '../services/api';
import { Check, RefreshCw } from 'lucide-react';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
// Components
const OptionCard = ({ label, icon, isSelected, onClick, delay }: any) => (
    <motion.button
        onClick={onClick}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className={`
            relative w-full p-4 rounded-full flex items-center gap-4 transition-all duration-300
            ${isSelected
                ? 'bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)] scale-[1.01]'
                : 'bg-white/60 hover:bg-white/80 shadow-sm'
            }
        `}
    >
        {/* Circular Emoji Container */}
        <div className={`
            w-14 h-14 rounded-full flex items-center justify-center text-3xl shrink-0
            ${isSelected ? 'bg-orange-50' : 'bg-gray-50'}
            transition-colors duration-300
        `}>
            {icon}
        </div>

        {/* Label */}
        <span className={`text-lg font-bold text-left flex-1 ${isSelected ? 'text-[#1A1A1A]' : 'text-gray-600'}`}>
            {label}
        </span>
    </motion.button>
);

const MoodPage: React.FC = () => {
    const navigate = useNavigate();
    
    // Clerk auth hooks
    const { getToken, isSignedIn } = useAuth();
    const { user } = useUser();
    const [backendUserId, setBackendUserId] = useState<string | null>(null);
    const syncedRef = useRef(false);

    const [questions, setQuestions] = useState<any[]>([]);
    const [currentStep, setCurrentStep] = useState<number>(0);
    const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [isLoggingMood, setIsLoggingMood] = useState(false);

    const faceComponents = [SadFace, NeutralFace, GoodFace, HappyFace];
    const baseScores = [20, 50, 75, 95];
    const negativeIds = ['stress', 'anxiety'];
    const labelMap: Record<string, string[]> = {
        mood: ['Terrible', 'Okay', 'Good', 'Excellent'],
        stress: ['Very Stressed', 'Stressed', 'Mild', 'Relaxed'],
        anxiety: ['Very Anxious', 'Anxious', 'Mild', 'Calm'],
        energy: ['Exhausted', 'Low', 'Good', 'Energized'],
    };

    // Sync user and get backend UUID
    useEffect(() => {
        if (!isSignedIn || !user || syncedRef.current) return;

        const syncUser = async () => {
            try {
                const token = await getToken();
                const response = await fetch(`${BACKEND_URL}/auth/sync-user`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });
                
                const data = await response.json();
                console.log("✅ Backend sync success:", data);
                
                if (data.uuid) {
                    setBackendUserId(data.uuid);
                    console.log("📝 Stored backend UUID:", data.uuid);
                }
                
                syncedRef.current = true;
            } catch (err) {
                console.error("User sync failed:", err);
            }
        };

        syncUser();
    }, [isSignedIn, user, getToken]);

    // Fetch questions from backend
    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                // Questions endpoint is public - no auth needed
                const response = await getMoodQuestions();
                setQuestions(response.questions);
                setCurrentStep(0);
            } catch (error) {
                console.error('Failed to fetch mood questions:', error);
                // Fallback to static questions if needed
                setQuestions([
                    { id: 'mood', prompt: 'How are you feeling right now?' },
                    { id: 'stress', prompt: 'How stressed do you feel?' },
                    { id: 'anxiety', prompt: 'How anxious are you feeling?' },
                    { id: 'energy', prompt: 'How is your energy level?' },
                ]);
                setCurrentStep(0);
            }
        };
        fetchQuestions();
    }, []);

    // Submit mood log when all questions answered
    useEffect(() => {
        if (currentStep === questions.length && questions.length > 0 && !isLoggingMood) {
            if (!backendUserId) {
                console.error("Cannot log mood: No backend user ID available");
                return;
            }

            const submitMoodLog = async () => {
                setIsLoggingMood(true);
                
                try {
                    const moodScore = selectedAnswers['mood'];
                    const data = {
                        mood_score: moodScore,
                        stress: selectedAnswers['stress'],
                        anxiety: selectedAnswers['anxiety'],
                        energy: selectedAnswers['energy'],
                        sadness: 100 - moodScore, // Derived from mood_score
                        logged_at: new Date().toISOString(),
                    };

                    const token = await getToken();
                    await logMood(data, token, backendUserId);
                    
                    console.log("✅ Mood logged successfully");
                    setTimeout(() => navigate('/solace'), 1500);
                } catch (error) {
                    console.error('Failed to log mood:', error);
                    // Still navigate to solace even if logging fails
                    setTimeout(() => navigate('/solace'), 1500);
                } finally {
                    setIsLoggingMood(false);
                }
            };

            submitMoodLog();
        }
    }, [currentStep, questions, selectedAnswers, backendUserId, getToken, navigate, isLoggingMood]);

    const handleSelect = (index: number) => {
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

    const getHeader = () => {
        if (currentStep < questions.length) {
            return questions[currentStep]?.prompt;
        }
        return 'Check-in Complete';
    };

    const getSubtext = () => {
        if (currentStep < questions.length) {
            return 'Select what best describes your current state.';
        }
        return 'Heading to Solace...';
    };

    // Show loading while syncing
    if (!backendUserId) {
        return (
            <div className="min-h-screen w-full bg-[#FFF5F5] flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="animate-spin mx-auto mb-4 text-pastel-pink" size={48} />
                    <p className="text-lg font-medium text-gray-700">Initializing your session...</p>
                </div>
            </div>
        );
    }

    if (questions.length === 0) {
        return (
            <div className="min-h-screen w-full bg-[#FFF5F5] flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="animate-spin mx-auto mb-4 text-gray-400" size={32} />
                    <p className="text-gray-600">Loading questions...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-[#FFF5F5] font-sans text-skin-text pb-24 relative flex flex-col">

            {/* Decorative Background */}
            <div className="fixed top-[-20%] right-[-20%] w-[500px] h-[500px] bg-pastel-pink/30 rounded-full blur-3xl pointer-events-none" />
            <div className="fixed bottom-[-20%] left-[-20%] w-[400px] h-[400px] bg-pastel-blue/20 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="pt-8 px-8 mb-10 text-center relative z-10 min-h-[120px] shrink-0">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <h1 className="font-display text-3xl font-bold text-[#1A1A1A] mb-2 leading-tight">
                            {getHeader()}
                        </h1>
                        <p className="text-skin-muted text-base">{getSubtext()}</p>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex-1 overflow-y-auto px-6 max-w-sm mx-auto w-full relative z-10 pb-32 no-scrollbar">
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
                                return (
                                    <OptionCard
                                        key={index}
                                        label={currentLabels[index]}
                                        icon={<Face />}
                                        isSelected={selectedIndex === index}
                                        onClick={() => handleSelect(index)}
                                        delay={index * 0.05}
                                    />
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
                                {isLoggingMood ? 'Saving your check-in...' : 'Check-in saved!'}
                            </p>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>

            {/* Back Button */}
            {currentStep > 0 && currentStep < questions.length && (
                <div className="fixed bottom-24 left-0 right-0 z-20 flex justify-center pointer-events-none">
                    <button
                        onClick={() => setCurrentStep(currentStep - 1)}
                        className="bg-white/80 backdrop-blur-md px-6 py-2 rounded-full text-gray-500 font-medium text-sm hover:text-gray-800 shadow-sm pointer-events-auto"
                    >
                        Go Back
                    </button>
                </div>
            )}

            <BottomNav />
        </div>
    );
};

export default MoodPage;