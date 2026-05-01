'use client';

import { CheckCircle2, Loader2 } from 'lucide-react';

interface ParticipantCardProps {
  name: string;
  status: 'connecting' | 'success' | string;
  highlightName?: boolean;
}

export function ParticipantCard({ name, status, highlightName = false }: ParticipantCardProps) {
  const isSuccess = status === 'success';
  const statusLabel = isSuccess ? 'Success' : 'Connecting...';
  const statusClass = isSuccess ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-orange-600 bg-orange-50 border-orange-100';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-4">
      <div>
        <p className={`text-sm font-semibold ${highlightName ? 'text-cyan-700' : 'text-gray-900'}`}>{name}</p>
        <span className={`mt-1 inline-flex items-center gap-2 px-2.5 py-1 text-[11px] font-medium rounded-full border ${statusClass}`}>
          {isSuccess ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {statusLabel}
        </span>
      </div>
      <div className="text-xs text-gray-400">&bull;</div>
    </div>
  );
}
