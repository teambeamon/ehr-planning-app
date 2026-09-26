// components/WeekendMatches.tsx
"use client";

import { useState, useEffect } from "react";
import { Match } from "@/lib/utils";
import { Home, Plane, Calendar } from "lucide-react";

// Fonction pour obtenir la couleur du lieu (fond)
const getLocationBgColor = (location: string | null, isHome: boolean | undefined) => {
  // Pour les matchs à l'extérieur, fond blanc
  if (!isHome) return 'bg-white';
  if (!location) return 'bg-white';
  
  const locationLower = location.toLowerCase();
  
  if (locationLower.includes('kanfen')) {
    return 'bg-orange-50';
  } else if (locationLower.includes('rodemack')) {
    return 'bg-yellow-50';
  } else if (locationLower.includes('hettange') && locationLower.includes('poly')) {
    return 'bg-green-50';
  } else if (locationLower.includes('hettange') && locationLower.includes('hall')) {
    return 'bg-blue-50';
  }
  
  return 'bg-white';
};

// Fonction pour obtenir l'icône
const getMatchIcon = (isHome: boolean | undefined, isAway: boolean | undefined) => {
  if (isHome && !isAway) {
    return <Home className="w-4 h-4 text-blue-600" />;
  } else if (isAway && !isHome) {
    return <Plane className="w-4 h-4 text-yellow-600" />;
  }
  return <Calendar className="w-4 h-4 text-gray-600" />;
};

// Formatage de la date
const formatDisplayDate = (date: string | null) => {
  if (!date) return '-';
  const parts = date.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return date;
};

// Formatage de l'heure
const formatTime = (time: string | null) => {
  if (!time) return '';
  // Ajouter un espace entre l'heure et les minutes
  return time.replace(/([0-9]{1,2})h([0-9]{2})/, '$1h $2');
};

export default function WeekendMatches() {
  const [weekendMatches, setWeekendMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWeekendMatches = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/matches");
        const allMatches = await response.json();
        
        // Obtenir les dates du week-end actuel
        const now = new Date();
        const saturday = new Date(now);
        saturday.setDate(now.getDate() + (6 - now.getDay()));
        saturday.setHours(0, 0, 0, 0);
        
        const sunday = new Date(saturday);
        sunday.setDate(saturday.getDate() + 1);
        
        const formatDate = (date: Date): string => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        
        const saturdayStr = formatDate(saturday);
        const sundayStr = formatDate(sunday);
        
        // Filtrer les matchs du week-end
        const matches = allMatches.filter((match: Match) => {
          return match.date === saturdayStr || match.date === sundayStr;
        });
        
        // Trier par date et heure
        matches.sort((a: Match, b: Match) => {
          if (a.date !== b.date) {
            return (a.date || '').localeCompare(b.date || '');
          }
          return (a.time || '99:99').localeCompare(b.time || '99:99');
        });
        
        setWeekendMatches(matches);
      } catch (error) {
        console.error("Erreur lors de la récupération des matchs du week-end:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchWeekendMatches();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-2 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Matchs du Week-end
        </h3>
        <p className="text-blue-600">Chargement...</p>
      </div>
    );
  }

  if (weekendMatches.length === 0) {
    return (
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-2 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Matchs du Week-end
        </h3>
        <p className="text-gray-600">Aucun match prévu ce week-end.</p>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 p-4 rounded-lg mb-6">
      <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5" />
        Matchs du Week-end ({weekendMatches.length})
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {weekendMatches.map((match) => {
          const locationBgColor = getLocationBgColor(match.location, match.is_home);
          const icon = getMatchIcon(match.is_home, match.is_away);
          
          return (
            <div 
              key={`${match.date}-${match.home_team}-${match.away_team}`}
              className={`p-3 rounded-lg ${locationBgColor} border border-blue-200`}
            >
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0">{icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-blue-800 text-sm truncate">
                    {match.home_team} {match.away_team ? 'vs' : ''} {match.away_team}
                  </div>
                  <div className="text-xs text-gray-600">
                    {formatDisplayDate(match.date)} {match.day}
                    {match.time && <span className="ml-2 text-yellow-600">{formatTime(match.time)}</span>}
                  </div>
                  <div className="text-xs mt-1">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {match.location}
                    </span>
                    {match.camionnette && (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded ml-1 text-xs">
                        Camionnette: {match.camionnette}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
