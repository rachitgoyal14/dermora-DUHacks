'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@clerk/clerk-react';
import {
    TrendingUp,
    Calendar,
    RefreshCw,
    ChevronRight,
    FileText,
    Camera,
    Activity,
    BarChart3,
    X,
    Trash2
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import BottomNav from './BottomNav';
import { useBackendAuth } from '../contexts/AuthContext';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
interface SkeletonPulseProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
}

const SkeletonPulse: React.FC<SkeletonPulseProps> = ({
    className = '',
    style,
    ...rest
}) => (
    <div
        {...rest}
        className={`relative overflow-hidden bg-gray-200 rounded ${className}`}
        style={{
            background: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s ease-in-out infinite',
            ...style, // ✅ allow height override
        }}
    />
);


// Insights Page Skeleton Component
const InsightsSkeleton: React.FC = () => (
    <div className="min-h-screen w-full bg-[#FFF5F5] font-sans overflow-x-hidden pb-24">
        {/* Shimmer Animation Styles */}
        <style>{`
            @keyframes shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
        `}</style>

        {/* Header Skeleton */}
        <nav className="sticky top-0 z-40 px-5 py-4 bg-[#FFF5F5]/95 backdrop-blur-md border-b border-gray-100">
            <div className="flex justify-between items-center max-w-md mx-auto">
                <div>
                    <SkeletonPulse className="h-7 w-24 rounded-lg mb-1" />
                    <SkeletonPulse className="h-3 w-36 rounded" />
                </div>
                <SkeletonPulse className="w-12 h-12 rounded-full" />
            </div>
        </nav>

        <div className="px-5 py-6 max-w-md mx-auto space-y-6">
            {/* Quick Stats Section Skeleton */}
            <div>
                <SkeletonPulse className="h-4 w-24 rounded mb-3" />
                <div className="grid grid-cols-2 gap-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="bg-white/60 rounded-2xl p-4 border border-gray-100">
                            <SkeletonPulse className="w-5 h-5 rounded mb-2" />
                            <SkeletonPulse className="h-8 w-12 rounded mb-1" />
                            <SkeletonPulse className="h-3 w-20 rounded" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Mood Trends Chart Skeleton */}
            <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                    <SkeletonPulse className="h-4 w-28 rounded" />
                    <div className="flex gap-2">
                        <SkeletonPulse className="h-6 w-10 rounded-full" />
                        <SkeletonPulse className="h-6 w-10 rounded-full" />
                        <SkeletonPulse className="h-6 w-10 rounded-full" />
                    </div>
                </div>
                {/* Chart Area Skeleton */}
                <div className="h-[200px] flex items-end justify-between gap-2 px-2">
                    {[80, 120, 60, 140, 90, 110, 70].map((height, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2">
                            <SkeletonPulse 
                                className="w-full rounded-t" 
                                style={{ height: `${height}px` }} 
                            />
                            <SkeletonPulse className="h-3 w-8 rounded" />
                        </div>
                    ))}
                </div>
                {/* Summary Stats Skeleton */}
                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3 text-center">
                    {[...Array(3)].map((_, i) => (
                        <div key={i}>
                            <SkeletonPulse className="h-3 w-16 rounded mx-auto mb-1" />
                            <SkeletonPulse className="h-6 w-10 rounded mx-auto" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Skin Progress Skeleton */}
            <div className="bg-white rounded-3xl p-5 shadow-md border border-gray-100">
                <SkeletonPulse className="h-4 w-28 rounded mb-4" />
                <div className="space-y-3 mb-4">
                    {[...Array(2)].map((_, i) => (
                        <div key={i} className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                            <div className="flex items-center justify-between mb-2">
                                <SkeletonPulse className="h-5 w-16 rounded" />
                                <SkeletonPulse className="h-4 w-20 rounded" />
                            </div>
                            <SkeletonPulse className="h-4 w-full rounded mb-1" />
                            <SkeletonPulse className="h-4 w-3/4 rounded" />
                        </div>
                    ))}
                </div>
                <div className="pt-4 border-t border-gray-100 text-center">
                    <SkeletonPulse className="h-3 w-24 rounded mx-auto mb-1" />
                    <SkeletonPulse className="h-8 w-20 rounded mx-auto mb-1" />
                    <SkeletonPulse className="h-3 w-28 rounded mx-auto" />
                </div>
            </div>

            {/* Weekly Reports Section Skeleton */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <SkeletonPulse className="h-4 w-28 rounded" />
                    <SkeletonPulse className="h-5 w-5 rounded" />
                </div>
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <SkeletonPulse className="h-3 w-32 rounded" />
                                        <SkeletonPulse className="h-5 w-5 rounded" />
                                    </div>
                                    <SkeletonPulse className="h-4 w-full rounded mb-1" />
                                    <SkeletonPulse className="h-4 w-2/3 rounded mb-2" />
                                    <div className="flex items-center gap-3">
                                        <SkeletonPulse className="h-3 w-20 rounded" />
                                        <SkeletonPulse className="h-3 w-16 rounded" />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 ml-2">
                                    <SkeletonPulse className="w-8 h-8 rounded-full" />
                                    <SkeletonPulse className="w-5 h-5 rounded" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <BottomNav />
    </div>
);

interface Report {
    report_id: string;
    week_start: string;
    week_end: string;
    summary: string;
    trend: string;
    generated_at: string;
    has_html: boolean;
    metrics: any;
}

interface MoodDataPoint {
    date: string;
    mood_score: number;
    stress: number;
    anxiety: number;
    energy: number;
}

interface MoodSummary {
    period: string;
    avg_mood: number;
    avg_stress: number;
    avg_anxiety: number;
    avg_energy: number;
    total_logs: number;
    mood_trend: string;
}

interface DashboardStats {
    streak: {
        current_streak: number;
        longest_streak: number;
        last_check_in: string | null;
        total_check_ins: number;
    };
    recent_activity: {
        images_this_week: number;
        moods_this_week: number;
        days_active: number;
    };
    quick_stats: {
        total_images: number;
        total_mood_logs: number;
        avg_mood_this_week: number;
        days_tracked: number;
    };
}

type TimeRange = '7' | '14' | '30';

const InsightsPage: React.FC = () => {
    const { getToken } = useAuth();
    const { backendUserId, isLoading: authLoading } = useBackendAuth();

    const [loading, setLoading] = useState(true);

    // Reports state
    const [reports, setReports] = useState<Report[]>([]);
    const [loadingReports, setLoadingReports] = useState(true);
    const [selectedReport, setSelectedReport] = useState<string | null>(null);
    const [reportHtml, setReportHtml] = useState<string | null>(null);

    // Charts state
    const [timeRange, setTimeRange] = useState<TimeRange>('7');
    const [moodChartData, setMoodChartData] = useState<MoodDataPoint[]>([]);
    const [improvementData, setImprovementData] = useState<any>(null);
    const [moodSummary, setMoodSummary] = useState<MoodSummary | null>(null);
    const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

    // Fetch all data
    useEffect(() => {
        const fetchAllData = async () => {
            if (!backendUserId) return;

            try {
                setLoading(true);
                const token = await getToken();

                // Fetch dashboard stats
                const dashboardResponse = await fetch(`${BACKEND_URL}/engagement/dashboard`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'X-User-Id': backendUserId
                    }
                });
                
                if (dashboardResponse.ok) {
                    const dashboard = await dashboardResponse.json();
                    setDashboardStats(dashboard);
                    console.log('Dashboard stats:', dashboard);
                }

                // Fetch mood history chart
                const moodHistoryResponse = await fetch(
                    `${BACKEND_URL}/engagement/mood/history?days=${timeRange}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'X-User-Id': backendUserId
                        }
                    }
                );
                
                if (moodHistoryResponse.ok) {
                    const moodHistoryData = await moodHistoryResponse.json();
                    setMoodChartData(moodHistoryData.mood_data || []);
                    console.log('Mood history:', moodHistoryData);
                }

                // Fetch mood summary
                const moodSummaryResponse = await fetch(`${BACKEND_URL}/engagement/mood/summary`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'X-User-Id': backendUserId
                    }
                });
                
                if (moodSummaryResponse.ok) {
                    const summary = await moodSummaryResponse.json();
                    setMoodSummary(summary);
                    console.log('Mood summary:', summary);
                }

                // Fetch improvement tracker data (skin progress)
                const improvementResponse = await fetch(`${BACKEND_URL}/skin/improvement-tracker`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'X-User-Id': backendUserId
                    }
                });
                
                if (improvementResponse.ok) {
                    const improvement = await improvementResponse.json();
                    setImprovementData(improvement);
                    console.log('Improvement data:', improvement);
                } else {
                    console.error('Failed to fetch improvement data:', improvementResponse.status);
                }

                // Fetch weekly reports - FIX: use correct endpoint
                const reportsResponse = await fetch(`${BACKEND_URL}/reports/weekly/list?limit=10`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'X-User-Id': backendUserId
                    }
                });
                
                if (reportsResponse.ok) {
                    const reportsData = await reportsResponse.json();
                    setReports(reportsData.reports || []);
                    console.log('Reports:', reportsData);
                } else {
                    console.error('Failed to fetch reports:', reportsResponse.status);
                    setReports([]);
                }

            } catch (err) {
                console.error("Failed to fetch insights:", err);
            } finally {
                setLoading(false);
                setLoadingReports(false);
            }
        };

        if (backendUserId) {
            fetchAllData();
        }
    }, [backendUserId, getToken, timeRange]);

    // View report - FIX: use correct endpoint
    const handleViewReport = async (weekStart: string) => {
        if (!backendUserId) return;

        try {
            const token = await getToken();
            // Correct endpoint: /reports/weekly/html with week_start query param
            const response = await fetch(`${BACKEND_URL}/reports/weekly/html?week_start=${weekStart}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-User-Id': backendUserId
                }
            });
            
            if (response.ok) {
                const htmlContent = await response.text();
                setReportHtml(htmlContent);
                setSelectedReport(weekStart);
            } else {
                console.error('Failed to fetch report HTML:', response.status);
                setReportHtml('<p>Failed to load report</p>');
            }
        } catch (err) {
            console.error("Failed to fetch report:", err);
            setReportHtml('<p>Error loading report</p>');
        }
    };

    // Delete report
    const handleDeleteReport = async (reportId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!backendUserId || !confirm('Delete this report?')) return;

        try {
            const token = await getToken();
            const response = await fetch(`${BACKEND_URL}/reports/weekly/${reportId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-User-Id': backendUserId
                }
            });
            
            if (response.ok) {
                setReports(reports.filter(r => r.report_id !== reportId));
            }
        } catch (err) {
            console.error("Failed to delete report:", err);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getTrendIcon = (trend: string) => {
        if (trend.toLowerCase().includes('improv')) return '📈';
        if (trend.toLowerCase().includes('declin')) return '📉';
        return '➡️';
    };

    // Show skeleton while loading instead of spinner
    if (authLoading || loading) {
        return <InsightsSkeleton />;
    }

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
                        <h1 className="font-display font-bold text-2xl text-[#1A1A1A]">Insights</h1>
                        <p className="text-xs text-gray-400">Your progress & analytics</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pastel-orange to-pastel-pink flex items-center justify-center">
                        <BarChart3 size={24} className="text-white" />
                    </div>
                </div>
            </motion.nav>

            <div className="px-5 py-6 max-w-md mx-auto space-y-6">

                {/* Statistics Cards */}
                {dashboardStats && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                            Quick Stats
                        </h2>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-2xl p-4 border border-pink-200">
                                <Camera size={20} className="text-pink-600 mb-2" />
                                <div className="text-2xl font-bold text-[#1A1A1A]">
                                    {dashboardStats.recent_activity?.images_this_week || 0}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">Images This Week</div>
                            </div>

                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 border border-blue-200">
                                <Activity size={20} className="text-blue-600 mb-2" />
                                <div className="text-2xl font-bold text-[#1A1A1A]">
                                    {dashboardStats.quick_stats?.avg_mood_this_week?.toFixed(1) || '—'}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">Avg Mood</div>
                            </div>

                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-4 border border-purple-200">
                                <Calendar size={20} className="text-purple-600 mb-2" />
                                <div className="text-2xl font-bold text-[#1A1A1A]">
                                    {dashboardStats.recent_activity?.days_active || 0}
                                </div>
                                <div className="text-xs text-gray-600 mt-1">Active Days</div>
                            </div>

                            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4 border border-green-200">
                                <TrendingUp size={20} className="text-green-600 mb-2" />
                                <div className="text-2xl font-bold text-[#1A1A1A]">
                                    {improvementData?.overall_improvement_percentage?.toFixed(0) || '0'}%
                                </div>
                                <div className="text-xs text-gray-600 mt-1">Improvement</div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Mood Trends Chart */}
                {moodChartData.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white rounded-3xl p-5 shadow-md border border-gray-100"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                                Mood Trends
                            </h2>
                            <div className="flex gap-2">
                                {(['7', '14', '30'] as TimeRange[]).map((range) => (
                                    <button
                                        key={range}
                                        onClick={() => setTimeRange(range)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                            timeRange === range
                                                ? 'bg-pastel-blue text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {range}D
                                    </button>
                                ))}
                            </div>
                        </div>

                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={moodChartData}>
                                <defs>
                                    <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#FFB6C1" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#FFB6C1" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8EA7E9" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#8EA7E9" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis 
                                    dataKey="date" 
                                    stroke="#999"
                                    fontSize={11}
                                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                />
                                <YAxis stroke="#999" fontSize={11} domain={[0, 100]} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                        borderRadius: '12px',
                                        border: '1px solid #e5e7eb',
                                        fontSize: '12px'
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="mood_score"
                                    stroke="#FFB6C1"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#moodGradient)"
                                    name="Mood"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="energy"
                                    stroke="#8EA7E9"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#energyGradient)"
                                    name="Energy"
                                />
                            </AreaChart>
                        </ResponsiveContainer>

                        {moodSummary && (
                            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-3 text-center">
                                <div>
                                    <div className="text-xs text-gray-500">Avg Mood</div>
                                    <div className="text-lg font-bold text-pink-600">
                                        {moodSummary.avg_mood?.toFixed(1) || '—'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">Avg Energy</div>
                                    <div className="text-lg font-bold text-blue-600">
                                        {moodSummary.avg_energy?.toFixed(1) || '—'}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs text-gray-500">Total Logs</div>
                                    <div className="text-lg font-bold text-purple-600">
                                        {moodSummary.total_logs || 0}
                                    </div>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Skin Improvement Chart */}
                {improvementData && improvementData.weekly_improvements && improvementData.weekly_improvements.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white rounded-3xl p-5 shadow-md border border-gray-100"
                    >
                        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
                            Skin Progress
                        </h2>

                        <div className="space-y-3 mb-4">
                            {improvementData.weekly_improvements.map((week: any, idx: number) => {
                                const getTrendColor = (trend: string) => {
                                    if (trend === 'improving') return 'bg-green-50 border-green-200 text-green-700';
                                    if (trend === 'worsening') return 'bg-red-50 border-red-200 text-red-700';
                                    return 'bg-gray-50 border-gray-200 text-gray-700';
                                };

                                return (
                                    <div key={idx} className={`p-4 rounded-xl border ${getTrendColor(week.trend)}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-semibold">Week {week.week_number}</span>
                                            <span className="text-sm font-medium capitalize">{week.trend}</span>
                                        </div>
                                        <p className="text-sm">{week.summary}</p>
                                        {week.confidence_change && (
                                            <p className="text-xs mt-2">
                                                Confidence change: {(week.confidence_change * 100).toFixed(1)}%
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="pt-4 border-t border-gray-100 text-center">
                            <div className="text-xs text-gray-500">Overall Trend</div>
                            <div className="text-2xl font-bold text-gray-800 capitalize">
                                {improvementData.overall_trend || 'Stable'}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Based on {improvementData.total_images || 0} images
                            </p>
                        </div>
                    </motion.div>
                )}

                {/* Weekly Reports Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                >
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                            Weekly Reports
                        </h2>
                        <FileText size={18} className="text-gray-400" />
                    </div>

                    {loadingReports ? (
                        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                            <RefreshCw className="animate-spin mx-auto mb-3 text-pastel-pink" size={32} />
                            <p className="text-sm text-gray-500">Loading reports...</p>
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
                            <Calendar className="mx-auto mb-3 text-gray-300" size={40} />
                            <p className="text-sm text-gray-500 mb-1">No reports yet</p>
                            <p className="text-xs text-gray-400">Start tracking to generate reports!</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {reports.map((report, idx) => (
                                <motion.div
                                    key={report.report_id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
                                    onClick={() => handleViewReport(report.week_start)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-medium text-gray-500">
                                                    {formatDate(report.week_start)} - {formatDate(report.week_end)}
                                                </span>
                                                <span className="text-lg">{getTrendIcon(report.trend)}</span>
                                            </div>
                                            <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                                                {report.summary}
                                            </p>
                                            <div className="flex items-center gap-3 text-xs text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <TrendingUp size={12} />
                                                    {report.trend}
                                                </span>
                                                {report.metrics?.days_tracked && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{report.metrics.days_tracked} days</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2 ml-2">
                                            <button
                                                onClick={(e) => handleDeleteReport(report.report_id, e)}
                                                className="p-2 rounded-full bg-red-50 hover:bg-red-100 transition-colors"
                                            >
                                                <Trash2 size={14} className="text-red-500" />
                                            </button>
                                            <ChevronRight size={20} className="text-gray-400" />
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </motion.div>

            </div>

            <BottomNav />

            {/* Report Viewer Modal */}
            <AnimatePresence>
                {reportHtml && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
                        onClick={() => {
                            setReportHtml(null);
                            setSelectedReport(null);
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                                <h3 className="font-display font-bold text-lg text-[#1A1A1A]">
                                    Weekly Report
                                </h3>
                                <button
                                    onClick={() => {
                                        setReportHtml(null);
                                        setSelectedReport(null);
                                    }}
                                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div
                                className="overflow-y-auto p-6"
                                style={{ maxHeight: 'calc(85vh - 80px)' }}
                                dangerouslySetInnerHTML={{ __html: reportHtml }}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default InsightsPage;
