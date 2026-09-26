// lib/utils.ts
import matchesData from "@/data/matches.json";

export type Match = {
  date: string | null;
  day: string | null;
  home_team: string | null;
  away_team: string | null;
  time: string | null;
  location: string | null;
  match_type: string | null;
  category: string | null;
  season: string | null;
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
