'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
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
    TrendingUp, TrendingDown, Minus, ChevronDown
} from 'lucide-react';
import BottomNav from './BottomNav';
import { 
    uploadSkinImage, getSkinHistory, 
    analyzeExisting, compareImages, deleteImage, refreshImprovement
} from '../services/api';
import { useMySkinImages, useImprovementTracker } from '../hooks/queries';
import { queryClient } from '../services/queryClient';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const isNative = Capacitor.isNativePlatform();


// Skeleton Pulse Component
const SkeletonPulse: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => (
    <div 
        className={`animate-shimmer bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] rounded ${className}`}
        style={style}
    />
);

// Detect Page Skeleton
const DetectPageSkeleton: React.FC = () => (
    <div className="min-h-screen w-full bg-bone-50 font-sans text-ink-900 pb-[110px] relative overflow-x-hidden">
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

        {/* Header Skeleton */}
        <div className="sticky top-0 bg-bone-50/80 backdrop-blur-lg z-40 pt-8 px-6 pb-4 border-b border-ink-900/8">
            <SkeletonPulse className="h-9 w-48 mb-2" />
            <SkeletonPulse className="h-4 w-56" />
        </div>

        <div className="px-6 space-y-6 mt-6">
            {/* Camera Section Skeleton */}
            <div className="relative w-full h-[420px] bg-bone-200 rounded-lg overflow-hidden border border-ink-900/8">
                <SkeletonPulse className="w-full h-full rounded-none" />
            </div>

            {/* Quick Actions Skeleton */}
            <div className="mt-8">
                <SkeletonPulse className="h-4 w-36 mb-4" />
                <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((_, index) => (
                        <div 
                            key={index}
                            className="p-6 card-base rounded-lg flex flex-col items-center gap-3"
                        >
                            <SkeletonPulse className="w-8 h-8 rounded" />
                            <SkeletonPulse className="h-4 w-20" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Progress Tracker Skeleton */}
            <div className="card-skin rounded-lg p-6 mt-6">
                <SkeletonPulse className="h-6 w-36 mb-6" />
                <div className="space-y-4">
                    {[1, 2, 3].map((_, index) => (
                        <div key={index} className="p-5 rounded-lg card-base">
                            <SkeletonPulse className="h-5 w-20 mb-3" />
                            <SkeletonPulse className="h-4 w-full mb-2" />
                            <SkeletonPulse className="h-4 w-3/4" />
                        </div>
                    ))}
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

const resizeImage = (file: File, maxDimension = 1024): Promise<File> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxDimension) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    }
                } else {
                    if (height > maxDimension) {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const resizedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            });
                            resolve(resizedFile);
                        } else {
                            resolve(file);
                        }
                    }, 'image/jpeg', 0.85); // 85% quality
                } else {
                    resolve(file);
                }
            };
            img.src = e.target?.result as string;
        };
        reader.readAsDataURL(file);
    });
};

type ActionMode = 'none' | 'reanalyze' | 'compare' | 'delete';

const DetectPage: React.FC = () => {
    const { isAuthenticated } = useAuth();
    const isAuthReady = isAuthenticated;
    const webcamRef = useRef<Webcam>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Core states
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    // History & Images via React Query
    const { data: userImagesData, isLoading: loadingImages, error: imagesErrorObj } = useMySkinImages();
    const { data: historyData } = useImprovementTracker();
    const userImages = userImagesData || [];
    const history = historyData || null;
    const imagesError = imagesErrorObj ? 'Failed to load images' : null;

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
                direction: CameraDirection.Rear,
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
            setError('Setting up your account… try again in 1–2 seconds.');
            return;
        }

        setIsAnalyzing(true);
        setError(null);
        setResult(null);

        try {
            const compressedFile = await resizeImage(file, 1024);
            const backendResult = await uploadSkinImage(compressedFile, 'progress');
            setResult(backendResult);
            showToast('Image uploaded and analyzed successfully!', 'success');
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['mySkinImages'] }),
                queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            ]);
        } catch (err) {
            console.error(err);
            setError('Failed to analyze image. Please try again.');
            showToast('Failed to analyze image', 'error');
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

        setActionError(null);
        setActionResult(null);
        setIsProcessing(true);

        try {
            if (actionMode === 'reanalyze' && selectedImageIds.length === 1) {
                const res = await analyzeExisting(selectedImageIds[0]);
                setActionResult({ ...res, _type: 'reanalyze' });
                showToast('Image re-analyzed successfully!', 'success');
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ['mySkinImages'] }),
                    queryClient.invalidateQueries({ queryKey: ['improvementTracker'] }),
                    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
                ]);
            } else if (actionMode === 'compare' && selectedImageIds.length === 2) {
                const sortedIds = [...selectedImageIds].sort((a, b) => {
                    const imgA = userImages.find(img => img.image_id === a);
                    const imgB = userImages.find(img => img.image_id === b);
                    if (!imgA || !imgB) return 0;
                    return new Date(imgA.captured_at).getTime() - new Date(imgB.captured_at).getTime();
                });
                const res = await compareImages(sortedIds[0], sortedIds[1]);
                setActionResult({ ...res, _type: 'compare' });
                showToast('Images compared successfully!', 'success');
            } else if (actionMode === 'delete' && selectedImageIds.length === 1) {
                const res = await deleteImage(selectedImageIds[0]);
                setActionResult({ ...res, _type: 'delete' });
                showToast('Image deleted successfully!', 'success');
                await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ['mySkinImages'] }),
                    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
                ]);
            }
            closeModal();
        } catch (err) {
            console.error(err);
            setActionError(`Failed to ${actionMode} image(s).`);
            showToast(`Failed to ${actionMode} image(s)`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRefresh = async () => {
        try {
            await refreshImprovement();
            showToast('Improvement data refreshed!', 'success');
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['improvementTracker'] }),
                queryClient.invalidateQueries({ queryKey: ['mySkinImages'] }),
                queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            ]);
        } catch (err) {
            console.error(err);
            showToast('Failed to refresh', 'error');
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
        if (trend === 'improving') return <TrendingUp className="text-moss-600" size={20} />;
        if (trend === 'worsening') return <TrendingDown className="text-amber-600" size={20} />;
        return <Minus className="text-ink-400" size={20} />;
    };

    const getTrendColor = (trend: string) => {
        if (trend === 'improving') return 'bg-moss-50 border-moss-200 text-moss-800';
        if (trend === 'worsening') return 'bg-amber-50 border-amber-200 text-amber-800';
        return 'bg-bone-100 border-ink-200 text-ink-700';
    };
    

    /* ================= LOADING GUARD ================= */
    // (sync-user removed — JWT contains user ID)

    // Show skeleton while loading
    if (!isAuthenticated) {
        return <DetectPageSkeleton />;
    }

    return (
        <div className="min-h-screen w-full bg-bone-50 font-sans text-ink-900 pb-[110px] relative overflow-x-hidden">
            {/* Toast Notification */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -50, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -50, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-full flex items-center gap-3 ${
                            toast.type === 'success' 
                                ? 'bg-moss-500 text-white shadow-md' 
                                : 'bg-amber-500 text-white shadow-md'
                        }`}
                    >
                        {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                        <span className="font-semibold">{toast.message}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="sticky top-0 bg-bone-50/80 backdrop-blur-lg z-40 pt-8 px-6 pb-4 border-b border-ink-900/8">
                <h1 className="font-display text-3xl text-ink-900 mb-1 font-semibold">Skin Analysis</h1>
                <p className="text-ink-700 text-sm">Track your skin health journey</p>
            </div>

            <div className="px-6 space-y-6 mt-6">
                {/* Camera/Image Section */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative w-full h-[420px] bg-black rounded-lg overflow-hidden border border-ink-900/8"
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
        videoConstraints={{ facingMode: { ideal: "environment" } }}
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
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-4 bg-white/90 backdrop-blur-md rounded-full text-ink-900 hover:bg-white transition-all"
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
                                        className="relative w-20 h-20 rounded-full bg-white flex items-center justify-center"
                                    >
                                        <div className="w-16 h-16 bg-clay-500 rounded-full" />
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
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={reset}
                                        className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md text-white rounded-full hover:bg-black/70 transition-all"
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
                            className="card-skin rounded-lg p-6"
                        >
                            {/* Success Header with Glow */}
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex items-center gap-3 mb-6"
                            >
                                <motion.div
                                    animate={{ scale: [1, 1.1, 1] }}
                                    transition={{ duration: 0.5, repeat: 3 }}
                                >
                                    <CheckCircle className="text-moss-500" size={32} />
                                </motion.div>
                                <h2 className="text-2xl font-semibold text-ink-900 font-display">Analysis Complete</h2>
                            </motion.div>

                            {/* Stats Grid - NO RAW NUMBERS */}
                            <div className="grid grid-cols-1 gap-4 mb-6">
                                <motion.div 
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="bg-sage-50 rounded-lg p-4 border border-sage-200"
                                >
                                    <p className="text-xs text-ink-600 uppercase tracking-wide mb-1 font-semibold eyebrow">Condition Detected</p>
                                    <p className="font-semibold text-xl text-ink-900 capitalize">{result.prediction}</p>
                                </motion.div>
                            </div>

                            {/* Message */}
                            <motion.p 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="text-sm text-ink-700 leading-relaxed mb-4 p-4 bg-bone-100 rounded-lg"
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
                                className="btn-primary w-full py-3 rounded-full font-semibold flex items-center justify-center gap-2"
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
                        className="p-4 bg-amber-50 text-amber-800 rounded-lg flex items-center gap-3 border border-amber-200"
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
                    <h2 className="eyebrow text-ink-600 mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {[
                            { icon: Search, label: 'Re-Analyze', mode: 'reanalyze' as ActionMode },
                            { icon: ArrowLeftRight, label: 'Compare', mode: 'compare' as ActionMode },
                            { icon: Trash, label: 'Delete', mode: 'delete' as ActionMode },
                            { icon: RotateCcw, label: 'Refresh', mode: 'none' as ActionMode }
                        ].map((action, index) => (
                            <motion.button
                                key={action.label}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * index }}
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => action.mode === 'none' ? handleRefresh() : openModal(action.mode)}
                                className="p-6 card-base rounded-lg flex flex-col items-center gap-3"
                            >
                                <action.icon className="text-sage-600" size={28} />
                                <span className="text-sm font-semibold text-ink-900">{action.label}</span>
                            </motion.button>
                        ))}
                    </div>
                </motion.div>

                {/* Improvement Tracker */}
                {history && history.weekly_improvements && history.weekly_improvements.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="card-skin rounded-lg p-6 mt-6"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <TrendingUp className="text-sage-600" size={28} />
                            <h2 className="text-2xl font-semibold text-ink-900 font-display">Your Progress</h2>
                        </div>

                        <div className="space-y-4">
                            {history.weekly_improvements.map((week: any, index: number) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.05 * index }}
                                    className={`p-5 rounded-lg border-2 ${getTrendColor(week.trend)} transition-all`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="font-bold text-lg">Week {week.week_number}</span>
                                        <div className="flex items-center gap-2 px-3 py-1 bg-white/50 rounded-full">
                                            {getTrendIcon(week.trend)}
                                            <span className="text-sm font-semibold capitalize">{week.trend}</span>
                                        </div>
                                    </div>
                                    <p className="text-sm leading-relaxed">{week.summary}</p>
                                </motion.div>
                            ))}
                        </div>

                        {/* Overall Trend */}
                        {history.overall_trend && (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className={`mt-6 p-5 rounded-lg border-2 ${getTrendColor(history.overall_trend)}`}
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
                    className="card-base rounded-lg p-6 mt-8"
                >
                    <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setHistoryExpanded(!historyExpanded)}
                        className="w-full flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <History size={28} className="text-sage-600" />
                            <h3 className="font-semibold text-2xl text-ink-900 font-display">Your Skin History</h3>
                        </div>
                        <motion.div
                            animate={{ rotate: historyExpanded ? 180 : 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <ChevronDown size={24} className="text-ink-600" />
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
                                        <RefreshCw className="animate-spin text-ink-400" size={32} />
                                    </div>
                                )}

                                {imagesError && (
                                    <div className="p-4 bg-amber-50 text-amber-800 rounded-lg flex items-center gap-2 border border-amber-200">
                                        <AlertCircle size={20} />
                                        <span className="text-sm font-medium">{imagesError}</span>
                                    </div>
                                )}

                                {!loadingImages && !imagesError && userImages.length === 0 && (
                                    <div className="bg-bone-100 rounded-lg p-12 text-center">
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
                                                whileHover={{ scale: 1.02, y: -2 }}
                                                className="bg-bone-100 rounded-lg overflow-hidden border border-ink-900/8 cursor-pointer"
                                            >
                                                <div className="aspect-square relative">
                                                    <img
                                                        src={getImageUrl(img.image_url) || "/placeholder.svg"}
                                                        alt={`Skin ${img.image_type}`}
                                                        className="duotone-thumbnail w-full h-full object-cover"
                                                        loading="lazy"
                                                    />
                                                </div>
                                                <div className="p-2">
                                                    <p className="text-xs text-ink-600">{formatDate(img.captured_at)}</p>
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
    className="card-skin rounded-lg p-6 mt-6"
  >
    {/* RE-ANALYZE */}
    {actionResult._type === 'reanalyze' && (
      <>
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="text-moss-500" size={28} />
          <h2 className="text-xl font-semibold text-ink-900 font-display">Re-Analysis Complete</h2>
        </div>

        <div className="p-4 bg-blue-50 rounded-2xl mb-4">
          <p className="text-xs uppercase font-semibold text-blue-600 mb-1">Condition Detected</p>
          <p className="font-bold text-lg capitalize text-gray-900">
            {actionResult.prediction}
          </p>
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

    {/* METRICS - SIMPLIFIED, NO RAW PERCENTAGES */}
    <div className="grid grid-cols-2 gap-3 text-center">
      <div className="bg-gray-50 rounded-xl p-3">
        <p className="text-xs text-gray-500">Time Between</p>
        <p className="font-bold">{actionResult.days_between} days</p>
      </div>

      <div
        className={`rounded-xl p-3 ${
          actionResult.improvement_detected
            ? 'bg-green-50 text-green-700'
            : 'bg-gray-50 text-gray-600'
        }`}
      >
        <p className="text-xs">Status</p>
        <p className="font-bold">
          {actionResult.improvement_detected ? '✓ Improving' : 'Stable'}
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
                            className="bg-bone-50 w-full md:w-[90%] md:max-w-4xl rounded-lg max-h-[85vh] overflow-hidden flex flex-col shadow-md"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="p-6 border-b border-ink-900/8 flex items-center justify-between bg-sage-50">
                                <div>
                                    <h2 className="text-2xl font-semibold text-ink-900 font-display">
                                        {actionMode === 'reanalyze' && 'Select Image to Re-Analyze'}
                                        {actionMode === 'compare' && 'Select 2 Images to Compare'}
                                        {actionMode === 'delete' && 'Select Image to Delete'}
                                    </h2>
                                    <p className="text-sm text-ink-600 mt-1 font-medium">
                                        {actionMode === 'compare' && selectedImageIds.length === 2 && 'Ready to compare'}
                                        {actionMode === 'compare' && selectedImageIds.length < 2 && `${selectedImageIds.length}/2 selected`}
                                        {actionMode !== 'compare' && selectedImageIds.length > 0 && 'Image selected'}
                                        {selectedImageIds.length === 0 && 'Tap to select'}
                                    </p>
                                </div>
                                <motion.button
                                    whileHover={{ scale: 1.05, rotate: 90 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={closeModal}
                                    className="p-2 hover:bg-bone-200 rounded-full transition-colors"
                                    disabled={isProcessing}
                                >
                                    <X size={24} />
                                </motion.button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {userImages.length === 0 ? (
                                    <div className="text-center py-12">
                                        <Camera className="mx-auto mb-4 text-ink-300" size={48} />
                                        <p className="text-ink-600 font-medium">No images available</p>
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
                                                    whileHover={{ scale: isProcessing ? 1 : 1.02 }}
                                                    whileTap={{ scale: isProcessing ? 1 : 0.95 }}
                                                    onClick={() => !isProcessing && toggleImageSelection(img.image_id)}
                                                    className={`bg-bone-50 rounded-lg overflow-hidden cursor-pointer transition-all ${
                                                        isSelected
                                                            ? 'ring-2 ring-clay-500'
                                                            : 'ring-1 ring-ink-900/8 hover:ring-ink-900/16'
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
                                                                className="absolute inset-0 bg-clay-500/20 flex items-center justify-center"
                                                            >
                                                                <div className="w-12 h-12 bg-clay-500 rounded-full flex items-center justify-center">
                                                                    <Check className="text-white" size={24} />
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </div>
                                                    <div className="p-3 bg-bone-100">
                                                        <p className="text-xs text-ink-600 mb-1">{formatDate(img.captured_at)}</p>
                                                        <p className="text-sm font-semibold text-ink-900 capitalize">{img.image_type}</p>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="p-6 border-t border-ink-900/8 flex gap-3 bg-bone-100">
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={closeModal}
                                    disabled={isProcessing}
                                    className="flex-1 py-3 bg-bone-50 text-ink-700 rounded-full font-semibold hover:bg-bone-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-ink-900/8"
                                >
                                    Cancel
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: isConfirmDisabled() || isProcessing ? 1 : 1.02 }}
                                    whileTap={{ scale: isConfirmDisabled() || isProcessing ? 1 : 0.98 }}
                                    onClick={handleConfirmAction}
                                    disabled={isConfirmDisabled() || isProcessing}
                                    className={`flex-1 py-3 rounded-full font-semibold transition-all flex items-center justify-center gap-2 ${
                                        isConfirmDisabled() || isProcessing
                                            ? 'bg-ink-200 text-ink-400 cursor-not-allowed'
                                            : 'btn-primary'
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
