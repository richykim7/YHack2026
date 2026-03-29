'use client';
import ReactMarkdown from 'react-markdown';
import { X, Copy, Download } from 'lucide-react';
import type { GeneratedDocument } from '@/lib/types';

interface DocumentDrawerProps {
  documents: GeneratedDocument[];
  open: boolean;
  onClose: () => void;
}

export function DocumentDrawer({ documents, open, onClose }: DocumentDrawerProps) {
  if (!open) return null;

  const handleCopy = (markdown: string) => {
    navigator.clipboard.writeText(markdown);
  };

  const handleDownload = (doc: GeneratedDocument) => {
    const blob = new Blob([doc.content_markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title.replace(/\s+/g, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-[480px] bg-slate-800 border-l border-slate-700 z-50 overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-slate-100 tracking-wide">Generated Documents</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-6">
          {documents.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">Documents will be available when plan processing completes.</p>
          )}
          {documents.map((doc, i) => (
            <div key={i} className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-slate-200 text-sm">{doc.title}</h3>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider">{doc.type.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleCopy(doc.content_markdown)} className="text-slate-400 hover:text-blue-400 p-1" title="Copy">
                    <Copy size={14} />
                  </button>
                  <button onClick={() => handleDownload(doc)} className="text-slate-400 hover:text-blue-400 p-1" title="Download">
                    <Download size={14} />
                  </button>
                </div>
              </div>
              <div className="px-4 py-3 prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{doc.content_markdown}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
