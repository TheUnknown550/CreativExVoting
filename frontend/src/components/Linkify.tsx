import { linkifyText } from '../utils/linkify';

interface LinkifyProps {
  text: string | null | undefined;
}

export function Linkify({ text }: LinkifyProps) {
  return <>{linkifyText(text)}</>;
}
