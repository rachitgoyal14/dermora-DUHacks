import React from 'react';
import { motion } from 'framer-motion';

const OrganicLogo: React.FC = () => {
  return (
    <div className="relative w-40 h-40 flex items-center justify-center">
      {/* Outer Glow / Soft Aura */}
      <motion.div
        className="absolute inset-0 rounded-full blur-2xl opacity-60"
        style={{
          background: 'radial-gradient(circle, #F3E8DC 0%, #EFD6D0 100%)',
        }}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.5, 0.7, 0.5],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Main Organic Shape Container */}
      <motion.div
        className="relative w-24 h-24"
        animate={{
          scale: [1, 1.03, 1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        {/* Layer 1: Base Cell */}
        <div className="absolute inset-0 rounded-[40%] bg-gradient-to-tr from-skin-cocoa/30 to-skin-nude/40 blur-sm transform rotate-45" />
        
        {/* Layer 2: Inner Core */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-b from-white/80 to-skin-ivory/50 shadow-inner backdrop-blur-sm border border-white/20" />
        
        {/* Layer 3: Subtle Nucleus */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-skin-nude/10 blur-[1px]" />
      </motion.div>
    </div>
  );
};

export default OrganicLogo;