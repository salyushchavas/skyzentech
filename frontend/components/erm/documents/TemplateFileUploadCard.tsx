'use client';

import { useRef, useState, type DragEvent } from 'react';
import { Download, Upload, FileText, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import {
  TEMPLATE_FILE_ACCEPT,
  TEMPLATE_FILE_MAX_BYTES,
  formatFileSize,
  isAllowedTemplateMime,
} from './badges';
import type { DocumentTemplateDto } from './types';

type Props = {
  template: DocumentTemplateDto;
  onUploaded: (next: DocumentTemplateDto) => void;
};

export default function TemplateFileUploadCard({ template, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function pickFile(file: File) {
    setErr(null);
    if (file.size > TEMPLATE_FILE_MAX_BYTES) {
      setErr(`File exceeds 10 MB limit (${formatFileSize(file.size)})`);
      return;
    }
    if (file.type && !isAllowedTemplateMime(file.type)) {
      setErr(`Unsupported file type: ${file.type}. Allowed: PDF, DOCX, XLSX.`);
      return;
    }
    setPending(file);
  }

  async function upload() {
    if (!pending) return;
    setUploading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', pending);
      const res = await api.post<DocumentTemplateDto>(
        `/api/v1/erm/document-templates/${template.id}/file`,
        fd,
      );
      onUploaded(res.data);
      setPending(null);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      setErr(ax.response?.data?.error ?? ax.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function downloadCurrent() {
    try {
      const res = await api.get<Blob>(
        `/api/v1/erm/document-templates/${template.id}/file`,
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = template.templateFileName ?? template.title;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      const ax = e as { response?: { data?: { error?: string } }; message?: string };
      alert(ax.response?.data?.error ?? ax.message ?? 'Download failed');
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) pickFile(file);
  }

  return (
    <section id="upload" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Template file</h3>
        <span className="text-xs text-slate-500">Max 10 MB · PDF / DOCX / XLSX</span>
      </div>

      {template.templateFileId ? (
        <div className="mt-3 flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-500" />
            <div>
              <p className="text-sm font-medium text-slate-900">
                {template.templateFileName ?? '(unnamed file)'}
              </p>
              <p className="text-[11px] text-slate-500">
                v{template.version} · {formatFileSize(template.templateFileSize)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={downloadCurrent}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </button>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertCircle className="h-4 w-4" />
          <span>No file uploaded yet — interns cannot be assigned this template until a file is in place.</span>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={
          'mt-4 rounded-md border-2 border-dashed p-6 text-center text-sm transition-colors '
          + (dragOver
            ? 'border-teal-500 bg-teal-50 text-teal-800'
            : 'border-slate-300 bg-slate-50 text-slate-600')
        }
      >
        <Upload className="mx-auto h-6 w-6 text-slate-400" />
        <p className="mt-2">
          Drop a {template.templateFileId ? 'replacement' : 'template'} file here, or{' '}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="font-semibold text-teal-700 hover:underline"
          >
            browse
          </button>
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={TEMPLATE_FILE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pickFile(f);
            e.target.value = '';
          }}
        />
        {template.templateFileId && (
          <p className="mt-1 text-[11px] text-slate-500">
            Uploading replaces the current file. Previous version is preserved in history.
          </p>
        )}
      </div>

      {pending && (
        <div className="mt-3 flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2">
          <div>
            <p className="text-sm font-medium text-slate-900">{pending.name}</p>
            <p className="text-[11px] text-slate-500">{formatFileSize(pending.size)}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPending(null)}
              disabled={uploading}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={upload}
              disabled={uploading}
              className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-800 disabled:bg-slate-300"
            >
              <Upload className="h-3.5 w-3.5" /> {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      )}

      {err && (
        <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
          {err}
        </p>
      )}
    </section>
  );
}
