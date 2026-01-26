import { SignUp } from '@clerk/clerk-react';
import React from 'react';
import SkinLayersVisual from './SkinLayersVisual';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const SignUpPage: React.FC = () => {
    return (
        <div className="fixed inset-0 w-full h-full bg-[#FFF5F5] font-sans text-skin-text flex flex-col justify-between overflow-hidden">
            {/* Top Section: Visual & Logo */}
            <div className="flex-1 w-full flex items-center justify-center relative min-h-[40%]">
                <h1 className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 font-display text-5xl font-bold tracking-tight text-[#1A1A1A] z-30 whitespace-nowrap">
                    Dermora.ai
                </h1>
                <div className="w-full max-w-[400px] aspect-square flex items-center justify-center relative z-0">
                    <div className="transform scale-110 opacity-100">
                        <SkinLayersVisual size="lg" variant="clean" />
                    </div>
                </div>
            </div>

            {/* Bottom Section: Clerk SignUp */}
            <div className="w-full bg-white rounded-t-[3rem] shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.05)] px-8 pt-10 pb-12 flex flex-col items-center gap-6 z-20 min-h-[50%]">
                <SignUp
                    appearance={{
                        elements: {
                            rootBox: "w-full",
                            card: "shadow-none w-full bg-transparent p-0",
                            headerTitle: "text-[#1A1A1A] font-display font-bold text-2xl",
                            headerSubtitle: "text-[#5f6368]",
                            socialButtonsBlockButton: "w-full bg-white border border-gray-200 text-[#1f1f1f] hover:bg-gray-50 font-medium py-3 rounded-xl",
                            socialButtonsBlockButtonText: "font-medium",
                            dividerLine: "bg-gray-200",
                            dividerText: "text-gray-400 bg-transparent",
                            formFieldLabel: "text-gray-700 font-medium",
                            formFieldInput: "w-full bg-gray-50 border border-gray-200 rounded-xl focus:ring-black focus:border-black transition-all",
                            formButtonPrimary: "w-full bg-black text-white hover:bg-gray-900 py-3 rounded-full text-lg font-medium shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99]",
                            footerAction: "hidden",
                            identityPreviewText: "text-gray-700",
                            formFieldAction: "text-black hover:underline"
                        },
                        layout: {
                            socialButtonsPlacement: 'top',
                            socialButtonsVariant: 'blockButton'
                        }
                    }}
                    signInUrl="/"
                    forceRedirectUrl="/home"
                />
            </div>
        </div>
    );
};

export default SignUpPage;
