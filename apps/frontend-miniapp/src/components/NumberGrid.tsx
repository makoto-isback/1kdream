import React from 'react';
import { NumberStats } from '../types/ui';
import { Icons } from './Icons';

interface Props {
  numbers: NumberStats[];
  selectedIds: number[];
  onToggleNumber: (id: number) => void;
}

export const NumberGrid: React.FC<Props> = ({ numbers, selectedIds, onToggleNumber }) => {
  return (
    <div className="grid grid-cols-5 gap-3 w-full max-w-md mx-auto">
      {numbers.map((num) => {
        const isSelected = selectedIds.includes(num.id);
        const formattedNumber = num.id.toString().padStart(2, '0');

        return (
          <button
            key={num.id}
            onClick={() => !num.isDisabled && onToggleNumber(num.id)}
            disabled={num.isDisabled}
            className={`
              relative aspect-square rounded-[18px] flex flex-col items-center justify-center
              transition-all duration-200 ease-out group
              ${num.isDisabled 
                ? 'opacity-40 cursor-not-allowed bg-ios-gray6' 
                : 'active:scale-95 cursor-pointer'}
              ${isSelected 
                ? 'bg-ios-yellow text-black shadow-md' 
                : 'bg-ios-gray5 hover:bg-ios-gray4 text-white'}
            `}
          >
            {/* Main Number */}
            <span className={`text-xl sm:text-2xl font-semibold tracking-tight ${isSelected ? 'scale-105' : ''}`}>
              {formattedNumber}
            </span>

            {/* Micro Stats */}
            <div className="flex flex-col items-center mt-1 space-y-0.5">
              <div className="flex items-center space-x-0.5 opacity-70">
                <Icons.User size={10} strokeWidth={3} className={isSelected ? 'text-black' : 'text-ios-label-secondary'} />
                <span className="text-[10px] font-medium">{num.buyers}</span>
              </div>
            </div>
            
            {/* Selection Indicator */}
            {isSelected && (
              <div className="absolute top-1.5 right-1.5 text-black opacity-50">
                <Icons.Check size={10} strokeWidth={4} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

