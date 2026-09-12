export interface AttachmentItem {
  name: string;
  url: string;
  is_bando: boolean;
  is_domanda: boolean;
  local_path?: string | null;
}

export interface PositionItem {
  codice_classe?: string | null;
  ordine_scuola?: string | null;
  tipo_posto?: string | null;
  posti?: number | null;
  ore?: string | null;
  periodo?: string | null;
  note?: string | null;
}

export interface Interpello {
  id: number;
  wp_id: number;
  item_key?: string | null;
  position_index?: number | null;
  title: string;
  slug?: string | null;
  wp_date: string;
  wp_modified?: string | null;
  wp_url: string;

  school_name?: string | null;
  school_code?: string | null;
  school_address?: string | null;
  school_city?: string | null;
  latitude?: number | null;
  longitude?: number | null;

  classi_concorso: string[];
  ordine_scuola?: string | null;
  tipo_posto?: string | null;
  posti_disponibili?: number | null;
  ore_settimanali?: string | null;
  periodo_desc?: string | null;
  periodo_inizio?: string | null;
  periodo_fine?: string | null;
  scadenza?: string | null;
  scadenza_raw?: string | null;
  email_candidatura?: string | null;
  oggetto_email?: string | null;
  link_candidatura?: string | null;
  posti_dettaglio?: PositionItem[] | null;

  attachments: AttachmentItem[];
  content_raw?: string | null;
  status_candidatura?: 'nessuno' | 'candidato' | 'preferito' | 'ignorato';
  is_candidato?: boolean;
  is_preferito?: boolean;
  candidatura_date?: string | null;
  notes?: string | null;

  created_at: string;
  updated_at: string;
  is_expired: boolean;
  time_remaining_seconds?: number | null;
  has_date_anomaly?: boolean;
  date_anomaly_desc?: string | null;
  // Date più probabili suggerite quando la scuola commette un refuso (bottone "usa date corrette")
  suggested_scadenza?: string | null;
  suggested_periodo_inizio?: string | null;
  suggested_periodo_fine?: string | null;
  suggested_periodo_desc?: string | null;
  has_suggested_dates?: boolean;
  suggested_dates_label?: string | null;
  date_fixed_by_user?: boolean;
  // Incoerenza strutturale: scadenza candidature successiva all'inizio del servizio
  has_date_inconsistency?: boolean;
  date_inconsistency_desc?: string | null;
}

export interface Stats {
  total_interpelli: number;
  active_interpelli: number;
  expiring_soon: number;
  candidati: number;
  preferiti: number;
  last_sync: string | null;
  last_sync_status: string | null;
}

export interface SyncResult {
  success: boolean;
  items_found: number;
  items_new: number;
  items_updated: number;
  message: string;
}

export interface UserLocation {
  address: string;
  latitude: number;
  longitude: number;
}

