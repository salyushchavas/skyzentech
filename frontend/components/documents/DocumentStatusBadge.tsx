import type { DocumentStatusColor } from '@/types';

interface Props {
  statusLabel: string;
  color: DocumentStatusColor;
}

const COLOR_MAP: Record<DocumentStatusColor, string> = {
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-700',
  purple: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
};

export default function DocumentStatusBadge({ statusLabel, color }: Props) {
  return (
    <span
      className={
        'inline-block whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ' +
        (COLOR_MAP[color] ?? COLOR_MAP.gray)
      }
    >
      {statusLabel}
    </span>
  );
}
