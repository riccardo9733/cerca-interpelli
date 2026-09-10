import Dexie, { type Table } from 'dexie';
import { UserLocation } from '@/types/interpello';

export interface UserSettingRecord {
  key: string;
  value: any;
}

export interface InterpelloUserStatusRecord {
  interpelloId: number;
  status: 'nessuno' | 'candidato' | 'preferito' | 'ignorato';
  notes?: string;
  candidatura_date?: string;
  updated_at: string;
}

export class CercaInterpelliDatabase extends Dexie {
  settings!: Table<UserSettingRecord, string>;
  userStatuses!: Table<InterpelloUserStatusRecord, number>;

  constructor() {
    super('CercaInterpelliDB');
    this.version(1).stores({
      settings: 'key',
      userStatuses: 'interpelloId, status, updated_at',
    });
  }
}

// Inizializzazione singleton (funziona solo lato client su browser)
export const db = typeof window !== 'undefined' ? new CercaInterpelliDatabase() : null;

// --- Helper Settings ---

export async function getUserSetting<T>(key: string, defaultValue: T): Promise<T> {
  if (!db) return defaultValue;
  try {
    const item = await db.settings.get(key);
    return item ? (item.value as T) : defaultValue;
  } catch (err) {
    console.error(`Errore lettura setting [${key}] da IndexedDB:`, err);
    return defaultValue;
  }
}

export async function setUserSetting<T>(key: string, value: T): Promise<void> {
  if (!db) return;
  try {
    await db.settings.put({ key, value });
  } catch (err) {
    console.error(`Errore scrittura setting [${key}] in IndexedDB:`, err);
  }
}

export async function removeUserSetting(key: string): Promise<void> {
  if (!db) return;
  try {
    await db.settings.delete(key);
  } catch (err) {
    console.error(`Errore eliminazione setting [${key}] da IndexedDB:`, err);
  }
}

// --- Helper Status & Note Interpelli ---

export async function getAllUserStatuses(): Promise<Record<number, { status: 'nessuno' | 'candidato' | 'preferito' | 'ignorato'; notes?: string }>> {
  if (!db) return {};
  try {
    const all = await db.userStatuses.toArray();
    const map: Record<number, { status: 'nessuno' | 'candidato' | 'preferito' | 'ignorato'; notes?: string }> = {};
    for (const item of all) {
      map[item.interpelloId] = {
        status: item.status,
        notes: item.notes,
      };
    }
    return map;
  } catch (err) {
    console.error('Errore lettura status da IndexedDB:', err);
    return {};
  }
}

export async function saveUserStatus(
  interpelloId: number,
  status: 'nessuno' | 'candidato' | 'preferito' | 'ignorato',
  notes?: string
): Promise<void> {
  if (!db) return;
  try {
    if (status === 'nessuno' && (!notes || notes.trim() === '')) {
      // Se lo stato è resettato e non ci sono note, rimuoviamo il record per pulizia
      await db.userStatuses.delete(interpelloId);
    } else {
      const existing = await db.userStatuses.get(interpelloId);
      const isNewlyCandidato = status === 'candidato' && existing?.status !== 'candidato';
      
      await db.userStatuses.put({
        interpelloId,
        status,
        notes: notes !== undefined ? notes : existing?.notes,
        candidatura_date: isNewlyCandidato ? new Date().toISOString() : existing?.candidatura_date,
        updated_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error(`Errore salvataggio status interpello #${interpelloId} in IndexedDB:`, err);
  }
}

export async function getUserStatsCounts(): Promise<{ candidati: number; preferiti: number }> {
  if (!db) return { candidati: 0, preferiti: 0 };
  try {
    const [candidati, preferiti] = await Promise.all([
      db.userStatuses.where('status').equals('candidato').count(),
      db.userStatuses.where('status').equals('preferito').count(),
    ]);
    return { candidati, preferiti };
  } catch (err) {
    console.error('Errore conteggio statistiche IndexedDB:', err);
    return { candidati: 0, preferiti: 0 };
  }
}

// --- Backup & Restore (JSON) ---

export interface UserBackupData {
  version: number;
  exportedAt: string;
  settings: Record<string, any>;
  statuses: InterpelloUserStatusRecord[];
}

export async function exportUserDataAsJSON(): Promise<string> {
  if (!db) return '{}';
  const settingsList = await db.settings.toArray();
  const statusesList = await db.userStatuses.toArray();

  const settingsMap: Record<string, any> = {};
  for (const s of settingsList) {
    settingsMap[s.key] = s.value;
  }

  const backup: UserBackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: settingsMap,
    statuses: statusesList,
  };

  return JSON.stringify(backup, null, 2);
}

export async function importUserDataFromJSON(jsonString: string): Promise<boolean> {
  if (!db) return false;
  try {
    const parsed: UserBackupData = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Formato JSON non valido');
    }

    await db.transaction('rw', db.settings, db.userStatuses, async () => {
      if (parsed.settings && typeof parsed.settings === 'object') {
        for (const [key, value] of Object.entries(parsed.settings)) {
          await db?.settings.put({ key, value });
        }
      }
      if (Array.isArray(parsed.statuses)) {
        for (const item of parsed.statuses) {
          if (item && typeof item.interpelloId === 'number') {
            await db?.userStatuses.put(item);
          }
        }
      }
    });

    return true;
  } catch (err) {
    console.error('Errore durante importazione dati:', err);
    return false;
  }
}

export async function clearAllUserData(): Promise<void> {
  if (!db) return;
  await db.transaction('rw', db.settings, db.userStatuses, async () => {
    await db?.settings.clear();
    await db?.userStatuses.clear();
  });
}

// --- Migrazione silenziosa iniziale da localStorage ---

export async function migrateLegacyLocalStorage(): Promise<{
  migratedLocation: UserLocation | null;
  migratedRadius: number | null;
  migratedFilterList: boolean;
}> {
  if (typeof window === 'undefined') {
    return { migratedLocation: null, migratedRadius: null, migratedFilterList: false };
  }

  try {
    const isMigrated = await getUserSetting<boolean>('migration_from_localstorage_done', false);
    
    // Leggi da localStorage
    const savedLoc = localStorage.getItem('cerca_interpelli_user_location');
    const savedRadius = localStorage.getItem('cerca_interpelli_max_radius');
    const savedFilterList = localStorage.getItem('cerca_interpelli_filter_list_by_dist');

    let parsedLoc: UserLocation | null = null;
    let parsedRadius: number | null = null;
    let parsedFilterList = false;

    if (savedLoc) {
      try {
        parsedLoc = JSON.parse(savedLoc);
      } catch (e) {}
    }
    if (savedRadius !== null && savedRadius !== 'null') {
      parsedRadius = Number(savedRadius);
    }
    if (savedFilterList !== null) {
      parsedFilterList = savedFilterList === 'true';
    }

    if (!isMigrated) {
      // Salva in Dexie
      if (parsedLoc) await setUserSetting('user_location', parsedLoc);
      if (parsedRadius !== null) await setUserSetting('max_radius_km', parsedRadius);
      if (savedFilterList !== null) await setUserSetting('filter_list_by_dist', parsedFilterList);
      
      await setUserSetting('migration_from_localstorage_done', true);
    }

    // Restituisci i valori correnti da Dexie se presenti
    const currentLoc = await getUserSetting<UserLocation | null>('user_location', parsedLoc);
    const currentRadius = await getUserSetting<number | null>('max_radius_km', parsedRadius);
    const currentFilterList = await getUserSetting<boolean>('filter_list_by_dist', parsedFilterList);

    return {
      migratedLocation: currentLoc,
      migratedRadius: currentRadius,
      migratedFilterList: currentFilterList,
    };
  } catch (err) {
    console.error('Errore durante migrazione da localStorage:', err);
    return { migratedLocation: null, migratedRadius: null, migratedFilterList: false };
  }
}
