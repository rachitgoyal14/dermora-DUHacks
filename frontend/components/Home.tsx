'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
    Flame, 
    Camera, 
    MessageCircle,
    Activity,
    ArrowRight,
    Sparkles
} from 'lucide-react';
import BottomNav from './BottomNav';
import { dailyCheckIn } from '../services/api';
import { useDashboard, useDailyInsight } from '../hooks/queries';
import { queryClient } from '../services/queryClient';

// Skeleton Loading
const DashboardSkeleton: React.FC = () => {
    return (
        <div className="min-h-screen w-full bg-bone-50 font-sans overflow-x-hidden pb-24">
            <div className="sticky top-0 z-40 px-6 py-8 bg-bone-50/80 backdrop-blur-md border-b border-ink-900/8">
                <div className="flex flex-col items-center text-center max-w-lg mx-auto space-y-4">
                    <div className="w-20 h-20 bg-bone-200 rounded-full animate-pulse" />
                    <div className="h-8 w-48 bg-bone-200 rounded animate-pulse" />
                    <div className="h-4 w-64 bg-bone-200 rounded animate-pulse" />
                </div>
            </div>
            <div className="px-6 py-8 max-w-lg mx-auto space-y-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 bg-white border border-ink-900/8 rounded-lg animate-pulse" />
                ))}
            </div>
            <BottomNav />
        </div>
    );
};

const Home: React.FC = () => {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    
    const [checkingIn, setCheckingIn] = useState(false);

    const { data: dashboardData, isLoading: isDashboardLoading } = useDashboard();
    const { data: dailyInsightData, isLoading: isInsightLoading } = useDailyInsight();

    const dailyInsight = dailyInsightData || null;

    const handleCheckIn = async () => {
        if (checkingIn) return;
        try {
            setCheckingIn(true);
            await dailyCheckIn();
            await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        } catch (err) {
            console.error('Check-in failed:', err);
        } finally {
            setCheckingIn(false);
        }
    };

    const canCheckInToday = () => {
        if (!dashboardData?.streak?.last_check_in) return true;
        const lastCheckIn = new Date(dashboardData.streak.last_check_in);
        const today = new Date();
        return lastCheckIn.toDateString() !== today.toDateString();
    };
    
    const getMoodPhrase = () => {
        const avgMood = dashboardData?.quick_stats?.avg_mood_this_week;
        if (!avgMood) return 'Ready to begin';
        if (avgMood >= 75) return 'You\'re thriving this week';
        if (avgMood >= 50) return 'Moving through steadily';
        if (avgMood >= 25) return 'Taking it day by day';
        return 'We\'re here with you';
    };

    if (isDashboardLoading || isInsightLoading) {
        return <DashboardSkeleton />;
    }

    const streak = dashboardData?.streak;
    const stats = dashboardData?.quick_stats;
    const recentActivity = dashboardData?.recent_activity;
    const moodPhrase = getMoodPhrase();

    return (
        <div className="min-h-screen w-full bg-bone-50 font-sans text-ink-900 overflow-x-hidden pb-[110px]">
            
            {/* Header - Full Bleed Hero with Grain */}
            <motion.section 
                className="sticky top-0 z-40 grain bg-bone-100 border-b border-ink-900/8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                <div className="px-6 py-10 text-center max-w-lg mx-auto">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 200, delay: 0.1 }}
                    >
                        <h1 className="text-4xl md:text-5xl font-display font-semibold text-ink-900 mb-3 tracking-tight">
                            Welcome back
                        </h1>
                        <p className="text-base text-ink-700">
                            {moodPhrase}
                        </p>
                    </motion.div>
                </div>
            </motion.section>

            <div className="px-6 py-8 max-w-lg mx-auto space-y-6">

                {/* Core Actions - Distinct Shape Language */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="space-y-4"
                >
                    <h2 className="eyebrow">Track Your Wellness</h2>
                    
                    {/* Skin Capture - Sage Tint */}
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate('/skin')}
                        className="w-full card-skin rounded-lg p-5 transition-all duration-200 hover:shadow-sm text-left group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                                <Camera size={24} className="text-sage-500" strokeWidth={1.5} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-sans font-semibold text-lg text-ink-900 mb-0.5">Capture Photo</h3>
                                <p className="text-sm text-ink-500">Document your skin progress</p>
                            </div>
                            <ArrowRight size={18} className="text-ink-500 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                        </div>
                    </motion.button>

                    {/* Mood Log - Warm Bone Tint */}
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate('/mind')}
                        className="w-full card-mind rounded-lg p-5 transition-all duration-200 hover:shadow-sm text-left group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                                <Activity size={24} className="text-amber-500" strokeWidth={1.5} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-sans font-semibold text-lg text-ink-900 mb-0.5">Log Mood</h3>
                                <p className="text-sm text-ink-500">Check in with yourself</p>
                            </div>
                            <ArrowRight size={18} className="text-ink-500 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                        </div>
                    </motion.button>

                    {/* Voice Support - Plum Tint */}
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate('/mind')}
                        className="w-full card-voice rounded-lg p-5 transition-all duration-200 hover:shadow-sm text-left group"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                                <MessageCircle size={24} className="text-plum-500" strokeWidth={1.5} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-sans font-semibold text-lg text-ink-900 mb-0.5">Voice Session</h3>
                                <p className="text-sm text-ink-500">Talk with Solace AI</p>
                            </div>
                            <ArrowRight size={18} className="text-ink-500 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                        </div>
                    </motion.button>
                </motion.div>

                {/* Streak Card - Asymmetric Signature Shape (once per page) */}
                {streak && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="card-base shape-signature p-6"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Flame size={24} className="text-clay-500" strokeWidth={1.5} />
                                <div>
                                    <div className="font-sans text-2xl font-semibold text-ink-900">
                                        {streak.current_streak}
                                    </div>
                                    <p className="text-xs text-ink-500">
                                        Day streak · Best {streak.longest_streak}
                                    </p>
                                </div>
                            </div>
                            {canCheckInToday() && (
                                <motion.button
                                    whileTap={{ scale: 0.96 }}
                                    onClick={handleCheckIn}
                                    disabled={checkingIn}
                                    className="px-4 py-2 bg-clay-500 text-bone-50 rounded-full text-sm font-semibold transition-all hover:bg-clay-600 disabled:opacity-50"
                                >
                                    {checkingIn ? '...' : 'Check In'}
                                </motion.button>
                            )}
                            {!canCheckInToday() && (
                                <div className="px-3 py-1.5 bg-moss-100 text-moss-500 rounded-full text-xs font-semibold">
                                    ✓ Done
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Daily Insight - No Emoji */}
                {dailyInsight && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="card-voice rounded-lg p-5 border-plum-500/12"
                    >
                        <div className="flex items-start gap-3">
                            <Sparkles size={20} className="text-plum-500 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                            <div className="flex-1">
                                <h3 className="eyebrow mb-2">Today's Insight</h3>
                                <p className="text-sm text-ink-700 leading-relaxed">
                                    {dailyInsight.insight_text}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Activity Summary - Hairline Border, No Shadow */}
                {stats && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 }}
                        className="card-base p-5"
                    >
                        <h3 className="eyebrow mb-4">This Week</h3>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <div className="font-sans text-2xl font-semibold text-ink-900">
                                    {recentActivity?.images_this_week || 0}
                                </div>
                                <div className="text-xs text-ink-500 mt-1">Photos</div>
                            </div>
                            <div>
                                <div className="font-sans text-2xl font-semibold text-ink-900">
                                    {recentActivity?.moods_this_week || 0}
                                </div>
                                <div className="text-xs text-ink-500 mt-1">Check-ins</div>
                            </div>
                            <div>
                                <div className="font-sans text-2xl font-semibold text-ink-900">
                                    {recentActivity?.days_active || 0}
                                </div>
                                <div className="text-xs text-ink-500 mt-1">Active</div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Primary CTA - Solid Clay */}
                <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => navigate('/insights')}
                    className="w-full btn-primary flex items-center justify-center gap-2"
                >
                    <span className="font-semibold">View Full Insights</span>
                    <ArrowRight size={18} strokeWidth={2} />
                </motion.button>

            </div>

            <BottomNav />
        </div>
    );
};

export default Home;
