import { useQuery } from '@tanstack/react-query';
import {
    getDashboard,
    getDailyInsight,
    getMoodSummary,
    getImprovementTracker,
    getMoodHistoryChart,
    getWeeklyReportsList,
    getMySkinImages,
    getMoodQuestions,
    getVoicePrompt,
    getSkinHistory
} from '../services/api';

export function useDashboard() {
    return useQuery({
        queryKey: ['dashboard'],
        queryFn: getDashboard,
    });
}

export function useDailyInsight() {
    return useQuery({
        queryKey: ['dailyInsight'],
        queryFn: getDailyInsight,
    });
}

export function useMoodSummary() {
    return useQuery({
        queryKey: ['moodSummary'],
        queryFn: getMoodSummary,
    });
}

export function useImprovementTracker() {
    return useQuery({
        queryKey: ['improvementTracker'],
        queryFn: getImprovementTracker,
    });
}

export function useMoodHistoryChart(days: number) {
    return useQuery({
        queryKey: ['moodHistoryChart', days],
        queryFn: () => getMoodHistoryChart(days),
    });
}

export function useWeeklyReportsList(limit: number = 10) {
    return useQuery({
        queryKey: ['weeklyReports', limit],
        queryFn: () => getWeeklyReportsList(limit),
    });
}

export function useMySkinImages() {
    return useQuery({
        queryKey: ['mySkinImages'],
        queryFn: getMySkinImages,
    });
}

export function useMoodQuestions() {
    return useQuery({
        queryKey: ['moodQuestions'],
        queryFn: getMoodQuestions,
    });
}

export function useVoicePrompt() {
    return useQuery({
        queryKey: ['voicePrompt'],
        queryFn: getVoicePrompt,
    });
}

export function useSkinHistory() {
    return useQuery({
        queryKey: ['skinHistory'],
        queryFn: getSkinHistory,
    });
}
