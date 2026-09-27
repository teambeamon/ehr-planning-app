// components/Navigation.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (path: string) => pathname === path;

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Liste des liens du menu
  const navLinks = [
    { href: "/", label: "Accueil" },
    { href: "/planning", label: "Calendrier" },
    { href: "/matches", label: "Tous les matchs" },
    { href: "/stats", label: "Statistiques" },
    { href: "/buvettes", label: "Gestion buvettes" },
    { href: "/upload", label: "Uploader" },
  ];

  return (
    <nav className="bg-gradient-to-r from-blue-700 to-yellow-500 shadow-lg relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Nom du club */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
              <span className="text-white text-xl font-bold">
                <span className="bg-yellow-400 text-blue-800 px-2 py-1 rounded">EHR</span>
                <span className="hidden sm:inline"> Planning</span>
              </span>
            </Link>
          </div>

          {/* Menu principal - Desktop */}
          <div className="hidden md:flex md:items-center md:space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? "bg-white text-blue-700"
                    : "text-white hover:bg-white/20"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Bouton mobile */}
          <div className="md:hidden">
            <button 
              onClick={toggleMobileMenu}
              className="text-white hover:bg-white/20 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2"
              aria-label="Menu"
              aria-expanded={isMobileMenuOpen}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Menu mobile - s'affiche quand isMobileMenuOpen est true */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-blue-700 z-50 shadow-xl">
          <div className="px-4 pt-2 pb-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-md text-base font-medium transition-colors ${
                  isActive(link.href)
                    ? "bg-yellow-400 text-blue-800"
                    : "text-white hover:bg-blue-600"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
