import { useEffect, useState, type CSSProperties } from 'react';

import { useLanguage } from '../contexts/LanguageContext';

interface ProjectPreviewProps {
  alt: string;
  className?: string;
  placeholderClassName?: string;
  placeholderLabel?: string;
  src?: string | null;
  style?: CSSProperties;
}

export function ProjectPreview({
  alt,
  className,
  placeholderClassName,
  placeholderLabel,
  src,
  style,
}: ProjectPreviewProps) {
  const { t } = useLanguage();
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div className={placeholderClassName ?? className} style={style}>
        {placeholderLabel ?? t('projectPreview.placeholder')}
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} style={style} onError={() => setHasError(true)} />;
}
