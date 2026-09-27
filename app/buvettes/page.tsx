// app/buvettes/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Match } from "@/lib/utils";
import { Calendar, Clock, Home, Plane, Beer, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

// Couleurs des salles EHR
const LOCATION_COLORS: Record<string, string> = {
  'Rodemack': 'bg-yellow-100 border-yellow-300',
  'Hettange (Hall)': 'bg-blue-100 border-blue-300',
  'Hettange (Poly)': 'bg-green-100 border-green-300',
  'Kanfen': 'bg-orange-100 border-orange-300',
  'Extérieur': 'bg-gray-100 border-gray-300',
};

// Couleurs des salles pour les badges
const LOCATION_BADGE_COLORS: Record<string, string> = {
  'Rodemack': 'bg-yellow-500 text-white',
  'Hettange (Hall)': 'bg-blue-500 text-white',
  'Hettange (Poly)': 'bg-green-500 text-white',
  'Kanfen': 'bg-orange-500 text-white',
  'Extérieur': 'bg-gray-500 text-white',
};

// Icônes pour domicile/extérieur
const getMatchIcon = (isHome: boolean | undefined, isAway: boolean | undefined) => {
  if (isHome && !isAway) {
    return <Home className="w-4 h-4 text-blue-600" />;
  } else if (isAway && !isHome) {
    return <Plane className="w-4 h-4 text-yellow-600" />;
  }
  return <Calendar className="w-4 h-4 text-gray-600" />;
};

// Formater la date pour affichage
const formatDisplayDate = (date: string | null) => {
  if (!date) return '-';
  const parts = date.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return date;
};

// Formater l'heure
const formatTime = (time: string | null) => {
  if (!time) return '';
  return time.replace(/([0-9]{1,2})h([0-9]{2})/, '$1h $2');
};

// Obtenir le nom du jour en français
const getDayName = (dateStr: string | null) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  return days[date.getDay()];
};

// Vérifier si deux matchs sont consécutifs (écart < 2h)
const areConsecutive = (match1: Match, match2: Match): boolean => {
  if (!match1.time || !match2.time) return false;
  
  // Convertir l'heure en minutes
  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split('h').map(t => t.trim());
    return parseInt(hours) * 60 + (parseInt(minutes) || 0);
  };
  
  const time1 = timeToMinutes(match1.time);
  const time2 = timeToMinutes(match2.time);
  const diff = Math.abs(time2 - time1);
  
  // Considéré comme consécutif si l'écart est <= 2h (120 minutes)
  return diff <= 120 && diff > 0;
};

// Trouver les groupes de matchs consécutifs
const findConsecutiveGroups = (matches: Match[]): Match[][] => {
  if (matches.length === 0) return [];
  
  const sortedMatches = [...matches].sort((a, b) => {
    const timeA = a.time || '23:59';
    const timeB = b.time || '23:59';
    return timeA.localeCompare(timeB);
  });
  
  const groups: Match[][] = [];
  let currentGroup: Match[] = [sortedMatches[0]];
  
  for (let i = 1; i < sortedMatches.length; i++) {
    const prevMatch = sortedMatches[i - 1];
    const currMatch = sortedMatches[i];
    
    if (areConsecutive(prevMatch, currMatch)) {
      currentGroup.push(currMatch);
    } else {
      if (currentGroup.length >= 2) {
        groups.push([...currentGroup]);
      }
      currentGroup = [currMatch];
    }
  }
  
  // Ajouter le dernier groupe
  if (currentGroup.length >= 2) {
    groups.push([...currentGroup]);
  }
  
  return groups;
};

export default function BuvettesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWeekend, setSelectedWeekend] = useState<{saturday: string; sunday: string} | null>(null);
  const [allWeekends, setAllWeekends] = useState<{saturday: string; sunday: string; label: string}[]>([]);
  
  // Liste des salles EHR (sans Extérieur)
  const ehrLocations = ['Rodemack', 'Hettange (Hall)', 'Hettange (Poly)', 'Kanfen'];
  
  // Filtrer les matchs Extérieur
  const filterEHRMatches = (matches: Match[]) => {
    return matches.filter(m => m.location && ehrLocations.includes(m.location));
  };

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/matches");
        const data = await response.json();
        setMatches(data);
        
        // Générer tous les week-ends disponibles
        const weekends = generateAllWeekends(data);
        setAllWeekends(weekends);
        
        // Sélectionner le week-end actuel par défaut
        if (weekends.length > 0) {
          // Trouver le week-end actuel (qui contient aujourd'hui ou le week-end à venir)
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          
          // Tant que le dimanche n'est pas passé, on reste sur le week-end actuel
          let currentWeekend = weekends[0];
          
          for (const weekend of weekends) {
            const saturdayDate = new Date(weekend.saturday);
            const sundayDate = new Date(weekend.sunday);
            
            // Si aujourd'hui est samedi ou dimanche de ce week-end
            if ((now.getDay() === 6 && now.toISOString().split('T')[0] === weekend.saturday) ||
                (now.getDay() === 0 && now.toISOString().split('T')[0] === weekend.sunday)) {
              currentWeekend = weekend;
              break;
            }
            
            // Si aujourd'hui est avant le week-end
            if (now < saturdayDate) {
              currentWeekend = weekend;
              break;
            }
          }
          
          setSelectedWeekend({ saturday: currentWeekend.saturday, sunday: currentWeekend.sunday });
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des matchs :", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMatches();
  }, []);

  // Générer tous les week-ends disponibles à partir des matchs
  const generateAllWeekends = (matches: Match[]): {saturday: string; sunday: string; label: string}[] => {
    const dateSet = new Set<string>();
    matches.forEach((m) => {
      if (m.date) dateSet.add(m.date);
    });
    
    const dates = Array.from(dateSet).sort();
    const weekends: {saturday: string; sunday: string; label: string}[] = [];
    
    // Grouper les dates par week-end
    const weekendMap = new Map<string, {saturday: string; sunday: string} >();
    
    dates.forEach((date) => {
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.getDay();
      
      let saturday: Date;
      let sunday: Date;
      
      if (dayOfWeek === 6) {
        // Samedi
        saturday = new Date(dateObj);
        sunday = new Date(dateObj);
        sunday.setDate(dateObj.getDate() + 1);
      } else if (dayOfWeek === 0) {
        // Dimanche
        saturday = new Date(dateObj);
        saturday.setDate(dateObj.getDate() - 1);
        sunday = new Date(dateObj);
      } else {
        // Lundi à vendredi - trouver le week-end précédent ou suivant
        saturday = new Date(dateObj);
        saturday.setDate(dateObj.getDate() - dayOfWeek);
        sunday = new Date(saturday);
        sunday.setDate(saturday.getDate() + 1);
      }
      
      const saturdayStr = saturday.toISOString().split('T')[0];
      const sundayStr = sunday.toISOString().split('T')[0];
      const weekendKey = `${saturdayStr}-${sundayStr}`;
      
      if (!weekendMap.has(weekendKey)) {
        weekendMap.set(weekendKey, { saturday: saturdayStr, sunday: sundayStr });
      }
    });
    
    // Convertir en tableau et trier
    const sortedWeekends = Array.from(weekendMap.values()).sort((a, b) => {
      return a.saturday.localeCompare(b.saturday);
    });
    
    // Générer les labels
    sortedWeekends.forEach((w) => {
      const saturdayDate = new Date(w.saturday);
      const sundayDate = new Date(w.sunday);
      const saturdayDisplay = formatDisplayDate(w.saturday);
      const month = saturdayDate.toLocaleString('fr-FR', { month: 'short' });
      weekends.push({
        ...w,
        label: `Week-end du ${saturdayDisplay} (${month})`
      });
    });
    
    return weekends;
  };

  // Obtenir les matchs pour le week-end sélectionné (sans Extérieur)
  const getWeekendMatches = () => {
    if (!selectedWeekend) return [];
    
    const weekendMatches = matches.filter((m) => {
      return m.date === selectedWeekend.saturday || m.date === selectedWeekend.sunday;
    });
    
    return filterEHRMatches(weekendMatches);
  };

  // Grouper les matchs par date puis par salle
  const getMatchesByDateAndLocation = () => {
    const weekendMatches = getWeekendMatches();
    const byDate: Record<string, Record<string, Match[]>> = {};
    
    // D'abord trier par date et heure
    const sortedMatches = [...weekendMatches].sort((a, b) => {
      if (a.date !== b.date) {
        return (a.date || '').localeCompare(b.date || '');
      }
      return (a.time || '23:59').localeCompare(b.time || '23:59');
    });
    
    sortedMatches.forEach((match) => {
      const date = match.date || 'Inconnu';
      const location = match.location || 'Extérieur';
      
      if (!byDate[date]) {
        byDate[date] = {};
      }
      if (!byDate[date][location]) {
        byDate[date][location] = [];
      }
      byDate[date][location].push(match);
    });
    
    // Trier les matchs par heure dans chaque salle
    Object.keys(byDate).forEach((date) => {
      Object.keys(byDate[date]).forEach((location) => {
        byDate[date][location].sort((a, b) => {
          return (a.time || '23:59').localeCompare(b.time || '23:59');
        });
      });
    });
    
    return byDate;
  };

  // Vérifier si une salle a des matchs consécutifs pour un week-end
  const getBuvetteCandidates = () => {
    const matchesByDateAndLocation = getMatchesByDateAndLocation();
    const candidates: Record<string, { location: string; matches: Match[][]; totalMatches: number }> = {};
    
    // Parcourir toutes les dates du week-end
    Object.keys(matchesByDateAndLocation).forEach((date) => {
      const locations = matchesByDateAndLocation[date];
      
      Object.keys(locations).forEach((location) => {
        const locationMatches = locations[location];
        
        if (locationMatches.length >= 2) {
          // Trouver les groupes de matchs consécutifs
          const consecutiveGroups = findConsecutiveGroups(locationMatches);
          
          if (consecutiveGroups.length > 0) {
            const key = `${date}-${location}`;
            candidates[key] = {
              location,
              matches: consecutiveGroups,
              totalMatches: locationMatches.length
            };
          }
        }
      });
    });
    
    return candidates;
  };

  // Obtenir un résumé par salle pour le week-end (groupé par date)
  const getLocationSummary = () => {
    const matchesByDateAndLocation = getMatchesByDateAndLocation();
    const summary: Record<string, { matchesByDate: Record<string, Match[]>; consecutiveGroupsByDate: Record<string, Match[][]>; totalMatches: number; isBuvetteCandidate: boolean }> = {};
    
    // Initialiser avec toutes les salles EHR
    ehrLocations.forEach((location) => {
      summary[location] = { matchesByDate: {}, consecutiveGroupsByDate: {}, totalMatches: 0, isBuvetteCandidate: false };
    });
    
    // Parcourir toutes les dates
    Object.entries(matchesByDateAndLocation).forEach(([date, locations]) => {
      Object.entries(locations).forEach(([location, locationMatches]) => {
        if (ehrLocations.includes(location)) {
          if (!summary[location]) {
            summary[location] = { matchesByDate: {}, consecutiveGroupsByDate: {}, totalMatches: 0, isBuvetteCandidate: false };
          }
          summary[location].matchesByDate[date] = locationMatches;
          summary[location].totalMatches += locationMatches.length;
        }
      });
    });
    
    // Vérifier les matchs consécutifs pour chaque salle et par date
    Object.keys(summary).forEach((location) => {
      let hasConsecutive = false;
      const consecutiveGroupsByDate: Record<string, Match[][]> = {};
      
      Object.entries(summary[location].matchesByDate).forEach(([date, dateMatches]) => {
        if (dateMatches.length >= 2) {
          const sortedMatches = [...dateMatches].sort((a, b) => {
            return (a.time || '23:59').localeCompare(b.time || '23:59');
          });
          const consecutiveGroups = findConsecutiveGroups(sortedMatches);
          if (consecutiveGroups.length > 0) {
            consecutiveGroupsByDate[date] = consecutiveGroups;
            hasConsecutive = true;
          }
        }
      });
      
      summary[location].consecutiveGroupsByDate = consecutiveGroupsByDate;
      summary[location].isBuvetteCandidate = hasConsecutive;
    });
    
    return summary;
  };

  if (isLoading) {
    return (
      <div className="container-custom animate-pulse">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-blue-500 rounded-full mx-auto mb-4 animate-pulse flex items-center justify-center">
            <Beer className="w-8 h-8 text-white" />
          </div>
          <p className="text-blue-600 text-lg">Chargement des données de buvette...</p>
        </div>
      </div>
    );
  }

  const locationSummary = getLocationSummary();
  const buvetteCandidates = getBuvetteCandidates();
  const matchesByDateAndLocation = getMatchesByDateAndLocation();
  const weekendMatches = getWeekendMatches();

  return (
    <div className="container-custom animate-fade-in">
      <div className="mb-8">
        <h1 className="page-title">🍺 Gestion des Buvettes</h1>
        <p className="page-subtitle">
          Anticipez les besoins en buvette pour le week-end - Détection automatique des créneaux avec matchs consécutifs
        </p>
      </div>

      {/* Sélecteur de week-end */}
      {allWeekends.length > 0 && (
        <div className="card mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex-1">
              <label className="block text-sm font-medium text-blue-800 mb-2">
                📅 Sélectionnez un week-end
              </label>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                {allWeekends.map((weekend) => {
                  const isSelected = selectedWeekend?.saturday === weekend.saturday && selectedWeekend?.sunday === weekend.sunday;
                  const saturdayDate = new Date(weekend.saturday);
                  const isCurrentMonth = saturdayDate.getMonth() === new Date().getMonth();
                  
                  return (
                    <button
                      key={`${weekend.saturday}-${weekend.sunday}`}
                      onClick={() => setSelectedWeekend({ saturday: weekend.saturday, sunday: weekend.sunday })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-500'
                          : isCurrentMonth
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <div className="text-xs opacity-70">{weekend.label.split('(')[1]?.replace(')', '') || ''}</div>
                      <div className="font-medium">{weekend.label.split('Week-end du ')[1]?.split(' (')[0]}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Résumé des candidats buvette */}
      {selectedWeekend && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-blue-800 mb-6 flex items-center gap-2">
            <CheckCircle className="w-6 h-6" />
            Salles avec créneaux buvette recommandés
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {ehrLocations.map((location) => {
              const summary = locationSummary[location];
              const totalMatches = summary?.totalMatches || 0;
              const hasConsecutive = summary?.isBuvetteCandidate || false;
              const matchesByDate = summary?.matchesByDate || {};
              const consecutiveGroupsByDate = summary?.consecutiveGroupsByDate || {};
              
              // Calculer le total de matchs consécutifs
              const totalConsecutiveMatches = Object.values(consecutiveGroupsByDate).reduce(
                (sum, groups) => sum + groups.reduce((gSum, group) => gSum + group.length, 0),
                0
              );
              
              return (
                <div
                  key={location}
                  className={`card p-4 ${LOCATION_COLORS[location] || 'bg-white border-gray-200'} ${
                    hasConsecutive ? 'ring-2 ring-green-500 shadow-lg' : 'opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-blue-800 text-lg">{location}</h3>
                    {hasConsecutive ? (
                      <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                        ✓ Buvette
                      </span>
                    ) : (
                      <span className="bg-gray-300 text-gray-600 px-2 py-1 rounded-full text-xs">
                        Aucun créneau
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Matchs totaux:</span>
                      <span className="font-semibold text-blue-700">{totalMatches}</span>
                    </div>
                    {hasConsecutive && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Matchs consécutifs:</span>
                        <span className="font-semibold text-green-700">{totalConsecutiveMatches}</span>
                      </div>
                    )}
                    {hasConsecutive && Object.keys(consecutiveGroupsByDate).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-current/20">
                        <p className="text-xs text-gray-600 mb-2">Créneaux par date:</p>
                        {Object.entries(consecutiveGroupsByDate).map(([date, groups]) => (
                          <div key={date} className="mb-2">
                            <p className="text-xs font-medium text-blue-700 mb-1">
                              {formatDisplayDate(date)} ({getDayName(date).substring(0, 3)})
                            </p>
                            {groups.slice(0, 2).map((group, idx) => (
                              <div key={idx} className="text-xs bg-white/50 p-2 rounded mb-1">
                                {group.map((m, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <span>{formatTime(m.time)}</span>
                                    <span className="text-gray-500">-</span>
                                    <span className="truncate max-w-20">{m.home_team} vs {m.away_team}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Légende */}
          <div className="card bg-yellow-50 p-4 mb-8">
            <p className="text-sm text-gray-600 mb-2">
              <strong>Légende:</strong>
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-yellow-500 rounded block" />
                <span className="text-sm">Rodemack</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-blue-500 rounded block" />
                <span className="text-sm">Hall Hettange</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-green-500 rounded block" />
                <span className="text-sm">Poly Hettange</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-orange-500 rounded block" />
                <span className="text-sm">Kanfen</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 bg-green-500 rounded block" />
                <span className="text-sm">✓ Créneau buvette</span>
              </div>
            </div>
          </div>

          {/* Détails par jour */}
          <div className="space-y-8">
            {Object.keys(matchesByDateAndLocation).sort().map((date) => {
              const locations = matchesByDateAndLocation[date];
              const dateMatches = Object.values(locations).flat();
              
              return (
                <div key={date} className="card">
                  <div className="mb-4 pb-4 border-b-2 border-blue-200">
                    <h3 className="text-xl font-bold text-blue-800 flex items-center gap-2">
                      <Calendar className="w-6 h-6" />
                      {formatDisplayDate(date)} - {getDayName(date)}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {dateMatches.length} match{dateMatches.length > 1 ? 's' : ''} prévu{dateMatches.length > 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Affichage par salle */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(locations).map(([location, locationMatches]) => {
                      const consecutiveGroups = findConsecutiveGroups(locationMatches);
                      const isBuvetteCandidate = consecutiveGroups.length > 0;
                      const totalConsecutive = consecutiveGroups.reduce((sum, g) => sum + g.length, 0);
                      
                      return (
                        <div
                          key={location}
                          className={`p-4 rounded-xl ${LOCATION_COLORS[location] || 'bg-white border border-gray-200'} ${
                            isBuvetteCandidate ? 'ring-2 ring-green-400' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-blue-800 text-lg">{location}</h4>
                            <div className="flex items-center gap-2">
                              {isBuvetteCandidate && (
                                <span className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Buvette
                                </span>
                              )}
                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                LOCATION_BADGE_COLORS[location] || 'bg-gray-500 text-white'
                              }`}>
                                {locationMatches.length} match{locationMatches.length > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>

                          {isBuvetteCandidate && (
                            <div className="mb-3 p-3 bg-green-50 rounded-lg border border-green-200">
                              <p className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                                <Beer className="w-4 h-4" />
                                Créneau buvette: {totalConsecutive} match{totalConsecutive > 1 ? 's' : ''} consécutif{totalConsecutive > 1 ? 's' : ''}
                              </p>
                              <div className="text-xs space-y-1">
                                {consecutiveGroups.map((group, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-green-800">
                                    <span>→ {group.map(g => formatTime(g.time)).join(' - ')}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Liste des matchs */}
                          <div className="space-y-3">
                            {locationMatches.map((match, idx) => {
                              const isConsecutive = consecutiveGroups.some(group => 
                                group.includes(match)
                              );
                              
                              return (
                                <div
                                  key={`${date}-${location}-${idx}`}
                                  className={`p-3 rounded-lg border ${
                                    isConsecutive 
                                      ? 'border-green-300 bg-green-50/50' 
                                      : 'border-blue-100 bg-white/50'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0">
                                      {getMatchIcon(match.is_home, match.is_away)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-blue-800 text-sm">
                                        {match.home_team} {match.away_team ? 'vs ' : ''}{match.away_team}
                                      </div>
                                      {match.category && (
                                        <div className="text-xs text-gray-600 mt-1">
                                          {match.category}
                                        </div>
                                      )}
                                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatTime(match.time)}
                                      </div>
                                      {match.camionnette && (
                                        <div className="text-xs mt-1">
                                          <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                                            🚐 {match.camionnette}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    {isConsecutive && (
                                      <div className="flex-shrink-0">
                                        <Beer className="w-4 h-4 text-green-600" />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Résumé du jour */}
                  {Object.values(locations).flat().length > 0 && (
                    <div className="mt-4 pt-4 border-t border-blue-100">
                      <p className="text-sm text-center text-gray-500">
                        {Object.entries(locations).filter(([l, m]) => findConsecutiveGroups(m).length > 0).length} salle{Object.entries(locations).filter(([l, m]) => findConsecutiveGroups(m).length > 0).length > 1 ? 's' : ''} avec créneaux buvette ce jour
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Si aucun week-end sélectionné */}
      {selectedWeekend && weekendMatches.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Beer className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-gray-600 text-lg">Aucun match prévu pour ce week-end.</p>
          <p className="text-gray-500 mt-2">Sélectionnez un autre week-end pour voir les créneaux buvette.</p>
        </div>
      )}

      {/* Info aide */}
      <div className="card bg-blue-50 mt-12 p-6">
        <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Comment utiliser cette page
        </h3>
        <ul className="text-sm text-blue-700 space-y-2">
          <li>• Les salles avec un fond vert clair et l'icône ✓ sont des <strong>bons candidats pour ouvrir une buvette</strong></li>
          <li>• Un créneau buvette est détecté quand au moins 2 matchs se succèdent (écart ≤ 2h) dans la même salle</li>
          <li>• Les matchs concernés sont mis en évidence avec l'icône 🍺</li>
          <li>• Utilisez le sélecteur en haut pour naviguer entre les week-ends</li>
          <li>• Les couleurs des salles: Jaune=Rodemack, Bleu=Hall Hettange, Vert=Poly Hettange, Orange=Kanfen</li>
        </ul>
      </div>
    </div>
  );
}
