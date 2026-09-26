// components/Navbar.tsx
"use client";

import Link from "next/link";
import { useState } from "react";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="bg-blue-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Nom du site */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                <span className="text-blue-800 font-bold text-lg">EHR</span>
              </div>
              <span className="text-xl font-bold">Entente Hettange Rodemack</span>
            </Link>
          </div>

          {/* Menu desktop */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-1">
              <Link
                href="/"
                className="bg-yellow-500 text-blue-800 px-4 py-2 rounded-md text-sm font-medium hover:bg-yellow-400 transition-colors"
              >
                Accueil
              </Link>
              <Link
                href="/matches"
                className="text-blue-100 hover:bg-blue-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Planning
              </Link>
              <Link
                href="/stats"
                className="text-blue-100 hover:bg-blue-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Statistiques
              </Link>
              <Link
                href="/upload"
                className="text-blue-100 hover:bg-blue-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Uploader
              </Link>
            </div>
          </div>

          {/* Bouton mobile */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="bg-yellow-500 text-blue-800 p-2 rounded-md hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-800"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Menu mobile */}
      {isMenuOpen && (
        <div className="md:hidden bg-blue-700">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link
              href="/"
              className="block px-3 py-2 rounded-md text-base font-medium text-white bg-yellow-500 hover:bg-yellow-400"
              onClick={() => setIsMenuOpen(false)}
            >
              Accueil
            </Link>
            <Link
              href="/matches"
              className="block px-3 py-2 rounded-md text-base font-medium text-blue-100 hover:bg-blue-600"
              onClick={() => setIsMenuOpen(false)}
            >
              Planning
            </Link>
            <Link
              href="/stats"
              className="block px-3 py-2 rounded-md text-base font-medium text-blue-100 hover:bg-blue-600"
              onClick={() => setIsMenuOpen(false)}
            >
              Statistiques
            </Link>
            <Link
              href="/upload"
              className="block px-3 py-2 rounded-md text-base font-medium text-blue-100 hover:bg-blue-600"
              onClick={() => setIsMenuOpen(false)}
            >
              Uploader
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
