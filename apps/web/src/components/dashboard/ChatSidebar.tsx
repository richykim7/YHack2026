'use client';
import { useState, useRef, useEffect, FormEvent } from 'react';
import { MessageCircle, Send, Zap, User, Bot } from 'lucide-react';
import { useScopeChat } from '@/hooks/useScopeChat';
import { CrisisProfileCard } from './CrisisProfileCard';

interface ChatSidebarProps {
  onLaunchPipeline?: (sessionId: string, crisisProfile: Record<string, unknown>) => void;
  pipelineStreaming?: boolean;
}

export function ChatSidebar({ onLaunchPipeline, pipelineStreaming }: ChatSidebarProps) {
  const { messages, isLoading, crisisProfile, sendMessage, sessionId } = useScopeChat();
  const [input, setInput] = useState('');
  const [pipelineLaunched, setPipelineLaunched] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    sendMessage(trimmed);
  }

  function handleLaunchPipeline() {
    if (!crisisProfile || pipelineLaunched) return;
    setPipelineLaunched(true);
    onLaunchPipeline?.(sessionId, crisisProfile as unknown as Record<string, unknown>);
  }

  const isLaunched = pipelineLaunched || pipelineStreaming;

  return (
    <div className="flex flex-col h-full bg-slate-850 border-l border-slate-700 w-80"
      style={{ background: 'linear-gradient(180deg, #1a2332 0%, #0f172a 100%)' }}
    >
      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-700/80">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
            <Zap size={14} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-display font-bold text-slate-100 tracking-wide">SCOPE Agent</h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Crisis analysis</p>
          </div>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center px-4">
              <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-3">
                <MessageCircle size={20} className="text-slate-600" />
              </div>
              <p className="text-sm font-display font-semibold text-slate-400">Describe your crisis</p>
              <p className="text-xs text-slate-600 mt-1">
                e.g. &quot;Winter storm cutting off 3 distribution sites in NW Philly&quot;
              </p>
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex items-start gap-2 ${msg.role === 'human' ? 'flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
              msg.role === 'human'
                ? 'bg-blue-500/20 border border-blue-500/40'
                : 'bg-emerald-500/15 border border-emerald-500/30'
            }`}>
              {msg.role === 'human'
                ? <User size={12} className="text-blue-400" />
                : <Bot size={12} className="text-emerald-400" />
              }
            </div>

            {/* Message bubble */}
            <div
              className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                msg.role === 'human'
                  ? 'bg-blue-500/15 border border-blue-500/20 text-slate-200 rounded-tr-sm'
                  : 'bg-slate-800/80 border border-slate-700/60 text-slate-300 rounded-tl-sm'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.crisisProfile && (
                <CrisisProfileCard
                  profile={msg.crisisProfile}
                  onLaunchPipeline={handleLaunchPipeline}
                  pipelineLaunched={!!isLaunched}
                />
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
              <Bot size={12} className="text-emerald-400" />
            </div>
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl rounded-tl-sm px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-700/80 bg-slate-900/50">
        <div className="flex gap-2 items-end">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Describe a crisis..."
            className="flex-1 bg-slate-800 text-slate-200 text-sm rounded-xl px-4 py-2.5 border border-slate-700 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-shadow"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`p-2.5 rounded-xl text-sm transition-all ${
              !input.trim() || isLoading
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
                : 'bg-blue-500 text-white hover:bg-blue-400 shadow-lg shadow-blue-500/20'
            }`}
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
