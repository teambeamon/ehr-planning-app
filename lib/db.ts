// lib/db.ts
import { createClient } from '@libsql/client';

// Timeout pour chaque requête SQL (évite les requêtes qui pendent indéfiniment)
const DB_TIMEOUT_MS = 15000;

// Client Turso - seulement si configuré
let client: ReturnType<typeof createClient> | null = null;

try {
  if (process.env.TURSO_DB_URL && process.env.TURSO_AUTH_TOKEN) {
    client = createClient({
      url: process.env.TURSO_DB_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
} catch (error) {
  console.error('Erreur lors de la création du client Turso:', error);
  client = null;
}

export default client;

// Fonction utilitaire pour exécuter des requêtes
export async function executeQuery(query: string, params: any[] = []) {
  if (!client) {
    console.error('Client Turso non disponible');
    throw new Error('Base de données non configurée');
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Requête SQL interrompue après ${DB_TIMEOUT_MS} ms : ${query.substring(0, 120)}`));
      }, DB_TIMEOUT_MS);
    });
    const result = await Promise.race([
      client.execute({ sql: query, args: params }),
      timeout,
    ]);
    return result;
  } catch (error) {
    console.error('Erreur lors de l\'exécution de la requête :', error);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Vérifier si Turso est configuré
export function isTursoConfigured(): boolean {
  return client !== null;
}
