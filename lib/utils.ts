// lib/utils.ts
import {
  getAllMatchesFromDB,
  getFilteredMatchesFromDB,
  getTeamsFromDB,
  getLocationsFromDB,
  getCategoriesFromDB,
  getSeasonsFromDB,
  getStatsFromDB,
  getEHRLocationsStatsFromDB,
  getWeekendMatchesFromDB,
  getMatchesByDateFromDB,
  getAllMatchDatesFromDB,
  getLastUpdatedFromDB
} from "./db-matches";

// Type pour les matchs
export type Match = {
  id?: number;
  date: string | null;
  day: string | null;
  home_team: string | null;
  away_team: string | null;
  match_display?: string;
  time: string | null;
  location: string | null;
  is_home?: boolean;
  is_away?: boolean;
  is_internal?: boolean;
  match_type: string | null;
  category: string | null;
  coach?: string | null;
  camionnette?: string | null;
  season: string | null;
  last_updated?: string;
  original_team?: string;
  original_column?: number;
};

// Noms d'affichage des équipes
const TEAM_DISPLAY_NAMES: Record<string, string> = {
  'Seniors M': 'Seniors Masculins',
  'Seniors F1': 'Seniors Filles 1',
  'Seniors F2': 'Seniors Filles 2',
  'M17': '17 ans Garçons',
  'F17': '17 ans Filles',
  'M15': '15 ans Garçons',
  'F15': '15 ans Filles',
  'M13': '13 ans Garçons',
  'F13': '13 ans Filles',
  'M11': '11 ans Garçons',
  'F11': '11 ans Filles'
};

// Liste des équipes EHR (noms normalisés)
const EHR_TEAM_NAMES = new Set([
  'Seniors M', 'Seniors F1', 'Seniors F2',
  'M17', 'F17',
  'M15', 'F15',
  'M13', 'F13',
  'M11', 'F11'
]);

// Salles EHR
const EHR_LOCATIONS = ['Rodemack', 'Hettange (Hall)', 'Hettange (Poly)', 'Kanfen'];

// Fonction pour obtenir le nom d'affichage d'une équipe
export const getTeamDisplayName = (team: string | null): string => {
  if (!team) return '';
  return TEAM_DISPLAY_NAMES[team] || team;
};

// Récupérer tous les matchs
export const getMatches = async (): Promise<Match[]> => {
  return await getAllMatchesFromDB();
};

// Récupérer les matchs avec filtres
export const getFilteredMatches = async (filters: {
  team?: string;
  location?: string;
  category?: string;
  season?: string;
}): Promise<Match[]> => {
  return await getFilteredMatchesFromDB(filters);
};

// Récupérer les équipes (EHR seulement)
export const getTeams = async (): Promise<string[]> => {
  return await getTeamsFromDB();
};

// Récupérer les lieux (EHR seulement + Extérieur)
export const getLocations = async (): Promise<string[]> => {
  return await getLocationsFromDB();
};

// Récupérer les catégories
export const getCategories = async (): Promise<string[]> => {
  return await getCategoriesFromDB();
};

// Récupérer les saisons
export const getSeasons = async (): Promise<string[]> => {
  return await getSeasonsFromDB();
};

// Statistiques
export const getStats = async () => {
  return await getStatsFromDB();
};

// Statistiques pour les locations EHR uniquement
export const getEHRLocationsStats = async () => {
  return await getEHRLocationsStatsFromDB();
};

// Fonction pour obtenir les matchs du week-end actuel
export const getWeekendMatches = async (): Promise<Match[]> => {
  return await getWeekendMatchesFromDB();
};

// Récupérer les matchs par date
export const getMatchesByDate = async (date: string): Promise<Match[]> => {
  return await getMatchesByDateFromDB(date);
};

// Récupérer toutes les dates avec matchs
export const getAllMatchDates = async (): Promise<string[]> => {
  return await getAllMatchDatesFromDB();
};

// Récupérer la dernière date de mise à jour
export const getLastUpdated = async (): Promise<string | null> => {
  return await getLastUpdatedFromDB();
};

// Vérifier si une équipe est EHR
export const isEHRTeam = (name: string): boolean => {
  if (!name) return false;
  const cleaned = String(name).trim();
  if (EHR_TEAM_NAMES.has(cleaned)) return true;
  if (/\bEHR\b/i.test(cleaned)) return true;
  return false;
};

// Obtenir les salles EHR
export const getEHRLocations = (): string[] => {
  return EHR_LOCATIONS;
};

// Obtenir tous les noms d'équipes EHR
export const getAllEHRTeamNames = (): string[] => {
  return Array.from(EHR_TEAM_NAMES);
};
