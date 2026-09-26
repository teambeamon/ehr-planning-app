// components/WeekendMatches.tsx
"use client";

import { useState, useEffect } from "react";
import { Match } from "@/lib/utils";
import { Home, Plane, Calendar, Clock } from "lucide-react";

// Fonction pour obtenir la couleur du lieu
const getLocationColor = (location: string | null) => {
  if (!location || location === 'Extérieur') return '';
  
  const locationLower = location.toLowerCase();
  
  if (locationLower.includes('kanfen')) {
    return 'bg-orange-100 text-orange-800';
  } else if (locationLower.includes('rodemack')) {
    return 'bg-yellow-100 text-yellow-800';
  } else if (locationLower.includes('hettange') && locationLower.includes('poly')) {
    return 'bg-green-100 text-green-800';
  } else if (locationLower.includes('hettange') && locationLower.includes('hall')) {
    return 'bg-blue-100 text-blue-800';
  }
  
  return '';
};

// Fonction pour obtenir l'icône du match
const getMatchIcon = (isHome: boolean | undefined, isAway: boolean | undefined) => {
  if (isHome && !isAway) {
    return <Home className="w-4 h-4 text-blue-600" />;
  } else if (isAway && !isHome) {
    return <Plane className="w-4 h-4 text-yellow-600" />;
  }
  return <Calendar className="w-4 h-4 text-gray-600" />;
};

// Formatage de la date pour affichage
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
  if (!time) return '-';
  // Remplacer h par : pour un format standard
  return time.replace(/h/g, ':').replace(/H/g, ':');
};

// Composant pour afficher un match du week-end
const WeekendMatchItem = ({ match }: { match: Match }) => {
  const locationColor = getLocationColor(match.location);
  const icon = getMatchIcon(match.is_home, match.is_away);
  
  return (
    <div className={`p-3 rounded-lg mb-3 border-2 ${match.is_home ? 'border-blue-300 bg-blue-50/50' : 'border-yellow-300 bg-yellow-50/50'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-blue-700">
          {formatDisplayDate(match.date)} - {match.day}
        </span>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
          {formatTime(match.time)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium text-gray-800">
          {match.home_team} vs {match.away_team}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className={`text-xs px-2 py-1 rounded-full ${locationColor || 'bg-gray-100 text-gray-600'}`}>
          {match.location || 'Extérieur'}
        </span>
        {match.category && (
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
            {match.category}
          </span>
        )}
      </div>
    </div>
  );
};

export default function WeekendMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [weekendDates, setWeekendDates] = useState<{saturday: string; sunday: string}>({saturday: '', sunday: ''});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Récupérer tous les matchs
        const matchesRes = await fetch("/api/matches");
        const allMatches = await matchesRes.json();
        
        // Calculer les dates du week-end
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
        
        setWeekendDates({saturday: saturdayStr, sunday: sundayStr});
        
        // Filtrer les matchs du week-end
        const weekendMatches = allMatches.filter((match: Match) => 
          match.date === saturdayStr || match.date === sundayStr
        );
        
        setMatches(weekendMatches);
      } catch (error) {
        console.error("Erreur lors de la récupération des matchs du week-end :", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-yellow-50 border border-blue-200 rounded-xl p-6 mb-6">
        <h2 className="text-xl font-bold text-blue-800 mb-4">
          📅 Matchs du Week-End
        </h2>
        <p className="text-blue-600">Chargement...</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-yellow-50 border border-blue-200 rounded-xl p-6 mb-6">
        <h2 className="text-xl font-bold text-blue-800 mb-4">
          📅 Matchs du Week-End
        </h2>
        <p className="text-gray-600 text-center py-4">
          Aucun match prévu pour ce week-end ({weekendDates.saturday} - {weekendDates.sunday})
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-yellow-50 border-2 border-blue-300 rounded-xl p-6 mb-6 shadow-lg">
      <h2 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-2">
        <Calendar className="w-6 h-6" />
        Matchs du Week-End ({formatDisplayDate(weekendDates.saturday)} - {formatDisplayDate(weekendDates.sunday)})
      </h2>
      <p className="text-sm text-blue-600 mb-4">
        {matches.length} match{matches.length > 1 ? 's' : ''} prévu{matches.length > 1 ? 's' : ''}
      </p>
      <div className="space-y-2">
        {matches.map((match) => (
          <WeekendMatchItem key={`${match.date}-${match.home_team}-${match.away_team}`} match={match} />
        ))}
      </div>
    </div>
  );
}
