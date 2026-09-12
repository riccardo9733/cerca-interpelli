'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Eye, EyeOff, Lock, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { verifyAdminPassword, setAdminUnlocked } from '@/lib/admin';

interface AdminGateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

export function AdminGate({ open, onOpenChange }: AdminGateProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset + autofocus ogni apertura
  useEffect(() => {
    if (open) {
      setPassword('');
      setError(null);
      setIsChecking(false);
      setShowPassword(false);
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open ]);

  const lockedMsLeft =
    lockedUntil && lockedUntil > Date.now() ? lockedUntil - Date.now() : 0;

  // Sblocco countdown lockout
  useEffect(() => {
    if (!lockedMsLeft) return;
    const t = setTimeout(() => {
      setLockedUntil(null);
      setAttempts(0);
    }, lockedMsLeft);
    return () => clearTimeout(t);
  }, [lockedMsLeft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isChecking || lockedMsLeft > 0 || !password) return;
    setIsChecking(true);
    setError(null);
    try {
      const ok = await verifyAdminPassword(password);
      if (ok) {
        setAdminUnlocked();
        onOpenChange(false);
      } else {
        const next = attempts + 1;
        setAttempts(next);
        if (next >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCKOUT_MS);
          setError(
            'Troppi tentativi. Riprova tra 30 secondi.'
          );
        } else {
          setError(
            `Password errata (${next}/${MAX_ATTEMPTS}).`
          );
        }
      }
    } catch {
      setError('Errore di verifica. Riprova.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <DialogTitle className="text-sm">Area riservata</DialogTitle>
              <DialogDescription>
                Inserisci la password per sbloccare le funzioni avanzate su
                questo dispositivo (solo questa sessione).
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="off"
              disabled={isChecking || lockedMsLeft > 0}
              className="pl-9 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition cursor-pointer"
              aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-2.5 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Annulla
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isChecking || !password || lockedMsLeft > 0}
              className="text-xs gap-1.5 min-w-24"
            >
              {isChecking ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : lockedMsLeft > 0 ? (
                <span>Bloccato {Math.ceil(lockedMsLeft / 1000)}s</span>
              ) : (
                <span>Sblocca</span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
