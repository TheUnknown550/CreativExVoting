/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { locales, type Language, type TranslationDict } from '../locales';

type Primitive = string;

type PathsOf<T, Prefix extends string = ''> = T extends Primitive
  ? Prefix
  : {
      [K in keyof T & string]: PathsOf<T[K], Prefix extends '' ? K : `${Prefix}.${K}`>;
    }[keyof T & string];

export type TranslationKey = PathsOf<TranslationDict>;

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const LANGUAGE_STORAGE_KEY = 'creativex-voting-language';

const LanguageContext = createContext<LanguageContextValue | null>(null);

function resolve(dict: TranslationDict, key: string): string | undefined {
  const value = key.split('.').reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in acc) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, dict);

  return typeof value === 'string' ? value : undefined;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) {
    return template;
  }
  return Object.entries(params).reduce(
    (result, [paramKey, paramValue]) => result.replaceAll(`{${paramKey}}`, String(paramValue)),
    template,
  );
}

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return stored === 'en' || stored === 'th' ? stored : 'th';
  });

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  function setLanguage(nextLanguage: Language) {
    setLanguageState(nextLanguage);
  }

  function toggleLanguage() {
    setLanguageState((current) => (current === 'th' ? 'en' : 'th'));
  }

  const t = useMemo(() => {
    return (key: TranslationKey, params?: Record<string, string | number>) => {
      const dict = locales[language];
      const fallbackDict = locales.en;
      const value = resolve(dict, key) ?? resolve(fallbackDict, key) ?? key;
      return interpolate(value, params);
    };
  }, [language]);

  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage, t }),
    [language, t],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
