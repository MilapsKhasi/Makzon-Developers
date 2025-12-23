
import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

const Logo: React.FC<LogoProps> = ({ className = '', size = 40 }) => {
  return (
    <div 
      className={`relative flex items-center justify-center rounded-md overflow-hidden bg-primary border border-slate-200 shadow-sm ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Background is handled by the wrapper div's bg-primary */}
        
        {/* The "P" */}
        <text
          x="50%"
          y="52%"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#0F172A"
          style={{
            fontSize: '52px',
            fontWeight: 800,
            fontFamily: 'Poppins, sans-serif',
          }}
        >
          P
        </text>

        {/* The Red Arrow (Smile) */}
        <path
          d="M25 65C35 80 65 80 75 65L82 72L84 55L68 58L75 65Z"
          fill="#EF4444"
        />
      </svg>
    </div>
  );
};

export default Logo;
