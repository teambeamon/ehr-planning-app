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
    { accessorKey: "date", header: "Date" },
    { accessorKey: "day", header: "Jour" },
    { accessorKey: "home_team", header: "Équipe à domicile" },
    { accessorKey: "away_team", header: "Équipe à l'extérieur" },
    { accessorKey: "time", header: "Heure" },
    { accessorKey: "location", header: "Lieu" },
    { accessorKey: "match_type", header: "Type de match" },
    { accessorKey: "category", header: "Catégorie" },
    { accessorKey: "season", header: "Saison" },
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
    onColumnFiltersChange: (filters) => {
      const newFilters = {
        team: filters.find((f) => f.id === "home_team" || f.id === "away_team")?.value || "",
        location: filters.find((f) => f.id === "location")?.value || "",
        category: filters.find((f) => f.id === "category")?.value || "",
        season: filters.find((f) => f.id === "season")?.value || "",
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
    return <div className="p-4">Chargement des matchs...</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Planning des Matchs</h1>
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex items-center gap-2">
          <label htmlFor="team" className="text-sm font-medium">Équipe</label>
          <select 
            id="team" 
            value={filters.team} 
            onChange={(e) => setFilters({ ...filters, team: e.target.value })} 
            className="border rounded p-2"
          >
            <option value="">Toutes les équipes</option>
            {teams.map((team) => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="location" className="text-sm font-medium">Lieu</label>
          <select 
            id="location" 
            value={filters.location} 
            onChange={(e) => setFilters({ ...filters, location: e.target.value })} 
            className="border rounded p-2"
          >
            <option value="">Tous les lieux</option>
            {locations.map((location) => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="category" className="text-sm font-medium">Catégorie</label>
          <select 
            id="category" 
            value={filters.category} 
            onChange={(e) => setFilters({ ...filters, category: e.target.value })} 
            className="border rounded p-2"
          >
            <option value="">Toutes les catégories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="season" className="text-sm font-medium">Saison</label>
          <select 
            id="season" 
            value={filters.season} 
            onChange={(e) => setFilters({ ...filters, season: e.target.value })} 
            className="border rounded p-2"
          >
            <option value="">Toutes les saisons</option>
            {seasons.map((season) => (
              <option key={season} value={season}>{season}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="p-3 text-left">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="p-3">
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
