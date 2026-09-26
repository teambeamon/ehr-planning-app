// app/matches/page.tsx
import MatchTable from "@/components/MatchTable";
import WeekendMatches from "@/components/WeekendMatches";
import Link from "next/link";

export default function MatchesPage() {
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
      
      {/* Tableau complet des matchs */}
      <div className="card animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <MatchTable />
      </div>
    </div>
  );
}
