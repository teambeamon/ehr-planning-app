// lib/utils.ts
import matchesData from "@/data/matches.json";

export type Match = {
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
    // Filtre par équipe (recherche dans home_team ou away_team, avec includes pour plus de flexibilité)
    const teamFilterPass = !filters.team || 
      (match.home_team && match.home_team.toLowerCase().includes(filters.team.toLowerCase())) ||
      (match.away_team && match.away_team.toLowerCase().includes(filters.team.toLowerCase())) ||
      (match.category && match.category.toLowerCase().includes(filters.team.toLowerCase()));
    
    // Filtre par lieu (correspondance exacte pour les salles EHR)
    const locationFilterPass = !filters.location || match.location === filters.location;
    
    // Filtre par catégorie
    const categoryFilterPass = !filters.category || match.category === filters.category;
    
    // Filtre par saison
    const seasonFilterPass = !filters.season || match.season === filters.season;
    
    return teamFilterPass && locationFilterPass && categoryFilterPass && seasonFilterPass;
  });
};

// Fonctions utilitaires pour extraire les valeurs uniques
export const getTeams = (): string[] => {
  // Ne retourner que les équipes EHR (celles qui jouent à domicile ou à l'extérieur)
  // Les équipes EHR sont celles qui ont is_home=true ou is_away=true
  const ehrTeamsSet = new Set<string>();
  matchesData.forEach((match: Match) => {
    if (match.is_home && match.home_team) ehrTeamsSet.add(match.home_team);
    if (match.is_away && match.away_team) ehrTeamsSet.add(match.away_team);
  });
  return Array.from(ehrTeamsSet).sort();
};

export const getLocations = (): string[] => {
  // Salles EHR uniquement
  const ehrLocations = ['Hettange (Hall)', 'Hettange (Poly)', 'Rodemack', 'Kanfen'];
  const locationsSet = new Set<string>();
  matchesData.forEach((match: Match) => {
    if (match.location && ehrLocations.includes(match.location)) {
      locationsSet.add(match.location);
    }
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
  // Salles EHR uniquement
  const ehrLocations = ['Hettange (Hall)', 'Hettange (Poly)', 'Rodemack', 'Kanfen'];
  
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
    // Filtrer uniquement les salles EHR
    if (match.location && ehrLocations.includes(match.location)) {
      stats.byLocation[match.location] = (stats.byLocation[match.location] || 0) + 1;
    }
    if (match.category) stats.byCategory[match.category] = (stats.byCategory[match.category] || 0) + 1;
    if (match.match_type) stats.byMatchType[match.match_type] = (stats.byMatchType[match.match_type] || 0) + 1;
  });

  return stats;
};

// Statistiques pour les locations EHR uniquement
export const getEHRLocationsStats = () => {
  const ehrLocations = ['Hettange (Hall)', 'Hettange (Poly)', 'Rodemack', 'Kanfen'];
  const homeMatches = matchesData.filter((m: Match) => m.is_home && m.location && ehrLocations.includes(m.location));
  
  const byLocation: Record<string, number> = {};
  homeMatches.forEach((match: Match) => {
    if (match.location) {
      byLocation[match.location] = (byLocation[match.location] || 0) + 1;
    }
  });
  
  return {
    byLocation,
    totalHome: homeMatches.length
  };
};
