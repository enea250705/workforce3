// Polyfill per import.meta.dirname in ESM
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

// Aggiungi il polyfill a import.meta
if (!import.meta.dirname) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  
  // Aggiungi dirname a import.meta
  import.meta.dirname = __dirname;
}

export function getImportMetaDirname() {
  return import.meta.dirname;
}

// Funzione helper per risolvere i percorsi relativi alla root del progetto
export function resolveProjectPath(...pathSegments) {
  return path.resolve(import.meta.dirname, '..', ...pathSegments);
} 