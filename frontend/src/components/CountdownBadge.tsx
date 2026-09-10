'use client';

import React from 'react';
import { Clock, AlertTriangle, CheckCircle, Calendar } from 'lucide-react';

interface CountdownBadgeProps {
  scadenza?: string | null;
  scadenzaRaw?: string | null;
  timeRemainingSeconds?: number | null;
  isExpired: boolean;
}

export function CountdownBadge({
  scadenza,
  scadenzaRaw,
  timeRemainingSeconds,
  isExpired,
}: CountdownBadgeProps) {
  if (!scadenza) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        <Calendar className="w-3.5 h-3.5" />
        <span>Scadenza da bando</span>
      </span>
    );
  }

  if (isExpired || (timeRemainingSeconds !== null && timeRemainingSeconds !== undefined && timeRemainingSeconds <= 0)) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
        <Clock className="w-3.5 h-3.5" />
        <span>Scaduto</span>
      </span>
    );
  }

  const seconds = timeRemainingSeconds ?? 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const days = Math.floor(hours / 24);

  // Meno di 12 ore: rosso urgente con pulsazione
  if (hours < 12) {
    return (
      <span className="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-sm animate-pulse">
        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute left-2" />
        <AlertTriangle className="w-3.5 h-3.5 ml-1 text-rose-600 dark:text-rose-400" />
        <span>Scade tra {hours > 0 ? `${hours}h ` : ''}{minutes}m</span>
      </span>
    );
  }

  // Tra 12 e 24 ore: arancione/ambra
  if (hours < 24) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
        <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        <span>Scade tra {hours}h</span>
      </span>
    );
  }

  // Più di 24 ore
  const dateObj = new Date(scadenza);
  const formattedDate = dateObj.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
      <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
      <span>Scade {days > 0 ? `tra ${days}g (${formattedDate})` : formattedDate}</span>
    </span>
  );
}
