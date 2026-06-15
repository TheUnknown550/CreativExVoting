import darkMark from '../assets/ce-awards-mark.png';
import lightMark from '../assets/ce-awards-mark-light.png';

interface BrandMarkProps {
  tone?: 'dark' | 'light';
  className?: string;
  alt?: string;
}

export function BrandMark({
  tone = 'dark',
  className,
  alt = 'Creative Excellence Awards',
}: BrandMarkProps) {
  return (
    <img
      src={tone === 'light' ? lightMark : darkMark}
      alt={alt}
      className={className}
    />
  );
}
