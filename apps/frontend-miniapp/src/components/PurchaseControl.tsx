import React, { useState } from 'react';
import { GlassCard } from './GlassCard';
import { Language, PurchaseMode } from '../types/ui';
import { TRANSLATIONS } from '../constants/translations';

interface Props {
  language: Language;
  selectedCount: number;
  onBuy: (amount: number, rounds: number, mode: PurchaseMode) => void;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
  disableAutoBuy?: boolean;
}

export const PurchaseControl: React.FC<Props> = ({ 
  language, 
  selectedCount, 
  onBuy, 
  disabled = false,
  loading = false,
  error = null,
  disableAutoBuy = false,
}) => {
  const [mode, setMode] = useState<PurchaseMode>(PurchaseMode.SINGLE);
  const [amount, setAmount] = useState<string>('1000');
  const [rounds, setRounds] = useState<number>(1);

  const parsedAmount = parseInt(amount) || 0;
  const totalCost = mode === PurchaseMode.SINGLE 
    ? parsedAmount * selectedCount 
    : parsedAmount * selectedCount * rounds;

  const canBuy = selectedCount > 0 && parsedAmount >= 1000 && !disabled && !loading;

  const handleBuy = () => {
    if (canBuy) {
      onBuy(parsedAmount, rounds, mode);
    }
  };

  return (
    <GlassCard className="sticky bottom-4 mx-4 md:static md:mx-0 shadow-2xl md:shadow-lg border-t border-white/10 md:border-t-white/5">
      
      {/* iOS Segmented Control */}
      <div className="flex p-0.5 mb-5 bg-ios-gray5 rounded-lg">
        <button
          onClick={() => setMode(PurchaseMode.SINGLE)}
          disabled={disabled || loading}
          className={`flex-1 py-1.5 rounded-[6px] text-[13px] font-medium transition-all ${
            mode === PurchaseMode.SINGLE ? 'bg-ios-gray3 text-white shadow-sm' : 'text-ios-label-secondary hover:text-white'
          } ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {TRANSLATIONS.single_buy[language]}
        </button>
        <button
          onClick={() => setMode(PurchaseMode.AUTO)}
          disabled={disabled || loading || disableAutoBuy}
          className={`flex-1 py-1.5 rounded-[6px] text-[13px] font-medium transition-all ${
            mode === PurchaseMode.AUTO ? 'bg-ios-gray3 text-white shadow-sm' : 'text-ios-label-secondary hover:text-white'
          } ${(disabled || loading || disableAutoBuy) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {TRANSLATIONS.auto_buy[language]}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-[11px] text-ios-label-secondary mb-2 ml-1 uppercase tracking-wide">{TRANSLATIONS.amount_kyat[language]}</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={disabled || loading}
            min="1000"
            className="w-full bg-ios-gray5 border border-transparent focus:border-ios-blue/50 rounded-xl px-4 py-3 text-white placeholder-ios-label-tertiary focus:outline-none focus:ring-1 focus:ring-ios-blue font-mono text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        
        {mode === PurchaseMode.AUTO ? (
           <div>
            <label className="block text-[11px] text-ios-label-secondary mb-2 ml-1 uppercase tracking-wide">{TRANSLATIONS.rounds_count[language]}</label>
            <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setRounds(Math.max(1, rounds - 1))} 
                  disabled={disabled || loading}
                  className="w-10 h-[52px] rounded-xl bg-ios-gray5 text-ios-blue flex items-center justify-center hover:bg-ios-gray4 text-xl font-medium active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <div className="flex-1 h-[52px] bg-ios-gray5 rounded-xl flex items-center justify-center text-white font-mono text-lg">{rounds}</div>
                <button 
                  onClick={() => setRounds(rounds + 1)} 
                  disabled={disabled || loading}
                  className="w-10 h-[52px] rounded-xl bg-ios-gray5 text-ios-blue flex items-center justify-center hover:bg-ios-gray4 text-xl font-medium active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col justify-center">
             <label className="block text-[11px] text-ios-label-secondary mb-2 ml-1 uppercase tracking-wide">{TRANSLATIONS.selected[language]}</label>
             <div className="text-right px-2 py-3">
               <span className="text-2xl font-bold text-white">{selectedCount}</span>
               <span className="text-sm text-ios-label-secondary ml-2">nums</span>
             </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-ios-red/10 border border-ios-red/20">
          <p className="text-[13px] text-ios-red">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-5 px-1">
        <span className="text-sm text-ios-label-secondary">{TRANSLATIONS.total_cost[language]}</span>
        <span className="text-xl font-bold text-white">{totalCost.toLocaleString()} <span className="text-sm font-normal text-ios-yellow">Ks</span></span>
      </div>

      <button
        onClick={handleBuy}
        disabled={!canBuy}
        className={`w-full py-4 rounded-xl font-semibold text-[17px] shadow-lg transition-all transform active:scale-[0.98] ${
          canBuy
            ? 'bg-ios-blue text-white shadow-blue-900/20'
            : 'bg-ios-gray5 text-ios-label-tertiary cursor-not-allowed'
        }`}
      >
        {loading ? TRANSLATIONS.loading[language] : TRANSLATIONS.buy_numbers[language]}
      </button>
    </GlassCard>
  );
};

