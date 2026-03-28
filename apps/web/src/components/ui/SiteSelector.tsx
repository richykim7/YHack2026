'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, MapPin, Building2, Check } from 'lucide-react';
import type { Site } from '@/lib/types';

interface SiteSelectorProps {
  sites: Site[];
  selectedSite: Site | null;
  onSelect: (site: Site | null) => void;
}

export function SiteSelector({ sites, selectedSite, onSelect }: SiteSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [open]);

  const healthDot = (score: number) => {
    const color = score >= 0.7 ? 'bg-green-400' : score >= 0.5 ? 'bg-amber-400' : 'bg-red-400';
    return <span className={`w-2 h-2 rounded-full ${color} shrink-0`} />;
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2.5 bg-slate-800 border text-sm rounded-lg px-3.5 py-2 transition-all min-w-[240px] ${
          open
            ? 'border-blue-500/50 ring-2 ring-blue-500/20'
            : 'border-slate-700 hover:border-slate-600'
        }`}
      >
        <div className="flex items-center gap-2 flex-1 text-left">
          {selectedSite ? (
            <>
              {healthDot(selectedSite.health_score)}
              <span className="text-slate-200 truncate">{selectedSite.name}</span>
            </>
          ) : (
            <>
              <Building2 size={14} className="text-slate-400" />
              <span className="text-slate-300">All Sites (Network-wide)</span>
            </>
          )}
        </div>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1.5 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-xl shadow-black/30 overflow-hidden">
          {/* Network-wide option */}
          <button
            type="button"
            onClick={() => { onSelect(null); setOpen(false); }}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors hover:bg-slate-700/50 ${
              !selectedSite ? 'bg-blue-500/10 text-blue-300' : 'text-slate-300'
            }`}
          >
            <Building2 size={14} className="text-slate-400 shrink-0" />
            <span className="flex-1 text-left">All Sites (Network-wide)</span>
            {!selectedSite && <Check size={14} className="text-blue-400" />}
          </button>

          <div className="border-t border-slate-700/60" />

          {/* Sites list */}
          <div className="max-h-64 overflow-y-auto py-1">
            {sites.map(site => {
              const isSelected = selectedSite?.id === site.id;
              return (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => { onSelect(site); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm transition-colors hover:bg-slate-700/50 ${
                    isSelected ? 'bg-blue-500/10' : ''
                  }`}
                >
                  {healthDot(site.health_score)}
                  <div className="flex-1 text-left min-w-0">
                    <div className={`truncate ${isSelected ? 'text-blue-300' : 'text-slate-200'}`}>
                      {site.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <MapPin size={10} className="text-slate-600 shrink-0" />
                      <span className="text-[11px] text-slate-500 truncate">{site.region ?? site.type}</span>
                      <span className="text-[11px] font-mono text-slate-600">
                        {(site.health_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check size={14} className="text-blue-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
