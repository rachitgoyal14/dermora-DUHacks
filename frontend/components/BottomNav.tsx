import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

// Updated Icons for 4-tab layout
const HomeIcon = ({ active }: { active: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "2"} strokeLinecap="round" strokeLinejoin="round" className={active ? "text-pastel-orange" : "text-white"}>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
);

const SkinIcon = ({ active }: { active: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={active ? "text-pastel-pink" : "text-white"}>
        <circle cx="12" cy="12" r="10" stroke={active ? "currentColor" : "currentColor"} />
        <path d="M12 16v-4M12 8h.01" stroke={active ? "currentColor" : "currentColor"} />
        <circle cx="12" cy="12" r="3" fill={active ? "currentColor" : "none"} className={active ? "text-pastel-pink" : ""} />
    </svg>
);

const MindIcon = ({ active }: { active: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={active ? "0" : "2"} strokeLinecap="round" strokeLinejoin="round" className={active ? "text-pastel-blue" : "text-white"}>
        <path d="M12 2a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
        <path d="M12 14a5 5 0 0 0 5-5H7a5 5 0 0 0 5 5z" />
        <path d="M8.7 21.3c1.7.8 3.6.8 5.3 0M12 14v7" />
    </svg>
);

const InsightsIcon = ({ active }: { active: boolean }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={active ? "text-pastel-lavender" : "text-white"}>
        <line x1="12" y1="20" x2="12" y2="10" />
        <line x1="18" y1="20" x2="18" y2="4" />
        <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
);

const BottomNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;

    const tabs = [
        { id: 'home', icon: HomeIcon, path: '/home', label: 'Home' },
        { id: 'skin', icon: SkinIcon, path: '/skin', label: 'Skin' },
        { id: 'mind', icon: MindIcon, path: '/mind', label: 'Mind' },
        { id: 'insights', icon: InsightsIcon, path: '/insights', label: 'Insights' },
    ];

    return (
        <div className="fixed bottom-6 left-4 right-4 z-50 flex justify-center">
            <div className="bg-[#1A1A1A] w-full max-w-[380px] h-16 rounded-full flex items-center justify-between px-6 shadow-nav relative">
                {tabs.map((tab) => {
                    const isActive = currentPath === tab.path;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => tab.path && navigate(tab.path)}
                            className="flex flex-col items-center justify-center w-12 h-full relative"
                        >
                            <tab.icon active={isActive} />
                            {isActive && (
                                <motion.div
                                    layoutId="nav-pill"
                                    className="absolute -bottom-1 w-1 h-1 rounded-full bg-white"
                                />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default BottomNav;