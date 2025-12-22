import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
}

const KBZ_PAY_LOGO_URL = 'https://play-lh.googleusercontent.com/cnKJYzzHFAE5ZRepCsGVhv7ZnoDfK8Wu5z6lMefeT-45fTNfUblK_gF3JyW5VZsjFc4';
const WAVE_PAY_LOGO_URL = 'https://play-lh.googleusercontent.com/rPq4GMCZy12WhwTlanEu7RzxihYCgYevQHVHLNha1VcY5SU1uLKHMd060b4VEV1r-OQ';

export const KBZPayLogo: React.FC<LogoProps> = ({ size = 24, className = '' }) => {
  return (
    <img
      src={KBZ_PAY_LOGO_URL}
      alt="KBZ Pay"
      className={`rounded-lg flex-shrink-0 ${className}`}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  );
};

export const WaveMoneyLogo: React.FC<LogoProps> = ({ size = 24, className = '' }) => {
  return (
    <img
      src={WAVE_PAY_LOGO_URL}
      alt="Wave Pay"
      className={`rounded-lg flex-shrink-0 ${className}`}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  );
};

