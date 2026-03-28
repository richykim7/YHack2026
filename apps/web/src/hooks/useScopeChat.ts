'use client';
import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, CrisisProfile } from '@/lib/types';
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
  }, []);

  const resetChat = useCallback(() => {
    setMessages([]);
    setCrisisProfile(null);
    sessionIdRef.current = crypto.randomUUID();
  }, []);

  return {
    messages,
    isLoading,
    crisisProfile,
    sessionId: sessionIdRef.current,
    sendMessage,
    resetChat,
  };
}
