'use client';
import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, CrisisProfile, FollowupResponse } from '@/lib/types';
import { postJSON } from '@/lib/api';

interface ScopeChatResponse {
  response: string;
  crisis_profile: CrisisProfile | null;
  is_complete: boolean;
}

export function useScopeChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [crisisProfile, setCrisisProfile] = useState<CrisisProfile | null>(null);
  const [followUpMode, setFollowUpMode] = useState(false);
  const [threadUrl, setThreadUrl] = useState<string | null>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'human',
      content,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      if (followUpMode && crisisProfile) {
        // Route data questions to Hex Threads followup endpoint
        const data = await postJSON<FollowupResponse>('/api/crisis/followup', {
          question: content,
          crisis_type: crisisProfile.crisis_type,
          geography: crisisProfile.geography,
          affected_population: crisisProfile.affected_population,
          timeline_days: crisisProfile.timeline_days,
          demand_delta_pct: crisisProfile.demand_delta_pct,
        });

        setThreadUrl(data.thread_url);

        const aiMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'ai',
          content: data.answer,
          threadUrl: data.thread_url,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        // Standard SCOPE crisis intake flow
        const data = await postJSON<ScopeChatResponse>('/api/scope/chat', {
          session_id: sessionIdRef.current,
          message: content,
        });

        const aiMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'ai',
          content: data.response,
          crisisProfile: data.crisis_profile ?? undefined,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, aiMsg]);

        if (data.crisis_profile) {
          setCrisisProfile(data.crisis_profile);
        }
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'ai',
        content: 'Connection error. Please try again.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [followUpMode, crisisProfile]);

  const enableFollowUp = useCallback(() => {
    setFollowUpMode(true);
    const systemMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'ai',
      content:
        'Pipeline complete. You can now ask follow-up questions about the data — ' +
        "I'll route them to Hex Threads for analysis against the CrisisGrid database.",
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, systemMsg]);
  }, []);

  const resetChat = useCallback(() => {
    setMessages([]);
    setCrisisProfile(null);
    setFollowUpMode(false);
    setThreadUrl(null);
    sessionIdRef.current = crypto.randomUUID();
  }, []);

  return {
    messages,
    isLoading,
    crisisProfile,
    followUpMode,
    threadUrl,
    sessionId: sessionIdRef.current,
    sendMessage,
    enableFollowUp,
    resetChat,
  };
}
