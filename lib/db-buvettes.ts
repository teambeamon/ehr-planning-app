// lib/db-buvettes.ts
import client, { isTursoConfigured, executeQuery } from "./db";

// Table de suivi des demandes d'autorisation de buvette
export const BUVAUTH_TABLE = "buvette_authorizations";

// Stockage en mémoire pour le fallback (quand Turso n'est pas configuré)
let inMemoryAuths: { date: string; location: string }[] = [];

// Initialisation de la table
export async function initializeBuvetteAuthTable() {
  if (!isTursoConfigured() || !client) {
    return;
  }

  try {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS ${BUVAUTH_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        location TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, location)
      )
    `, []);
  } catch (error) {
    console.error("Erreur initialisation buvette_authorizations:", error);
  }
}

// Récupérer toutes les demandes d'autorisation
export async function getBuvetteAuthorizations(): Promise<{ date: string; location: string; created_at: string | null }[]> {
  if (!isTursoConfigured() || !client) {
    return inMemoryAuths.map(a => ({ ...a, created_at: null }));
  }

  try {
    const result = await executeQuery(`SELECT date, location, created_at FROM ${BUVAUTH_TABLE}`, []);
    return result.rows.map((r: any) => ({
      date: r.date as string,
      location: r.location as string,
      created_at: (r.created_at as string) || null,
    }));
  } catch (error) {
    console.error("Erreur récupération autorisations:", error);
    return [];
  }
}

// Marquer / démarquer une date comme demandée pour une salle
export async function setBuvetteAuthorization(date: string, location: string, done: boolean) {
  if (!isTursoConfigured() || !client) {
    inMemoryAuths = done
      ? [...inMemoryAuths.filter(a => !(a.date === date && a.location === location)), { date, location }]
      : inMemoryAuths.filter(a => !(a.date === date && a.location === location));
    return;
  }

  if (done) {
    await executeQuery(`INSERT OR IGNORE INTO ${BUVAUTH_TABLE} (date, location) VALUES (?, ?)`, [date, location]);
  } else {
    await executeQuery(`DELETE FROM ${BUVAUTH_TABLE} WHERE date = ? AND location = ?`, [date, location]);
  }
}
