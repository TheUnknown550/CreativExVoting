import type { Language } from './index';

// Picks the value for the active language for DB-driven content that is stored
// in both English (default) and Thai. Falls back to the other language when the
// preferred one is empty so nothing ever renders blank.
export function localize(
  language: Language,
  en: string | null | undefined,
  th: string | null | undefined,
): string {
  const english = (en ?? '').trim();
  const thai = (th ?? '').trim();
  if (language === 'th') {
    return thai || english;
  }
  return english || thai;
}
