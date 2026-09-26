// app/planning/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Match } from "@/lib/utils";
import { Calendar, Clock, Home, Plane, Trophy } from "lucide-react";

// Couleurs des salles
const LOCATION_COLORS: Record<string, string> = {
  'Rodemack': 'bg-yellow-50 border-yellow-200',
  'Hettange (Hall)': 'bg-blue-50 border-blue-200',
  'Hettange (Poly)': 'bg-green-50 border-green-200',
  'Kanfen': 'bg-orange-50 border-orange-200',
  'Extérieur': 'bg-gray-50 border-gray-200',
};

// Icônes pour domicile/extérieur
const getMatchIcon = (isHome: boolean | undefined, isAway: boolean | undefined) => {
  if (isHome && !isAway) {
    return <Home className="w-4 h-4 text-blue-600" />;
  } else if (isAway && !isHome) {
    return <Plane className="w-4 h-4 text-yellow-600" />;
  }
  return <Trophy className="w-4 h-4 text-gray-600" />;
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

export default function PlanningPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>('toutes');
  
  // Liste des salles EHR
  const ehrLocations = ['Rodemack', 'Hettange (Hall)', 'Hettange (Poly)', 'Kanfen', 'Extérieur'];

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/matches");
        const data = await response.json();
        setMatches(data);
        
        // Par défaut, sélectionner la date du premier match
        if (data.length > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayStr = today.toISOString().split('T')[0];
          
          // Trouver la date la plus proche >= aujourd'hui
          const futureMatches = data.filter((m: Match) => m.date && m.date >= todayStr);
          if (futureMatches.length > 0) {
            setSelectedDate(futureMatches[0].date);
          } else {
            setSelectedDate(data[0].date);
          }
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des matchs :", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMatches();
  }, []);

  // Obtenir toutes les dates uniques
  const getAllDates = () => {
    const dates: string[] = [];
    matches.forEach((match) => {
      if (match.date && !dates.includes(match.date)) {
        dates.push(match.date);
      }
    });
    return dates.sort();
  };

  // Filtrer les matchs par date et salle
  const getFilteredMatches = () => {
    let filtered = matches;
    
    if (selectedDate) {
      filtered = filtered.filter((m) => m.date === selectedDate);
    }
    
    if (selectedLocation !== 'toutes') {
      filtered = filtered.filter((m) => m.location === selectedLocation);
    }
    
    return filtered;
  };

  // Grouper les matchs par salle
  const getMatchesByLocation = () => {
    const byLocation: Record<string, Match[]> = {};
    const filtered = getFilteredMatches();
    
    filtered.forEach((match) => {
      const location = match.location || 'Inconnu';
      if (!byLocation[location]) {
        byLocation[location] = [];
      }
      byLocation[location].push(match);
    });
    
    // Trier les matchs par heure dans chaque salle
    Object.keys(byLocation).forEach((location) => {
      byLocation[location].sort((a, b) => {
        const timeA = a.time || '23:59';
        const timeB = b.time || '23:59';
        return timeA.localeCompare(timeB);
      });
    });
    
    return byLocation;
  };

  // Obtenir le nom du mois
  const getMonthName = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    return months[date.getMonth()];
  };

  if (isLoading) {
    return (
      <div className="container-custom animate-pulse">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-blue-500 rounded-full mx-auto mb-4 animate-pulse flex items-center justify-center">
            <span className="text-2xl text-white">⏳</span>
          </div>
          <p className="text-blue-600 text-lg">Chargement du planning...</p>
        </div>
      </div>
    );
  }

  const allDates = getAllDates();
  const matchesByLocation = getMatchesByLocation();
  const filteredMatches = getFilteredMatches();

  return (
    <div className="container-custom animate-fade-in">
      <div className="mb-8">
        <h1 className="page-title">📅 Planning des Matchs par Salle</h1>
        <p className="page-subtitle">
          Saison 2026-2027 - Entente Hettange Rodemack
        </p>
      </div>

      {/* Sélecteur de date */}
      <div className="card mb-8">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex-1">
            <label className="block text-sm font-medium text-blue-800 mb-2">
              📅 Sélectionnez une date
            </label>
            <div className="flex flex-wrap gap-2">
              {allDates.map((date) => {
                const isSelected = selectedDate === date;
                const dayName = getDayName(date);
                const monthName = getMonthName(date);
                const shortDate = formatDisplayDate(date);
                
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      isSelected 
                        ? 'bg-blue-600 text-white shadow-lg' 
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    <div className="text-xs opacity-70">{dayName}</div>
                    <div>{shortDate}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Sélecteur de salle */}
      <div className="card mb-8">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedLocation('toutes')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedLocation === 'toutes'
                ? 'bg-blue-600 text-white'
                : 'bg-yellow-50 text-blue-700 hover:bg-yellow-100'
            }`}
          >
            Toutes les salles
          </button>
          {ehrLocations.map((location) => (
            <button
              key={location}
              onClick={() => setSelectedLocation(location)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedLocation === location
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              {location}
            </button>
          ))}
        </div>
      </div>

      {/* Affichage des matchs par salle */}
      {selectedDate && (
        <div className="space-y-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-blue-800">
              {formatDisplayDate(selectedDate)} - {getDayName(selectedDate)}
            </h2>
            <p className="text-gray-600 mt-2">
              {filteredMatches.length} match{filteredMatches.length > 1 ? 's' : ''} trouvé{filteredMatches.length > 1 ? 's' : ''}
            </p>
          </div>

          {/* Affichage par salle */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.entries(matchesByLocation).map(([location, locationMatches]) => (
              <div
                key={location}
                className={`card ${LOCATION_COLORS[location] || 'bg-white border-gray-200'}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-blue-800">
                    {location}
                  </h3>
                  <span className="text-sm text-gray-600">
                    {locationMatches.length} match{locationMatches.length > 1 ? 's' : ''}
                  </span>
                </div>
                
                <div className="space-y-3">
                  {locationMatches.map((match) => (
                    <div
                      key={`${match.date}-${match.home_team}-${match.away_team}`}
                      className="p-3 bg-white/50 rounded-lg border border-blue-100 hover:bg-white/80 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          {getMatchIcon(match.is_home, match.is_away)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-blue-800 text-sm">
                            {match.home_team} {match.away_team ? 'vs' : ''} {match.away_team}
                          </div>
                          {match.time && (
                            <div className="text-xs text-yellow-600 mt-1">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {formatTime(match.time)}
                            </div>
                          )}
                          {match.match_type !== 'Championnat' && (
                            <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                              {match.match_type}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Si aucune date sélectionnée */}
      {!selectedDate && allDates.length > 0 && (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <p className="text-gray-600">Sélectionnez une date pour afficher les matchs</p>
        </div>
      )}
    </div>
  );
}
