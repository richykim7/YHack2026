'use client';
import { ExternalLink, MessageCircle } from 'lucide-react';

const HEX_WORKSPACE_ID = '019d332d-fb08-7115-8160-d2aee00146ea';
const HEX_THREADS_URL = `https://app.hex.tech/${HEX_WORKSPACE_ID}/threads`;

interface FollowUpTabProps {
  threadUrl?: string | null;
  pipelineComplete?: boolean;
}

export function FollowUpTab({ threadUrl, pipelineComplete }: FollowUpTabProps) {
  const embedUrl = threadUrl || (pipelineComplete ? HEX_THREADS_URL : null);

  if (!embedUrl) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <div className="text-center">
          <MessageCircle size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">Follow-up</p>
          <p className="text-sm mt-1">
            Available after pipeline completion.
          </p>
          <p className="text-xs mt-2 text-slate-600">
            Use the chat sidebar to ask follow-up questions about the data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700 bg-slate-800/50">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-emerald-400" />
          <span className="text-sm font-semibold text-slate-200">Hex Threads</span>
          <span className="text-xs text-slate-500">AI-powered data analysis</span>
        </div>
        <a
          href={embedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          Open in new tab
          <ExternalLink size={12} />
        </a>
      </div>
      <div className="flex-1 relative">
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full border-none"
          title="Hex Threads"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
    </div>
  );
}
