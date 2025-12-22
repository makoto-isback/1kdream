import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

export const KBZPayLogo: React.FC<LogoProps> = ({ size = 24, className = '' }) => {
  return (
    <div 
      className={`bg-[#0066CC] rounded-lg flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.75} height={size * 0.75} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="50" y="38" fontSize="18" fontWeight="bold" fill="white" textAnchor="middle" fontFamily="Arial, sans-serif" letterSpacing="1">KBZ</text>
        <text x="50" y="62" fontSize="14" fontWeight="600" fill="white" textAnchor="middle" fontFamily="Arial, sans-serif">Pay</text>
        <polygon points="88,12 96,8 92,18" fill="white" opacity="0.7" />
        <polygon points="4,92 10,88 14,96" fill="white" opacity="0.7" />
      </svg>
    </div>
  );
};

export const WaveMoneyLogo: React.FC<LogoProps> = ({ size = 24, className = '' }) => {
  return (
    <div 
      className={`bg-[#FFD700] rounded-lg flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size * 0.85} height={size * 0.85} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Wave Money abstract blue shape with yellow center */}
        <path
          d="M50,15 Q25,25 20,50 Q15,75 30,85 Q45,95 50,90 Q55,95 70,85 Q85,75 80,50 Q75,25 50,15 Z"
          fill="#0066CC"
        />
        <circle cx="50" cy="50" r="12" fill="#FFD700" />
      </svg>
    </div>
  );
};

