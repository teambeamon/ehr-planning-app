// components/MatchTable.tsx
"use client";

import { useState, useEffect } from "react";
import { useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, ColumnDef, flexRender } from "@tanstack/react-table";

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

// Fonction pour obtenir la couleur du badge de type
const getMatchTypeColor = (type: string | null) => {
  switch (type?.toLowerCase()) {
    case 'amical':
      return 'bg-yellow-100 text-yellow-800';
    case 'tournoi':
      return 'bg-blue-100 text-blue-800';
    case 'coupe':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-green-100 text-green-800';
  }
};

// Fonction pour obtenir la couleur du badge de catégorie
const getCategoryColor = (category: string | null) => {
  if (!category) return 'bg-gray-100 text-gray-800';
  
  if (category.includes('Seniors')) {
    return 'bg-blue-600 text-white';
  } else if (category.includes('U17')) {
    return 'bg-blue-500 text-white';
  } else if (category.includes('U15')) {
    return 'bg-blue-400 text-white';
  } else if (category.includes('U13')) {
    return 'bg-blue-300 text-blue-800';
  } else if (category.includes('U11') || category.includes('U9')) {
    return 'bg-yellow-400 text-yellow-900';
  }
  return 'bg-gray-100 text-gray-800';
};

export default function MatchTable() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [teams, setTeams] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    team: "",
    location: "",
    category: "",
    season: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [matchesRes, teamsRes, locationsRes, categoriesRes, seasonsRes] = await Promise.all([
          fetch("/api/matches"),
          fetch("/api/teams"),
          fetch("/api/locations"),
          fetch("/api/categories"),
          fetch("/api/seasons"),
        ]);

        const matchesData = await matchesRes.json();
        const teamsData = await teamsRes.json();
        const locationsData = await locationsRes.json();
        const categoriesData = await categoriesRes.json();
        const seasonsData = await seasonsRes.json();

        setMatches(matchesData);
        setTeams(teamsData);
        setLocations(locationsData);
        setCategories(categoriesData);
        setSeasons(seasonsData);
      } catch (error) {
        console.error("Erreur lors de la récupération des données :", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const columns: ColumnDef<Match>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        return value ? <span className="font-medium text-blue-700">{value}</span> : '-';
      }
    },
    {
      accessorKey: "day",
      header: "Jour",
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        return value ? <span className="text-gray-600">{value}</span> : '-';
      }
    },
    {
      accessorKey: "home_team",
      header: "Équipe à domicile",
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        return value ? <span className="font-semibold text-blue-800">{value}</span> : '-';
      }
    },
    {
      accessorKey: "away_team",
      header: "Équipe à l'extérieur",
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        return value ? <span className="text-gray-700">{value}</span> : '-';
      }
    },
    {
      accessorKey: "time",
      header: "Heure",
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        return value ? <span className="text-yellow-600 font-medium">{value}</span> : '-';
      }
    },
    {
      accessorKey: "location",
      header: "Lieu",
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        return value ? <span className="badge badge-blue">{value}</span> : '-';
      }
    },
    {
      accessorKey: "match_type",
      header: "Type",
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        return value ? <span className={`badge ${getMatchTypeColor(value)}`}>{value}</span> : '-';
      }
    },
    {
      accessorKey: "category",
      header: "Catégorie",
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        return value ? <span className={`badge ${getCategoryColor(value)}`}>{value}</span> : '-';
      }
    },
  ];

  const table = useReactTable({
    data: matches,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      columnFilters: [
        { id: "home_team", value: filters.team },
        { id: "away_team", value: filters.team },
        { id: "location", value: filters.location },
        { id: "category", value: filters.category },
        { id: "season", value: filters.season },
      ],
    },
    onColumnFiltersChange: (updaterOrValue: any) => {
      const currentFilters: any[] = typeof updaterOrValue === 'function' 
        ? updaterOrValue(table.getState().columnFilters) 
        : updaterOrValue;
      
      const newFilters = {
        team: currentFilters.find((f: any) => f.id === "home_team" || f.id === "away_team")?.value || "",
        location: currentFilters.find((f: any) => f.id === "location")?.value || "",
        category: currentFilters.find((f: any) => f.id === "category")?.value || "",
        season: currentFilters.find((f: any) => f.id === "season")?.value || "",
      };
      setFilters(newFilters);
    },
  });

  useEffect(() => {
    const fetchFilteredMatches = async () => {
      setIsLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (filters.team) queryParams.append("team", filters.team);
        if (filters.location) queryParams.append("location", filters.location);
        if (filters.category) queryParams.append("category", filters.category);
        if (filters.season) queryParams.append("season", filters.season);

        const response = await fetch(`/api/matches?${queryParams.toString()}`);
        const data = await response.json();
        setMatches(data);
      } catch (error) {
        console.error("Erreur lors du filtrage des matchs :", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFilteredMatches();
  }, [filters]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-blue-500 rounded-full mx-auto mb-4 animate-pulse"></div>
        <p className="text-blue-600 text-lg">Chargement des matchs...</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-yellow-100 rounded-full mx-auto mb-4 flex items-center justify-center">
          <span className="text-2xl">⚠️</span>
        </div>
        <h3 className="text-xl font-semibold text-blue-800 mb-2">Aucun match trouvé</h3>
        <p className="text-gray-600">
          Essayez de modifier vos filtres ou upload un fichier Excel.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <div className="card">
        <h3 className="text-lg font-semibold text-blue-800 mb-4">🔍 Filtres</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="form-label">Équipe</label>
            <select 
              value={filters.team} 
              onChange={(e) => setFilters({ ...filters, team: e.target.value })}
              className="form-input"
            >
              <option value="">Toutes les équipes</option>
              {teams.map((team) => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Lieu</label>
            <select 
              value={filters.location} 
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              className="form-input"
            >
              <option value="">Tous les lieux</option>
              {locations.map((location) => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Catégorie</label>
            <select 
              value={filters.category} 
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="form-input"
            >
              <option value="">Toutes les catégories</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Saison</label>
            <select 
              value={filters.season} 
              onChange={(e) => setFilters({ ...filters, season: e.target.value })}
              className="form-input"
            >
              <option value="">Toutes les saisons</option>
              {seasons.map((season) => (
                <option key={season} value={season}>{season}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-500">
          {matches.length} matchs trouvés
        </div>
      </div>

      {/* Tableau */}
      <div className="table-container card">
        <table className="w-full">
          <thead className="table-header">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="p-4 text-left font-semibold text-sm">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-blue-100">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="p-4">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
