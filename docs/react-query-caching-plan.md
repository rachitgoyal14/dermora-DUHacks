# Task 6: Frontend Data Caching & Request Optimization (React Query) - Implementation Plan

This document outlines the data-fetching inventory and cache invalidation plan for introducing React Query to Dermora.ai.

## 📋 Part B: Data-Fetching Inventory

| Page/Component | Current Fetch Call(s) | Sequential or Parallel? | Target Query Key(s) |
| :--- | :--- | :--- | :--- |
| **`Home.tsx`** | `getDashboard()`, `getDailyInsight()` | Parallelized via `Promise.all` | `['dashboard']`, `['dailyInsight']` |
| **`InsightsPage.tsx`** | `getDashboard()`, `getMoodSummary()`, `getImprovementTracker()`, `getMoodHistoryChart(days)`, `getWeeklyReportsList(limit)` | Mixed (Parallel dashboard/summary/tracker, followed by sequential history chart and reports list) | `['dashboard']`, `['moodSummary']`, `['improvementTracker']`, `['moodHistoryChart', days]`, `['weeklyReports', limit]` |
| **`DetectPage.tsx`** | `getMySkinImages()`, `getImprovementTracker()` | Parallelized via concurrent `useEffect` calls | `['mySkinImages']`, `['improvementTracker']` |
| **`MindPage.tsx`** | `getMoodQuestions()`, `getVoicePrompt()`, `getMoodSummary()` | Sequential `await` chain | `['moodQuestions']`, `['voicePrompt']`, `['moodSummary']` |
| **`MoodPage.tsx`** | `getMoodQuestions()` | Single fetch | `['moodQuestions']` |
| **`SolacePage.tsx`** | `getVoicePrompt()` | Single fetch | *(EXCLUDED: Unmodified per non-negotiable safety constraints)* |

---

## 🛠️ Invalidation & Mutation Plan (Part D)

Since our backend performs complex diagnostics and generates AI insights/mood summaries, client-side optimistic guesses are not reliable for health/diagnostic features. Instead, we use targeted query invalidation to ensure UI correctness:

1. **Daily Check-In (`Home.tsx`):**
   - On success of `dailyCheckIn()`, invalidate `['dashboard']`.
2. **Image Uploads/Deletes (`DetectPage.tsx`):**
   - On success of `uploadSkinImage()` or `deleteImage()`, invalidate `['mySkinImages']` and `['dashboard']` (since dashboard displays `total_images` and `images_this_week`).
3. **Refresh/Re-analyze (`DetectPage.tsx`):**
   - On success of `refreshImprovement()` or `analyzeExisting()`, invalidate `['improvementTracker']`, `['mySkinImages']`, and `['dashboard']`.
4. **Mood Logs (`MindPage.tsx` / `MoodPage.tsx`):**
   - On success of `logMood()`, invalidate `['moodSummary']`, `['dashboard']` (since dashboard displays `total_mood_logs` and `avg_mood_this_week`), and `['moodHistoryChart']` (so the mood history chart re-renders with the new data points).
5. **Voice Session Recording End (`MindPage.tsx`):**
   - On success of `uploadVoiceForMoodAnalysis()`, invalidate `['moodSummary']`, `['dashboard']`, and `['moodHistoryChart']`.
6. **Weekly Report Generation/Deletion (`InsightsPage.tsx`):**
   - On success of `generateWeeklyReport()` or `deleteWeeklyReport()`, invalidate `['weeklyReports']`.
