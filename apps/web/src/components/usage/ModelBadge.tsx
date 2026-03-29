'use client';

interface ModelBadgeProps {
  model: string;
  provider?: string;
}

function getModelStyle(model: string): { bg: string; text: string } {
  const m = model.toLowerCase();
  if (m.includes('claude') || m.includes('anthropic') || m.includes('sonnet'))
    return { bg: 'bg-amber-500/15 border-amber-500/30', text: 'text-amber-300' };
  if (m.includes('gemini') || m.includes('google'))
    return { bg: 'bg-blue-500/15 border-blue-500/30', text: 'text-blue-300' };
  if (m.includes('gpt') || m.includes('openai'))
    return { bg: 'bg-emerald-500/15 border-emerald-500/30', text: 'text-emerald-300' };
  return { bg: 'bg-slate-700/50 border-slate-600/30', text: 'text-slate-300' };
}

export function ModelBadge({ model }: ModelBadgeProps) {
  const style = getModelStyle(model);
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-mono font-bold ${style.bg} ${style.text}`}>
      {model}
    </span>
  );
}
