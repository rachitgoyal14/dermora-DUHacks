import { SignIn } from '@clerk/clerk-react';
import SkinLayersVisual from './SkinLayersVisual';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const Login: React.FC = () => {
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

            {/* Bottom Section: Clerk Login */}
            <div className="w-full bg-white rounded-t-[3rem] shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.05)] px-8 pt-10 pb-12 flex flex-col items-center gap-6 z-20 min-h-[50%]">
                <SignIn
                    appearance={{
                        elements: {
                            rootBox: "w-full",
                            card: "shadow-none w-full",
                            headerTitle: "hidden",
                            headerSubtitle: "hidden",
                            socialButtonsBlockButton: "w-full border-gray-200 text-gray-700 hover:bg-gray-50",
                            formButtonPrimary: "bg-black hover:bg-gray-900",
                            footerAction: "hidden"
                        }
                    }}
                    signUpUrl="/sign-up"
                    forceRedirectUrl="/home"
                />
            </div>

        </div>
    );
};

export default Login;
