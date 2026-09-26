// app/stats/page.tsx
"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

type Match = {
  date: string | null;
  day: string | null;
  home_team: string | null;
  away_team: string | null;
  time: string | null;
  location: string | null;
  match_type: string | null;
  category: string | null;
  season: string | null;
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#A4DE6C', '#D0ED57', '#FF6B6B'];

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
      if (match.away_team) {
        teamCounts[match.away_team] = (teamCounts[match.away_team] || 0) + 1;
      }
    });
    return Object.entries(teamCounts).map(([team, count]) => ({ team, count }));
  };

  const getLocationStats = () => {
    const locationCounts: Record<string, number> = {};
    matches.forEach((match) => {
      if (match.location) {
        locationCounts[match.location] = (locationCounts[match.location] || 0) + 1;
      }
    });
    return Object.entries(locationCounts).map(([location, count]) => ({ location, count }));
  };

  const getCategoryStats = () => {
    const categoryCounts: Record<string, number> = {};
    matches.forEach((match) => {
      if (match.category) {
        categoryCounts[match.category] = (categoryCounts[match.category] || 0) + 1;
      }
    });
    return Object.entries(categoryCounts).map(([category, count]) => ({ category, count }));
  };

  const getMonthlyStats = () => {
    const monthlyCounts: Record<string, number> = {};
    matches.forEach((match) => {
      if (match.date) {
        const month = new Date(match.date).toLocaleString('default', { month: 'long' });
        monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
      }
    });
    return Object.entries(monthlyCounts).map(([month, count]) => ({ month, count }));
  };

  const teamStats = getTeamStats();
  const locationStats = getLocationStats();
  const categoryStats = getCategoryStats();
  const monthlyStats = getMonthlyStats();

  if (isLoading) {
    return <div className="container mx-auto py-4">Chargement des statistiques...</div>;
  }

  return (
    <div className="container mx-auto py-4 space-y-8">
      <h1 className="text-2xl font-bold">Statistiques des Matchs</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Matchs par Équipe</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={teamStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="team" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Matchs par Lieu</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={locationStats}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
                nameKey="location"
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {locationStats.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Matchs par Catégorie</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4">Matchs par Mois</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" fill="#ffc658" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4">Résumé</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium">Total des matchs</h3>
            <p className="text-3xl font-bold">{matches.length}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium">Équipes</h3>
            <p className="text-3xl font-bold">{teamStats.length}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium">Lieux</h3>
            <p className="text-3xl font-bold">{locationStats.length}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium">Catégories</h3>
            <p className="text-3xl font-bold">{categoryStats.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
