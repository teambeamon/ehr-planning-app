// components/MatchTableNew.tsx
"use client";

import { useState, useEffect } from "react";
import { useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, ColumnDef, flexRender } from "@tanstack/react-table";
import { Home, Plane, Calendar, Clock, Users, Trophy, Bus } from "lucide-react";
import { Match } from "@/lib/utils";

// Fonction pour obtenir la couleur du lieu (pour les badges)
const getLocationColor = (location: string | null, isHome: boolean | undefined) => {
  if (!location) return 'bg-gray-100 text-gray-800';
  
  const locationLower = location.toLowerCase();
  
  // Salles EHR uniquement
  if (locationLower.includes('kanfen')) {
    return 'bg-orange-100 text-orange-800';
  } else if (locationLower.includes('rodemack')) {
    return 'bg-yellow-100 text-yellow-800';
  } else if (locationLower.includes('hettange') && locationLower.includes('poly')) {
    return 'bg-green-100 text-green-800';
  } else if (locationLower.includes('hettange') && locationLower.includes('hall')) {
    return 'bg-blue-100 text-blue-800';
  }
  
  // Pour les autres lieux (non-EHR), pas de couleur
  return '';
};

// Fonction pour obtenir la couleur de fond de la ligne (uniquement pour les matchs à domicile)
const getLocationRowColor = (location: string | null) => {
  if (!location) return '';
  
  const locationLower = location.toLowerCase();
  
  // Salles EHR uniquement
  if (locationLower.includes('kanfen')) {
    return 'bg-orange-50';
  } else if (locationLower.includes('rodemack')) {
    return 'bg-yellow-50';
  } else if (locationLower.includes('hettange') && locationLower.includes('poly')) {
    return 'bg-green-50';
  } else if (locationLower.includes('hettange') && locationLower.includes('hall')) {
    return 'bg-blue-50';
  }
  
  return '';
};

// Fonction pour obtenir l'icône du match
const getMatchIcon = (isHome: boolean | undefined, isAway: boolean | undefined) => {
  if (isHome && !isAway) {
    return <Home className="w-4 h-4 text-blue-600" />;
  } else if (isAway && !isHome) {
    return <Plane className="w-4 h-4 text-yellow-600" />;
  } else if (isHome && isAway) {
    return <Users className="w-4 h-4 text-green-600" />;
  }
  return <Trophy className="w-4 h-4 text-gray-600" />;
};

// Fonction pour obtenir la couleur du badge de type
const getMatchTypeColor = (type: string | null) => {
  if (!type) return 'bg-gray-100 text-gray-800';
  
  switch (type.toLowerCase()) {
    case 'amical':
      return 'bg-yellow-100 text-yellow-800';
    case 'tournoi':
      return 'bg-purple-100 text-purple-800';
    case 'coupe':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-green-100 text-green-800';
  }
};

// Fonction pour obtenir la couleur du badge de catégorie
const getCategoryColor = (category: string | null) => {
  if (!category) return 'bg-gray-100 text-gray-800';
  
  const catLower = category.toLowerCase();
  
  if (catLower.includes('seniors')) {
    return 'bg-blue-600 text-white';
  } else if (catLower.includes('u17') || catLower.includes('-17')) {
    return 'bg-blue-500 text-white';
  } else if (catLower.includes('u15') || catLower.includes('-15')) {
    return 'bg-blue-400 text-blue-900';
  } else if (catLower.includes('u13') || catLower.includes('-13')) {
    return 'bg-blue-300 text-blue-800';
  } else if (catLower.includes('u11') || catLower.includes('u9') || catLower.includes('-11') || catLower.includes('-9')) {
    return 'bg-yellow-400 text-yellow-900';
  }
  
  return 'bg-gray-100 text-gray-800';
};

// Formatage de la date pour affichage
const formatDisplayDate = (date: string | null) => {
  if (!date) return '-';
  // Convertir YYYY-MM-DD en DD/MM/YYYY
  const parts = date.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return date;
};

// Composant Badge réutilisable
const Badge = ({ text, color }: { text: string; color: string }) => (
  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${color}`}>
    {text}
  </span>
);

// Composant IconBadge pour domicile/extérieur
const LocationBadge = ({ location, isHome, isAway }: { location: string | null; isHome?: boolean; isAway?: boolean }) => {
  const color = getLocationColor(location, isHome);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      {getMatchIcon(isHome, isAway)}
      {location || 'N/A'}
    </span>
  );
};

export default function MatchTableNew() {
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
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [matchesRes, teamsRes, locationsRes, categoriesRes, seasonsRes, statsRes] = await Promise.all([
          fetch("/api/matches"),
          fetch("/api/teams"),
          fetch("/api/locations"),
          fetch("/api/categories"),
          fetch("/api/seasons"),
          fetch("/api/stats"),
        ]);

        const matchesData = await matchesRes.json();
        const teamsData = await teamsRes.json();
        const locationsData = await locationsRes.json();
        const categoriesData = await categoriesRes.json();
        const seasonsData = await seasonsRes.json();
        const statsData = await statsRes.json();

        setMatches(matchesData);
        setTeams(teamsData);
        setLocations(locationsData);
        setCategories(categoriesData);
        setSeasons(seasonsData);
        setLastUpdated(statsData?.lastUpdated || null);
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
      header: () => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Date
        </div>
      ),
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        return value ? <span className="font-medium text-blue-700">{formatDisplayDate(value)}</span> : '-';
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
      accessorKey: "match_display",
      header: () => (
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          Match
        </div>
      ),
      cell: ({ row }) => {
        const matchDisplay = row.getValue('match_display') as string | null;
        const isHome = row.getValue('is_home') as boolean | undefined;
        const isAway = row.getValue('is_away') as boolean | undefined;
        const location = row.getValue('location') as string | null;
        
        if (!matchDisplay) return '-';
        
        // Déterminer la couleur du badge selon le lieu (uniquement pour les matchs à domicile)
        // Pour les matchs à l'extérieur, pas de couleur de fond (blanc)
        const locationColor = isHome ? getLocationColor(location, isHome) : '';
        const icon = getMatchIcon(isHome, isAway);
        
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${locationColor}`}>
            {icon}
            {matchDisplay}
          </span>
        );
      }
    },
    {
      accessorKey: "time",
      header: () => (
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Heure
        </div>
      ),
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        return value ? <span className="text-yellow-600 font-medium">{value}</span> : '-';
      }
    },
    {
      accessorKey: "location",
      header: () => (
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          Lieu
        </div>
      ),
      cell: ({ row }) => {
        const location = row.getValue('location') as string | null;
        const isHome = row.getValue('is_home') as boolean | undefined;
        const isAway = row.getValue('is_away') as boolean | undefined;
        return <LocationBadge location={location} isHome={isHome} isAway={isAway} />;
      }
    },
    {
      accessorKey: "match_type",
      header: "Type",
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        return value ? <Badge text={value} color={getMatchTypeColor(value)} /> : '-';
      }
    },
    {
      accessorKey: "category",
      header: "Catégorie",
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        return value ? <Badge text={value} color={getCategoryColor(value)} /> : '-';
      }
    },
    {
      accessorKey: "camionnette",
      header: () => (
        <div className="flex items-center gap-2">
          <Bus className="w-4 h-4" />
          Camionnette
        </div>
      ),
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        return value ? (
          <span className="text-xs text-green-700 font-medium">{value}</span>
        ) : '-';
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
        <div className="w-16 h-16 bg-blue-500 rounded-full mx-auto mb-4 animate-pulse flex items-center justify-center">
          <span className="text-2xl text-white">⏳</span>
        </div>
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
      {/* En-tête avec date de dernière mise à jour */}
      <div className="card">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-semibold text-blue-800">🔍 Filtres</h3>
          {lastUpdated && (
            <div className="text-sm text-gray-500 bg-blue-50 p-2 rounded">
              <Calendar className="w-4 h-4 inline mr-1" />
              Dernière mise à jour: {formatDisplayDate(lastUpdated)}
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Équipe</label>
            <select 
              value={filters.team} 
              onChange={(e) => setFilters({ ...filters, team: e.target.value })}
              className="w-full p-2 border border-blue-200 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Toutes les équipes</option>
              {teams.map((team) => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lieu</label>
            <select 
              value={filters.location} 
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              className="w-full p-2 border border-blue-200 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tous les lieux</option>
              {locations.map((location) => (
                <option key={location} value={location}>{location}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
            <select 
              value={filters.category} 
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full p-2 border border-blue-200 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Toutes les catégories</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Saison</label>
            <select 
              value={filters.season} 
              onChange={(e) => setFilters({ ...filters, season: e.target.value })}
              className="w-full p-2 border border-blue-200 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Toutes les saisons</option>
              {seasons.map((season) => (
                <option key={season} value={season}>{season}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="mt-4 text-sm text-gray-500 bg-blue-50 p-2 rounded">
          {matches.length} matchs trouvés
        </div>
      </div>

      {/* Tableau */}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead className="bg-blue-600 text-white">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="p-3 text-left font-semibold text-sm whitespace-nowrap">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const isHome = row.getValue('is_home') as boolean | undefined;
              const location = row.getValue('location') as string | null;
              const locationColor = isHome ? getLocationRowColor(location) : '';
              
              return (
                <tr 
                  key={row.id} 
                  className={`border-t border-blue-100 hover:bg-blue-50 transition-colors ${locationColor}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="p-3 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
