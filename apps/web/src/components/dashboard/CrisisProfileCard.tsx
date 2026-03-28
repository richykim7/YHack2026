'use client';
import type { CrisisProfile } from '@/lib/types';
import { AlertTriangle, MapPin, Users, TrendingUp, Clock } from 'lucide-react';

interface CrisisProfileCardProps {
  profile: CrisisProfile;
  onLaunchPipeline?: () => void;
  pipelineLaunched?: boolean;
}

function severityColor(severity: number): string {
  if (severity <= 2) return 'text-green-400';
  if (severity === 3) return 'text-yellow-400';
  return 'text-red-400';
}

export function CrisisProfileCard({ profile, onLaunchPipeline, pipelineLaunched }: CrisisProfileCardProps) {
  return (
    <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={14} className="text-amber-400" />
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Crisis Profile
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-xs text-slate-400">Type</span>
          <p className="text-slate-200">{profile.crisis_type}</p>
        </div>
        <div className="flex items-start gap-1">
          <MapPin size={12} className="text-slate-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-xs text-slate-400">Geography</span>
            <p className="text-slate-200">{profile.geography}</p>
          </div>
        </div>
        <div>
          <span className="text-xs text-slate-400">Severity</span>
          <p className={severityColor(profile.severity)}>
            {profile.severity}/5
          </p>
        </div>
        <div className="flex items-start gap-1">
          <Users size={12} className="text-slate-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-xs text-slate-400">Affected</span>
            <p className="text-slate-200">
              {profile.affected_population.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-1">
          <TrendingUp size={12} className="text-slate-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-xs text-slate-400">Demand Delta</span>
            <p className="text-slate-200">+{profile.demand_delta_pct}%</p>
          </div>
        </div>
        <div className="flex items-start gap-1">
          <Clock size={12} className="text-slate-400 mt-0.5 shrink-0" />
          <div>
            <span className="text-xs text-slate-400">Timeline</span>
            <p className="text-slate-200">{profile.timeline_days} days</p>
          </div>
        </div>
      </div>

      {profile.notes && (
        <div className="mt-2 pt-2 border-t border-slate-600">
          <span className="text-xs text-slate-400">Notes</span>
          <p className="text-xs text-slate-300 mt-0.5">{profile.notes}</p>
        </div>
      )}

      <button
        onClick={onLaunchPipeline}
        disabled={pipelineLaunched}
        className={`mt-3 w-full py-2 rounded-lg text-sm font-medium transition-colors ${
          pipelineLaunched
            ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        {pipelineLaunched ? 'Pipeline Launched' : 'Launch Pipeline'}
      </button>
    </div>
  );
}
