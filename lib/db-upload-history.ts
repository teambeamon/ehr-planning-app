// lib/db-upload-history.ts
import client, { isTursoConfigured, executeQuery } from "./db";

// Nom de la table pour l'historique des uploads
export const UPLOAD_HISTORY_TABLE = "upload_history";

// Initialisation de la table d'historique
export async function initializeUploadHistoryTable() {
  if (!isTursoConfigured() || !client) {
    return;
  }

  try {
    await executeQuery(`
        CREATE TABLE IF NOT EXISTS ${UPLOAD_HISTORY_TABLE} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT NOT NULL,
          uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
          season TEXT,
          last_updated TEXT,
          match_count INTEGER,
          file_hash TEXT UNIQUE,
          data_snapshot TEXT
        )
      `, []);

    await executeQuery(`CREATE INDEX IF NOT EXISTS idx_upload_history_date ON ${UPLOAD_HISTORY_TABLE}(uploaded_at)`, []);

    await executeQuery(`CREATE INDEX IF NOT EXISTS idx_upload_history_hash ON ${UPLOAD_HISTORY_TABLE}(file_hash)`, []);

  } catch (error) {
    console.error("Erreur initialisation upload_history:", error);
  }
}

// Sauvegarder un upload dans l'historique
export async function saveUploadToHistory(filename: string, season: string, lastUpdated: string, matchCount: number, fileHash: string, snapshot: string) {
  if (!isTursoConfigured() || !client) {
    return;
  }

  try {
    await executeQuery(
      `INSERT INTO ${UPLOAD_HISTORY_TABLE} (filename, season, last_updated, match_count, file_hash, data_snapshot) VALUES (?, ?, ?, ?, ?, ?)`,
      [filename, season, lastUpdated, matchCount, fileHash, snapshot],
    );
  } catch (error) {
    console.error("Erreur sauvegarde historique:", error);
  }
}

// Récupérer l'historique des uploads
export async function getUploadHistory(): Promise<any[]> {
  if (!isTursoConfigured() || !client) {
    return [];
  }

  try {
    const result = await executeQuery(`SELECT * FROM ${UPLOAD_HISTORY_TABLE} ORDER BY uploaded_at DESC`, []);
    return result.rows;
  } catch (error) {
    return [];
  }
}

// Récupérer le dernier upload
export async function getLastUpload(): Promise<any> {
  if (!isTursoConfigured() || !client) {
    return null;
  }

  try {
    const result = await executeQuery(`SELECT * FROM ${UPLOAD_HISTORY_TABLE} ORDER BY uploaded_at DESC LIMIT 1`, []);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    return null;
  }
}

// Récupérer un snapshot spécifique
export async function getUploadSnapshot(fileHash: string): Promise<string | null> {
  if (!isTursoConfigured() || !client) {
    return null;
  }

  try {
    const result = await executeQuery(`SELECT data_snapshot FROM ${UPLOAD_HISTORY_TABLE} WHERE file_hash = ?`, [fileHash]);
    return result.rows.length > 0 ? (result.rows[0].data_snapshot as string || null) : null;
  } catch (error) {
    return null;
  }
}
