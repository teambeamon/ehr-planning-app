// components/Navigation.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="bg-gradient-to-r from-blue-700 to-yellow-500 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Nom du club */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-white text-xl font-bold">
                <span className="bg-yellow-400 text-blue-800 px-2 py-1 rounded">EHR</span>
                <span className="hidden sm:inline"> Planning</span>
              </span>
            </Link>
          </div>

          {/* Menu principal */}
          <div className="hidden md:flex md:items-center md:space-x-1">
            <Link
              href="/"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive("/")
                  ? "bg-white text-blue-700"
                  : "text-white hover:bg-white/20"
              }`}
            >
              Accueil
            </Link>

            <Link
              href="/matches"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive("/matches")
                  ? "bg-white text-blue-700"
                  : "text-white hover:bg-white/20"
              }`}
            >
              Planning
            </Link>

            <Link
              href="/stats"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive("/stats")
                  ? "bg-white text-blue-700"
                  : "text-white hover:bg-white/20"
              }`}
            >
              Statistiques
            </Link>

            <Link
              href="/upload"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive("/upload")
                  ? "bg-white text-blue-700"
                  : "text-white hover:bg-white/20"
              }`}
            >
              Uploader
            </Link>
          </div>

          {/* Bouton mobile */}
          <div className="md:hidden">
            <button className="text-white hover:bg-white/20 p-2 rounded-md">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
