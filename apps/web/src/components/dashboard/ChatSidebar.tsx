import { MessageCircle } from 'lucide-react';

export function ChatSidebar() {
  return (
    <div className="flex flex-col h-full bg-slate-800 border-l border-slate-700 w-80">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
        <MessageCircle size={16} className="text-blue-400" />
        <span className="text-sm font-semibold text-slate-200">Crisis Chat</span>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-slate-500">
          <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Describe a crisis to begin</p>
          <p className="text-xs mt-1">Chat functionality coming in Phase 2</p>
        </div>
      </div>
      <div className="p-3 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Describe a crisis..."
            disabled
            className="flex-1 bg-slate-700 text-slate-400 text-sm rounded-lg px-3 py-2 border border-slate-600 cursor-not-allowed"
          />
          <button
            disabled
            className="px-3 py-2 bg-blue-500/50 text-blue-200 rounded-lg text-sm cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
