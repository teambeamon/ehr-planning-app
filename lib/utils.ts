// lib/utils.ts
import matchesData from "@/data/matches.json";

export type Match = {
  date: string | null;
  day: string | null;
  home_team: string | null;
  away_team: string | null;
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

export const getMatches = (): Match[] => {
  return matchesData as Match[];
};

export const getFilteredMatches = (filters: {
  team?: string;
  location?: string;
  category?: string;
  season?: string;
}): Match[] => {
  return matchesData.filter((match: Match) => {
    return (
      (!filters.team || match.home_team === filters.team || match.away_team === filters.team) &&
      (!filters.location || match.location === filters.location) &&
      (!filters.category || match.category === filters.category) &&
      (!filters.season || match.season === filters.season)
    );
  });
};

// Fonctions utilitaires pour extraire les valeurs uniques
export const getTeams = (): string[] => {
  const teamsSet = new Set<string>();
  matchesData.forEach((match: Match) => {
    if (match.home_team) teamsSet.add(match.home_team);
    if (match.away_team) teamsSet.add(match.away_team);
  });
  return Array.from(teamsSet).sort();
};

export const getLocations = (): string[] => {
  const locationsSet = new Set<string>();
  matchesData.forEach((match: Match) => {
    if (match.location) locationsSet.add(match.location);
  });
  return Array.from(locationsSet).sort();
};

export const getCategories = (): string[] => {
  const categoriesSet = new Set<string>();
  matchesData.forEach((match: Match) => {
    if (match.category) categoriesSet.add(match.category);
  });
  return Array.from(categoriesSet).sort();
};

export const getSeasons = (): string[] => {
  const seasonsSet = new Set<string>();
  matchesData.forEach((match: Match) => {
    if (match.season) seasonsSet.add(match.season);
  });
  return Array.from(seasonsSet).sort();
};

// Statistiques
export const getStats = () => {
  const stats = {
    total: matchesData.length,
    home: matchesData.filter((m: Match) => m.is_home).length,
    away: matchesData.filter((m: Match) => m.is_away).length,
    internal: matchesData.filter((m: Match) => m.is_internal).length,
    byTeam: {} as Record<string, number>,
    byLocation: {} as Record<string, number>,
    byCategory: {} as Record<string, number>,
    byMatchType: {} as Record<string, number>,
    withCamionnette: matchesData.filter((m: Match) => m.camionnette).length,
    lastUpdated: matchesData.length > 0 && matchesData[0].last_updated ? matchesData[0].last_updated : null
  };

  matchesData.forEach((match: Match) => {
    if (match.home_team) stats.byTeam[match.home_team] = (stats.byTeam[match.home_team] || 0) + 1;
    if (match.location) stats.byLocation[match.location] = (stats.byLocation[match.location] || 0) + 1;
    if (match.category) stats.byCategory[match.category] = (stats.byCategory[match.category] || 0) + 1;
    if (match.match_type) stats.byMatchType[match.match_type] = (stats.byMatchType[match.match_type] || 0) + 1;
  });

  return stats;
};
