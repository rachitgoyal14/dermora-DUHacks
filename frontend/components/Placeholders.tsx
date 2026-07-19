import React from 'react';
import BottomNav from './BottomNav';

export const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => (
    <div className="min-h-screen w-full bg-[#FFF5F5] font-sans text-skin-text flex flex-col items-center justify-center pb-24">
        <h1 className="font-display text-4xl font-bold text-[#1A1A1A] mb-4">{title}</h1>
        <p className="text-skin-muted">Coming Soon</p>
        <BottomNav />
    </div>
);
