import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  padding?: string;
}

export const GlassCard: React.FC<Props> = ({ children, className = '', padding = 'p-4' }) => {
  return (
    <div className={`bg-ios-gray6/90 backdrop-blur-xl border border-white/5 rounded-[20px] shadow-lg ${padding} ${className}`}>
      {children}
    </div>
  );
};

