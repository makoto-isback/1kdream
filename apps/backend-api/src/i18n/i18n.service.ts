import { Injectable } from '@nestjs/common';
import { translations, Language, TranslationKey } from './translations';

@Injectable()
export class I18nService {
  translate(key: TranslationKey, lang: Language = 'my'): string {
    const langTranslations = translations[lang] || translations.my;
    const keys = key.split('.');
    let value: any = langTranslations;

    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        return key; // Return key if translation not found
      }
    }

    return typeof value === 'string' ? value : key;
  }

  getError(key: string, lang: Language = 'my'): string {
    return this.translate(`errors.${key}` as TranslationKey, lang);
  }

  getSuccess(key: string, lang: Language = 'my'): string {
    return this.translate(`success.${key}` as TranslationKey, lang);
  }
}

