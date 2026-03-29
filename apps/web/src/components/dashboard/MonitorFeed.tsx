'use client';
import { useEffect, useRef } from 'react';
import { Radio, Bird, Newspaper, AlertTriangle, Check, Zap, Search, Brain, Cpu } from 'lucide-react';
import type { MonitorPost, MonitorClassification } from '@/lib/types';

interface MonitorFeedProps {
  posts: MonitorPost[];
  classifications: Map<string, MonitorClassification>;
  crisisDetected: boolean;
  monitorMode: 'idle' | 'monitoring' | 'pipeline';
  orchestratorSteps?: { step: string; model: string; message: string }[];
}

function sourceIcon(source: string) {
  switch (source) {
    case 'twitter': return <Bird size={12} className="text-sky-400" />;
    case 'news': return <Newspaper size={12} className="text-amber-400" />;
    case 'community_alert': return <AlertTriangle size={12} className="text-red-400" />;
    default: return <Radio size={12} className="text-slate-400" />;
  }
}

function stepIcon(step: string) {
  switch (step) {
    case 'web_research': return <Search size={14} className="text-blue-400" />;
    case 'crisis_analysis': return <Brain size={14} className="text-purple-400" />;
    case 'profile_assembly': return <Cpu size={14} className="text-emerald-400" />;
    default: return <Zap size={14} className="text-slate-400" />;
  }
}

function ClassificationBadge({ classification }: { classification: MonitorClassification }) {
  const pct = Math.round(classification.confidence * 100);
  if (classification.relevant) {
    return (
      <div className="animate-badge-pop flex items-center gap-1.5 mt-2 px-2 py-1 rounded-md bg-red-500/15 border border-red-500/30">
        <AlertTriangle size={12} className="text-red-400" />
        <span className="text-xs font-bold text-red-300 uppercase tracking-wide">Relevant</span>
        <span className="text-xs text-red-400/70">({pct}%)</span>
      </div>
    );
  }
  return (
    <div className="animate-badge-pop flex items-center gap-1.5 mt-2 px-2 py-1 rounded-md bg-slate-700/50 border border-slate-600/30">
      <Check size={12} className="text-emerald-400" />
      <span className="text-xs text-slate-400">Irrelevant</span>
      <span className="text-xs text-slate-500">({pct}%)</span>
    </div>
  );
}

export function MonitorFeed({ posts, classifications, crisisDetected, monitorMode, orchestratorSteps }: MonitorFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new posts
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [posts.length, classifications.size, crisisDetected, orchestratorSteps?.length]);

  return (
    <div
      className="flex flex-col h-full bg-slate-850 border-l border-slate-700 w-80"
      style={{ background: 'linear-gradient(180deg, #1a2332 0%, #0f172a 100%)' }}
    >
      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-700/80">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-md border flex items-center justify-center ${
            crisisDetected
              ? 'bg-red-500/20 border-red-500/30'
              : 'bg-emerald-500/20 border-emerald-500/30 animate-pulse-ring'
          }`}>
            <Radio size={14} className={crisisDetected ? 'text-red-400' : 'text-emerald-400'} />
          </div>
          <div>
            <h2 className="text-sm font-display font-bold text-slate-100 tracking-wide">
              {crisisDetected ? 'CRISIS DETECTED' : 'MONITORING'}
            </h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">
              {crisisDetected ? 'Pipeline launching' : 'Scanning public feeds'}
            </p>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {posts.length === 0 && monitorMode === 'monitoring' && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-4">
              <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-3 animate-pulse">
                <Radio size={20} className="text-emerald-500" />
              </div>
              <p className="text-sm font-display font-semibold text-slate-400">Connecting to feeds...</p>
              <p className="text-xs text-slate-600 mt-1">Monitoring Twitter, news, community alerts</p>
            </div>
          </div>
        )}

        {/* Post cards */}
        {posts.map(post => {
          const cls = classifications.get(post.id);
          const isIrrelevant = cls && !cls.relevant;
          return (
            <div
              key={post.id}
              className={`animate-slide-in-right rounded-lg border p-3 transition-opacity duration-300 ${
                isIrrelevant
                  ? 'bg-slate-800/40 border-slate-700/40 opacity-60'
                  : 'bg-slate-800/80 border-slate-700/60'
              }`}
            >
              {/* Post header */}
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center">
                  {sourceIcon(post.source)}
                </div>
                <span className="text-xs font-bold text-slate-300 truncate">{post.author}</span>
                <span className="text-[10px] text-slate-600 uppercase">{post.source.replace('_', ' ')}</span>
              </div>
              {/* Post content */}
              <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">{post.content}</p>
              {/* Classification badge (appears after classification event) */}
              {cls && <ClassificationBadge classification={cls} />}
            </div>
          );
        })}

        {/* Crisis Detected Banner */}
        {crisisDetected && (
          <div className="animate-crisis-flash rounded-lg border-2 border-red-500/50 bg-red-500/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={18} className="text-red-400" />
              <span className="text-sm font-display font-bold text-red-300 uppercase tracking-wide">
                Crisis Detected
              </span>
            </div>
            <p className="text-xs text-red-300/80">
              Food security threat identified. Initiating multi-model crisis analysis...
            </p>
          </div>
        )}

        {/* Orchestrator Progress */}
        {orchestratorSteps && orchestratorSteps.length > 0 && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} className="text-amber-400" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">Orchestrator</span>
            </div>
            <div className="space-y-2">
              {orchestratorSteps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 animate-slide-in-right">
                  {stepIcon(s.step)}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 truncate">{s.message}</p>
                    <p className="text-[10px] text-slate-500">{s.model}</p>
                  </div>
                  <Check size={12} className="text-emerald-400 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Footer status */}
      <div className="px-4 py-3 border-t border-slate-700/80 bg-slate-900/50">
        <div className="flex items-center gap-2">
          {monitorMode === 'monitoring' && !crisisDetected && (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-slate-400">
                {posts.length} posts scanned, {classifications.size} classified
              </span>
            </>
          )}
          {crisisDetected && monitorMode === 'monitoring' && (
            <>
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <span className="text-xs text-red-300">Assembling crisis profile...</span>
            </>
          )}
          {monitorMode === 'pipeline' && (
            <>
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs text-blue-300">Pipeline running...</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
