'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
    Flame, 
    Sparkles, 
    Camera, 
    Brain, 
    TrendingUp,
    Activity,
    Calendar,
    ChevronRight
} from 'lucide-react';
import BottomNav from './BottomNav';
import { dailyCheckIn, DashboardData, DailyInsight } from '../services/api';
import { useDashboard, useDailyInsight } from '../hooks/queries';
import { queryClient } from '../services/queryClient';

// Skeleton Pulse Component
const SkeletonPulse: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer rounded ${className}`} />
);

// Skeleton Loading Component that mirrors the actual dashboard structure
const DashboardSkeleton: React.FC = () => {
    return (
        <div className="min-h-screen w-full bg-[#FFF5F5] font-sans text-skin-text overflow-x-hidden pb-24">
            {/* Header Skeleton */}
            <nav className="sticky top-0 z-40 px-5 py-4 bg-[#FFF5F5]/95 backdrop-blur-md border-b border-gray-100">
                <div className="flex justify-between items-center max-w-md mx-auto">
                    <div className="flex flex-col gap-2">
                        <SkeletonPulse className="h-3 w-20" />
                        <SkeletonPulse className="h-6 w-32" />
                    </div>
                    <SkeletonPulse className="w-12 h-12 rounded-full" />
                </div>
            </nav>

            <div className="px-5 py-6 max-w-md mx-auto space-y-4">
                {/* Streak Card Skeleton */}
                <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-3xl p-6 shadow-lg border border-orange-100">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <SkeletonPulse className="w-7 h-7 rounded-full" />
                                <SkeletonPulse className="h-10 w-16" />
                            </div>
                            <SkeletonPulse className="h-4 w-24 mt-2" />
                        </div>
                        <SkeletonPulse className="h-10 w-24 rounded-full" />
                    </div>
                    <div className="flex items-center gap-4">
                        <SkeletonPulse className="h-3 w-28" />
                        <SkeletonPulse className="h-3 w-32" />
                    </div>
                </div>

                {/* Daily Insight Skeleton */}
                <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100">
                    <div className="flex items-start gap-3">
                        <SkeletonPulse className="w-10 h-10 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                            <SkeletonPulse className="h-3 w-24" />
                            <SkeletonPulse className="h-4 w-full" />
                            <SkeletonPulse className="h-4 w-3/4" />
                        </div>
                    </div>
                </div>

                {/* Quick Stats Skeleton */}
                <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center">
                            <SkeletonPulse className="w-6 h-6 rounded mb-2" />
                            <SkeletonPulse className="h-8 w-12" />
                            <SkeletonPulse className="h-3 w-16 mt-2" />
                        </div>
                    ))}
                </div>

                {/* Total Stats Card Skeleton */}
                <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100">
                    <SkeletonPulse className="h-3 w-28 mb-4" />
                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2].map((i) => (
                            <div key={i} className="flex flex-col items-center">
                                <SkeletonPulse className="h-9 w-16" />
                                <SkeletonPulse className="h-3 w-20 mt-2" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Actions Skeleton */}
                <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100">
                    <SkeletonPulse className="h-3 w-28 mb-4" />
                    <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                                <SkeletonPulse className="w-6 h-6 rounded" />
                                <SkeletonPulse className="h-3 w-12" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* View Insights CTA Skeleton */}
                <div className="w-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 rounded-2xl p-4 shadow-lg flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-3">
                        <SkeletonPulse className="w-6 h-6 rounded" />
                        <SkeletonPulse className="h-5 w-32" />
                    </div>
                    <SkeletonPulse className="w-5 h-5 rounded" />
                </div>
            </div>

            <BottomNav />

            {/* Custom shimmer animation styles */}
            <style>{`
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                .animate-shimmer {
                    animation: shimmer 1.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};

const Home: React.FC = () => {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    
    const [checkingIn, setCheckingIn] = useState(false);

    // Fetch dashboard data via React Query
    const { data: dashboardData, isLoading: isDashboardLoading } = useDashboard();
    const { data: dailyInsightData, isLoading: isInsightLoading } = useDailyInsight();

    const dailyInsight = dailyInsightData || null;

    // Handle check-in
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

    // Check if user can check in today
    const canCheckInToday = () => {
        if (!dashboardData?.streak?.last_check_in) return true;
        const lastCheckIn = new Date(dashboardData.streak.last_check_in);
        const today = new Date();
        return lastCheckIn.toDateString() !== today.toDateString();
    };

    // Show skeleton loading state only on first load
    if (isDashboardLoading || isInsightLoading) {
        return <DashboardSkeleton />;
    }

    const streak = dashboardData?.streak;
    const stats = dashboardData?.quick_stats;
    const recentActivity = dashboardData?.recent_activity;

    return (
        <div className="min-h-screen w-full bg-[#FFF5F5] font-sans text-skin-text overflow-x-hidden pb-[110px]">
            
            {/* Header */}
            <motion.nav 
                className="sticky top-0 z-40 px-5 py-4 bg-[#FFF5F5]/95 backdrop-blur-md border-b border-gray-100"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
            >
                <div className="flex justify-between items-center max-w-md mx-auto">
                    <div className="flex flex-col">
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                            Welcome Back
                        </span>
                        <span className="font-display font-bold text-xl text-[#1A1A1A]">
                            Dermora User
                        </span>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-white shadow-md border border-gray-100 flex items-center justify-center overflow-hidden">
                        <div className="w-full h-full bg-gradient-to-br from-pastel-pink to-pastel-lavender" />
                    </div>
                </div>
            </motion.nav>

            <div className="px-5 py-6 max-w-md mx-auto space-y-4">

                {/* Streak Card */}
                {streak && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-br from-orange-50 to-red-50 rounded-3xl p-6 shadow-lg border border-orange-100"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <Flame size={28} className="text-orange-500" />
                                    <span className="text-4xl font-display font-bold text-[#1A1A1A]">
                                        {streak.current_streak}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600">
                                    {streak.current_streak === 1 ? 'Day Streak' : 'Days Streak'}
                                </p>
                            </div>
                            {canCheckInToday() && (
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleCheckIn}
                                    disabled={checkingIn}
                                    className="px-4 py-2 bg-orange-500 text-white rounded-full text-sm font-medium shadow-md disabled:opacity-50"
                                >
                                    {checkingIn ? '...' : 'Check In'}
                                </motion.button>
                            )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>🏆 Best: {streak.longest_streak} days</span>
                            {!canCheckInToday() && (
                                <span className="text-green-600">✓ Checked in today</span>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Daily Insight */}
                {dailyInsight && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white rounded-3xl p-5 shadow-md border border-gray-100"
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pastel-pink to-pastel-orange flex items-center justify-center flex-shrink-0">
                                <Sparkles size={20} className="text-white" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
                                    Daily Insight
                                </h3>
                                <p className="text-sm text-gray-700 leading-relaxed">
                                    {dailyInsight.insight_text}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Quick Stats */}
                {stats && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="grid grid-cols-3 gap-3"
                    >
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                            <Camera size={24} className="text-pastel-pink mx-auto mb-2" />
                            <div className="text-2xl font-bold text-[#1A1A1A]">
                                {recentActivity?.images_this_week || 0}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                This Week
                            </div>
                        </div>
                        
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                            <Activity size={24} className="text-pastel-blue mx-auto mb-2" />
                            <div className="text-2xl font-bold text-[#1A1A1A]">
                                {stats.avg_mood_this_week?.toFixed(1) || '—'}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                Avg Mood
                            </div>
                        </div>
                        
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                            <Calendar size={24} className="text-pastel-lavender mx-auto mb-2" />
                            <div className="text-2xl font-bold text-[#1A1A1A]">
                                {recentActivity?.days_active || 0}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                Active Days
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Total Stats Card */}
                {stats && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="bg-white rounded-3xl p-5 shadow-md border border-gray-100"
                    >
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
                            Your Progress
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                                <div className="text-3xl font-bold text-pink-600">
                                    {stats.total_images || 0}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">Total Images</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-blue-600">
                                    {stats.total_mood_logs || 0}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">Mood Logs</div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Quick Actions */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white rounded-3xl p-5 shadow-md border border-gray-100"
                >
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
                        Quick Actions
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate('/skin')}
                            className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-gradient-to-br from-pink-50 to-pink-100 border border-pink-200 hover:shadow-md transition-shadow"
                        >
                            <Camera size={24} className="text-pink-600" />
                            <span className="text-xs font-medium text-gray-700">Upload</span>
                        </motion.button>
                        
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate('/mind')}
                            className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 hover:shadow-md transition-shadow"
                        >
                            <Activity size={24} className="text-blue-600" />
                            <span className="text-xs font-medium text-gray-700">Log Mood</span>
                        </motion.button>
                        
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate('/mind')}
                            className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 hover:shadow-md transition-shadow"
                        >
                            <Brain size={24} className="text-purple-600" />
                            <span className="text-xs font-medium text-gray-700">Voice</span>
                        </motion.button>
                    </div>
                </motion.div>

                {/* View Insights CTA */}
                <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/insights')}
                    className="w-full bg-gradient-to-r from-pastel-pink via-pastel-orange to-pastel-lavender rounded-2xl p-4 shadow-lg flex items-center justify-between"
                >
                    <div className="flex items-center gap-3">
                        <TrendingUp size={24} className="text-white" />
                        <span className="font-semibold text-white">View Full Insights</span>
                    </div>
                    <ChevronRight size={20} className="text-white" />
                </motion.button>

            </div>

            <BottomNav />
        </div>
    );
};

export default Home;
