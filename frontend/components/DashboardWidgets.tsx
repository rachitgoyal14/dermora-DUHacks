import React from 'react';
import { motion } from 'framer-motion';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Icons
const MoonIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
);
const DropletIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
    </svg>
);
const CheckIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);

export const SkinScoreCard: React.FC = () => (
    <div className="col-span-2 w-full h-[220px] bg-gradient-to-br from-skin-ivory via-[#FFF0E6] to-pastel-pink/20 rounded-[2rem] p-6 relative overflow-hidden shadow-sm">
        {/* Background Decor */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-pastel-pink/30 rounded-full blur-2xl transform translate-x-10 -translate-y-10" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-pastel-blue/20 rounded-full blur-2xl" />

        <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-skin-muted text-sm font-medium mb-1">Skin Health</p>
                    <h3 className="font-display text-3xl font-bold text-[#1A1A1A]">Great Condition!</h3>
                </div>
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <DropletIcon />
                </div>
            </div>

            <div className="flex items-end gap-3">
                <span className="font-display text-6xl font-bold text-[#1A1A1A] leading-none">92</span>
                <span className="text-skin-muted font-medium mb-2">/ 100</span>
            </div>

            <div className="flex gap-2 mt-2">
                <div className="px-3 py-1 bg-white rounded-full text-xs font-semibold text-[#1A1A1A] shadow-sm">Hydrated</div>
                <div className="px-3 py-1 bg-white rounded-full text-xs font-semibold text-[#1A1A1A] shadow-sm">Radiant</div>
            </div>
        </div>
    </div>
);

export const RoutineCard: React.FC = () => (
    <div className="col-span-1 w-full h-[180px] bg-[#E8F5E9] rounded-[2rem] p-5 relative overflow-hidden shadow-sm flex flex-col justify-between">
        <div className="absolute -right-4 -top-4 w-20 h-20 bg-[#C8E6C9] rounded-full blur-xl opacity-50" />

        <div>
            <p className="text-skin-muted text-xs font-bold uppercase tracking-wider mb-2">Morning Routine</p>
            <h4 className="font-display text-xl font-bold text-[#1B5E20] leading-tight">Keep it<br />Fresh</h4>
        </div>

        <div className="space-y-2">
            {['Cleanser', 'Vitamin C'].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#A5D6A7] flex items-center justify-center text-white">
                        <CheckIcon />
                    </div>
                    <span className="text-sm font-medium text-[#2E7D32]">{item}</span>
                </div>
            ))}
        </div>
    </div>
);

export const EnvironmentCard: React.FC = () => (
    <div className="col-span-1 w-full h-[180px] bg-[#FFF3E0] rounded-[2rem] p-5 relative overflow-hidden shadow-sm flex flex-col justify-between">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-[#FFE0B2] rounded-full blur-xl opacity-60" />

        <div>
            <p className="text-skin-muted text-xs font-bold uppercase tracking-wider mb-2">Environment</p>
            <h4 className="font-display text-xl font-bold text-[#E65100] leading-tight">UV Index<br />High</h4>
        </div>

        <div className="flex items-center justify-between">
            <span className="text-4xl font-bold text-[#E65100]">7.2</span>
            <div className="w-10 h-10 bg-[#FFCC80] rounded-full flex items-center justify-center text-[#E65100]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
            </div>
        </div>
    </div>
);

export const TrendCard: React.FC = () => (
    <div className="col-span-2 w-full h-[140px] bg-[#F3E5F5] rounded-[2rem] p-6 flex flex-col justify-center relative shadow-sm overflow-hidden">
        <div className="z-10 flex justify-between items-center mb-2">
            <div>
                <p className="text-skin-muted text-sm font-medium">Weekly Progress</p>
                <h4 className="text-2xl font-bold text-[#4A148C]">+12% <span className="text-sm font-normal text-[#6A1B9A]">better than last week</span></h4>
            </div>
        </div>

        {/* Mock Graph Bars */}
        <div className="flex items-end gap-3 h-12 w-full mt-2">
            {[30, 45, 35, 60, 50, 75, 65, 80, 70, 90].map((h, i) => (
                <div key={i} className="flex-1 bg-[#CE93D8] rounded-t-sm opacity-60" style={{ height: `${h}%` }} />
            ))}
        </div>
    </div>
);
