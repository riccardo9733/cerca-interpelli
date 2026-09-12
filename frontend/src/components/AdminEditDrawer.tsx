'use client';

import React, { useEffect, useState } from 'react';
import { PencilLine, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { Interpello } from '@/types/interpello';
import { updateInterpelloAdmin, deleteInterpelloAdmin } from '@/lib/api';
import { isAdminUnlocked } from '@/lib/admin';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface AdminEditDrawerProps {
  interpello: Interpello | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: Interpello) => void;
  onDeleted: (id: number) => void;
}

function toInputDateTime(v?: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toInputDate(v?: string | null): string {
  if (!v) return '';
  // Accetta sia DATE (YYYY-MM-DD) che ISO completi
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function fromInputDateTime(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

interface FormState {
  title: string;
  school_name: string;
  school_code: string;
  school_address: string;
  school_city: string;
  classi: string;
  ordine_scuola: string;
  tipo_posto: string;
  ore_settimanali: string;
  posti_disponibili: string;
  periodo_desc: string;
  periodo_inizio: string;
  periodo_fine: string;
  scadenza: string;
  scadenza_raw: string;
  email_candidatura: string;
  oggetto_email: string;
  link_candidatura: string;
  latitude: string;
  longitude: string;
}

function fromInterpello(i: Interpello): FormState {
  return {
    title: i.title ?? '',
    school_name: i.school_name ?? '',
    school_code: i.school_code ?? '',
    school_address: i.school_address ?? '',
    school_city: i.school_city ?? '',
    classi: (i.classi_concorso ?? []).join(', '),
    ordine_scuola: i.ordine_scuola ?? '',
    tipo_posto: i.tipo_posto ?? '',
    ore_settimanali: i.ore_settimanali ?? '',
    posti_disponibili:
      i.posti_disponibili !== null && i.posti_disponibili !== undefined
        ? String(i.posti_disponibili)
        : '',
    periodo_desc: i.periodo_desc ?? '',
    periodo_inizio: toInputDate(i.periodo_inizio),
    periodo_fine: toInputDate(i.periodo_fine),
    scadenza: toInputDateTime(i.scadenza),
    scadenza_raw: i.scadenza_raw ?? '',
    email_candidatura: i.email_candidatura ?? '',
    oggetto_email: i.oggetto_email ?? '',
    link_candidatura: i.link_candidatura ?? '',
    latitude:
      i.latitude !== null && i.latitude !== undefined ? String(i.latitude) : '',
    longitude:
      i.longitude !== null && i.longitude !== undefined
        ? String(i.longitude)
        : '',
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      {children}
    </label>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold text-foreground border-b border-border pb-1.5">
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

export function AdminEditDrawer({
  interpello,
  open,
  onOpenChange,
  onSaved,
  onDeleted,
}: AdminEditDrawerProps) {
  const isMobile = useIsMobile();
  const [form, setForm] = useState<FormState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && interpello) {
      setForm(fromInterpello(interpello));
      setError(null);
      setIsSaving(false);
      setIsDeleting(false);
      setIsConfirmingDelete(false);
    }
    if (!open) {
      setForm(null);
      setError(null);
      setIsConfirmingDelete(false);
    }
  }, [open, interpello]);

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => setForm((prev) => (prev ? { ...prev, [key]: e.target.value } : prev));

  const handleReset = () => {
    if (interpello) setForm(fromInterpello(interpello));
    setError(null);
  };

  const handleDelete = async () => {
    if (!interpello || isDeleting) return;
    if (!isAdminUnlocked()) {
      setError('Sessione admin non attiva.');
      return;
    }
    setIsDeleting(true);
    setError(null);
    try {
      await deleteInterpelloAdmin(interpello.id);
      onDeleted(interpello.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore eliminazione');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interpello || !form || isSaving) return;
    if (!isAdminUnlocked()) {
      setError('Sessione admin non attiva.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateInterpelloAdmin(interpello.id, {
        title: form.title.trim() || interpello.title,
        school_name: form.school_name.trim() || null,
        school_code: form.school_code.trim() || null,
        school_address: form.school_address.trim() || null,
        school_city: form.school_city.trim() || null,
        classi_concorso: form.classi
          .split(',')
          .map((v) => v.trim().toUpperCase())
          .filter(Boolean),
        ordine_scuola: form.ordine_scuola.trim() || null,
        tipo_posto: form.tipo_posto.trim() || null,
        ore_settimanali: form.ore_settimanali.trim() || null,
        posti_disponibili: form.posti_disponibili
          ? Number(form.posti_disponibili)
          : null,
        periodo_desc: form.periodo_desc.trim() || null,
        periodo_inizio: form.periodo_inizio || null,
        periodo_fine: form.periodo_fine || null,
        scadenza: fromInputDateTime(form.scadenza),
        scadenza_raw: form.scadenza_raw.trim() || null,
        email_candidatura: form.email_candidatura.trim() || null,
        oggetto_email: form.oggetto_email.trim() || null,
        link_candidatura: form.link_candidatura.trim() || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
      });
      // Reintegra flag locali (preferiti/note) che vivono in Dexie, non nel DB
      onSaved({
        ...updated,
        is_candidato: interpello.is_candidato,
        is_preferito: interpello.is_preferito,
        status_candidatura: interpello.status_candidatura,
        notes: interpello.notes,
        candidatura_date: interpello.candidatura_date,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvataggio');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={
          isMobile
            ? 'max-h-[88vh] overflow-y-auto px-5 pb-8 pt-2'
            : 'overflow-y-auto p-6'
        }
      >
        {isMobile && (
          <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
        )}

        <SheetHeader className="text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <PencilLine className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-sm truncate">
                Modifica interpello #{interpello?.id}
              </SheetTitle>
              <SheetDescription>
                Solo admin · le modifiche sono salvate nel database e protette
                dal prossimo sync automatico.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {form && (
          <form onSubmit={handleSave} className="mt-5 space-y-6 pb-4">
            <Section title="Bando e scuola">
              <div className="sm:col-span-2">
                <Field label="Titolo">
                  <Input value={form.title} onChange={set('title')} />
                </Field>
              </div>
              <Field label="Scuola">
                <Input value={form.school_name} onChange={set('school_name')} />
              </Field>
              <Field label="Codice scuola">
                <Input value={form.school_code} onChange={set('school_code')} />
              </Field>
              <Field label="Indirizzo">
                <Input
                  value={form.school_address}
                  onChange={set('school_address')}
                />
              </Field>
              <Field label="Città">
                <Input value={form.school_city} onChange={set('school_city')} />
              </Field>
              <Field label="Latitudine">
                <Input
                  inputMode="decimal"
                  placeholder="45.4064"
                  value={form.latitude}
                  onChange={set('latitude')}
                />
              </Field>
              <Field label="Longitudine">
                <Input
                  inputMode="decimal"
                  placeholder="11.8768"
                  value={form.longitude}
                  onChange={set('longitude')}
                />
              </Field>
            </Section>

            <Section title="Incarico">
              <div className="sm:col-span-2">
                <Field label="Classi di concorso (separate da virgola)">
                  <Input
                    value={form.classi}
                    onChange={set('classi')}
                    placeholder="A001, A022, ADEE"
                    className="font-mono"
                  />
                </Field>
              </div>
              <Field label="Ordine scuola">
                <Input
                  value={form.ordine_scuola}
                  onChange={set('ordine_scuola')}
                  placeholder="Primaria, Secondaria I..."
                />
              </Field>
              <Field label="Tipo posto">
                <Input
                  value={form.tipo_posto}
                  onChange={set('tipo_posto')}
                  placeholder="Comune, Sostegno..."
                />
              </Field>
              <Field label="Ore settimanali">
                <Input
                  value={form.ore_settimanali}
                  onChange={set('ore_settimanali')}
                  placeholder="18 ore, spezzone 9h..."
                />
              </Field>
              <Field label="Posti disponibili">
                <Input
                  inputMode="numeric"
                  value={form.posti_disponibili}
                  onChange={set('posti_disponibili')}
                />
              </Field>
            </Section>

            <Section title="Date e periodo">
              <div className="sm:col-span-2">
                <Field label="Periodo (descrizione)">
                  <Input
                    value={form.periodo_desc}
                    onChange={set('periodo_desc')}
                  />
                </Field>
              </div>
              <Field label="Inizio periodo">
                <Input
                  type="date"
                  value={form.periodo_inizio}
                  onChange={set('periodo_inizio')}
                />
              </Field>
              <Field label="Fine periodo">
                <Input
                  type="date"
                  value={form.periodo_fine}
                  onChange={set('periodo_fine')}
                />
              </Field>
              <Field label="Scadenza">
                <Input
                  type="datetime-local"
                  value={form.scadenza}
                  onChange={set('scadenza')}
                />
              </Field>
              <Field label="Scadenza (testo originale)">
                <Input
                  value={form.scadenza_raw}
                  onChange={set('scadenza_raw')}
                />
              </Field>
            </Section>

            <Section title="Candidatura">
              <div className="sm:col-span-2">
                <Field label="Email / PEC">
                  <Input
                    type="email"
                    value={form.email_candidatura}
                    onChange={set('email_candidatura')}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Oggetto email">
                  <Input
                    value={form.oggetto_email}
                    onChange={set('oggetto_email')}
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Link candidatura">
                  <Input
                    type="url"
                    value={form.link_candidatura}
                    onChange={set('link_candidatura')}
                  />
                </Field>
              </div>
            </Section>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-2.5 py-2">
                {error}
              </p>
            )}

            <Separator />

            {/* Zona eliminazione */}
            <div>
              {!isConfirmingDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-2 text-xs gap-1.5 w-full justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Elimina interpello dal database</span>
                </Button>
              ) : (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 space-y-2 text-center">
                  <p className="text-xs font-medium text-destructive">
                    Eliminare definitivamente #{interpello?.id}? Non si può
                    annullare (il prossimo sync potrebbe ricrearlo se il bando
                    è ancora online).
                  </p>
                  <div className="flex justify-center gap-2">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="h-7 text-xs px-3 gap-1.5"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>Sì, elimina</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsConfirmingDelete(false)}
                      disabled={isDeleting}
                      className="h-7 text-xs px-3"
                    >
                      Annulla
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 sticky bottom-0 bg-card py-3 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-xs gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Ripristina
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="text-xs"
                >
                  Annulla
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving}
                  className="text-xs gap-1.5 min-w-28"
                >
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Salva modifiche</span>
                  )}
                </Button>
              </div>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
