'use client';

import React, { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  exportUserDataAsJSON, 
  importUserDataFromJSON, 
  clearAllUserData,
  getUserStatsCounts
} from '@/lib/db';
import { 
  Database, 
  Download, 
  Upload, 
  Trash2, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
  homeAddress?: string;
}

export function DataManagementModal({
  isOpen,
  onClose,
  onDataChanged,
  homeAddress,
}: DataManagementModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  const handleExport = async () => {
    try {
      const json = await exportUserDataAsJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `interpelli-padova-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage({ type: 'success', text: 'Backup esportato con successo!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Errore durante l\'esportazione: ' + err.message });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const success = await importUserDataFromJSON(content);
        if (success) {
          setStatusMessage({ type: 'success', text: 'Dati importati e ripristinati correttamente!' });
          onDataChanged();
        } else {
          setStatusMessage({ type: 'error', text: 'File non valido o danneggiato.' });
        }
      } catch (err: any) {
        setStatusMessage({ type: 'error', text: 'Errore lettura file: ' + err.message });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleClear = async () => {
    try {
      await clearAllUserData();
      // Pulisce anche eventuale legacy localStorage
      localStorage.removeItem('cerca_interpelli_user_location');
      localStorage.removeItem('cerca_interpelli_max_radius');
      localStorage.removeItem('cerca_interpelli_filter_list_by_dist');
      
      setIsConfirmingClear(false);
      setStatusMessage({ type: 'success', text: 'Tutti i dati personali locali sono stati eliminati.' });
      onDataChanged();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'Errore durante la cancellazione: ' + err.message });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md bg-card text-foreground">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-foreground/5 border border-border flex items-center justify-center">
              <Database className="w-4 h-4 text-foreground" />
            </div>
            <DialogTitle className="text-base font-semibold">
              I Tuoi Dati Personali (IndexedDB)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            I preferiti, le candidature inviate, le note personali e la posizione della tua casa sono salvati esclusivamente nella memoria protetta del tuo browser con <strong>Dexie (IndexedDB)</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* Box Privacy & Multi-Utente */}
          <div className="p-3 rounded-lg bg-muted/60 border border-border space-y-1.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Massima Privacy & Multi-Utente</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Nessun dato personale viene salvato sui server centrali. Se un altro collega o utente accede all'app dal proprio dispositivo, vedrà solo il proprio profilo.
            </p>
            {homeAddress && (
              <p className="text-[11px] text-foreground/80 pt-1 border-t border-border/50">
                📍 <strong>Casa impostata:</strong> {homeAddress}
              </p>
            )}
          </div>

          {/* Feedback status */}
          {statusMessage && (
            <div className={`p-2.5 rounded-md text-xs flex items-center gap-2 ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' 
                : 'bg-destructive/10 text-destructive border border-destructive/20'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Azioni Backup & Ripristino */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Backup e Trasferimento</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="h-9 text-xs gap-1.5 w-full justify-center"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Esporta Backup</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleImportClick}
                className="h-9 text-xs gap-1.5 w-full justify-center"
              >
                <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Importa Backup</span>
              </Button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
          </div>

          {/* Reset Dati */}
          <div className="pt-2 border-t border-border">
            {!isConfirmingClear ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsConfirmingClear(true)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-2 text-xs gap-1.5 w-full justify-center"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Cancella tutti i dati locali</span>
              </Button>
            ) : (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 space-y-2 text-center">
                <p className="text-xs font-medium text-destructive">
                  Sei sicuro? Perderai preferiti, note e indirizzo salvati su questo browser.
                </p>
                <div className="flex justify-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleClear}
                    className="h-7 text-xs px-3"
                  >
                    Sì, cancella
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsConfirmingClear(false)}
                    className="h-7 text-xs px-3"
                  >
                    Annulla
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
