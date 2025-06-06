// Polyfill per import.meta.dirname in ESM
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

// Estendi l'interfaccia ImportMeta per includere dirname
declare global {
  interface ImportMeta {
    dirname?: string;
  }
}

// Aggiungi il polyfill a import.meta
if (!import.meta.dirname) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  
  // Aggiungi dirname a import.meta
  import.meta.dirname = __dirname;
}

export function getImportMetaDirname(): string {
  return import.meta.dirname || '';
}

// Funzione helper per risolvere i percorsi relativi alla root del progetto
export function resolveProjectPath(...pathSegments: string[]): string {
  return path.resolve(import.meta.dirname || '', '..', ...pathSegments);
} 