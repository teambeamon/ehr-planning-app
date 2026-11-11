// app/affiche/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { Match, getTeamDisplayName } from "@/lib/utils";
import { Printer, ChevronLeft, ChevronRight } from "lucide-react";

const EHR_LOCATIONS = ["Rodemack", "Hettange (Hall)", "Hettange (Poly)", "Kanfen"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Samedi de la semaine de la date donnée (un week-end regroupe sam. + dim., et les matchs en semaine qui précèdent)
function saturdayOf(dateIso: string): string {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return toIsoDate(d);
}

const formatLong = (dateIso: string) => {
  const d = new Date(dateIso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

const formatShort = (dateIso: string) => {
  const d = new Date(dateIso);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 4)}.`;
};

const gymBadge = (location: string) => {
  switch (location) {
    case "Rodemack":
      return "bg-yellow-300 text-yellow-900 border-yellow-500";
    case "Hettange (Hall)":
      return "bg-blue-700 text-white border-blue-900";
    case "Hettange (Poly)":
      return "bg-blue-200 text-blue-900 border-blue-400";
    case "Kanfen":
      return "bg-orange-400 text-white border-orange-600";
    default:
      return "bg-gray-200 text-gray-800 border-gray-400";
  }
};

export default function AffichePage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const now = new Date();
  const [selected, setSelected] = useState({ year: now.getFullYear(), month: now.getMonth() });

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

  const isHomeMatch = (m: Match) => m.is_home && !!m.location && EHR_LOCATIONS.includes(m.location) && !!m.date;

  // Si le mois courant n'a pas de match à domicile, avancer vers le premier mois qui en a
  useEffect(() => {
    if (isLoading || matches.length === 0) return;
    const monthPrefix = `${selected.year}-${String(selected.month + 1).padStart(2, "0")}`;
    const hasMatchInSelected = matches.some((m) => isHomeMatch(m) && m.date!.startsWith(monthPrefix));
    if (hasMatchInSelected) return;
    const nowPrefix = toIsoDate(new Date()).slice(0, 7);
    const upcoming = matches
      .filter((m) => isHomeMatch(m) && m.date!.slice(0, 7) >= nowPrefix)
      .map((m) => m.date!)
      .sort();
    if (upcoming.length === 0) return;
    const [y, mo] = upcoming[0].split("-");
    setSelected({ year: Number(y), month: Number(mo) - 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, isLoading]);

  const goToMonth = (delta: number) => {
    setSelected((s) => {
      const d = new Date(s.year, s.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  // Matchs à domicile du mois sélectionné, groupés par week-end puis par jour
  const weekends = useMemo(() => {
    const monthPrefix = `${selected.year}-${String(selected.month + 1).padStart(2, "0")}`;
    const byWeekend: Record<string, Match[]> = {};
    matches
      .filter((m) => isHomeMatch(m) && m.date!.startsWith(monthPrefix))
      .forEach((m) => {
        const key = saturdayOf(m.date!);
        (byWeekend[key] ||= []).push(m);
      });

    return Object.entries(byWeekend)
      .map(([saturday, list]) => {
        const byDay: Record<string, Match[]> = {};
        list.forEach((m) => {
          (byDay[m.date!] ||= []).push(m);
        });
        const days = Object.entries(byDay)
          .map(([date, dayMatches]) => ({
            date,
            matches: [...dayMatches].sort((a, b) => (a.time || "zz").localeCompare(b.time || "zz")),
          }))
          .sort((a, b) => a.date.localeCompare(b.date));
        return { saturday, days };
      })
      .sort((a, b) => a.saturday.localeCompare(b.saturday));
  }, [matches, selected]);

  const opponentOf = (m: Match) => {
    if (!m.away_team) return "À déterminer";
    const ehrNames = ["Seniors M", "Seniors F1", "Seniors F2", "M17", "F17", "M17Dep1", "M17Dep2", "F17CDF", "F17Dep", "M15", "F15", "M13", "F13", "M11", "F11"];
    return ehrNames.includes(m.away_team) ? getTeamDisplayName(m.away_team) : m.away_team;
  };

  if (isLoading) {
    return (
      <div className="container-custom animate-pulse">
        <div className="text-center py-12">
          <p className="text-blue-600 text-lg">Chargement de l'affiche...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-custom animate-fade-in">
      {/* Barre de contrôle (masquée à l'impression) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Affiche mensuelle des matchs</h1>
          <p className="page-subtitle">
            Matchs à domicile uniquement - conçue pour une impression A3 à afficher dans les gymnases
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => goToMonth(-1)}
            className="btn-outline px-4 py-2"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-bold text-blue-800 capitalize min-w-[180px] text-center">
            {MONTHS[selected.month]} {selected.year}
          </span>
          <button
            onClick={() => goToMonth(1)}
            className="btn-outline px-4 py-2"
            aria-label="Mois suivant"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="no-print mb-6 flex flex-wrap items-center gap-4">
        <button onClick={() => window.print()} className="btn-primary flex items-center gap-2">
          <Printer className="w-5 h-5" />
          Imprimer en A3
        </button>
        <p className="text-sm text-gray-500">
          Dans la fenêtre d&apos;impression : format A3, orientation Portrait, et activez
          « Graphiques d&apos;arrière-plan » pour conserver les couleurs.
        </p>
      </div>

      {/* Affiche A3 */}
      <div className="print-colors w-full max-w-[1046px] mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        {/* En-tête de l'affiche */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-700 to-yellow-400 text-white px-10 py-8 flex items-center justify-between">
          <div>
            <p className="text-yellow-300 text-lg font-semibold tracking-widest uppercase">
              Entente Hettange Rodemack
            </p>
            <h2 className="text-5xl font-extrabold leading-tight">Matchs à domicile</h2>
            <p className="text-2xl text-blue-100 capitalize">
              {MONTHS[selected.month]} {selected.year}
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block bg-white text-blue-800 text-4xl font-extrabold px-5 py-3 rounded-xl shadow-md">
              EHR
            </span>
            <p className="text-blue-100 text-lg mt-2 font-semibold tracking-wide">Handball</p>
          </div>
        </div>

        {/* Corps : un bloc par week-end */}
        <div className="px-8 py-8 space-y-8">
          {weekends.length === 0 && (
            <div className="text-center py-16">
              <p className="text-3xl font-bold text-blue-800">Pas de match à domicile ce mois-ci</p>
              <p className="text-xl text-gray-500 mt-2">Choisissez un autre mois avec les flèches ci-dessus.</p>
            </div>
          )}

          {weekends.map(({ saturday, days }) => {
            const label =
              days.length > 1
                ? `Week-end du ${formatShort(days[0].date)} au ${formatShort(days[days.length - 1].date)}`
                : formatLong(days[0].date);
            return (
              <section key={saturday} className="print-break-avoid rounded-2xl border-2 border-blue-100 shadow-md overflow-hidden">
                <div className="bg-blue-800 text-white px-8 py-4 border-b-4 border-yellow-400">
                  <h3 className="text-3xl font-bold capitalize">{label}</h3>
                </div>
                <div className={`grid ${days.length > 1 ? "md:grid-cols-2" : ""}`}>
                  {days.map((day, dayIndex) => (
                    <div
                      key={day.date}
                      className={`p-6 ${dayIndex > 0 ? "border-t md:border-t-0 md:border-l border-blue-100" : ""} ${
                        days.length > 1 && dayIndex < days.length - 1 ? "md:border-r" : ""
                      } border-blue-100`}
                    >
                      <div className="mb-5 pb-3 border-b-4 border-yellow-400">
                        <h4 className="text-2xl font-extrabold text-blue-700 capitalize">{formatLong(day.date)}</h4>
                      </div>
                      <ul className="space-y-4">
                        {day.matches.map((m, i) => (
                          <li
                            key={`${m.date}-${m.home_team}-${m.time}-${i}`}
                            className="flex items-center gap-5 rounded-xl bg-blue-50 border border-blue-100 px-5 py-4"
                          >
                            <span className="text-3xl font-extrabold text-blue-800 tabular-nums w-24 shrink-0">
                              {m.time || "à définir"}
                            </span>
                            <span className="flex-1 text-2xl leading-snug">
                              <span className="font-bold text-gray-900">{getTeamDisplayName(m.home_team)}</span>
                              <span className="text-gray-400 mx-2 font-medium">vs</span>
                              <span className="text-blue-700">{opponentOf(m)}</span>
                            </span>
                            <span
                              className={`inline-block text-lg font-bold px-4 py-1.5 rounded-lg border-2 shrink-0 ${gymBadge(m.location || "")}`}
                            >
                              {m.location}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* Pied de l'affiche */}
        <div className="bg-blue-900 text-white px-10 py-6 flex items-center justify-between">
          <p className="text-2xl font-bold text-yellow-300">Venez nombreux encourager nos équipes !</p>
          <div className="text-right text-blue-100 text-sm leading-snug">
            <p>Hettange (Hall) - Hettange (Poly) - Rodemack - Kanfen</p>
            <p>Horaires susceptibles de modification</p>
          </div>
        </div>
      </div>
    </div>
  );
}
