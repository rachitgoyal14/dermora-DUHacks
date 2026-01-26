import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// Base config - NOW USES ENVIRONMENT VARIABLE
const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

// ──────────────────────────────────────────────────────────────────────────────
// Factory to create auth-aware axios instance with X-User-Id header
// Usage in component: const api = createApi(await getToken(), userId);
// ──────────────────────────────────────────────────────────────────────────────
export const createApi = (token?: string, userId?: string): AxiosInstance => {
    const instance = axios.create({
        baseURL: BASE_URL,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(userId && { 'X-User-Id': userId }),
        },
    });

    // Optional: Add response interceptor for common error handling
    instance.interceptors.response.use(
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

    return instance;
};

// ──────────────────────────────────────────────────────────────────────────────
// Default public instance (no token) - use only for truly public endpoints
// ──────────────────────────────────────────────────────────────────────────────
export const api = createApi(); // No auth by default

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
// Engagement Types (NEW)
// ──────────────────────────────────────────────────────────────────────────────

export interface StreakData {
    current_streak: number;
    longest_streak: number;
    last_check_in: string | null;
    can_check_in_today: boolean;
}

export interface DashboardData {
    streak: StreakData;
    quick_stats: {
        images_this_week: number;
        mood_avg_this_week: number | null;
        days_active_this_month: number;
    };
    recent_activity: Array<{
        type: 'skin' | 'mood' | 'voice';
        description: string;
        timestamp: string;
    }>;
}

export interface DailyInsight {
    message: string;
    insight_type: string;
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
// Skin API (requires X-User-Id header)
// ──────────────────────────────────────────────────────────────────────────────

export const getMySkinImages = async (token?: string, userId?: string): Promise<UserSkinImage[]> => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.get('/skin/my-images');
    return response.data;
};

export const uploadSkinImage = async (
    file: File,
    imageType: string = "weekly",
    token?: string,
    userId?: string
): Promise<SkinImageUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const apiInstance = createApi(token, userId);
    const response = await apiInstance.post('/skin/upload', formData, {
        params: { image_type: imageType },
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const analyzeExisting = async (
    imageId: string,
    token?: string,
    userId?: string
) => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.post(`/skin/analyze/${imageId}`);
    return response.data;
};

export const compareImages = async (
    beforeImageId: string,
    afterImageId: string,
    token?: string,
    userId?: string
) => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.post('/skin/compare', {
        before_image_id: beforeImageId,
        after_image_id: afterImageId,
    });
    return response.data;
};

export const getSkinHistory = async (token?: string, userId?: string) => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.get('/skin/progress/comparison');
    return response.data;
};

export const deleteImage = async (imageId: string, token?: string, userId?: string) => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.delete(`/skin/image/${imageId}`);
    return response.data;
};

export const getImprovementTracker = async (token?: string, userId?: string) => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.get('/skin/improvement-tracker');
    return response.data;
};

export const refreshImprovement = async (token?: string, userId?: string) => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.post('/skin/improvement-tracker/refresh');
    return response.data;
};

// ──────────────────────────────────────────────────────────────────────────────
// Mood API (requires X-User-Id header for authenticated endpoints)
// ──────────────────────────────────────────────────────────────────────────────

export const logMood = async (data: MoodLogData, token?: string, userId?: string) => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.post('/mood/log', data);
    return response.data;
};

export const getMoodQuestions = async () => {
    // Public endpoint - no auth required
    const apiInstance = createApi();
    const response = await apiInstance.get('/mood/questions');
    return response.data;
};

export const getMoodHistory = async (limit: number = 30, token?: string, userId?: string): Promise<MoodHistoryResponse> => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.get('/mood/history', {
        params: { limit },
    });
    return response.data;
};

export const deleteMoodLog = async (moodLogId: string, token?: string, userId?: string) => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.delete(`/mood/log/${moodLogId}`);
    return response.data;
};

// ──────────────────────────────────────────────────────────────────────────────
// Voice / Solace API (requires X-User-Id header)
// ──────────────────────────────────────────────────────────────────────────────

export const getVoicePrompt = async (token?: string, userId?: string): Promise<VoicePromptData> => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.get('/voice/prompt');
    return response.data;
};

export const uploadVoiceForMoodAnalysis = async (
    audioBlob: Blob,
    token?: string,
    userId?: string
): Promise<MoodAnalysisResponse> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'conversation.webm');

    const apiInstance = createApi(token, userId);
    const response = await apiInstance.post('/voice/mood/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

// ──────────────────────────────────────────────────────────────────────────────
// Reports API (requires X-User-Id header)
// ──────────────────────────────────────────────────────────────────────────────

export const getWeeklyReport = async (token?: string, userId?: string) => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.get('/reports/weekly');
    return response.data;
};

// Updated generateWeeklyReport function for api.ts
// Handles both successful reports and empty week reports (200 status)

export const generateWeeklyReport = async (
    forceRegenerate: boolean = true, 
    token?: string, 
    userId?: string
) => {
    const apiInstance = createApi(token, userId);
    
    console.group("🔍 generateWeeklyReport DEBUG — " + new Date().toISOString());
    console.log("Backend URL:            ", BASE_URL);
    console.log("Full endpoint:          ", `${BASE_URL}/reports/weekly`);
    console.log("Force regenerate:       ", forceRegenerate);
    console.log("Token present:          ", !!token);
    console.log("User-ID present:        ", !!userId);
    console.log("Headers:", {
        'Authorization': token ? `Bearer ${token.substring(0, 20)}...` : 'MISSING',
        'X-User-Id': userId || 'MISSING'
    });
    console.groupEnd();
    
    try {
        const response = await apiInstance.get('/reports/weekly', {
            params: { force_regenerate: forceRegenerate }
        });
        
        console.log("✅ Report generated successfully:", response.data);
        
        // Check if it's an empty week report
        const isEmptyWeek = response.data.skin_trend === 'insufficient_data' || 
                           response.data.metrics?.total_images_uploaded === 0;
        
        if (isEmptyWeek) {
            console.log("ℹ️ Empty week report - no data for this period");
        }
        
        return response.data;
        
    } catch (error: any) {
        console.error("❌ generateWeeklyReport failed:");
        console.error("Status:", error.response?.status);
        console.error("Status Text:", error.response?.statusText);
        console.error("Error Data:", error.response?.data);
        console.error("Full Error:", error);
        
        // Provide more user-friendly error messages
        let errorMessage = 'Failed to generate report';
        
        if (error.response?.status === 503) {
            errorMessage = 'Report generation service is temporarily unavailable. Please try again later.';
        } else if (error.response?.status === 401) {
            errorMessage = 'Authentication failed. Please log in again.';
        } else if (error.response?.status === 500) {
            errorMessage = 'Server error occurred while generating the report. Please try again.';
        } else if (error.response?.data?.detail) {
            errorMessage = error.response.data.detail;
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        throw new Error(errorMessage);
    }
};

export const getWeeklyReportHtml = async (weekStart?: string, token?: string, userId?: string) => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.get('/reports/weekly/html', {
        params: weekStart ? { week_start: weekStart } : {},
        responseType: 'text',
    });
    return response.data;
};

export const getWeeklyReportsList = async (limit: number = 10, token?: string, userId?: string) => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.get('/reports/weekly/list', {
        params: { limit },
    });
    return response.data;
};

export const deleteWeeklyReport = async (reportId: string, token?: string, userId?: string) => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.delete(`/reports/weekly/${reportId}`);
    return response.data;
};

// ──────────────────────────────────────────────────────────────────────────────
// Engagement API (NEW - requires X-User-Id header)
// ──────────────────────────────────────────────────────────────────────────────

export const getStreak = async (token?: string, userId?: string): Promise<StreakData> => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.get('/engagement/streak');
    return response.data;
};

export const dailyCheckIn = async (token?: string, userId?: string) => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.post('/engagement/check-in');
    return response.data;
};

export const getDashboard = async (token?: string, userId?: string): Promise<DashboardData> => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.get('/engagement/dashboard');
    return response.data;
};

export const getDailyInsight = async (token?: string, userId?: string): Promise<DailyInsight> => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.get('/engagement/insights/daily');
    return response.data;
};

export const getMoodHistoryChart = async (days: number = 7, token?: string, userId?: string): Promise<MoodChartData[]> => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.get('/engagement/mood/history', {
        params: { days },
    });
    return response.data;
};

export const getMoodSummary = async (token?: string, userId?: string): Promise<MoodSummary> => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.get('/engagement/mood/summary');
    return response.data;
};

export const getPreferences = async (token?: string, userId?: string): Promise<UserPreferences> => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.get('/engagement/preferences');
    return response.data;
};

export const updatePreferences = async (prefs: Partial<UserPreferences>, token?: string, userId?: string): Promise<UserPreferences> => {
    const apiInstance = createApi(token, userId);
    const response = await apiInstance.put('/engagement/preferences', prefs);
    return response.data;
};

export default api; // Export default public instance (no auth)