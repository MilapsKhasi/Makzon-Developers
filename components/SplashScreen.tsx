import React from 'react';
import Logo from './Logo';

interface SplashScreenProps {
  isExiting: boolean;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ isExiting }) => {
  return (
    <div className={`fixed inset-0 z-[1000] splash-bg flex flex-col items-center justify-center transition-opacity duration-700 ease-in-out font-['Poppins'] ${isExiting ? 'opacity-0' : 'opacity-100'}`}>
      <div className="relative z-10 flex flex-col items-center animate-in zoom-in-95 duration-1000">
        <Logo size={100} className="mb-6 rounded-[15px]" />
        <div className="text-center">
          <h1 className="text-3xl font-semibold text-[#EF4444] tracking-tight mb-1 font-['Poppins']">
            Findesk Prime
          </h1>
          <p className="text-sm font-medium text-slate-900 tracking-[0.2em] uppercase font-['Poppins']">
            Your Digital Finance Desk
          </p>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;