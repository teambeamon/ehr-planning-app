// app/stats/page.tsx
"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Match } from "@/lib/utils";

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

  // Calculer les statistiques
  const getTeamStats = () => {
    const teamCounts: Record<string, number> = {};
    matches.forEach((match) => {
      if (match.home_team) {
        teamCounts[match.home_team] = (teamCounts[match.home_team] || 0) + 1;
      }
    });
    return Object.entries(teamCounts)
      .map(([team, count]) => ({ team, count }))
      .sort((a, b) => b.count - a.count);
  };

  const getLocationStats = () => {
    const locationCounts: Record<string, number> = {};
    matches.forEach((match) => {
      if (match.location) {
        locationCounts[match.location] = (locationCounts[match.location] || 0) + 1;
      }
    });
    return Object.entries(locationCounts)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count);
  };

  const getCategoryStats = () => {
    const categoryCounts: Record<string, number> = {};
    matches.forEach((match) => {
      if (match.category) {
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

  const teamStats = getTeamStats();
  const locationStats = getLocationStats();
  const categoryStats = getCategoryStats();
  const monthlyStats = getMonthlyStats();

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
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={teamStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis dataKey="team" tick={{ fill: '#4f46e5', fontSize: 12 }} />
              <YAxis tick={{ fill: '#4f46e5', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e40af',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white'
                }}
              />
              <Bar dataKey="count" fill="#1e40af" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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

        {/* Matchs par Catégorie */}
        <div className="card">
          <h2 className="text-xl font-semibold text-blue-800 mb-6">
            🏆 Matchs par Catégorie
          </h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={categoryStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
              <XAxis dataKey="category" tick={{ fill: '#4f46e5', fontSize: 12 }} />
              <YAxis tick={{ fill: '#4f46e5', fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e40af',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white'
                }}
              />
              <Bar dataKey="count" fill="#fbbf24" radius={[8, 8, 0, 0]} />
            </BarChart>
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
      </div>
    </div>
  );
}
