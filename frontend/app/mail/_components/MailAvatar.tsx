'use client';

import { cn } from '@/lib/cn';
import { avatarTint, initials } from '@/lib/mail-format';

const SIZES = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-10 w-10 text-sm',
  lg: 'h-11 w-11 text-base',
};

/**
 * Sender initial-avatar derived purely from the display name (no external
 * service). On-brand tint from the .ds tokens only. Presentation-only.
 */
export default function MailAvatar({
  name,
  size = 'sm',
  className,
}: {
  name?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold',
        SIZES[size],
        avatarTint(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
