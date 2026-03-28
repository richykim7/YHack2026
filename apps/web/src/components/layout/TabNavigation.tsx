'use client';
import { cn } from '@/components/ui/cn';
import type { TabId } from '@/lib/types';
import { LayoutDashboard, Map, ClipboardList, FileText, MessageCircle } from 'lucide-react';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'map', label: 'Map', icon: Map },
  { id: 'assessment', label: 'Assessment', icon: ClipboardList },
  { id: 'plans', label: 'Plans', icon: FileText },
  { id: 'followup', label: 'Follow-up', icon: MessageCircle },
];

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  isStreaming?: boolean;
}

export function TabNavigation({ activeTab, onTabChange, isStreaming }: TabNavigationProps) {
  return (
    <nav className="flex gap-1 px-6 py-1 bg-slate-800/50 border-b border-slate-700">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors',
            activeTab === id
              ? 'bg-slate-700 text-blue-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          )}
        >
          <Icon size={16} />
          {label}
          {id === 'assessment' && isStreaming && (
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          )}
        </button>
      ))}
    </nav>
  );
}
