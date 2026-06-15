import { useEffect, useState, type CSSProperties } from 'react';

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
  placeholderLabel = 'Project preview',
  src,
  style,
}: ProjectPreviewProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (!src || hasError) {
    return (
      <div className={placeholderClassName ?? className} style={style}>
        {placeholderLabel}
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} style={style} onError={() => setHasError(true)} />;
}
