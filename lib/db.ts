// lib/db.ts
import { createClient } from '@libsql/client';

// Turso est compatible avec libSQL
const client = createClient({
  url: process.env.TURSO_DB_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export default client;

// Fonction utilitaire pour exécuter des requêtes
export async function executeQuery(query: string, params: any[] = []) {
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
