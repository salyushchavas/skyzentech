'use client';

import { Bell, Menu } from 'lucide-react';
import UserMenuDropdown from './UserMenuDropdown';

interface Props {
  title?: string;
  onMenuClick?: () => void;
}

export default function DashboardTopbar({ title, onMenuClick }: Props) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="Open menu"
            className="-ml-2 rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 lg:hidden"
          >
            <Menu className="h-6 w-6" strokeWidth={2} />
          </button>
        )}
        {title && (
          <h1 className="text-base font-semibold text-gray-900">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Notifications"
          className="rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <Bell className="h-5 w-5" strokeWidth={2} />
        </button>
        <UserMenuDropdown />
      </div>
    </header>
  );
}
