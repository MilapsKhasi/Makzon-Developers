import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  style?: React.CSSProperties;
  innerClassName?: string;
  innerStyle?: React.CSSProperties;
  spanStyle?: React.CSSProperties;
}

const Logo: React.FC<LogoProps> = ({ 
  className = '', 
  size = 40, 
  style, 
  innerClassName = '', 
  innerStyle, 
  spanStyle 
}) => {
  return (
    <div 
      className={`relative flex items-center justify-center rounded-[5px] overflow-hidden bg-[#4338ca] ${className}`}
      style={{ 
        width: size, 
        height: size, 
        borderRadius: '5px', 
        border: '0.5px solid rgba(255, 255, 255, 0.35)',
        boxSizing: 'border-box',
        ...style 
      }}
    >
      <div 
        className={`relative w-full h-full flex flex-col items-center justify-center ${innerClassName}`}
        style={innerStyle}
      >
        <span 
          className="text-white font-bold leading-none select-none" 
          style={{ fontSize: size * 0.6, fontFamily: "'Dancing Script', cursive", ...spanStyle }}
        >
          Z
        </span>
      </div>
    </div>
  );
};

export default Logo;