// lib/db-matches.ts
import client, { isTursoConfigured } from "./db";

// Type pour les matchs
import type { Match } from "./utils";

// Nom de la table
export const MATCHES_TABLE = "matches";

// Stockage en mémoire pour le fallback (quand Turso n'est pas configuré)
let inMemoryMatches: Match[] = [];

// Initialisation de la table
export async function initializeMatchesTable() {
  if (!isTursoConfigured() || !client) {
    console.log("Turso non configuré, utilisation du stockage en mémoire");
    return;
  }

  try {
    await client.execute({
      sql: `
        CREATE TABLE IF NOT EXISTS ${MATCHES_TABLE} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          day TEXT,
          home_team TEXT NOT NULL,
          away_team TEXT,
          match_display TEXT,
          time TEXT,
          location TEXT NOT NULL,
          is_home INTEGER DEFAULT 0,
          is_away INTEGER DEFAULT 0,
          is_internal INTEGER DEFAULT 0,
          match_type TEXT DEFAULT 'Championnat',
          category TEXT,
          coach TEXT,
          camionnette TEXT,
          season TEXT DEFAULT '2026-2027',
          last_updated TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `,
      args: [],
    });

    await client.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_matches_date ON ${MATCHES_TABLE}(date)`,
      args: [],
    });

    await client.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_matches_home_team ON ${MATCHES_TABLE}(home_team)`,
      args: [],
    });

    console.log("Table matches initialisée avec succès");
  } catch (error) {
    console.error("Erreur lors de l'initialisation:", error);
    throw error;
  }
}

// Sauvegarder tous les matchs
export async function saveAllMatches(matches: any[]) {
  if (!isTursoConfigured() || !client) {
    inMemoryMatches = matches.map(m => ({ ...m, id: undefined }));
    console.log(`Sauvegarde de ${matches.length} matchs en mémoire`);
    return;
  }

  try {
    await client.execute({ sql: `DELETE FROM ${MATCHES_TABLE}`, args: [] });
    if (matches.length === 0) return;

    const insertSql = `
      INSERT INTO ${MATCHES_TABLE} (
        date, day, home_team, away_team, match_display, time, location,
        is_home, is_away, is_internal, match_type, category, coach,
        camionnette, season, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    for (const match of matches) {
      await client.execute({
        sql: insertSql,
        args: [
          match.date || null, match.day || null, match.home_team || null,
          match.away_team || null, match.match_display || null, match.time || null,
          match.location || null, match.is_home ? 1 : 0, match.is_away ? 1 : 0,
          match.is_internal ? 1 : 0, match.match_type || 'Championnat',
          match.category || null, match.coach || null, match.camionnette || null,
          match.season || '2026-2027', match.last_updated || null
        ],
      });
    }
    console.log(`Sauvegarde de ${matches.length} matchs terminée`);
  } catch (error) {
    console.error("Erreur sauvegarde:", error);
    throw error;
  }
}

// Helper pour convertir les rows en Match
function rowToMatch(row: any): Match {
  return {
    id: row.id,
    date: row.date || null,
    day: row.day || null,
    home_team: row.home_team || null,
    away_team: row.away_team || null,
    match_display: row.match_display || null,
    time: row.time || null,
    location: row.location || null,
    is_home: Boolean(row.is_home || 0),
    is_away: Boolean(row.is_away || 0),
    is_internal: Boolean(row.is_internal || 0),
    match_type: row.match_type || null,
    category: row.category || null,
    coach: row.coach || null,
    camionnette: row.camionnette || null,
    season: row.season || null,
    last_updated: row.last_updated || null,
  };
}

// Exécuter une requête avec fallback
async function executeWithFallback(sql: string, args: any[] = []): Promise<any> {
  if (!isTursoConfigured() || !client) {
    throw new Error("Turso non configuré");
  }
  return await client.execute({ sql, args });
}

// Récupérer tous les matchs
export async function getAllMatchesFromDB(): Promise<Match[]> {
  if (!isTursoConfigured() || !client) return [...inMemoryMatches];
  try {
    const result = await executeWithFallback(
      `SELECT * FROM ${MATCHES_TABLE} ORDER BY date, time, home_team`, []
    );
    return result.rows.map(rowToMatch);
  } catch (error) {
    console.error("Erreur récupération matchs:", error);
    return [];
  }
}

// Récupérer les matchs avec filtres
export async function getFilteredMatchesFromDB(filters: {
  team?: string;
  location?: string;
  category?: string;
  season?: string;
}): Promise<Match[]> {
  if (!isTursoConfigured() || !client) {
    return inMemoryMatches.filter(match => {
      const teamOk = !filters.team ||
        (match.home_team?.toLowerCase().includes(filters.team?.toLowerCase() || '')) ||
        (match.away_team?.toLowerCase().includes(filters.team?.toLowerCase() || ''));
      const locOk = !filters.location || match.location === filters.location;
      const catOk = !filters.category || (match.category?.toLowerCase().includes(filters.category?.toLowerCase() || ''));
      const seaOk = !filters.season || match.season === filters.season;
      return teamOk && locOk && catOk && seaOk;
    });
  }
  try {
    let sql = `SELECT * FROM ${MATCHES_TABLE} WHERE 1=1`;
    const args: any[] = [];
    if (filters.team) {
      sql += ` AND (home_team LIKE ? OR away_team LIKE ?)`;
      args.push(`%${filters.team}%`, `%${filters.team}%`);
    }
    if (filters.location) {
      sql += ` AND location = ?`; args.push(filters.location);
    }
    if (filters.category) {
      sql += ` AND category LIKE ?`; args.push(`%${filters.category}%`);
    }
    if (filters.season) {
      sql += ` AND season = ?`; args.push(filters.season);
    }
    sql += ` ORDER BY date, time, home_team`;
    const result = await executeWithFallback(sql, args);
    return result.rows.map(rowToMatch);
  } catch (error) {
    console.error("Erreur filtres:", error);
    return [];
  }
}

// Helper pour obtenir les dates du week-end
function getWeekendDateStrings(): { saturday: string; sunday: string } {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let saturday: Date, sunday: Date;
  if (now.getDay() === 6) {
    saturday = new Date(now);
    sunday = new Date(now);
    sunday.setDate(now.getDate() + 1);
  } else if (now.getDay() === 0) {
    saturday = new Date(now);
    saturday.setDate(now.getDate() - 1);
    sunday = new Date(now);
  } else {
    saturday = new Date(now);
    saturday.setDate(now.getDate() + (6 - now.getDay()));
    sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);
  }
  const format = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { saturday: format(saturday), sunday: format(sunday) };
}

// Récupérer les matchs du week-end
export async function getWeekendMatchesFromDB(): Promise<Match[]> {
  if (!isTursoConfigured() || !client) {
    const { saturday, sunday } = getWeekendDateStrings();
    return inMemoryMatches.filter(m => m.date === saturday || m.date === sunday);
  }
  try {
    const { saturday, sunday } = getWeekendDateStrings();
    const result = await executeWithFallback(
      `SELECT * FROM ${MATCHES_TABLE} WHERE date = ? OR date = ? ORDER BY date, time, location, home_team`,
      [saturday, sunday]
    );
    return result.rows.map(rowToMatch);
  } catch (error) {
    console.error("Erreur week-end:", error);
    return [];
  }
}

// Équipes EHR
const EHR_TEAMS = ['Seniors M', 'Seniors F1', 'Seniors F2', 'M17', 'F17', 'M15', 'F15', 'M13', 'F13', 'M11', 'F11'];
const EHR_LOCATIONS = ['Rodemack', 'Hettange (Hall)', 'Hettange (Poly)', 'Kanfen', 'Extérieur'];

// Récupérer les équipes
export async function getTeamsFromDB(): Promise<string[]> {
  if (!isTursoConfigured() || !client) {
    const allTeams = new Set<string>();
    inMemoryMatches.forEach(m => { if (m.home_team) allTeams.add(m.home_team); if (m.away_team) allTeams.add(m.away_team); });
    return EHR_TEAMS.filter(t => allTeams.has(t));
  }
  try {
    const result = await executeWithFallback(
      `SELECT DISTINCT home_team FROM ${MATCHES_TABLE} WHERE home_team IS NOT NULL UNION SELECT DISTINCT away_team FROM ${MATCHES_TABLE} WHERE away_team IS NOT NULL ORDER BY home_team`,
      []
    );
    const allTeams = result.rows.map((r: any) => r.home_team || r.away_team || '');
    return EHR_TEAMS.filter(t => allTeams.includes(t));
  } catch (error) {
    return [];
  }
}

// Récupérer les lieux
export async function getLocationsFromDB(): Promise<string[]> {
  if (!isTursoConfigured() || !client) {
    const allLocs = new Set<string>();
    inMemoryMatches.forEach(m => { if (m.location) allLocs.add(m.location); });
    return EHR_LOCATIONS.filter(l => allLocs.has(l));
  }
  try {
    const result = await executeWithFallback(
      `SELECT DISTINCT location FROM ${MATCHES_TABLE} WHERE location IS NOT NULL ORDER BY location`,
      []
    );
    const allLocs = result.rows.map((r: any) => r.location || '');
    return EHR_LOCATIONS.filter(l => allLocs.includes(l));
  } catch { return []; }
}

// Récupérer les catégories
export async function getCategoriesFromDB(): Promise<string[]> {
  if (!isTursoConfigured() || !client) {
    const cats = new Set<string>();
    inMemoryMatches.forEach(m => { if (m.category) cats.add(m.category); });
    return Array.from(cats).sort();
  }
  try {
    const result = await executeWithFallback(
      `SELECT DISTINCT category FROM ${MATCHES_TABLE} WHERE category IS NOT NULL AND category != '' ORDER BY category`,
      []
    );
    return result.rows.map((r: any) => r.category || '');
  } catch { return []; }
}

// Récupérer les saisons
export async function getSeasonsFromDB(): Promise<string[]> {
  if (!isTursoConfigured() || !client) {
    const seas = new Set<string>();
    inMemoryMatches.forEach(m => { if (m.season) seas.add(m.season); });
    return Array.from(seas).sort();
  }
  try {
    const result = await executeWithFallback(
      `SELECT DISTINCT season FROM ${MATCHES_TABLE} WHERE season IS NOT NULL ORDER BY season`,
      []
    );
    return result.rows.map((r: any) => r.season || '');
  } catch { return []; }
}

// Récupérer la dernière mise à jour
export async function getLastUpdatedFromDB(): Promise<string | null> {
  if (!isTursoConfigured() || !client) {
    return inMemoryMatches.length > 0 ? (inMemoryMatches[0].last_updated || null) : null;
  }
  try {
    const result = await executeWithFallback(
      `SELECT last_updated FROM ${MATCHES_TABLE} WHERE last_updated IS NOT NULL ORDER BY last_updated DESC LIMIT 1`,
      []
    );
    return result.rows.length > 0 ? (result.rows[0].last_updated as string || null) : null;
  } catch { return null; }
}

// Stats - Team display names
const TEAM_DISPLAY: Record<string, string> = {
  'Seniors M': 'Seniors Masculins', 'Seniors F1': 'Seniors Filles 1', 'Seniors F2': 'Seniors Filles 2',
  'M17': '17 ans Garçons', 'F17': '17 ans Filles', 'M15': '15 ans Garçons', 'F15': '15 ans Filles',
  'M13': '13 ans Garçons', 'F13': '13 ans Filles', 'M11': '11 ans Garçons', 'F11': '11 ans Filles'
};

// Stats principales
export async function getStatsFromDB() {
  if (!isTursoConfigured() || !client) {
    const ehrTeams = new Set(EHR_TEAMS);
    const ehrLocs = ['Rodemack', 'Hettange (Hall)', 'Hettange (Poly)', 'Kanfen'];
    const total = inMemoryMatches.length;
    const home = inMemoryMatches.filter(m => m.is_home).length;
    const away = inMemoryMatches.filter(m => m.is_away).length;
    const internal = inMemoryMatches.filter(m => m.is_internal).length;
    const withCamionnette = inMemoryMatches.filter(m => m.camionnette).length;
    const byTeam: Record<string, number> = {};
    inMemoryMatches.filter(m => m.is_home && m.home_team && ehrTeams.has(m.home_team)).forEach(m => {
      const dn = TEAM_DISPLAY[m.home_team!] || m.home_team!;
      byTeam[dn] = (byTeam[dn] || 0) + 1;
    });
    const byLocation: Record<string, number> = {};
    inMemoryMatches.filter(m => m.is_home && m.location && ehrLocs.includes(m.location)).forEach(m => {
      byLocation[m.location!] = (byLocation[m.location!] || 0) + 1;
    });
    const byCategory: Record<string, number> = {};
    inMemoryMatches.forEach(m => { if (m.category) byCategory[m.category] = (byCategory[m.category] || 0) + 1; });
    const byMatchType: Record<string, number> = {};
    inMemoryMatches.forEach(m => { if (m.match_type) byMatchType[m.match_type] = (byMatchType[m.match_type] || 0) + 1; });
    const lastUpdated = inMemoryMatches.length > 0 ? inMemoryMatches[0].last_updated : null;
    return { total, home, away, internal, withCamionnette, byTeam, byLocation, byCategory, byMatchType, lastUpdated };
  }
  try {
    const totalR = await executeWithFallback(`SELECT COUNT(*) as c FROM ${MATCHES_TABLE}`, []);
    const homeR = await executeWithFallback(`SELECT COUNT(*) as c FROM ${MATCHES_TABLE} WHERE is_home = 1`, []);
    const awayR = await executeWithFallback(`SELECT COUNT(*) as c FROM ${MATCHES_TABLE} WHERE is_away = 1`, []);
    const internalR = await executeWithFallback(`SELECT COUNT(*) as c FROM ${MATCHES_TABLE} WHERE is_internal = 1`, []);
    const camR = await executeWithFallback(`SELECT COUNT(*) as c FROM ${MATCHES_TABLE} WHERE camionnette IS NOT NULL AND camionnette != ''`, []);
    const ehrTeams = new Set(EHR_TEAMS);
    const ehrLocs = ['Rodemack', 'Hettange (Hall)', 'Hettange (Poly)', 'Kanfen'];
    const total = totalR.rows[0]?.c || 0;
    const home = homeR.rows[0]?.c || 0;
    const away = awayR.rows[0]?.c || 0;
    const internal = internalR.rows[0]?.c || 0;
    const withCamionnette = camR.rows[0]?.c || 0;
    const teamR = await executeWithFallback(
      `SELECT home_team, COUNT(*) as c FROM ${MATCHES_TABLE} WHERE is_home = 1 AND home_team IS NOT NULL GROUP BY home_team`, []
    );
    const byTeam: Record<string, number> = {};
    teamR.rows.forEach((r: any) => { if (ehrTeams.has(r.home_team)) { const dn = TEAM_DISPLAY[r.home_team] || r.home_team; byTeam[dn] = (byTeam[dn] || 0) + r.c; } });
    const locR = await executeWithFallback(
      `SELECT location, COUNT(*) as c FROM ${MATCHES_TABLE} WHERE is_home = 1 AND location IS NOT NULL GROUP BY location`, []
    );
    const byLocation: Record<string, number> = {};
    locR.rows.forEach((r: any) => { if (ehrLocs.includes(r.location)) byLocation[r.location] = r.c; });
    const catR = await executeWithFallback(
      `SELECT category, COUNT(*) as c FROM ${MATCHES_TABLE} WHERE category IS NOT NULL AND category != '' GROUP BY category`, []
    );
    const byCategory: Record<string, number> = {};
    catR.rows.forEach((r: any) => byCategory[r.category] = r.c);
    const typeR = await executeWithFallback(
      `SELECT match_type, COUNT(*) as c FROM ${MATCHES_TABLE} WHERE match_type IS NOT NULL GROUP BY match_type`, []
    );
    const byMatchType: Record<string, number> = {};
    typeR.rows.forEach((r: any) => byMatchType[r.match_type || 'Championnat'] = r.c);
    const lastUpdated = await getLastUpdatedFromDB();
    return { total, home, away, internal, withCamionnette, byTeam, byLocation, byCategory, byMatchType, lastUpdated };
  } catch (error) {
    console.error("Stats error:", error);
    return { total: 0, home: 0, away: 0, internal: 0, withCamionnette: 0, byTeam: {}, byLocation: {}, byCategory: {}, byMatchType: {}, lastUpdated: null };
  }
}

// Stats par lieu EHR
export async function getEHRLocationsStatsFromDB() {
  if (!isTursoConfigured() || !client) {
    const ehrLocs = ['Rodemack', 'Hettange (Hall)', 'Hettange (Poly)', 'Kanfen'];
    const homeMatches = inMemoryMatches.filter(m => m.is_home && m.location && ehrLocs.includes(m.location));
    const byLocation: Record<string, number> = {};
    homeMatches.forEach(m => { if (m.location) byLocation[m.location] = (byLocation[m.location] || 0) + 1; });
    return { byLocation, totalHome: homeMatches.length };
  }
  try {
    const ehrLocs = ['Rodemack', 'Hettange (Hall)', 'Hettange (Poly)', 'Kanfen'];
    const result = await executeWithFallback(
      `SELECT location, COUNT(*) as c FROM ${MATCHES_TABLE} WHERE is_home = 1 AND location IS NOT NULL GROUP BY location`,
      []
    );
    const byLocation: Record<string, number> = {};
    let totalHome = 0;
    result.rows.forEach((r: any) => { if (ehrLocs.includes(r.location)) { byLocation[r.location] = r.c; totalHome += r.c; } });
    return { byLocation, totalHome };
  } catch { return { byLocation: {}, totalHome: 0 }; }
}

// Matchs par date
export async function getMatchesByDateFromDB(date: string): Promise<Match[]> {
  if (!isTursoConfigured() || !client) return inMemoryMatches.filter(m => m.date === date);
  try {
    const result = await executeWithFallback(
      `SELECT * FROM ${MATCHES_TABLE} WHERE date = ? ORDER BY time, location, home_team`,
      [date]
    );
    return result.rows.map(rowToMatch);
  } catch { return []; }
}

// Toutes les dates
export async function getAllMatchDatesFromDB(): Promise<string[]> {
  if (!isTursoConfigured() || !client) {
    const dates = new Set<string>();
    inMemoryMatches.forEach(m => { if (m.date) dates.add(m.date); });
    return Array.from(dates).sort();
  }
  try {
    const result = await executeWithFallback(
      `SELECT DISTINCT date FROM ${MATCHES_TABLE} WHERE date IS NOT NULL ORDER BY date`,
      []
    );
    return result.rows.map((r: any) => r.date as string);
  } catch { return []; }
}
