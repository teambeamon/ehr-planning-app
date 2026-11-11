// app/affiche/page.tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Match, getTeamDisplayName } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";

const EHR_LOCATIONS = ["Rodemack", "Hettange (Hall)", "Hettange (Poly)", "Kanfen"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

// Largeur de l'affiche en pixels : A3 portrait à 96 dpi (297 mm)
const POSTER_WIDTH_PX = 1123;

const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Samedi de la semaine de la date donnée
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

/// Logo EHR : utilise /logo.png si présent, sinon un badge SVG
function EhrLogo() {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className="w-32 h-32 shrink-0 flex items-center justify-center">
      {imgOk ? (
        <img
          src="/logo.png"
          alt="Logo EHR"
          className="w-full h-full object-contain"
          onError={() => setImgOk(false)}
        />
      ) : (
        <svg viewBox="0 0 120 120" className="w-full h-full">
          <circle cx="60" cy="48" r="32" fill="#facc15" stroke="#ffffff" strokeWidth="3" />
          <path d="M28 48h64" stroke="#1e3a8a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M60 16c-12 10-12 54 0 64" stroke="#1e3a8a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M60 16c12 10 12 54 0 64" stroke="#1e3a8a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <text x="60" y="112" textAnchor="middle" fontSize="24" fontWeight="800" fill="#ffffff">
            EHR
          </text>
        </svg>
      )}
    </div>
  );
}

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

  const opponentOf = (m: Match) => {
    if (!m.away_team) return "À déterminer";
    const ehrNames = ["Seniors M", "Seniors F1", "Seniors F2", "M17", "F17", "M17Dep1", "M17Dep2", "F17CDF", "F17Dep", "M15", "F15", "M13", "F13", "M11", "F11"];
    return ehrNames.includes(m.away_team) ? getTeamDisplayName(m.away_team) : m.away_team;
  };

  // Générer le PDF : chaque page est un format exact (A3 ou A4), les week-ends ne sont jamais coupés
  const generatePdf = async () => {
    if (!posterRef.current || isGenerating) return;
    setIsGenerating(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF } = await import("jspdf");

      const sections = Array.from(
        posterRef.current.querySelectorAll<HTMLElement>(".pdf-section")
      );
      const scale = 2; // qualité d'image

      const canvases: HTMLCanvasElement[] = [];
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        const canvas = await html2canvas(section, {
          scale,
          backgroundColor: "#ffffff",
          width: POSTER_WIDTH_PX,
          height: Math.ceil(rect.height),
          windowWidth: POSTER_WIDTH_PX,
        });
        canvases.push(canvas);
      }

      const imgWidthMm = format === "A3" ? 297 : 210;
      const pageHeightMm = format === "A3" ? 420 : 297;
      const gap = 5; // mm entre sections sur une même page

      const pxToMm = (px: number) => (px / POSTER_WIDTH_PX) * imgWidthMm;

      // Découper une section plus haute qu'une page (rare) en tranches pleines pages
      const sliceCanvas = (canvas: HTMLCanvasElement, maxRealPx: number): { canvas: HTMLCanvasElement; hMm: number }[] => {
        const slices: { canvas: HTMLCanvasElement; hMm: number }[] = [];
        const slicePx = Math.floor(maxRealPx) * scale;
        for (let y = 0; y < canvas.height; y += slicePx) {
          const h = Math.min(slicePx, canvas.height - y);
          const tmp = document.createElement("canvas");
          tmp.width = canvas.width;
          tmp.height = h;
          const ctx = tmp.getContext("2d")!;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, tmp.width, tmp.height);
          ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
          slices.push({ canvas: tmp, hMm: pxToMm(h / scale) });
        }
        return slices.length > 0 ? slices : [{ canvas, hMm: pxToMm(canvas.height / scale) }];
      };

      // Regrouper les sections page par page, un week-end n'est jamais coupé
      type Placed = { canvas: HTMLCanvasElement; yMm: number };
      const pages: { items: Placed[] }[] = [];
      let currentItems: Placed[] = [];
      let currentUsedMm = 0;

      const place = (canvas: HTMLCanvasElement, hMm: number) => {
        if (currentItems.length > 0 && currentUsedMm + hMm > pageHeightMm) {
          pages.push({ items: currentItems });
          currentItems = [];
          currentUsedMm = 0;
        }
        currentItems.push({ canvas, yMm: currentUsedMm });
        currentUsedMm += hMm + gap;
      };

      for (const canvas of canvases) {
        const hMm = pxToMm(canvas.height / scale);
        const maxRealPx = (pageHeightMm / imgWidthMm) * POSTER_WIDTH_PX;
        if (hMm > pageHeightMm) {
          sliceCanvas(canvas, maxRealPx).forEach((s) => place(s.canvas, s.hMm));
        } else {
          place(canvas, hMm);
        }
      }
      if (currentItems.length > 0) pages.push({ items: currentItems });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format });
      pages.forEach(({ items }, pageIndex) => {
        if (pageIndex > 0) pdf.addPage();
        items.forEach(({ canvas, yMm }) => {
          const wMm = imgWidthMm;
          const hMm = pxToMm(canvas.height / scale);
          pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, yMm, wMm, hMm, undefined, "FAST");
        });
      });

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

      {/* Affiche : largeur fixe A3 pour un rendu identique à l'écran et dans le PDF */}
      <div className="no-print mb-1 text-xs text-gray-400">
        Faites défiler horizontalement si l&apos;affiche dépasse la largeur de l&apos;écran.
      </div>
      <div className="overflow-x-auto pb-6">
        <div ref={posterRef} className="bg-white shadow-xl mx-auto" style={{ width: POSTER_WIDTH_PX }}>
          {/* En-tête de l'affiche */}
          <div className="pdf-section bg-gradient-to-r from-blue-900 via-blue-700 to-yellow-400 text-white px-12 py-10 flex items-center justify-between">
            <div>
              <p className="text-yellow-300 text-xl font-semibold tracking-widest uppercase">
                Entente Hettange Rodemack
              </p>
              <h2 className="text-6xl font-extrabold leading-tight mt-2">Matchs à domicile</h2>
              <p className="text-3xl text-blue-100 capitalize mt-2">
                {MONTHS[selected.month]} {selected.year}
              </p>
            </div>
            <EhrLogo />
          </div>

          {/* Corps : un bloc par week-end */}
          <div className="bg-white px-10 py-8">
            {weekends.length === 0 ? (
              <div className="pdf-section text-center py-20 border-2 border-dashed border-blue-200 rounded-none">
                <p className="text-4xl font-bold text-blue-800">Pas de match à domicile ce mois-ci</p>
              </div>
            ) : (
              <div className="space-y-8">
                {weekends.map(({ saturday, days }) => {
                  const label =
                    days.length > 1
                      ? `Week-end du ${formatShort(days[0].date)} au ${formatShort(days[days.length - 1].date)}`
                      : formatLong(days[0].date);
                  return (
                    <section key={saturday} className="pdf-section border-2 border-blue-100">
                      <div className="bg-blue-800 text-white px-8 py-4 border-b-4 border-yellow-400">
                        <h3 className="text-3xl font-bold capitalize">{label}</h3>
                      </div>
                      <div className={`grid gap-0 ${days.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                        {days.map((day, dayIndex) => (
                          <div
                            key={day.date}
                            className={`p-6 ${
                              days.length > 1 && dayIndex % 2 === 1 ? "border-l border-blue-100" : ""
                            } ${days.length > 1 && dayIndex > 1 ? "border-t border-blue-100" : ""}`}
                          >
                            <div className="mb-5 pb-3 border-b-4 border-yellow-400">
                              <h4 className="text-2xl font-extrabold text-blue-700 capitalize">
                                {formatLong(day.date)}
                              </h4>
                            </div>
                            <ul className="space-y-4">
                              {day.matches.map((m, i) => (
                                <li
                                  key={`${m.date}-${m.home_team}-${m.time}-${i}`}
                                  className="flex items-center gap-5 rounded-none bg-blue-50 border border-blue-100 px-5 py-4"
                                >
                                  <span className="text-3xl font-extrabold text-blue-800 tabular-nums w-24 shrink-0">
                                    {m.time || "à définir"}
                                  </span>
                                  <span className="flex-1 text-2xl leading-snug">
                                    <span className="font-bold text-gray-900">
                                      {getTeamDisplayName(m.home_team)}
                                    </span>
                                    <span className="text-gray-400 mx-2 font-medium">vs</span>
                                    <span className="text-blue-700">{opponentOf(m)}</span>
                                  </span>
                                  <span
                                    className={`inline-block text-lg font-bold px-4 py-1.5 rounded-none border-2 shrink-0 ${gymBadge(m.location || "")}`}
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
            )}
          </div>

          {/* Pied de l'affiche */}
          <div className="pdf-section bg-blue-900 text-white px-12 py-6 flex items-center justify-between">
            <p className="text-2xl font-bold text-yellow-300">Venez nombreux encourager nos équipes !</p>
            <div className="text-right text-blue-100 text-sm leading-snug">
              <p>Hettange (Hall) - Hettange (Poly) - Rodemack - Kanfen</p>
              <p>Horaires susceptibles de modification</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
