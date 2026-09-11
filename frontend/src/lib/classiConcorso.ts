import classiCatalog from '@/data/classi_concorso.json';

export interface ClassInfo {
  code: string;
  name: string;
  ordine_scuola: string;
  tipo_posto: string;
  aliases: string[];
}

const classiMap = new Map<string, ClassInfo>();
(classiCatalog as ClassInfo[]).forEach(item => {
  classiMap.set(item.code.toUpperCase(), item);
});

export function getClassInfo(code: string | null | undefined): ClassInfo | null {
  if (!code) return null;
  const clean = code.trim().toUpperCase();
  return classiMap.get(clean) || null;
}

export function getClassLabel(code: string | null | undefined): string {
  if (!code) return '';
  const info = getClassInfo(code);
  if (info) {
    return `${info.code} - ${info.name}`;
  }
  return `Classe ${code}`;
}

export function getAllClassi(): ClassInfo[] {
  return classiCatalog as ClassInfo[];
}
