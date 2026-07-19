import axios, { AxiosInstance } from 'axios';
import { getCurrentToken } from './auth';

// Base config
const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

// ──────────────────────────────────────────────────────────────────────────────
// Single axios instance — attaches Bearer token automatically via interceptor
// ──────────────────────────────────────────────────────────────────────────────
export const api: AxiosInstance = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
    const token = getCurrentToken();
    if (token && config.headers) {
        if (typeof config.headers.set === 'function') {
            config.headers.set('Authorization', `Bearer ${token}`);
        } else {
            (config.headers as any)['Authorization'] = `Bearer ${token}`;
        }
    }
    return config;
});

// Response interceptor: common error logging
api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', {
            url: error.config?.url,
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
        });
        return Promise.reject(error);
    }
);

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface SkinAnalysisResult {
    prediction: string;
    confidence: number;
    severity_score?: number;
}

export interface SkinImageUploadResponse {
    image_id: string;
    image_url: string;
    prediction: string;
    confidence: number;
    captured_at: string;
    message: string;
}

export interface UserSkinImage {
    image_id: string;
    image_url: string;
    captured_at: string;
    image_type: string;
}

export interface MoodLogData {
    mood_score: number;
    stress: number;
    anxiety: number;
    sadness: number;
    energy: number;
    logged_at: string;
}

export interface MoodLog {
    mood_log_id: string;
    mood_score: number;
    stress: number;
    anxiety: number;
    energy: number;
    logged_at: string;
}

export interface MoodHistoryResponse {
    total_logs: number;
    logs: MoodLog[];
}

export interface VoicePromptData {
    mood_category: string;
    mood_score: number;
    prompt_name: string;
    system_prompt: string;
    suggested_duration: string;
    follow_up_recommended: boolean;
    calculated_at: string;
}

export interface MoodAnalysisResponse {
    mood_score: number;
    stress: number;
    anxiety: number;
    sadness: number;
    energy: number;
    logged_at: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Engagement Types
// ──────────────────────────────────────────────────────────────────────────────

export interface StreakData {
    current_streak: number;
    longest_streak: number;
    last_check_in: string | null;
    total_check_ins: number;
}

export interface DashboardData {
    streak: StreakData;
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
    daily_insight: string | null;
}

export interface DailyInsight {
    insight_text: string;
    insight_type: string;
    icon: string;
    generated_at: string;
}

export interface MoodChartData {
    date: string;
    mood_score: number;
    stress: number;
    anxiety: number;
    energy: number;
}

export interface MoodSummary {
    total_logs: number;
    avg_mood: number | null;
    avg_stress: number | null;
    avg_anxiety: number | null;
    avg_energy: number | null;
    period_days: number;
}

export interface UserPreferences {
    notification_time: string | null;
    daily_reminder: boolean;
    weekly_report: boolean;
    voice_prompt_frequency: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Skin API
// ──────────────────────────────────────────────────────────────────────────────

export const getMySkinImages = async (): Promise<UserSkinImage[]> => {
    const response = await api.get('/skin/my-images');
    return response.data;
};

export const uploadSkinImage = async (
    file: File,
    imageType: string = 'weekly',
): Promise<SkinImageUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/skin/upload', formData, {
        params: { image_type: imageType },
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const analyzeExisting = async (imageId: string) => {
    const response = await api.post(`/skin/analyze/${imageId}`);
    return response.data;
};

export const compareImages = async (beforeImageId: string, afterImageId: string) => {
    const response = await api.post('/skin/compare', {
        before_image_id: beforeImageId,
        after_image_id: afterImageId,
    });
    return response.data;
};

export const getSkinHistory = async () => {
    const response = await api.get('/skin/progress/comparison');
    return response.data;
};

export const deleteImage = async (imageId: string) => {
    const response = await api.delete(`/skin/image/${imageId}`);
    return response.data;
};

export const getImprovementTracker = async () => {
    const response = await api.get('/skin/improvement-tracker');
    return response.data;
};

export const refreshImprovement = async () => {
    const response = await api.post('/skin/improvement-tracker/refresh');
    return response.data;
};

// ──────────────────────────────────────────────────────────────────────────────
// Mood API
// ──────────────────────────────────────────────────────────────────────────────

export const logMood = async (data: MoodLogData) => {
    const response = await api.post('/mood/log', data);
    return response.data;
};

export const getMoodQuestions = async () => {
    // Public endpoint — no auth required; goes straight to the shared instance
    const response = await api.get('/mood/questions');
    return response.data;
};

export const getMoodHistory = async (limit: number = 30): Promise<MoodHistoryResponse> => {
    const response = await api.get('/mood/history', { params: { limit } });
    return response.data;
};

export const deleteMoodLog = async (moodLogId: string) => {
    const response = await api.delete(`/mood/log/${moodLogId}`);
    return response.data;
};

// ──────────────────────────────────────────────────────────────────────────────
// Voice / Solace API
// ──────────────────────────────────────────────────────────────────────────────

export const getVoicePrompt = async (): Promise<VoicePromptData> => {
    const response = await api.get('/voice/prompt');
    return response.data;
};

export const uploadVoiceForMoodAnalysis = async (
    audioBlob: Blob,
): Promise<MoodAnalysisResponse> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'conversation.webm');
    const response = await api.post('/voice/mood/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

// ──────────────────────────────────────────────────────────────────────────────
// Reports API
// ──────────────────────────────────────────────────────────────────────────────

export const getWeeklyReport = async () => {
    const response = await api.get('/reports/weekly');
    return response.data;
};

export const generateWeeklyReport = async (forceRegenerate: boolean = true) => {
    const response = await api.get('/reports/weekly', {
        params: { force_regenerate: forceRegenerate },
    });
    return response.data;
};

export const getWeeklyReportHtml = async (weekStart?: string) => {
    const response = await api.get('/reports/weekly/html', {
        params: weekStart ? { week_start: weekStart } : {},
        responseType: 'text',
    });
    return response.data;
};

export const getWeeklyReportsList = async (limit: number = 10) => {
    const response = await api.get('/reports/weekly/list', { params: { limit } });
    return response.data;
};

export const deleteWeeklyReport = async (reportId: string) => {
    const response = await api.delete(`/reports/weekly/${reportId}`);
    return response.data;
};

// ──────────────────────────────────────────────────────────────────────────────
// Engagement API
// ──────────────────────────────────────────────────────────────────────────────

export const getStreak = async (): Promise<StreakData> => {
    const response = await api.get('/engagement/streak');
    return response.data;
};

export const dailyCheckIn = async () => {
    const response = await api.post('/engagement/check-in');
    return response.data;
};

export const getDashboard = async (): Promise<DashboardData> => {
    const response = await api.get('/engagement/dashboard');
    return response.data;
};

export const getDailyInsight = async (): Promise<DailyInsight> => {
    const response = await api.get('/engagement/insights/daily');
    return response.data;
};

export const getMoodHistoryChart = async (days: number = 7): Promise<MoodChartData[]> => {
    const response = await api.get('/engagement/mood/history', { params: { days } });
    return response.data;
};

export const getMoodSummary = async (): Promise<MoodSummary> => {
    const response = await api.get('/engagement/mood/summary');
    return response.data;
};

export const getPreferences = async (): Promise<UserPreferences> => {
    const response = await api.get('/engagement/preferences');
    return response.data;
};

export const updatePreferences = async (prefs: Partial<UserPreferences>): Promise<UserPreferences> => {
    const response = await api.put('/engagement/preferences', prefs);
    return response.data;
};

export default api;