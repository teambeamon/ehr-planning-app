// app/stats/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Match, getTeamDisplayName } from "@/lib/utils";
import { Truck } from "lucide-react";

// Couleurs EHR : Bleu et Jaune
const COLORS = ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#fbbf24', '#facc15', '#f59e0b', '#d97706'];

export default function StatsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/matches");
        const data = await response.json();
        setMatches(data);
      } catch (error) {
        console.error("Erreur lors de la récupération des matchs :", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMatches();
  }, []);

  // Formater une date ISO (YYYY-MM-DD) en jj/mm/aaaa
  const formatDate = (date: string | null) => {
    if (!date) return "-";
    const parts = date.split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;
  };

  // Calculer les statistiques
  // Liste des équipes EHR (noms normalisés en base)
  const ehrTeams = new Set([
    'Seniors M', 'Seniors F1', 'Seniors F2',
    'M17Dep1', 'M17Dep2', 'F17CDF', 'F17Dep', 'M15', 'F15',
    'M13', 'F13', 'M11', 'F11'
  ]);

  const getTeamStats = () => {
    const teamCounts: Record<string, number> = {};
    // Initialiser avec toutes les équipes EHR (0 match si absente des données)
    Array.from(ehrTeams).forEach((t) => {
      const name = getTeamDisplayName(t);
      teamCounts[name] = 0;
    });
    matches.forEach((match) => {
      // Ne compter que les équipes EHR (home_team ou away_team)
      if (match.home_team && ehrTeams.has(match.home_team)) {
        const name = getTeamDisplayName(match.home_team);
        teamCounts[name] = (teamCounts[name] || 0) + 1;
      }
      if (match.away_team && ehrTeams.has(match.away_team) && match.is_away) {
        const name = getTeamDisplayName(match.away_team);
        teamCounts[name] = (teamCounts[name] || 0) + 1;
      }
    });
    return Object.entries(teamCounts)
      .map(([team, count]) => ({ team, count }))
      .sort((a, b) => b.count - a.count || a.team.localeCompare(b.team));
  };

  const getLocationStats = () => {
    const locationCounts: Record<string, number> = {};
    matches.forEach((match) => {
      if (match.location) {
        // Ne compter que les salles EHR (Hall, Poly, Rodemack, Kanfen)
        const locationLower = match.location.toLowerCase();
        const isEHRLocation = locationLower.includes('hettange (hall)') || 
                              locationLower.includes('hettange (poly)') || 
                              locationLower === 'rodemack' || 
                              locationLower === 'kanfen';
        if (isEHRLocation) {
          locationCounts[match.location] = (locationCounts[match.location] || 0) + 1;
        }
      }
    });
    return Object.entries(locationCounts)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count);
  };

  const getCategoryStats = () => {
    const categoryCounts: Record<string, number> = {};
    matches.forEach((match) => {
      // Ne compter que les catégories des équipes EHR
      if (match.category && (ehrTeams.has(match.home_team || '') || ehrTeams.has(match.away_team || ''))) {
        categoryCounts[match.category] = (categoryCounts[match.category] || 0) + 1;
      }
    });
    return Object.entries(categoryCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  };

  const getMonthlyStats = () => {
    const monthlyCounts: Record<string, number> = {};
    matches.forEach((match) => {
      if (match.date) {
        const date = new Date(match.date);
        const month = date.toLocaleString('fr-FR', { month: 'long' });
        monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
      }
    });
    return Object.entries(monthlyCounts)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => {
        const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
        return months.indexOf(a.month.toLowerCase()) - months.indexOf(b.month.toLowerCase());
      });
  };

  // Stats des camionnettes par équipe : nombre d'utilisations et dernière utilisation
  // Une réservation (équipe + date) compte pour une seule utilisation
  const getCamionnetteStats = () => {
    const stats: Record<string, { count: number; lastUsed: string | null }> = {};
    const counted = new Set<string>();

    matches.forEach((match) => {
      if (!match.camionnette || !match.is_home || !match.date) return;
      const key = `${match.date}|${match.camionnette}`;
      if (counted.has(key)) return;
      counted.add(key);
      const name = getTeamDisplayName(match.camionnette);
      const entry = stats[name] || (stats[name] = { count: 0, lastUsed: null });
      entry.count += 1;
      if (!entry.lastUsed || match.date > entry.lastUsed) {
        entry.lastUsed = match.date;
      }
    });

    return Object.entries(stats)
      .map(([team, s]) => ({ team, count: s.count, lastUsed: s.lastUsed }))
      .sort((a, b) => b.count - a.count || a.team.localeCompare(b.team));
  };

  // Memoize all stats calculations
  const teamStats = useMemo(() => getTeamStats(), [matches]);
  const locationStats = useMemo(() => getLocationStats(), [matches]);
  const categoryStats = useMemo(() => getCategoryStats(), [matches]);
  const monthlyStats = useMemo(() => getMonthlyStats(), [matches]);
  const camionnetteStats = useMemo(() => getCamionnetteStats(), [matches]);

  if (isLoading) {
    return (
      <div className="container-custom animate-pulse">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-blue-500 rounded-full mx-auto mb-4 animate-pulse"></div>
          <p className="text-blue-600 text-lg">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-custom animate-fade-in">
      <div className="mb-8">
        <h1 className="page-title">Statistiques des Matchs</h1>
        <p className="page-subtitle">
          Saison 2026-2027 - Entente Hettange Rodemack
        </p>
      </div>

      {/* Résumé en haut */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-blue-600 uppercase tracking-wider">Total des matchs</h3>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-xl text-blue-600">📊</span>
            </div>
          </div>
          <p className="text-4xl font-bold text-blue-800">{matches.length}</p>
        </div>
        
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-blue-600 uppercase tracking-wider">Équipes</h3>
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <span className="text-xl text-yellow-600">👥</span>
            </div>
          </div>
          <p className="text-4xl font-bold text-blue-800">{teamStats.length}</p>
        </div>
        
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-blue-600 uppercase tracking-wider">Lieux</h3>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-xl text-blue-600">📍</span>
            </div>
          </div>
          <p className="text-4xl font-bold text-blue-800">{locationStats.length}</p>
        </div>
        
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-blue-600 uppercase tracking-wider">Catégories</h3>
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <span className="text-xl text-yellow-600">🏆</span>
            </div>
          </div>
          <p className="text-4xl font-bold text-blue-800">{categoryStats.length}</p>
        </div>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {/* Matchs par Équipe */}
        <div className="card">
          <h2 className="text-xl font-semibold text-blue-800 mb-6">
            📊 Matchs par Équipe
          </h2>
          <ul className="space-y-2">
            {teamStats.map(({ team, count }) => {
              const maxCount = teamStats[0]?.count || 1;
              return (
                <li key={team} className="flex items-center gap-3">
                  <span className="flex-1 text-sm font-medium text-gray-700">{team}</span>
                  <div className="hidden sm:block w-32 h-4 bg-blue-100 rounded-full overflow-hidden" aria-hidden="true">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-sm font-bold text-blue-800">{count}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Matchs par Lieu */}
        <div className="card">
          <h2 className="text-xl font-semibold text-blue-800 mb-6">
            📍 Matchs par Lieu
          </h2>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={locationStats}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                dataKey="count"
                nameKey="location"
                label={({ name, percent }) => 
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
              >
                {locationStats.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e40af',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white'
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Matchs par Mois */}
        <div className="card">
          <h2 className="text-xl font-semibold text-blue-800 mb-6">
            📅 Matchs par Mois
          </h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={monthlyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis dataKey="month" tick={{ fill: '#4f46e5', fontSize: 12 }} />
              <YAxis tick={{ fill: '#4f46e5', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e40af',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white'
                }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Camionnettes par Équipe */}
        <div className="card">
          <h2 className="text-xl font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <Truck className="w-6 h-6" />
            Camionnettes par Équipe
          </h2>
          {camionnetteStats.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune réservation de camionnette.</p>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-4">
                {camionnetteStats.reduce((total, s) => total + s.count, 0)} utilisation(s) au total — dernière :{" "}
                {formatDate(
                  camionnetteStats.reduce<string | null>(
                    (latest, s) => (!s.lastUsed || (latest && s.lastUsed <= latest) ? latest : s.lastUsed),
                    null
                  )
                )}
              </p>
              <ul className="space-y-2">
                {camionnetteStats.map(({ team, count, lastUsed }) => (
                  <li key={team} className="flex items-center gap-3">
                    <span className="flex-1 text-sm font-medium text-gray-700">{team}</span>
                    <span className="text-sm text-gray-500">
                      Dernière : {formatDate(lastUsed)}
                    </span>
                    <span className="w-12 text-right text-sm font-bold text-blue-800">{count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
