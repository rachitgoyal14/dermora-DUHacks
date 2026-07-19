import React from 'react';
import { motion } from 'framer-motion';
import { ScanIcon, DropIcon, FileTextIcon } from './icons/AppIcons';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const FloatingDot: React.FC<{
  icon: React.ReactNode;
  x: string;
  y: string;
  delay: number;
}> = ({ icon, x, y, delay }) => (
  <motion.div
    className="absolute w-12 h-12 rounded-full bg-white/40 backdrop-blur-md shadow-soft flex items-center justify-center border border-white/50 text-skin-text/80 z-20"
    style={{ left: x, top: y }}
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{
      type: "spring",
      stiffness: 260,
      damping: 20,
      delay: delay
    }}
    whileHover={{ scale: 1.1 }}
  >
    <div className="w-5 h-5">
      {icon}
    </div>
  </motion.div>
);

const SkinLayersVisual: React.FC<{ size?: 'sm' | 'lg'; variant?: 'organic' | 'clean' }> = ({ size = 'lg', variant = 'organic' }) => {
  const isSmall = size === 'sm';
  const isClean = variant === 'clean';

  // Adjust container size based on prop
  const containerSize = isSmall ? "w-[320px] h-[320px]" : "w-full max-w-[500px] h-[500px]";
  const paddingClass = isSmall ? "p-4" : "";

  if (isClean) {
    // Render the concentric "clean" look (Image 3)
    // Reduced height for clean variant to avoid pushing content too far
    return (
      <div className={`relative flex items-center justify-center overflow-visible ${isSmall ? 'w-full h-auto py-8' : 'w-full h-[350px]'}`}>
        <motion.div
          className={`relative w-[320px] h-[320px] flex items-center justify-center`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
        >
          {/* Outer Ring - Faint */}
          <motion.div
            className="absolute w-[90%] h-[90%] rounded-full bg-gradient-to-tr from-skin-ivory to-pastel-pink opacity-40 blur-xl"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Middle Ring - The Main Color (Pink/Lavender) */}
          <motion.div
            className="absolute w-[65%] h-[65%] rounded-full bg-gradient-to-br from-pastel-pink via-skin-nude to-pastel-lavender opacity-80 shadow-soft"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Inner Ring - Highlights */}
          <motion.div
            className="absolute w-[35%] h-[35%] rounded-full bg-gradient-to-b from-white to-white/60 blur-sm border border-white/50"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Center Dot - Focus */}
          <motion.div
            className="absolute w-[15%] h-[15%] rounded-full bg-white opacity-90 blur-[1px]"
            animate={{ opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
    );
  }

  // Organic Variant
  return (
    <div className={`relative flex items-center justify-center overflow-visible ${isSmall ? 'w-full h-auto py-8' : 'w-full h-[550px]'}`}>
      <motion.div
        className={`relative ${containerSize} ${paddingClass}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{
          opacity: 1,
          scale: [1, 1.05, 0.98, 1.02, 1],
        }}
        transition={{
          duration: 1,
          scale: {
            duration: 8,
            repeat: Infinity,
            repeatType: "mirror",
            ease: "easeInOut"
          }
        }}
      >
        {/* Layer 3 - Deep Background (Lavender/Pink) */}
        <motion.div
          className={`absolute ${isSmall ? 'right-[-10px] top-[10px]' : 'right-[-20px] top-[40px]'} ${isSmall ? 'w-[240px] h-[280px]' : 'w-[380px] h-[440px]'} rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-gradient-to-br from-pastel-lavender to-pastel-pink opacity-80 filter blur-3xl`}
          animate={{
            borderRadius: [
              "40% 60% 70% 30% / 40% 50% 60% 50%",
              "60% 40% 30% 70% / 60% 30% 70% 40%",
              "40% 60% 70% 30% / 40% 50% 60% 50%"
            ],
            scale: [1, 1.1, 0.95, 1]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Layer 2 - Mid (Peach/Orange) */}
        <motion.div
          className={`absolute ${isSmall ? 'right-[0px] top-[5px]' : 'right-[0px] top-[20px]'} ${isSmall ? 'w-[260px] h-[300px]' : 'w-[420px] h-[480px]'} rounded-[60%_40%_30%_70%/60%_30%_70%_40%] bg-gradient-to-tr from-pastel-orange via-skin-nude to-pastel-pink opacity-90 shadow-soft`}
          animate={{
            scale: [1, 1.05, 0.98, 1],
            rotate: [0, 2, -1, 0],
            borderRadius: [
              "60% 40% 30% 70% / 60% 30% 70% 40%",
              "50% 50% 40% 60% / 50% 40% 60% 50%",
              "60% 40% 30% 70% / 60% 30% 70% 40%"
            ]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Subtle Texture */}
          <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAiLz48L3N2Zz4=')] bg-[length:12px_12px]" />
        </motion.div>

        {/* Layer 1 - Epidermis (Highlight) */}
        <motion.div
          className={`absolute ${isSmall ? 'right-[10px] top-[0px]' : 'right-[20px] top-[0px]'} ${isSmall ? 'w-[220px] h-[260px]' : 'w-[360px] h-[420px]'} rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-gradient-to-b from-white/60 to-transparent backdrop-blur-[2px] border border-white/30`}
          style={{
            clipPath: "ellipse(80% 90% at 80% 20%)"
          }}
          animate={{
            scale: [1, 1.02, 0.98, 1],
            translateY: [0, -5, 0]
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Floating Icons - Only show on Large? Or scale them? Let's hide on small to keep it clean */}
        {!isSmall && (
          <>
            <FloatingDot icon={<ScanIcon />} x="15%" y="25%" delay={1.2} />
            <FloatingDot icon={<DropIcon />} x="85%" y="45%" delay={1.4} />
            <FloatingDot icon={<FileTextIcon />} x="25%" y="65%" delay={1.6} />
          </>
        )}
      </motion.div>
    </div>
  );
};

export default SkinLayersVisual;