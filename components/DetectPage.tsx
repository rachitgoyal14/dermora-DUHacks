'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import Webcam from 'react-webcam';
import { Capacitor } from '@capacitor/core';
import {
    Camera as CapCamera,
    CameraResultType,
    CameraSource,
    CameraDirection
  } from '@capacitor/camera';

import { motion, AnimatePresence } from 'framer-motion';
import { 
    Camera, Upload, RefreshCw, AlertCircle, CheckCircle, FileText, X, 
    History, ArrowLeftRight, Trash, RotateCcw, Search, Check, 
    TrendingUp, TrendingDown, Minus, ChevronDown, Sparkles 
} from 'lucide-react';
import BottomNav from './BottomNav';
import { useBackendAuth } from '../contexts/AuthContext';
import { 
    uploadSkinImage, getImprovementTracker, getSkinHistory, 
    analyzeExisting, compareImages, deleteImage, refreshImprovement, getMySkinImages 
} from '../services/api';

const isNative = Capacitor.isNativePlatform();
// const BACKEND_URL = "http://localhost:8000";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Skeleton Pulse Component
const SkeletonPulse: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => (
    <div 
        className={`animate-shimmer bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] rounded ${className}`}
        style={style}
    />
);

// Detect Page Skeleton
const DetectPageSkeleton: React.FC = () => (
    <div className="min-h-screen w-full bg-[#FFF5F5] font-sans text-[#1A1A1A] pb-[110px] relative overflow-x-hidden">
        {/* Shimmer Animation Style */}
        <style>{`
            @keyframes shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
            .animate-shimmer {
                animation: shimmer 1.5s ease-in-out infinite;
            }
        `}</style>

        {/* Decorative Background */}
        <div className="absolute top-[-10%] right-[-20%] w-[400px] h-[400px] bg-[#FFB6C1]/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[10%] left-[-10%] w-[300px] h-[300px] bg-[#8EA7E9]/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header Skeleton */}
        <div className="sticky top-0 bg-[#FFF5F5]/80 backdrop-blur-lg z-40 pt-8 px-6 pb-4 border-b border-gray-200/50">
            <SkeletonPulse className="h-9 w-48 mb-2" />
            <SkeletonPulse className="h-4 w-56" />
        </div>

        <div className="px-6 space-y-6 mt-6">
            {/* Camera Section Skeleton */}
            <div className="relative w-full h-[420px] bg-gray-200 rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
                <SkeletonPulse className="w-full h-full rounded-none" />
                
                {/* Camera Controls Skeleton */}
                <div className="absolute bottom-8 w-full flex justify-center items-center gap-6 z-10 px-6">
                    <SkeletonPulse className="w-14 h-14 rounded-full" />
                    <SkeletonPulse className="w-20 h-20 rounded-full" />
                </div>
            </div>

            {/* Quick Actions Skeleton */}
            <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                    <SkeletonPulse className="w-6 h-6 rounded" />
                    <SkeletonPulse className="h-7 w-36" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((_, index) => (
                        <div 
                            key={index}
                            className="p-6 bg-white rounded-3xl shadow-lg border border-gray-100 flex flex-col items-center gap-3"
                        >
                            <SkeletonPulse className="w-8 h-8 rounded-lg" />
                            <SkeletonPulse className="h-4 w-20" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Progress Tracker Skeleton */}
            <div className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100 mt-6">
                <div className="flex items-center gap-3 mb-6">
                    <SkeletonPulse className="w-7 h-7 rounded" />
                    <SkeletonPulse className="h-7 w-36" />
                </div>
                <div className="space-y-4">
                    {[1, 2, 3].map((_, index) => (
                        <div key={index} className="p-5 rounded-2xl border-2 border-gray-100 bg-gray-50">
                            <div className="flex items-center justify-between mb-3">
                                <SkeletonPulse className="h-5 w-20" />
                                <SkeletonPulse className="h-6 w-24 rounded-full" />
                            </div>
                            <SkeletonPulse className="h-4 w-full mb-2" />
                            <SkeletonPulse className="h-4 w-3/4" />
                        </div>
                    ))}
                </div>
            </div>

            {/* History Section Skeleton */}
            <div className="bg-white rounded-3xl p-6 mt-8 shadow-lg border border-gray-100">
                <div className="w-full flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <SkeletonPulse className="w-7 h-7 rounded" />
                        <SkeletonPulse className="h-7 w-44" />
                    </div>
                    <SkeletonPulse className="w-6 h-6 rounded" />
                </div>
            </div>
        </div>

        <BottomNav />
    </div>
);

interface SkinImage {
    image_id: string;
    image_url: string;
    captured_at: string;
    image_type: string;
}

type ActionMode = 'none' | 'reanalyze' | 'compare' | 'delete';

const DetectPage: React.FC = () => {
    // const { backendUserId, isLoading: authLoading } = useBackendAuth();
    // const { getToken } = useAuth();

    const { getToken, isSignedIn } = useAuth();
    const { user } = useUser();
    const [backendUserId, setBackendUserId] = useState<string | null>(null);
    const syncedRef = useRef(false);

    const isAuthReady = Boolean(backendUserId);
    const webcamRef = useRef<Webcam>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Core states
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    // History & Images
    const [history, setHistory] = useState<any>(null);
    const [userImages, setUserImages] = useState<SkinImage[]>([]);
    const [loadingImages, setLoadingImages] = useState(false);
    const [imagesError, setImagesError] = useState<string | null>(null);
    const [historyExpanded, setHistoryExpanded] = useState(false);
    
    // Actions
    const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
    const [actionMode, setActionMode] = useState<ActionMode>('none');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [actionResult, setActionResult] = useState<any>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    
    // UI States
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);

    // Helper function for image URLs
    // const getImageUrl = (imageUrl: string) => {
    //     if (imageUrl.startsWith('http')) return imageUrl;
    //     const cleanPath = imageUrl.replace(/^\/+/, '');
    //     return `${BACKEND_URL}/${cleanPath}`;
    // };
    const getImageUrl = (imageUrl: string) => {
        if (imageUrl.startsWith('http')) return imageUrl;
        const cleanPath = imageUrl.replace(/^\/+/, '');
        return `${BACKEND_URL}/${cleanPath}?t=${Date.now()}`;
    };
    

    // Fetch user images
    const fetchUserImages = useCallback(async () => {
        if (!isAuthReady) return;

        setLoadingImages(true);
        setImagesError(null);
        try {
            const token = await getToken();
            const images = await getMySkinImages(token, backendUserId);
            setUserImages(images);
        } catch (err) {
            console.error("Failed to fetch user images", err);
            setImagesError("Failed to load images");
        } finally {
            setLoadingImages(false);
        }
    }, [backendUserId, getToken]);

    // Fetch history on mount
    useEffect(() => {
        const fetchHistory = async () => {
            if (!isAuthReady) return;

            try {
                const token = await getToken();
                const data = await getImprovementTracker(token, backendUserId);
                setHistory(data);
            } catch (err) {
                console.error("Failed to fetch history", err);
            }
        };

        if (backendUserId) {
            fetchHistory();
            fetchUserImages();
        }
    }, [isAuthReady, backendUserId, getToken, fetchUserImages]);

    // const capture = useCallback(() => {
    //     if (!isAuthReady) return;  // ← ADD THIS LINE
    //     const imageSrc = webcamRef.current?.getScreenshot();
    //     if (imageSrc) {
    //         setImageSrc(imageSrc);
    //         fetch(imageSrc)
    //             .then(res => res.blob())
    //             .then(blob => {
    //                 const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
    //                 handleAnalysis(file);
    //             });
    //     }
    // }, [webcamRef, isAuthReady]);
    const capture = async () => {
        if (!isAuthReady) return;
      
        try {
          if (isNative) {
            // ANDROID / IOS
            const photo = await CapCamera.getPhoto({
                quality: 90,
                resultType: CameraResultType.Base64,
                source: CameraSource.Camera,
                direction: CameraDirection.Front,
              });
              
              
      
            const base64 = photo.base64String!;
            const blob = await (
              await fetch(`data:image/jpeg;base64,${base64}`)
            ).blob();
      
            const file = new File([blob], "mobile_capture.jpg", {
              type: "image/jpeg",
            });
      
            setImageSrc(`data:image/jpeg;base64,${base64}`);
            handleAnalysis(file);
      
          } else {
            // WEB
            const imageSrc = webcamRef.current?.getScreenshot();
            if (!imageSrc) return;
      
            const blob = await (await fetch(imageSrc)).blob();
            const file = new File([blob], "web_capture.jpg", {
              type: "image/jpeg",
            });
      
            setImageSrc(imageSrc);
            handleAnalysis(file);
          }
        } catch (err) {
          console.error("Camera error", err);
          setError("Camera access failed");
        }
      };
      

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageSrc(reader.result as string);
                handleAnalysis(file);
            };
            reader.readAsDataURL(file);
        }
    };

    // const handleAnalysis = async (file: File) => {
    //     if (!backendUserId) {
    //         setError("User authentication pending. Please wait...");
    //         return;
    //     }

    const handleAnalysis = async (file: File) => {
    if (!isAuthReady) {
        setError("Setting up your account… try again in 1–2 seconds.");
        return;
    }

        setIsAnalyzing(true);
        setError(null);
        setResult(null);

        try {
            const token = await getToken();
            const backendResult = await uploadSkinImage(file, 'progress', token, backendUserId);
            setResult(backendResult);
            
            // Show confetti for high confidence
            if (backendResult.confidence > 0.8) {
                setShowConfetti(true);
                setTimeout(() => setShowConfetti(false), 3000);
            }
            
            showToast("Image uploaded and analyzed successfully!", "success");
            fetchUserImages();
        } catch (err) {
            console.error(err);
            setError("Failed to analyze image. Please try again.");
            showToast("Failed to analyze image", "error");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const reset = () => {
        setImageSrc(null);
        setResult(null);
        setError(null);
    };

    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const openModal = (mode: ActionMode) => {
        setActionMode(mode);
        setSelectedImageIds([]);
        setActionResult(null);
        setActionError(null);
        setIsModalOpen(true);
    };

    // const closeModal = () => {
    //     setIsModalOpen(false);
    //     setActionMode('none');
    //     setSelectedImageIds([]);
    //     setIsProcessing(false);
    // };
    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedImageIds([]);
        setIsProcessing(false);
        // DO NOT reset actionMode here
    };
    

    const toggleImageSelection = (imageId: string) => {
        if (actionMode === 'compare') {
            if (selectedImageIds.includes(imageId)) {
                setSelectedImageIds(selectedImageIds.filter(id => id !== imageId));
            } else if (selectedImageIds.length < 2) {
                setSelectedImageIds([...selectedImageIds, imageId]);
            }
        } else {
            setSelectedImageIds([imageId]);
        }
    };

    const handleConfirmAction = async () => {
        const currentMode = actionMode;
        

        if (!backendUserId) return;

        setActionError(null);
        setActionResult(null);
        setIsProcessing(true);

        try {
            const token = await getToken();

            if (actionMode === 'reanalyze' && selectedImageIds.length === 1) {
                const res = await analyzeExisting(selectedImageIds[0], token, backendUserId);
                setActionResult({
                    ...res,
                    _type: 'reanalyze',
                });
                showToast("Image re-analyzed successfully!", "success");
            } else if (actionMode === 'compare' && selectedImageIds.length === 2) {
                const sortedIds = [...selectedImageIds].sort((a, b) => {
                    const imgA = userImages.find(img => img.image_id === a);
                    const imgB = userImages.find(img => img.image_id === b);
                    if (!imgA || !imgB) return 0;
                    return (
                        new Date(imgA.captured_at).getTime() -
                        new Date(imgB.captured_at).getTime()
                    );
                });
            
                const res = await compareImages(
                    sortedIds[0],
                    sortedIds[1],
                    token,
                    backendUserId
                );
            
                setActionResult({
                    ...res,
                    _type: 'compare',
                });
            
                showToast("Images compared successfully!", "success");
            }
            else if (actionMode === 'delete' && selectedImageIds.length === 1) {
                const res = await deleteImage(selectedImageIds[0], token, backendUserId);
                setActionResult({
                    ...res,
                    _type: 'delete',
                });
                showToast("Image deleted successfully!", "success");
                fetchUserImages();
            }
            closeModal();
        } catch (err) {
            console.error(err);
            setActionError(`Failed to ${actionMode} image(s).`);
            showToast(`Failed to ${actionMode} image(s)`, "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRefresh = async () => {
        if (!backendUserId) return;

        try {
            const token = await getToken();
            const res = await refreshImprovement(token, backendUserId);
            showToast("Improvement data refreshed!", "success");
            const data = await getImprovementTracker(token, backendUserId);
            setHistory(data);
        } catch (err) {
            console.error(err);
            showToast("Failed to refresh", "error");
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const isConfirmDisabled = () => {
        if (actionMode === 'reanalyze' || actionMode === 'delete') {
            return selectedImageIds.length !== 1;
        }
        if (actionMode === 'compare') {
            return selectedImageIds.length !== 2;
        }
        return true;
    };

    const getTrendIcon = (trend: string) => {
        if (trend === 'improving') return <TrendingUp className="text-green-500" size={20} />;
        if (trend === 'worsening') return <TrendingDown className="text-red-500" size={20} />;
        return <Minus className="text-gray-400" size={20} />;
    };

    const getTrendColor = (trend: string) => {
        if (trend === 'improving') return 'bg-gradient-to-br from-green-50 to-green-100 border-green-200 text-green-700';
        if (trend === 'worsening') return 'bg-gradient-to-br from-red-50 to-red-100 border-red-200 text-red-700';
        return 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200 text-gray-700';
    };
    

    /* ================= SYNC USER ================= */
useEffect(() => {
  if (!isSignedIn || !user || syncedRef.current) return;

  const syncUser = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/auth/sync-user`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
        },
        });

      const data = await res.json();
      if (data.uuid) {
        setBackendUserId(data.uuid);
        syncedRef.current = true;
      }
    } catch (e) {
      console.error("User sync failed", e);
    }
  };

  syncUser();
}, [isSignedIn, user, getToken]);

    // Show skeleton while loading
    if (!backendUserId) {
        return <DetectPageSkeleton />;
    }

    return (
        <div className="min-h-screen w-full bg-[#FFF5F5] font-sans text-[#1A1A1A] pb-[110px] relative overflow-x-hidden">
            {/* Decorative Background */}
            <div className="absolute top-[-10%] right-[-20%] w-[400px] h-[400px] bg-[#FFB6C1]/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-[10%] left-[-10%] w-[300px] h-[300px] bg-[#8EA7E9]/20 rounded-full blur-3xl pointer-events-none" />

            {/* Confetti Effect */}
            <AnimatePresence>
                {showConfetti && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 pointer-events-none z-50"
                    >
                        {[...Array(30)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{ 
                                    x: Math.random() * window.innerWidth, 
                                    y: -20,
                                    rotate: 0 
                                }}
                                animate={{ 
                                    y: window.innerHeight + 20,
                                    rotate: 360,
                                    x: Math.random() * window.innerWidth
                                }}
                                transition={{ 
                                    duration: 2 + Math.random() * 2,
                                    ease: "linear"
                                }}
                                className={`absolute w-2 h-2 ${
                                    ['bg-[#FFB6C1]', 'bg-[#8EA7E9]', 'bg-[#FFA07A]', 'bg-[#66BB6A]'][Math.floor(Math.random() * 4)]
                                } rounded-full`}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toast Notification */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -50, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 ${
                            toast.type === 'success' 
                                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' 
                                : 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                        }`}
                    >
                        {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                        <span className="font-semibold">{toast.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="sticky top-0 bg-[#FFF5F5]/80 backdrop-blur-lg z-40 pt-8 px-6 pb-4 border-b border-gray-200/50">
                <h1 className="font-bold text-3xl text-[#1A1A1A] mb-1">Skin Analysis</h1>
                <p className="text-gray-600 text-sm">Track your skin health journey</p>
            </div>

            <div className="px-6 space-y-6 mt-6">
                {/* Camera/Image Section */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative w-full h-[420px] bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-white"
                >
                    <AnimatePresence mode="wait">
                        {!imageSrc ? (
                            <motion.div
                                key="webcam"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="w-full h-full relative"
                            >
                                {/* <Webcam
                                    audio={false}
                                    ref={webcamRef}
                                    screenshotFormat="image/jpeg"
                                    videoConstraints={{ facingMode: "user" }}
                                    className="w-full h-full object-cover"
                                /> */}
{!imageSrc && (
  <>
    {/* WEB LIVE CAMERA */}
    {!isNative && (
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        videoConstraints={{ facingMode: "user" }}
        className="w-full h-full object-cover"
      />
    )}

    {/* ANDROID / IOS CAMERA PLACEHOLDER */}
    {isNative && (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white">
        <Camera size={64} className="mb-4 opacity-80" />
        <p className="text-sm opacity-70">
          Tap the shutter button to open camera
        </p>
      </div>
    )}
  </>
)}


                                {/* Camera Controls */}
                                <div className="absolute bottom-8 w-full flex justify-center items-center gap-6 z-10 px-6">
                                    {/* Upload Button */}
                                    <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-4 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition-all shadow-lg"
                                    >
                                        <Upload size={24} />
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleFileUpload}
                                        />
                                    </motion.button>

                                    {/* Capture Button */}
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={capture}
                                        className="relative w-20 h-20 rounded-full bg-white shadow-2xl flex items-center justify-center"
                                    >
                                        <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-pink-500 rounded-full" />
                                        <div className="absolute inset-0 rounded-full border-4 border-white" />
                                    </motion.button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="preview"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="w-full h-full relative"
                            >
                                <img src={imageSrc || "/placeholder.svg"} alt="Captured" className="w-full h-full object-cover" />
                                
                                {/* Analyzing Overlay */}
                                {isAnalyzing && (
                                    <motion.div 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white"
                                    >
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                        >
                                            <Sparkles className="mb-4" size={48} />
                                        </motion.div>
                                        <motion.p 
                                            animate={{ opacity: [0.5, 1, 0.5] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                            className="font-semibold text-lg"
                                        >
                                            Analyzing your skin...
                                        </motion.p>
                                        <p className="text-sm text-gray-300 mt-2">This may take a moment</p>
                                    </motion.div>
                                )}

                                {/* Close Button */}
                                {!isAnalyzing && (
                                    <motion.button
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={reset}
                                        className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md text-white rounded-full hover:bg-black/70 transition-all shadow-lg"
                                    >
                                        <X size={20} />
                                    </motion.button>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Analysis Result Card */}
                <AnimatePresence>
                    {result && (
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                            className="bg-white rounded-3xl p-6 shadow-xl border-2 border-green-200"
                        >
                            {/* Success Header with Glow */}
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center gap-3 mb-6"
                            >
                                <motion.div
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 0.5, repeat: 3 }}
                                >
                                    <CheckCircle className="text-green-500" size={32} />
                                </motion.div>
                                <h2 className="text-2xl font-bold text-gray-800">Analysis Complete</h2>
                            </motion.div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <motion.div 
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 border border-blue-200"
                                >
                                    <p className="text-xs text-gray-600 uppercase tracking-wide mb-1 font-semibold">Condition</p>
                                    <p className="font-bold text-xl text-gray-900 capitalize">{result.prediction}</p>
                                </motion.div>
                                <motion.div 
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-4 border border-purple-200"
                                >
                                    <p className="text-xs text-gray-600 uppercase tracking-wide mb-1 font-semibold">Confidence</p>
                                    <p className="font-bold text-xl text-gray-900">{(result.confidence * 100).toFixed(1)}%</p>
                                </motion.div>
                            </div>

                            {/* Message */}
                            <motion.p 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="text-sm text-gray-600 leading-relaxed mb-4 p-4 bg-gray-50 rounded-xl"
                            >
                                {result.message}
                            </motion.p>

                            {/* Action Button */}
                            <motion.button 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="w-full py-3 bg-[#1A1A1A] text-white rounded-2xl font-semibold hover:bg-gray-800 transition-all flex items-center justify-center gap-2 shadow-lg"
                            >
                                <FileText size={18} />
                                View Full Report
                            </motion.button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Error Display */}
                {error && (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 border border-red-200 shadow-lg"
                    >
                        <AlertCircle size={20} />
                        <span className="text-sm font-medium">{error}</span>
                    </motion.div>
                )}

                {/* Quick Actions Grid */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-8"
                >
                    <h2 className="text-2xl font-bold text-[#1A1A1A] mb-4 flex items-center gap-2">
                        <Sparkles className="text-[#FFA07A]" size={24} />
                        Quick Actions
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { icon: Search, label: 'Re-Analyze', color: 'purple', mode: 'reanalyze' as ActionMode },
                            { icon: ArrowLeftRight, label: 'Compare', color: 'orange', mode: 'compare' as ActionMode },
                            { icon: Trash, label: 'Delete', color: 'red', mode: 'delete' as ActionMode },
                            { icon: RotateCcw, label: 'Refresh', color: 'green', mode: 'none' as ActionMode }
                        ].map((action, index) => (
                            <motion.button
                                key={action.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * index }}
                                whileHover={{ scale: 1.05, y: -4 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => action.mode === 'none' ? handleRefresh() : openModal(action.mode)}
                                className="p-6 bg-white rounded-3xl shadow-lg border border-gray-100 hover:shadow-2xl transition-all flex flex-col items-center gap-3"
                            >
                                <action.icon className={`text-${action.color}-500`} size={32} />
                                <span className="text-sm font-bold text-gray-800">{action.label}</span>
                            </motion.button>
                        ))}
                    </div>
                </motion.div>

                {/* Improvement Tracker */}
                {history && history.weekly_improvements && history.weekly_improvements.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100 mt-6"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <TrendingUp className="text-[#8EA7E9]" size={28} />
                            <h2 className="text-2xl font-bold text-gray-800">Your Progress</h2>
                        </div>

                        <div className="space-y-4">
                            {history.weekly_improvements.map((week: any, index: number) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.05 * index }}
                                    className={`p-5 rounded-2xl border-2 ${getTrendColor(week.trend)} transition-all hover:shadow-lg`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="font-bold text-lg">Week {week.week_number}</span>
                                        <div className="flex items-center gap-2 px-3 py-1 bg-white/50 rounded-full">
                                            {getTrendIcon(week.trend)}
                                            <span className="text-sm font-semibold capitalize">{week.trend}</span>
                                        </div>
                                    </div>
                                    <p className="text-sm leading-relaxed">{week.summary}</p>
                                    {week.confidence_change && (
                                        <p className="text-xs mt-2 font-medium">
                                            Change: {(week.confidence_change * 100).toFixed(1)}%
                                        </p>
                                    )}
                                </motion.div>
                            ))}
                        </div>

                        {/* Overall Trend */}
                        {history.overall_trend && (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className={`mt-6 p-5 rounded-2xl border-2 ${getTrendColor(history.overall_trend)}`}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    {getTrendIcon(history.overall_trend)}
                                    <span className="font-bold text-lg">
                                        Overall: <span className="capitalize">{history.overall_trend}</span>
                                    </span>
                                </div>
                                {history.summary && <p className="text-sm">{history.summary}</p>}
                            </motion.div>
                        )}
                    </motion.div>
                )}

                {/* Masked Image History */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl p-6 mt-8 shadow-lg border border-gray-100"
                >
                    <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setHistoryExpanded(!historyExpanded)}
                        className="w-full flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <History size={28} className="text-[#8EA7E9]" />
                            <h3 className="font-bold text-2xl text-gray-800">Your Skin History</h3>
                        </div>
                        <motion.div
                            animate={{ rotate: historyExpanded ? 180 : 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <ChevronDown size={24} className="text-gray-600" />
                        </motion.div>
                    </motion.button>

                    <AnimatePresence>
                        {historyExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.4, ease: 'easeInOut' }}
                                className="overflow-hidden mt-6"
                            >
                                {loadingImages && (
                                    <div className="flex justify-center items-center py-12">
                                        <RefreshCw className="animate-spin text-gray-400" size={32} />
                                    </div>
                                )}

                                {imagesError && (
                                    <div className="p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-2 border border-red-100">
                                        <AlertCircle size={20} />
                                        <span className="text-sm font-medium">{imagesError}</span>
                                    </div>
                                )}

                                {!loadingImages && !imagesError && userImages.length === 0 && (
                                    <div className="bg-gray-50 rounded-2xl p-12 text-center">
                                        <Camera className="mx-auto mb-4 text-gray-300" size={48} />
                                        <p className="text-gray-600 font-medium">No images yet—upload your first one!</p>
                                    </div>
                                )}

                                {!loadingImages && !imagesError && userImages.length > 0 && (
                                    <div className="grid grid-cols-3 gap-3">
                                        {userImages.map((img, index) => (
                                            <motion.div
                                                key={img.image_id}
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: 0.05 * index }}
                                                whileHover={{ scale: 1.05, y: -4 }}
                                                className="bg-gray-50 rounded-2xl overflow-hidden shadow-md border border-gray-200 cursor-pointer"
                                            >
                                                <div className="aspect-square relative">
                                                    <img
                                                        src={getImageUrl(img.image_url) || "/placeholder.svg"}
                                                        alt={`Skin ${img.image_type}`}
                                                        className="w-full h-full object-cover"
                                                        loading="lazy"
                                                    />
                                                </div>
                                                <div className="p-2">
                                                    <p className="text-xs text-gray-500">{formatDate(img.captured_at)}</p>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                {/* Action Results */}
                {actionResult && (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-3xl p-6 shadow-lg border border-gray-100 mt-6"
  >
    {/* RE-ANALYZE */}
    {actionResult._type === 'reanalyze' && (
      <>
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="text-green-500" size={28} />
          <h2 className="text-xl font-bold text-gray-800">Re-Analysis Complete</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-4 bg-blue-50 rounded-2xl">
            <p className="text-xs uppercase font-semibold">Prediction</p>
            <p className="font-bold text-lg capitalize">
              {actionResult.prediction}
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-2xl">
            <p className="text-xs uppercase font-semibold">Confidence</p>
            <p className="font-bold text-lg">
              {(actionResult.confidence * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {actionResult.message && (
          <p className="text-sm text-gray-600">{actionResult.message}</p>
        )}
      </>
    )}

    {/* COMPARE */}

{actionResult._type === 'compare' && (
  <>
    <div className="flex items-center gap-3 mb-6">
      <ArrowLeftRight className="text-orange-500" size={28} />
      <h2 className="text-xl font-bold text-gray-800">
        Comparison Result
      </h2>
    </div>

    {/* Images */}
    <div className="grid grid-cols-2 gap-4 mb-6">
      <img
        src={getImageUrl(actionResult.before_image.image_url) || "/placeholder.svg"}
        className="rounded-2xl"
      />
      <img
        src={getImageUrl(actionResult.after_image.image_url) || "/placeholder.svg"}
        className="rounded-2xl"
      />
    </div>

    {/* SUMMARY */}
    <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4">
      <p className="text-xs uppercase font-semibold text-orange-600 mb-1">
        Analysis Summary
      </p>
      <p className="text-sm text-gray-700">
        {actionResult.summary}
      </p>
    </div>

    {/* METRICS */}
    <div className="grid grid-cols-3 gap-3 text-center">
      <div className="bg-gray-50 rounded-xl p-3">
        <p className="text-xs text-gray-500">Days Between</p>
        <p className="font-bold">{actionResult.days_between}</p>
      </div>

      <div className="bg-gray-50 rounded-xl p-3">
        <p className="text-xs text-gray-500">Confidence Change</p>
        <p className="font-bold">
          {(actionResult.confidence_change * 100).toFixed(3)}%
        </p>
      </div>

      <div
        className={`rounded-xl p-3 ${
          actionResult.improvement_detected
            ? 'bg-green-50 text-green-700'
            : 'bg-yellow-50 text-yellow-700'
        }`}
      >
        <p className="text-xs">Trend</p>
        <p className="font-bold">
          {actionResult.improvement_detected ? 'Improved' : 'Stable'}
        </p>
      </div>
    </div>
  </>
)}


    {/* DELETE */}
    {actionResult._type === 'delete' && (
      <>
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="text-green-500" size={28} />
          <h2 className="text-xl font-bold text-gray-800">Image Deleted</h2>
        </div>
        <p className="text-sm text-gray-600">
          {actionResult.message || 'Image successfully removed.'}
        </p>
      </>
    )}
  </motion.div>
)}

            </div>

            {/* Selection Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
                        onClick={closeModal}
                    >
                        <motion.div
                            initial={{ y: '100%', opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-white w-full md:w-[90%] md:max-w-4xl rounded-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-[#FFB6C1]/10 to-[#8EA7E9]/10">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-800">
                                        {actionMode === 'reanalyze' && 'Select Image to Re-Analyze'}
                                        {actionMode === 'compare' && 'Select 2 Images to Compare'}
                                        {actionMode === 'delete' && 'Select Image to Delete'}
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-1 font-medium">
                                        {actionMode === 'compare' && selectedImageIds.length === 2 && 'Ready to compare'}
                                        {actionMode === 'compare' && selectedImageIds.length < 2 && `${selectedImageIds.length}/2 selected`}
                                        {actionMode !== 'compare' && selectedImageIds.length > 0 && 'Image selected'}
                                        {selectedImageIds.length === 0 && 'Tap to select'}
                                    </p>
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.1, rotate: 90 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={closeModal}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                    disabled={isProcessing}
                                >
                                    <X size={24} />
                                </motion.button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {userImages.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Camera className="mx-auto mb-4 text-gray-300" size={48} />
                                        <p className="text-gray-600 font-medium">No images available</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {userImages.map((img, index) => {
                                            const isSelected = selectedImageIds.includes(img.image_id);
                                            return (
                                                <motion.div
                                                    key={img.image_id}
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: 0.05 * index }}
                                                    whileHover={{ scale: isProcessing ? 1 : 1.05 }}
                                                    whileTap={{ scale: isProcessing ? 1 : 0.95 }}
                                                    onClick={() => !isProcessing && toggleImageSelection(img.image_id)}
                                                    className={`bg-white rounded-2xl overflow-hidden cursor-pointer transition-all ${
                                                        isSelected
                                                            ? 'ring-4 ring-blue-500 shadow-2xl'
                                                            : 'ring-2 ring-gray-200 hover:ring-gray-300'
                                                    } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    <div className="aspect-square relative">
                                                        <img
                                                            src={getImageUrl(img.image_url) || "/placeholder.svg"}
                                                            alt={`Skin ${img.image_type}`}
                                                            className="w-full h-full object-cover"
                                                        />
                                                        {isSelected && (
                                                            <motion.div
                                                                initial={{ opacity: 0, scale: 0.5 }}
                                                                animate={{ opacity: 1, scale: 1 }}
                                                                className="absolute inset-0 bg-blue-500/20 flex items-center justify-center"
                                                            >
                                                                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                                                                    <Check className="text-white" size={24} />
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </div>
                                                    <div className="p-3 bg-gray-50">
                                                        <p className="text-xs text-gray-500 mb-1">{formatDate(img.captured_at)}</p>
                                                        <p className="text-sm font-semibold text-gray-800 capitalize">{img.image_type}</p>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-gray-200 flex gap-3 bg-gray-50">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={closeModal}
                                    disabled={isProcessing}
                                    className="flex-1 py-3 bg-white text-gray-700 rounded-2xl font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-2 border-gray-200"
                                >
                                    Cancel
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: isConfirmDisabled() || isProcessing ? 1 : 1.02 }}
                                    whileTap={{ scale: isConfirmDisabled() || isProcessing ? 1 : 0.98 }}
                                    onClick={handleConfirmAction}
                                    disabled={isConfirmDisabled() || isProcessing}
                                    className={`flex-1 py-3 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 ${
                                        isConfirmDisabled() || isProcessing
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-lg'
                                    }`}
                                >
                                    {isProcessing && <RefreshCw className="animate-spin" size={18} />}
                                    <span>
                                        {isProcessing ? 'Processing...' : 
                                         actionMode === 'delete' ? 'Delete' :
                                         actionMode === 'compare' ? 'Compare' :
                                         'Re-Analyze'}
                                    </span>
                                </motion.button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {!isModalOpen && <BottomNav />}
        </div>
    );
};

export default DetectPage;
