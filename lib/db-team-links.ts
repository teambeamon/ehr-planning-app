// lib/db-team-links.ts
import client, { isTursoConfigured, executeQuery } from "./db";

// Table des liens de classement (ex: page FFHandball) par équipe
export const TEAM_LINKS_TABLE = "team_links";

// Stockage en mémoire pour le fallback (quand Turso n'est pas configuré)
let inMemoryLinks: Record<string, string> = {};

// Initialisation de la table
export async function initializeTeamLinksTable() {
  if (!isTursoConfigured() || !client) {
    return;
  }
  try {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS ${TEAM_LINKS_TABLE} (
        team TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `, []);
  } catch (error) {
    console.error("Erreur initialisation team_links:", error);
  }
}

// Récupérer tous les liens : { équipe normalisée -> url }
export async function getTeamLinks(): Promise<Record<string, string>> {
  if (!isTursoConfigured() || !client) {
    return { ...inMemoryLinks };
  }
  try {
    const result = await executeQuery(`SELECT team, url FROM ${TEAM_LINKS_TABLE}`, []);
    const links: Record<string, string> = {};
    result.rows.forEach((r: any) => {
      if (r.team && r.url) links[r.team as string] = r.url as string;
    });
    return links;
  } catch (error) {
    console.error("Erreur récupération liens équipes:", error);
    return {};
  }
}

// Enregistrer (ou supprimer si url vide) le lien d'une équipe
export async function saveTeamLink(team: string, url: string) {
  if (!team) return;
  if (!isTursoConfigured() || !client) {
    if (url) {
      inMemoryLinks[team] = url;
    } else {
      delete inMemoryLinks[team];
    }
    return;
  }
  if (!url) {
    await executeQuery(`DELETE FROM ${TEAM_LINKS_TABLE} WHERE team = ?`, [team]);
    return;
  }
  await executeQuery(
    `INSERT INTO ${TEAM_LINKS_TABLE} (team, url, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(team) DO UPDATE SET url = excluded.url, updated_at = excluded.updated_at`,
    [team, url]
  );
}
