// app/matches/page.tsx
"use client";

import MatchTable from "@/components/MatchTable";
import WeekendMatches from "@/components/WeekendMatches";
import Link from "next/link";
import { useState, useEffect } from "react";
import { Truck } from "lucide-react";

export default function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/matches");
        const data = await response.json();
        setMatches(data);
      } catch (error) {
        console.error("Erreur :", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMatches();
  }, []);

  // Extraire les réservations de camionnettes par date
  const getCamionnetteSummary = () => {
    const byDate: Record<string, { teams: Set<string>; camionnettes: Set<string> }> = {};
    
    matches.forEach((m: any) => {
      if (m.camionnette && m.date) {
        if (!byDate[m.date]) {
          byDate[m.date] = { teams: new Set(), camionnettes: new Set() };
        }
        byDate[m.date].teams.add(m.home_team);
        byDate[m.date].camionnettes.add(m.camionnette);
      }
    });
    
    return byDate;
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

  const formatDate = (date: string) => {
    if (!date) return '-';
    const parts = date.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return date;
  };

  const getDayName = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[date.getDay()];
  };

  const camionnetteSummary = getCamionnetteSummary();
  const hasCamionnettes = Object.keys(camionnetteSummary).length > 0;

  return (
    <div className="container-custom animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="page-title">Planning des Matchs</h1>
          <p className="page-subtitle">
            Saison 2026-2027 - Entente Hettange Rodemack
          </p>
        </div>
        <Link
          href="/upload"
          className="btn-secondary"
        >
          + Uploader un Nouveau Planning
        </Link>
      </div>
      
      {/* Matchs du Week-End - Bien visibles en haut */}
      <WeekendMatches />
      
      {/* Résumé des Camionnettes - Visible sans scroll */}
      {hasCamionnettes && !isLoading && (
        <div className="card mb-8 bg-yellow-50 border-yellow-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-blue-800 flex items-center gap-2">
              <Truck className="w-6 h-6" />
              Réservations de Camionnettes
            </h2>
            <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm font-bold">
              {Object.keys(camionnetteSummary).length} date{Object.keys(camionnetteSummary).length > 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(camionnetteSummary).sort().map(([date, data]) => (
              <div key={date} className="bg-white p-4 rounded-lg border border-yellow-200">
                <h3 className="font-semibold text-blue-800 mb-3">
                  {formatDate(date)} - {getDayName(date)}
                </h3>
                <div className="space-y-2">
                  {Array.from(data.camionnettes).sort().map((camionnette) => (
                    <div key={camionnette} className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                      <span className="font-medium text-blue-700">Camionnette {camionnette}</span>
                    </div>
                  ))}
                  <p className="text-xs text-gray-600 mt-2">
                    Équipes concernées: {Array.from(data.teams).map(normalizeTeamDisplay).join(', ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Tableau complet des matchs */}
      <div className="card animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <MatchTable />
      </div>
    </div>
  );
}
