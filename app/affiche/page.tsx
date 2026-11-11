// app/affiche/page.tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Match, getTeamDisplayName } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";

const EHR_LOCATIONS = ["Rodemack", "Hettange (Hall)", "Hettange (Poly)", "Kanfen"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const DAYS_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

// Dimensions de l'affiche : A3 portrait à 96 dpi (297 x 420 mm)
const POSTER_WIDTH_PX = 1123;
const POSTER_HEIGHT_PX = 1587;

// Hauteurs fixes des zones de l'affiche
const HEADER_H = 170;
const FOOTER_H = 70;
const WEEKEND_BAND_H = 48;
const MIDDLE_PAD = 48; // py-6 (24 top + 24 bottom)
const BLOCK_GAP = 16; // gap-4 entre week-ends

// Paliers de densité selon la hauteur disponible par ligne de match
const ROW_SIZES = {
  big: { day: "text-xl", time: "text-3xl", match: "text-2xl", badge: "text-lg" },
  medium: { day: "text-lg", time: "text-2xl", match: "text-xl", badge: "text-base" },
  small: { day: "text-base", time: "text-xl", match: "text-lg", badge: "text-sm" },
  tiny: { day: "text-sm", time: "text-lg", match: "text-base", badge: "text-xs" },
} as const;

const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Samedi de la semaine de la date donnée
function saturdayOf(dateIso: string): string {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return toIsoDate(d);
}

const dayShort = (dateIso: string) => {
  const d = new Date(dateIso);
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()}`;
};

const formatShort = (dateIso: string) => {
  const d = new Date(dateIso);
  return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 4)}.`;
};

const gymBadge = (location: string) => {
  switch (location) {
    case "Rodemack":
      return "bg-yellow-300 text-yellow-900";
    case "Hettange (Hall)":
      return "bg-blue-700 text-white";
    case "Hettange (Poly)":
      return "bg-blue-200 text-blue-900";
    case "Kanfen":
      return "bg-orange-400 text-white";
    default:
      return "bg-gray-200 text-gray-800";
  }
};

export default function AffichePage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const now = new Date();
  const [selected, setSelected] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [format, setFormat] = useState<"A3" | "A4">("A3");
  const [isGenerating, setIsGenerating] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);

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

  // Adapter la densité des lignes pour que TOUT tienne sur une seule page :
  // plus il y a de matchs, plus les lignes sont compactes
  const { rowH, rowSize } = useMemo(() => {
    const totalMatches = weekends.reduce((t, w) => t + w.days.reduce((s, d) => s + d.matches.length, 0), 0);
    const weeks = weekends.length;
    const available =
      POSTER_HEIGHT_PX -
      HEADER_H -
      FOOTER_H -
      MIDDLE_PAD -
      Math.max(0, weeks - 1) * BLOCK_GAP -
      weeks * WEEKEND_BAND_H;
    let h = 62;
    if (weeks > 0 && totalMatches > 0) {
      h = Math.min(62, Math.max(26, Math.floor(available / totalMatches)));
    }
    const tier = h >= 54 ? "big" : h >= 40 ? "medium" : h >= 32 ? "small" : "tiny";
    return { rowH: h, rowSize: ROW_SIZES[tier as keyof typeof ROW_SIZES] };
  }, [weekends]);

  const opponentOf = (m: Match) => {
    if (!m.away_team) return "À déterminer";
    const ehrNames = ["Seniors M", "Seniors F1", "Seniors F2", "M17", "F17", "M17Dep1", "M17Dep2", "F17CDF", "F17Dep", "M15", "F15", "M13", "F13", "M11", "F11"];
    return ehrNames.includes(m.away_team) ? getTeamDisplayName(m.away_team) : m.away_team;
  };

  // Générer le PDF : l'affiche complète tient toujours sur UNE page (A3 ou A4)
  const generatePdf = async () => {
    if (!posterRef.current || isGenerating) return;
    setIsGenerating(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(posterRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        width: POSTER_WIDTH_PX,
        height: POSTER_HEIGHT_PX,
        windowWidth: POSTER_WIDTH_PX,
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format });
      const pageWidthMm = format === "A3" ? 297 : 210;
      const pageHeightMm = pageWidthMm * (POSTER_HEIGHT_PX / POSTER_WIDTH_PX);
      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        0,
        0,
        pageWidthMm,
        pageHeightMm,
        undefined,
        "FAST"
      );
      pdf.save(`affiche-matchs-domicile-${MONTHS[selected.month]}-${selected.year}-${format}.pdf`);
    } catch (error) {
      console.error("Erreur génération PDF:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container-custom animate-pulse">
        <div className="text-center py-12">
          <p className="text-blue-600 text-lg">Chargement de l&apos;affiche...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-custom animate-fade-in">
      {/* Barre de contrôle (hors affiche/PDF) */}
      <div className="no-print mb-6">
        <h1 className="text-xl font-bold text-blue-800 mb-4">Affiche mensuelle des matchs à domicile</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToMonth(-1)}
              className="btn-outline px-3 py-2"
              aria-label="Mois précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-base font-bold text-blue-800 capitalize min-w-[160px] text-center">
              {MONTHS[selected.month]} {selected.year}
            </span>
            <button
              onClick={() => goToMonth(1)}
              className="btn-outline px-3 py-2"
              aria-label="Mois suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center rounded-lg border-2 border-blue-600 overflow-hidden">
            {(["A4", "A3"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={`px-3 py-2 text-sm font-semibold transition-colors ${
                  format === f ? "bg-blue-600 text-white" : "bg-white text-blue-600 hover:bg-blue-50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={generatePdf}
            disabled={isGenerating}
            className="btn-primary flex items-center gap-2 disabled:opacity-60"
          >
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            {isGenerating ? "Génération en cours..." : `Télécharger l'affiche (${format})`}
          </button>
        </div>
      </div>

      {/* Affiche : dimension A3 exacte (une page), hauteur fixe = aucun décalage possible */}
      <div className="overflow-x-auto pb-6">
        <div
          ref={posterRef}
          className="bg-white shadow-xl mx-auto flex flex-col overflow-hidden"
          style={{ width: POSTER_WIDTH_PX, height: POSTER_HEIGHT_PX }}
        >
          {/* En-tête */}
          <div
            className="bg-gradient-to-r from-blue-900 via-blue-700 to-yellow-400 text-white px-12 flex items-center gap-10 shrink-0"
            style={{ height: HEADER_H }}
          >
            <img src="/logo.png" alt="Logo EHR" className="h-32 w-auto object-contain" />
            <div className="flex-1 text-center">
              <p className="text-yellow-300 text-lg font-semibold tracking-widest uppercase">
                Entente Hettange Rodemack
              </p>
              <h2 className="text-5xl font-extrabold leading-tight mt-1">Matchs à domicile</h2>
              <p className="text-3xl text-blue-50 capitalize mt-1">
                {MONTHS[selected.month]} {selected.year}
              </p>
            </div>
            <div className="w-44" aria-hidden="true" />
          </div>

          {/* Corps : une bande par week-end, une ligne par match */}
          <div className="flex-1 flex flex-col px-10 py-6 gap-4 min-h-0">
            {weekends.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-4xl font-bold text-blue-800">
                  Pas de match à domicile ce mois-ci
                </p>
              </div>
            ) : (
              weekends.map(({ saturday, days }) => (
                <div key={saturday} className="border-2 border-blue-100">
                  <div
                    className="bg-blue-800 text-white px-6 flex items-center border-b-4 border-yellow-400"
                    style={{ height: WEEKEND_BAND_H }}
                  >
                    <h3 className="text-2xl font-bold capitalize">
                      {days.length > 1
                        ? `Week-end du ${formatShort(days[0].date)} au ${formatShort(days[days.length - 1].date)}`
                        : `${formatShort(days[0].date)}`}
                    </h3>
                  </div>
                  <ul>
                    {days.flatMap((day, dayIdx) =>
                      day.matches.map((m, i) => (
                        <li
                          key={`${day.date}-${i}`}
                          className={`flex items-center gap-4 px-6 whitespace-nowrap overflow-hidden ${
                            i % 2 === 0 ? "bg-blue-50" : "bg-white"
                          } ${dayIdx > 0 && i === 0 ? "border-t-2 border-blue-200" : ""}`}
                          style={{ height: rowH }}
                        >
                          <span className={`${rowSize.day} font-semibold text-blue-700 w-24 shrink-0 capitalize`}>
                            {dayShort(day.date)}
                          </span>
                          <span className={`${rowSize.time} font-extrabold text-blue-800 tabular-nums w-20 shrink-0 text-center`}>
                            {m.time || "à définir"}
                          </span>
                          <span className={`${rowSize.match} leading-tight min-w-0`}>
                            <span className="font-bold text-gray-900">{getTeamDisplayName(m.home_team)}</span>
                            <span className="text-gray-400 mx-2">vs</span>
                            <span className="text-blue-700">{opponentOf(m)}</span>
                          </span>
                          <span
                            className={`${rowSize.badge} font-bold px-3 py-1 rounded-md shrink-0 ml-auto ${gymBadge(m.location || "")}`}
                          >
                            {m.location}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ))
            )}
          </div>

          {/* Pied de l'affiche */}
          <div
            className="bg-blue-900 text-white px-12 flex items-center justify-between shrink-0"
            style={{ height: FOOTER_H }}
          >
            <p className="text-2xl font-bold text-yellow-300">Venez nombreux encourager nos équipes !</p>
            <p className="text-blue-100 text-sm">
              Hettange (Hall) - Hettange (Poly) - Rodemack - Kanfen | Horaires susceptibles de modification
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
