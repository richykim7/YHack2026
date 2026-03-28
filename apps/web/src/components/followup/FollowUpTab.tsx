'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import { postJSON } from '@/lib/api';
import type { FollowupResponse } from '@/lib/types';
import { cn } from '@/components/ui/cn';

interface FollowUpTabProps {
  isComplete: boolean;
  sessionId: string | null;
}

export function FollowUpTab({ isComplete, sessionId }: FollowUpTabProps) {
  const [question, setQuestion] = useState('');
  const [conversations, setConversations] = useState<
    Array<{ question: string; response: FollowupResponse }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new conversations arrive or loading state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations.length, isLoading]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim() || !sessionId) return;
    setIsLoading(true);
    setError(null);
    const q = question;
    setQuestion('');
    try {
      const response = await postJSON<FollowupResponse>('/api/followup', {
        question: q,
        session_id: sessionId,
      });
      setConversations((prev) => [...prev, { question: q, response }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
      setQuestion(q); // Restore question on error
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="h-full flex flex-col p-6">
      {/* Not-ready overlay message */}
      {!isComplete && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-slate-500 text-sm">
            Follow-up available after pipeline completes
          </p>
        </div>
      )}

      {/* Conversation area */}
      {isComplete && (
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          {conversations.length === 0 && !isLoading && (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-500 text-sm">
                Ask a question about the crisis analysis, response plans, or
                sourcing options
              </p>
            </div>
          )}

          {conversations.map((conv, i) => (
            <div key={i} className="space-y-3">
              {/* User question */}
              <div className="flex justify-end">
                <div className="bg-blue-600/20 text-blue-100 rounded-lg p-3 max-w-[80%] ml-auto">
                  <p className="text-sm">{conv.question}</p>
                </div>
              </div>
              {/* AI response */}
              <div className="flex justify-start">
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 max-w-[90%]">
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">
                    {conv.response.answer}
                  </p>
                  {conv.response.chart_url && (
                    <img
                      src={conv.response.chart_url}
                      alt="Analysis chart"
                      className="mt-3 rounded-lg border border-slate-700 max-w-full"
                    />
                  )}
                  {conv.response.thread_url && (
                    <a
                      href={conv.response.thread_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:underline mt-2 inline-block"
                    >
                      View in Hex
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Loading placeholder */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 rounded-lg p-4 animate-pulse max-w-[90%]">
                <div className="h-4 bg-slate-700 rounded w-48 mb-2" />
                <div className="h-4 bg-slate-700 rounded w-32" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3 border border-red-500/20 mb-4">
          {error}
        </div>
      )}

      {/* Input area */}
      <div
        className={cn(
          'border-t border-slate-700 pt-4',
          !isComplete && 'opacity-50 pointer-events-none',
        )}
      >
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a follow-up question..."
            className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={!isComplete}
          />
          <button
            type="submit"
            disabled={isLoading || !question.trim() || !isComplete || !sessionId}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-3 font-display font-bold uppercase tracking-widest text-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
