'use client';

import { CSS } from '@dnd-kit/utilities';
import { useDraggable } from '@dnd-kit/core';
import type { ApplicationResponse } from '@/types';

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  if (s < 2592000) return `${Math.floor(s / 604800)}w ago`;
  if (s < 31536000) return `${Math.floor(s / 2592000)}mo ago`;
  return `${Math.floor(s / 31536000)}y ago`;
}

interface Props {
  application: ApplicationResponse;
  onViewDetails: (id: string) => void;
  onDownloadResume: (resumeId: string) => void | Promise<void>;
  /** When true, render in DragOverlay style (no drag wiring, just visual). */
  overlay?: boolean;
  /** Hide the body content while the source card is being dragged; the overlay shows the real card. */
  ghosted?: boolean;
}

export default function ApplicationCard({
  application,
  onViewDetails,
  onDownloadResume,
  overlay = false,
  ghosted = false,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: application.id,
    data: { status: application.status },
    disabled: overlay,
  });

  const style: React.CSSProperties = overlay
    ? { transform: 'rotate(2deg)', cursor: 'grabbing' }
    : {
        transform: CSS.Translate.toString(transform),
        opacity: ghosted || isDragging ? 0.4 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      };

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      className={
        'rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition ' +
        (overlay ? 'shadow-xl ring-2 ring-accent/40' : 'hover:-translate-y-0.5 hover:shadow-md')
      }
    >
      <div className="mb-1.5 text-sm font-semibold text-slate-900">
        {application.candidateName ?? '(unnamed candidate)'}
      </div>
      <div className="mb-2 line-clamp-2 text-xs text-slate-500">
        {application.jobPostingTitle ?? '(unlinked posting)'}
      </div>
      <div className="mb-3 text-[11px] text-slate-400">
        Applied {timeAgo(application.appliedAt)}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
        {application.resumeId ? (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              void onDownloadResume(application.resumeId as string);
            }}
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 hover:text-primary-700"
            aria-label={`Download resume ${application.resumeFileName ?? ''}`}
            title={application.resumeFileName ?? 'Download resume'}
          >
            <i className="icofont-download" />
            Resume
          </button>
        ) : (
          <span className="text-[11px] text-slate-400">No resume</span>
        )}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails(application.id);
          }}
          className="rounded px-2 py-1 text-[11px] font-medium text-primary-700 hover:bg-accent/10 hover:text-primary-800"
        >
          View details
        </button>
      </div>
    </div>
  );
}
