'use client';

interface InfoTooltipProps {
  text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  return (
    <span className="relative group inline-flex items-center ml-1 cursor-help">
      <span className="w-3.5 h-3.5 rounded-full border border-slate-600 flex items-center justify-center text-[9px] font-bold text-slate-500 group-hover:text-slate-300 group-hover:border-slate-400 transition-colors">
        i
      </span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-xs text-slate-200 whitespace-normal w-56 text-center opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50 shadow-lg">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-700" />
      </span>
    </span>
  );
}
