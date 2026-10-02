// lib/db.ts
import { createClient } from '@libsql/client';

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
  try {
    const result = await client.execute({
      sql: query,
      args: params,
    });
    return result;
  } catch (error) {
    console.error('Erreur lors de l\'exécution de la requête :', error);
    throw error;
  }
}

// Vérifier si Turso est configuré
export function isTursoConfigured(): boolean {
  return client !== null;
}
