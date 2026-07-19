import React from 'react';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

interface AuthButtonProps {
  onClick?: () => void;
  variant: 'google' | 'apple';
  icon: React.ReactNode;
  label: string;
}

const AuthButton: React.FC<AuthButtonProps> = ({ onClick, variant, icon, label }) => {
  const baseStyles = "w-full min-h-[48px] px-6 py-3 rounded-full flex items-center justify-center gap-3 transition-all duration-300 transform active:scale-[0.98] cursor-pointer select-none font-medium text-sm md:text-base";
  
  const variants = {
    google: "bg-white/90 hover:bg-white text-skin-text shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] border border-skin-beige/50",
    apple: "bg-[#2B2B2B] hover:bg-[#1a1a1a] text-white shadow-lg hover:shadow-xl",
  };

  return (
    <button className={`${baseStyles} ${variants[variant]}`} onClick={onClick}>
      <span className="w-5 h-5 flex items-center justify-center">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
};

export default AuthButton;