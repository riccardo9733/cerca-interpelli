'use client';

import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAInstallPromptProps {
  variant?: 'navbar' | 'banner';
}

export function PWAInstallPrompt({ variant = 'navbar' }: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Controllo se l'app è già installata/eseguita in standalone
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    setIsStandalone(isStandaloneMode);

    // Controllo se dismissed precedentemente
    if (localStorage.getItem('pwa_prompt_dismissed') === 'true') {
      setDismissed(true);
    }

    // Controllo dispositivi iOS (dove beforeinstallprompt non è supportato da Safari)
    const ua = window.navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;

    if (choiceResult.outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  // Se l'app è già in modalità standalone, non mostra nulla
  if (isStandalone) return null;

  // Se non c'è il prompt e non è iOS, o se l'utente ha rifiutato in precedenza la banner
  if (!deferredPrompt && !isIOS) return null;
  if (dismissed && variant === 'banner') return null;

  if (variant === 'navbar') {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={handleInstallClick}
          className="h-8 sm:h-9 px-2.5 sm:px-3 gap-1.5 text-xs font-medium border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors"
          title="Installa Cerca Interpelli come App sul tuo dispositivo"
        >
          <Smartphone className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="hidden sm:inline">Installa App</span>
        </Button>

        {/* Modal Istruzioni iOS */}
        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-sm bg-background border border-border rounded-xl p-5 shadow-lg">
              <button
                onClick={() => setShowIOSModal(false)}
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  IP
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Installa su iPhone / iPad</h3>
                  <p className="text-xs text-muted-foreground">Aggiungi alla schermata Home</p>
                </div>
              </div>
              <ol className="text-xs space-y-2.5 my-4 text-muted-foreground list-decimal list-inside">
                <li>Tocca il pulsante <span className="font-medium text-foreground inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded"><Share className="w-3 h-3" /> Condividi</span> in basso nel browser Safari.</li>
                <li>Scorri verso il basso e seleziona <span className="font-medium text-foreground bg-muted px-1.5 py-0.5 rounded">Aggiungi alla schermata Home</span>.</li>
                <li>Tocca <span className="font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">Aggiungi</span> in alto a destra.</li>
              </ol>
              <Button
                variant="default"
                size="sm"
                className="w-full text-xs h-8"
                onClick={() => setShowIOSModal(false)}
              >
                Ho capito
              </Button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Variant 'banner' - Notifica discreta in basso a destra
  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 max-w-sm bg-background/95 backdrop-blur-md border border-border rounded-xl p-3.5 shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300">
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Download className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground leading-snug">
            Installa l'app per un accesso rapido e consultazione offline
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="default"
            size="sm"
            onClick={handleInstallClick}
            className="h-7 px-2.5 text-xs font-medium"
          >
            Installa
          </Button>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md"
            title="Chiudi"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Modal Istruzioni iOS */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-background border border-border rounded-xl p-5 shadow-lg">
            <button
              onClick={() => setShowIOSModal(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                IP
              </div>
              <div>
                <h3 className="font-semibold text-sm">Installa su iPhone / iPad</h3>
                <p className="text-xs text-muted-foreground">Aggiungi alla schermata Home</p>
              </div>
            </div>
            <ol className="text-xs space-y-2.5 my-4 text-muted-foreground list-decimal list-inside">
              <li>Tocca il pulsante <span className="font-medium text-foreground inline-flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded"><Share className="w-3 h-3" /> Condividi</span> in basso nel browser Safari.</li>
              <li>Scorri verso il basso e seleziona <span className="font-medium text-foreground bg-muted px-1.5 py-0.5 rounded">Aggiungi alla schermata Home</span>.</li>
              <li>Tocca <span className="font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">Aggiungi</span> in alto a destra.</li>
            </ol>
            <Button
              variant="default"
              size="sm"
              className="w-full text-xs h-8"
              onClick={() => setShowIOSModal(false)}
            >
              Ho capito
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
