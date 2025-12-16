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

export interface Translations {
  [key: string]: {
    en: string;
    my: string;
  };
}

