// components/CamionnetteReservations.tsx
"use client";

import { useState, useEffect } from "react";
import { Truck, Calendar } from "lucide-react";

// Type pour les réservations de camionnettes
interface CamionnetteReservation {
  team: string;
  camionnette: string;
  column?: number;
  note?: string;
}

interface CamionnetteReservationsByDate {
  [date: string]: CamionnetteReservation[];
}

// Formater la date pour affichage
const formatDisplayDate = (date: string) => {
  if (!date) return '-';
  const parts = date.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return date;
};

// Obtenir le nom du jour
const getDayName = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  return days[date.getDay()];
};

// Normaliser les noms d'équipes pour affichage
const normalizeTeamDisplay = (team: string) => {
  const mapping: Record<string, string> = {
    'Seniors M': 'Seniors Masculins',
    'Seniors F1': 'Seniors Filles 1',
    'Seniors F2': 'Seniors Filles 2',
    'M17 departementale': '17 ans Garçons Départemental',
    'M17 region': '17 ans Garçons Régional',
    'F17 CDF': '17 ans Filles Championnat de France',
    'F17 departementale': '17 ans Filles Départemental',
    'M15 region': '15 ans Garçons Régional',
    'M15 departementale': '15 ans Garçons Départemental',
    'F15 region': '15 ans Filles Régional',
    'F15 departementale': '15 ans Filles Départemental',
    'M13 region': '13 ans Garçons Régional',
    'M13 departementale': '13 ans Garçons Départemental',
    'F13 departementale': '13 ans Filles Départemental',
    'M11 interdepartementale': '11 ans Garçons Interdépartemental',
    'F11 departementale': '11 ans Filles Départemental',
  };
  return mapping[team] || team;
};

export default function CamionnetteReservations() {
  const [reservations, setReservations] = useState<CamionnetteReservationsByDate>({});
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchReservations = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/camionnettes");
        const data = await response.json();
        setReservations(data);
      } catch (error) {
        console.error("Erreur lors de la récupération des réservations :", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservations();
  }, []);

  // Trier les dates par ordre chronologique
  const sortedDates = Object.keys(reservations).sort();

  // Basculer l'affichage d'une date
  const toggleDate = (date: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="card p-4 animate-pulse">
        <p className="text-gray-600">Chargement des réservations de camionnettes...</p>
      </div>
    );
  }

  if (sortedDates.length === 0) {
    return (
      <div className="card bg-blue-50 p-4 text-center">
        <p className="text-gray-600">Aucune réservation de camionnette enregistrée.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-4 pb-4 border-b-2 border-blue-200">
        <h2 className="text-xl font-bold text-blue-800 flex items-center gap-2">
          <Truck className="w-6 h-6" />
          Réservations de Camionnettes
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {sortedDates.length} date{sortedDates.length > 1 ? 's' : ''} avec réservations
        </p>
      </div>

      <div className="space-y-4">
        {sortedDates.map((date) => {
          const dateReservations = reservations[date];
          const isExpanded = expandedDates.has(date);
          const reservationCount = dateReservations.length;
          
          // Regrouper les réservations par camionnette pour cette date
          const reservationsByCamionnette: Record<string, string[]> = {};
          dateReservations.forEach((res) => {
            const camionnetteKey = res.camionnette || 'Non spécifiée';
            if (!reservationsByCamionnette[camionnetteKey]) {
              reservationsByCamionnette[camionnetteKey] = [];
            }
            reservationsByCamionnette[camionnetteKey].push(res.team);
          });
          
          return (
            <div key={date} className="border border-blue-100 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleDate(date)}
                className="w-full p-4 text-left flex items-center justify-between hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-semibold text-blue-800">
                      {formatDisplayDate(date)} - {getDayName(date)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {reservationCount} réservation{reservationCount > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <span className="text-2xl text-blue-400 transform transition-transform">
                  {isExpanded ? '−' : '+'}
                </span>
              </button>

              {isExpanded && (
                <div className="p-4 bg-blue-50/50">
                  {Object.entries(reservationsByCamionnette).map(([camionnette, teams]) => (
                    <div key={camionnette} className="mb-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <Truck className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-blue-800 mb-1">
                            Camionnette: <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">{camionnette}</span>
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            Équipes: {teams.length}
                          </p>
                          <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                            {teams.map((team, idx) => (
                              <li key={idx}>{normalizeTeamDisplay(team)}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Résumé global */}
      <div className="mt-6 pt-4 border-t border-blue-100 text-sm text-gray-600">
        <p>
          <strong>Total:</strong> {Object.values(reservations).reduce((sum, dateRes) => sum + dateRes.length, 0)} 
          réservation{Object.values(reservations).reduce((sum, dateRes) => sum + dateRes.length, 0) > 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}
