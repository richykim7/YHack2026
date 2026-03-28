'use client';
import { useState, useRef, useEffect, FormEvent } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { useScopeChat } from '@/hooks/useScopeChat';
import { CrisisProfileCard } from './CrisisProfileCard';

export function ChatSidebar() {
  const { messages, isLoading, sendMessage, sessionId } = useScopeChat();
  const [input, setInput] = useState('');
  const [launchedSessions, setLaunchedSessions] = useState<Set<string>>(new Set());
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
    console.log('Launch pipeline', sessionId);
    setLaunchedSessions(prev => new Set(prev).add(sessionId));
  }

  const pipelineLaunched = launchedSessions.has(sessionId);

  return (
    <div className="flex flex-col h-full bg-slate-800 border-l border-slate-700 w-80">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
        <MessageCircle size={16} className="text-blue-400" />
        <span className="text-sm font-semibold text-slate-200">Crisis Chat</span>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center text-slate-500">
              <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Describe a crisis to begin</p>
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'human' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'human'
                  ? 'bg-blue-500/20 text-slate-200'
                  : 'bg-slate-700 text-slate-200'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.crisisProfile && (
                <CrisisProfileCard
                  profile={msg.crisisProfile}
                  onLaunchPipeline={handleLaunchPipeline}
                  pipelineLaunched={pipelineLaunched}
                />
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-700 rounded-lg px-3 py-2 text-sm text-slate-400">
              <span className="animate-pulse">SCOPE is analyzing...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Describe a crisis..."
            className="flex-1 bg-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 border border-slate-600 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              !input.trim() || isLoading
                ? 'bg-blue-500/30 text-blue-300 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
