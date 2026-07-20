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
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2 font-['Poppins'] flex items-center justify-center gap-2">
            ZenterPrime
            <span className="text-[10px] font-bold bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-400/20 px-2 py-0.5 rounded uppercase tracking-wider select-none">
              Early Access
            </span>
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