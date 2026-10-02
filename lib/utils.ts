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

export const getFilteredMatches = (filters: {
  team?: string;
  location?: string;
  category?: string;
  season?: string;
}): Match[] => {
  return matchesData.filter((match: Match) => {
    // Filtre par équipe (recherche dans home_team ou away_team)
    // Seules les équipes EHR doivent apparaître dans le filtre
    const teamFilterPass = !filters.team || 
      (match.home_team && EHR_TEAM_NAMES.has(match.home_team) && match.home_team.toLowerCase().includes(filters.team.toLowerCase())) ||
      (match.away_team && EHR_TEAM_NAMES.has(match.away_team) && match.away_team.toLowerCase().includes(filters.team.toLowerCase()));
    
    // Filtre par lieu (salles EHR + Extérieur)
    const locationFilterPass = !filters.location || match.location === filters.location;
    
    // Filtre par catégorie
    const categoryFilterPass = !filters.category || (match.category && match.category.toLowerCase().includes(filters.category.toLowerCase()));
    
    // Filtre par saison
    const seasonFilterPass = !filters.season || match.season === filters.season;
    
    return teamFilterPass && locationFilterPass && categoryFilterPass && seasonFilterPass;
  });
};

// Fonctions utilitaires pour extraire les valeurs uniques
export const getTeams = (): string[] => {
  // Ne retourner que les équipes EHR
  const ehrTeamsSet = new Set<string>();
  matchesData.forEach((match: Match) => {
    if (match.home_team && EHR_TEAM_NAMES.has(match.home_team)) {
      ehrTeamsSet.add(match.home_team);
    }
    if (match.away_team && EHR_TEAM_NAMES.has(match.away_team)) {
      ehrTeamsSet.add(match.away_team);
    }
  });
  // Retourner dans l'ordre standard
  const standardOrder = ['Seniors M', 'Seniors F1', 'Seniors F2', 'M17', 'F17', 'M15', 'F15', 'M13', 'F13', 'M11', 'F11'];
  return standardOrder.filter(team => ehrTeamsSet.has(team));
};

export const getLocations = (): string[] => {
  // Salles EHR + Extérieur
  const locationsSet = new Set<string>();
  matchesData.forEach((match: Match) => {
    if (match.location && EHR_LOCATIONS.includes(match.location)) {
      locationsSet.add(match.location);
    }
    if (match.location === 'Extérieur') {
      locationsSet.add(match.location);
    }
  });
  // Retourner dans l'ordre standard
  return ['Rodemack', 'Hettange (Hall)', 'Hettange (Poly)', 'Kanfen', 'Extérieur']
    .filter(loc => locationsSet.has(loc));
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

  // Compter uniquement les matchs EHR pour les stats par équipe
  matchesData.forEach((match: Match) => {
    if (match.is_home && match.home_team && EHR_TEAM_NAMES.has(match.home_team)) {
      const displayName = TEAM_DISPLAY_NAMES[match.home_team] || match.home_team;
      stats.byTeam[displayName] = (stats.byTeam[displayName] || 0) + 1;
    }
    // Filtrer uniquement les salles EHR
    if (match.location && EHR_LOCATIONS.includes(match.location)) {
      stats.byLocation[match.location] = (stats.byLocation[match.location] || 0) + 1;
    }
    if (match.category) stats.byCategory[match.category] = (stats.byCategory[match.category] || 0) + 1;
    if (match.match_type) stats.byMatchType[match.match_type] = (stats.byMatchType[match.match_type] || 0) + 1;
  });

  return stats;
};

// Statistiques pour les locations EHR uniquement
export const getEHRLocationsStats = () => {
  const homeMatches = matchesData.filter((m: Match) => m.is_home && m.location && EHR_LOCATIONS.includes(m.location));
  
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

// Fonction pour obtenir les matchs du week-end actuel
export const getWeekendMatches = (): Match[] => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  let saturday: Date, sunday: Date;
  
  // Si aujourd'hui est samedi (6) ou dimanche (0)
  if (now.getDay() === 6) {
    // Samedi: week-end = aujourd'hui + demain
    saturday = new Date(now);
    sunday = new Date(now);
    sunday.setDate(now.getDate() + 1);
  } else if (now.getDay() === 0) {
    // Dimanche: week-end = hier + aujourd'hui
    saturday = new Date(now);
    saturday.setDate(now.getDate() - 1);
    sunday = new Date(now);
  } else {
    // Lundi à vendredi: week-end = samedi/dimanche suivant
    saturday = new Date(now);
    saturday.setDate(now.getDate() + (6 - now.getDay()));
    sunday = new Date(saturday);
    sunday.setDate(saturday.getDate() + 1);
  }
  
  // Formater les dates en YYYY-MM-DD
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const saturdayStr = formatDate(saturday);
  const sundayStr = formatDate(sunday);
  
  // Filtrer les matchs du week-end
  return matchesData.filter((match: Match) => {
    return match.date === saturdayStr || match.date === sundayStr;
  });
};

// Fonction utilitaire pour obtenir le nom d'affichage d'une équipe
export const getTeamDisplayName = (team: string | null): string => {
  if (!team) return '';
  return TEAM_DISPLAY_NAMES[team] || team;
};
