import { useLanguage } from '../contexts/LanguageContext';

interface LanguageToggleProps {
  className?: string;
  tone?: 'dark' | 'light';
}

export function LanguageToggle({ className, tone = 'dark' }: LanguageToggleProps) {
  const { language, setLanguage } = useLanguage();

  return (
    <div className={`language-toggle language-toggle--${tone} ${className ?? ''}`}>
      <button
        type="button"
        className={`language-toggle__option ${language === 'th' ? 'language-toggle__option--active' : ''}`}
        onClick={() => setLanguage('th')}
      >
        THA
      </button>
      <button
        type="button"
        className={`language-toggle__option ${language === 'en' ? 'language-toggle__option--active' : ''}`}
        onClick={() => setLanguage('en')}
      >
        ENG
      </button>
    </div>
  );
}
