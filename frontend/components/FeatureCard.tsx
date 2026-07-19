import React from 'react';
import { motion } from 'framer-motion';

interface FeatureCardProps {
  title: string;
  subtitle: string;
  visual: React.ReactNode;
  icon: React.ReactNode;
  index: number;
}
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

const FeatureCard: React.FC<FeatureCardProps> = ({ title, subtitle, visual, icon, index }) => {
  return (
    <motion.div
      className="w-full bg-white/60 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-card mb-4 relative overflow-hidden"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ 
        duration: 0.6, 
        delay: index * 0.1,
        ease: [0.21, 0.47, 0.32, 0.98] 
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-6 z-10 relative">
        <div>
          <h3 className="font-display font-semibold text-xl text-skin-text">{title}</h3>
          <p className="text-skin-muted text-sm mt-1">{subtitle}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-skin-ivory flex items-center justify-center text-skin-text/70">
          {icon}
        </div>
      </div>

      {/* Visual Container */}
      <div className="relative w-full h-32 rounded-2xl bg-gradient-to-b from-skin-ivory/50 to-white/50 overflow-hidden flex items-center justify-center">
        {visual}
      </div>
    </motion.div>
  );
};

export default FeatureCard;