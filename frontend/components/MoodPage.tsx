// MoodPage.tsx - Manual JWT Authentication (no Clerk)

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { SadFace, NeutralFace, GoodFace, HappyFace } from './MoodFaces';
import BottomNav from './BottomNav';
import { logMood } from '../services/api';
import { useMoodQuestions } from '../hooks/queries';
import { queryClient } from '../services/queryClient';
import { Check, RefreshCw } from 'lucide-react';
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
                ? 'bg-plum-100 ring-2 ring-plum-200 scale-[1.02]'
                : 'card-base hover:bg-bone-100 hover:scale-[1.01]'
            }
        `}
    >
        {/* Selection Dot */}
        <div className={`
            w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300
            ${isSelected ? 'bg-white' : 'bg-bone-200'}
        `}>
            {isSelected ? (
                <Check size={20} className="text-ink-900" />
            ) : (
                <div className="w-2.5 h-2.5 rounded-full bg-ink-300" />
            )}
        </div>

        {/* Custom Face Icon wrapper */}
        <div className={`
            w-10 h-10 rounded-full flex items-center justify-center text-2xl
            transition-colors duration-300
        `}>
            {icon}
        </div>

        {/* Label */}
        <span className={`text-lg font-semibold text-left flex-1 ${isSelected ? 'text-ink-900' : 'text-ink-600'}`}>
            {label}
        </span>
    </motion.button>
);

const MoodPage: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    const { data: questionsData, isLoading } = useMoodQuestions();
    const questions = questionsData?.questions || [
        { id: 'mood', prompt: 'How are you feeling right now?' },
        { id: 'stress', prompt: 'How stressed do you feel?' },
        { id: 'anxiety', prompt: 'How anxious are you feeling?' },
        { id: 'energy', prompt: 'How is your energy level?' },
    ];

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

    // Submit mood log when all questions answered
    useEffect(() => {
        if (currentStep === questions.length && questions.length > 0 && !isLoggingMood) {
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
                    // Invalidate queries to refresh charts/summaries
                    await Promise.all([
                        queryClient.invalidateQueries({ queryKey: ['moodSummary'] }),
                        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
                        queryClient.invalidateQueries({ queryKey: ['moodHistoryChart'] }),
                    ]);
                    setTimeout(() => navigate('/mind'), 1500);
                } catch (error) {
                    console.error('Failed to log mood:', error);
                    setTimeout(() => navigate('/mind'), 1500);
                } finally {
                    setIsLoggingMood(false);
                }
            };
            submitMoodLog();
        }
    }, [currentStep, questions, selectedAnswers, navigate, isLoggingMood]);

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

    // Show loading while authenticating
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen w-full bg-bone-50 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="animate-spin mx-auto mb-4 text-plum-500" size={48} />
                    <p className="text-lg font-medium text-ink-700">Initializing your session...</p>
                </div>
            </div>
        );
    }

    if (questions.length === 0) {
        return (
            <div className="min-h-screen w-full bg-bone-50 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="animate-spin mx-auto mb-4 text-ink-400" size={32} />
                    <p className="text-ink-600">Loading questions...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-bone-50 font-sans text-ink-900 pb-24 relative flex flex-col">

            {/* Header */}
            <div className="pt-8 px-8 mb-10 text-center relative z-10 min-h-[120px] shrink-0">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <h1 className="font-display text-3xl font-semibold text-ink-900 mb-2 leading-tight">
                            {getHeader()}
                        </h1>
                        <p className="text-ink-600 text-base">{getSubtext()}</p>
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
                            <div className="w-24 h-24 bg-moss-100 rounded-full flex items-center justify-center text-moss-600 mb-4">
                                {isLoggingMood ? (
                                    <RefreshCw className="animate-spin" size={48} />
                                ) : (
                                    <Check size={48} />
                                )}
                            </div>
                            <p className="text-ink-600 font-medium">
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
                        className="bg-bone-50/80 backdrop-blur-md px-6 py-2 rounded-full text-ink-500 font-medium text-sm hover:text-ink-800 pointer-events-auto border border-ink-900/8"
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