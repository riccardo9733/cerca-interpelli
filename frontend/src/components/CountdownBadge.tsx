'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';

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
      <Badge variant="outline" className="font-normal text-muted-foreground text-[11px] gap-1.5 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
        <span>Da bando</span>
      </Badge>
    );
  }

  if (isExpired || (timeRemainingSeconds !== null && timeRemainingSeconds !== undefined && timeRemainingSeconds <= 0)) {
    return (
      <Badge variant="secondary" className="font-normal text-muted-foreground text-[11px] gap-1.5 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600 shrink-0" />
        <span>Scaduto</span>
      </Badge>
    );
  }

  const seconds = timeRemainingSeconds ?? 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const days = Math.floor(hours / 24);

  // Meno di 12 ore: punto rosso tenue con testo ad alto contrasto
  if (hours < 12) {
    return (
      <Badge variant="outline" className="text-[11px] font-medium border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 gap-1.5 py-0.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
        </span>
        <span>{hours > 0 ? `${hours}h ` : ''}{minutes}m rimasti</span>
      </Badge>
    );
  }

  // Tra 12 e 24 ore: ambra sobrio
  if (hours < 24) {
    return (
      <Badge variant="outline" className="text-[11px] font-medium border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 gap-1.5 py-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
        <span>Scade tra {hours}h</span>
      </Badge>
    );
  }

  // Più di 24 ore: sobrio secondario
  const dateObj = new Date(scadenza);
  const formattedDate = dateObj.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Badge variant="secondary" className="text-[11px] font-normal text-muted-foreground gap-1.5 py-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
      <span>Scade {days > 0 ? `tra ${days}g (${formattedDate})` : formattedDate}</span>
    </Badge>
  );
}
