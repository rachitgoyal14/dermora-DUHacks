import React from 'react';

// Simple emoji components - no complex animations
export const SadFace = () => <span className="text-4xl">😢</span>;
export const NeutralFace = () => <span className="text-4xl">😐</span>;
export const GoodFace = () => <span className="text-4xl">🙂</span>;
export const HappyFace = () => <span className="text-4xl">😊</span>;

// Alternative emoji sets for variety
export const StressEmojis = {
    High: () => <span className="text-4xl">😰</span>,
    Medium: () => <span className="text-4xl">😟</span>,
    Low: () => <span className="text-4xl">😌</span>,
    None: () => <span className="text-4xl">😎</span>,
};

export const AnxietyEmojis = {
    High: () => <span className="text-4xl">😨</span>,
    Medium: () => <span className="text-4xl">😬</span>,
    Low: () => <span className="text-4xl">🙂</span>,
    None: () => <span className="text-4xl">😌</span>,
};

export const EnergyEmojis = {
    Low: () => <span className="text-4xl">😴</span>,
    Medium: () => <span className="text-4xl">😐</span>,
    Good: () => <span className="text-4xl">😊</span>,
    High: () => <span className="text-4xl">⚡</span>,
};