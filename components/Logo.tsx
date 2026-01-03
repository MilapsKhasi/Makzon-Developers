import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

const Logo: React.FC<LogoProps> = ({ className = '', size = 40 }) => {
  return (
    <div 
      className={`relative flex items-center justify-center rounded-[10px] overflow-hidden bg-[#ffea79] ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="relative w-full h-full flex flex-col items-center justify-center pt-2">
        <span className="text-slate-900 font-black leading-none select-none" style={{ fontSize: size * 0.5 }}>F</span>
        <svg 
          viewBox="0 0 100 40" 
          className="absolute bottom-[12%] w-[60%] h-auto"
          style={{ filter: 'none' }}
        >
          <path 
            d="M5 5 C 20 25, 80 25, 95 5 L 85 15 L 90 2 L 75 8 Z" 
            fill="#EF4444" 
          />
        </svg>
      </div>
    </div>
  );
};

export default Logo;