import React from 'react';
import { Language } from '../types/ui';
import { TRANSLATIONS } from '../constants/translations';
import { Icons } from './Icons';

interface Props {
  language: Language;
  isOpen: boolean;
  onClose: () => void;
}

export const HowItWorksModal: React.FC<Props> = ({ language, isOpen, onClose }) => {
  if (!isOpen) return null;

  const t = TRANSLATIONS.howItWorks as {
    title: { en: string; my: string };
    exchangeRate: { en: string; my: string };
    step1: { title: { en: string; my: string }; description: { en: string; my: string } };
    step2: { title: { en: string; my: string }; description: { en: string; my: string } };
    step3: { title: { en: string; my: string }; description: { en: string; my: string } };
    step4: { title: { en: string; my: string }; description: { en: string; my: string } };
    example: {
      title: { en: string; my: string };
      roundDetails: { en: string; my: string };
      totalPool: { en: string; my: string };
      winnerPool: { en: string; my: string };
      winningBlock: { en: string; my: string };
      betsOnBlock: { en: string; my: string };
      totalOnBlock: { en: string; my: string };
      calculations: { en: string; my: string };
      payoutFormula: { en: string; my: string };
      totalPaid: { en: string; my: string };
      note: { en: string; my: string };
    };
    rules: { title: { en: string; my: string }; rule1: { en: string; my: string }; rule2: { en: string; my: string }; rule3: { en: string; my: string } };
    close: { en: string; my: string };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-ios-bg-primary rounded-2xl border border-white/10 shadow-2xl animate-fade-in-up">
        {/* Header */}
        <div className="sticky top-0 bg-ios-bg-primary border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Icons.Info className="text-ios-blue" size={20} />
            {t.title[language]}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-ios-gray5 transition-colors"
          >
            <Icons.Close size={20} className="text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Exchange Rate Banner */}
          <div className="bg-ios-blue/10 border border-ios-blue/30 rounded-xl px-4 py-3 mb-2">
            <div className="flex items-center justify-center gap-2">
              <Icons.Wallet className="text-ios-blue" size={18} />
              <p className="text-ios-blue font-semibold text-sm">{t.exchangeRate[language]}</p>
            </div>
          </div>

          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-ios-blue/20 flex items-center justify-center">
              <span className="text-ios-blue font-bold text-lg">1</span>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold mb-1">{t.step1.title[language]}</h3>
              <p className="text-ios-label-secondary text-sm leading-relaxed">{t.step1.description[language]}</p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-ios-green/20 flex items-center justify-center">
              <span className="text-ios-green font-bold text-lg">2</span>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold mb-1">{t.step2.title[language]}</h3>
              <p className="text-ios-label-secondary text-sm leading-relaxed">{t.step2.description[language]}</p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-ios-pink/20 flex items-center justify-center">
              <span className="text-ios-pink font-bold text-lg">3</span>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold mb-1">{t.step3.title[language]}</h3>
              <p className="text-ios-label-secondary text-sm leading-relaxed">{t.step3.description[language]}</p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-ios-yellow/20 flex items-center justify-center">
              <span className="text-ios-yellow font-bold text-lg">4</span>
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold mb-1">{t.step4.title[language]}</h3>
              <p className="text-ios-label-secondary text-sm leading-relaxed">{t.step4.description[language]}</p>
            </div>
          </div>

          {/* Example Section */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Icons.Info className="text-ios-blue" size={18} />
              {t.example.title[language]}
            </h3>
            
            <div className="bg-ios-gray5/50 rounded-xl p-4 space-y-3 mb-4">
              <div>
                <p className="text-ios-label-secondary text-xs mb-2">{t.example.roundDetails[language]}</p>
                <div className="space-y-1 text-sm">
                  <p className="text-white"><span className="text-ios-label-secondary">{t.example.totalPool[language]}</span> <span className="font-semibold text-ios-green">500,000 KYAT</span></p>
                  <p className="text-white"><span className="text-ios-label-secondary">{t.example.winnerPool[language]}</span> <span className="font-semibold text-ios-green">450,000 KYAT</span></p>
                  <p className="text-white"><span className="text-ios-label-secondary">{t.example.winningBlock[language]}</span> <span className="font-semibold text-ios-yellow">12</span></p>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10">
                <p className="text-ios-label-secondary text-xs mb-2">{t.example.betsOnBlock[language]}</p>
                <div className="space-y-1 text-xs font-mono">
                  <p className="text-white">User A: <span className="text-ios-blue">1,000 KYAT</span></p>
                  <p className="text-white">User B: <span className="text-ios-blue">5,000 KYAT</span></p>
                  <p className="text-white">User C: <span className="text-ios-blue">10,000 KYAT</span></p>
                  <p className="text-white">User D: <span className="text-ios-blue">50,000 KYAT</span></p>
                  <p className="text-white">User E: <span className="text-ios-blue">100,000 KYAT</span></p>
                  <p className="text-ios-green font-semibold mt-2">{t.example.totalOnBlock[language]} <span className="text-white">166,000 KYAT</span></p>
                </div>
              </div>
            </div>

            <div className="bg-ios-gray5/50 rounded-xl p-4 space-y-2">
              <p className="text-ios-label-secondary text-xs mb-2">{t.example.calculations[language]}</p>
              <p className="text-ios-blue text-xs mb-3 font-mono">{t.example.payoutFormula[language]}</p>
              <div className="space-y-1.5 text-xs font-mono">
                <p className="text-white">User A: <span className="text-ios-green">(1,000 / 166,000) × 450,000 = <span className="font-bold">2,711 KYAT</span></span></p>
                <p className="text-white">User B: <span className="text-ios-green">(5,000 / 166,000) × 450,000 = <span className="font-bold">13,554 KYAT</span></span></p>
                <p className="text-white">User C: <span className="text-ios-green">(10,000 / 166,000) × 450,000 = <span className="font-bold">27,108 KYAT</span></span></p>
                <p className="text-white">User D: <span className="text-ios-green">(50,000 / 166,000) × 450,000 = <span className="font-bold">135,542 KYAT</span></span></p>
                <p className="text-white">User E: <span className="text-ios-green">(100,000 / 166,000) × 450,000 = <span className="font-bold">271,084 KYAT</span></span></p>
                <p className="text-ios-green font-semibold mt-3 pt-2 border-t border-white/10">{t.example.totalPaid[language]} <span className="text-white font-bold">450,000 KYAT</span></p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-ios-green/10 border border-ios-green/30 rounded-lg">
              <p className="text-ios-green text-xs leading-relaxed flex items-start gap-2">
                <Icons.Check className="text-ios-green flex-shrink-0 mt-0.5" size={14} />
                <span>{t.example.note[language]}</span>
              </p>
            </div>
          </div>

          {/* Rules Section */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Icons.Check className="text-ios-green" size={18} />
              {t.rules.title[language]}
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm text-ios-label-secondary">
                <span className="text-ios-blue mt-0.5 font-bold">•</span>
                <span className="leading-relaxed">{t.rules.rule1[language]}</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-ios-label-secondary">
                <span className="text-ios-blue mt-0.5 font-bold">•</span>
                <span className="leading-relaxed">{t.rules.rule2[language]}</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-ios-label-secondary">
                <span className="text-ios-blue mt-0.5 font-bold">•</span>
                <span className="leading-relaxed">{t.rules.rule3[language]}</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-ios-bg-primary border-t border-white/10 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full bg-ios-blue text-white py-3 rounded-xl font-semibold hover:bg-ios-blue/90 transition-colors active:scale-95"
          >
            {t.close[language]}
          </button>
        </div>
      </div>
    </div>
  );
};

