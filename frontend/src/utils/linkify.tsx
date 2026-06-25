import { LinkOutlined } from '@ant-design/icons';
import { Fragment, type ReactNode } from 'react';

// Matches bare http(s) URLs and www.-prefixed domains so admins can write
// free text like "IG: https://instagram.com/x   Facebook: https://fb.com/y"
// and have just the URLs become clickable, leaving labels as plain text.
const URL_PATTERN = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/gi;

function toHref(match: string): string {
  return match.startsWith('www.') ? `https://${match}` : match;
}

export function linkifyText(text: string | null | undefined): ReactNode {
  if (!text) {
    return text;
  }

  const parts = text.split(URL_PATTERN);
  if (parts.length === 1) {
    return text;
  }

  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <a key={index} href={toHref(part)} target="_blank" rel="noreferrer" className="linkify-link">
        <LinkOutlined /> {part}
      </a>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}
