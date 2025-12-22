export type Language = 'my' | 'en';

export enum PurchaseMode {
  SINGLE = 'SINGLE',
  AUTO = 'AUTO'
}

export enum WalletTab {
  BALANCE = 'BALANCE',
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW'
}

export interface NumberStats {
  id: number;
  buyers: number;
  totalKyat: number;
  isSelected: boolean;
  isDisabled: boolean;
}

export type TranslationValue = {
  en: string;
  my: string;
} | {
  [key: string]: TranslationValue;
};

export interface Translations {
  [key: string]: TranslationValue;
}

