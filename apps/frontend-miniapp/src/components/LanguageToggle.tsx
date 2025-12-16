import React from 'react';
import { Language } from '../types/ui';

interface Props {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const LanguageToggle: React.FC<Props> = ({ language, setLanguage }) => {
  return (
    <button
      onClick={() => setLanguage(language === 'en' ? 'my' : 'en')}
      className="flex items-center justify-center w-9 h-9 rounded-full bg-ios-gray5 text-ios-blue hover:bg-ios-gray4 transition-all active:scale-95 font-medium"
    >
      <span className="text-[11px] uppercase">{language}</span>
    </button>
  );
};

