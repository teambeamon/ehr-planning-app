// app/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Calendar, BarChart, Upload, Beer, List, Trophy } from "lucide-react";

export default function Home() {
  return (
    <div className="container-custom animate-fade-in">
      {/* Section Hero */}
      <section className="bg-gradient-to-r from-blue-800 to-blue-600 rounded-2xl p-12 mb-12 text-white shadow-2xl">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Bienvenue sur le Planning EHR
        </h1>
        <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-3xl">
          Gérez et consultez les matchs de l'Entente Hettange Rodemack.
        </p>
        
        {/* Boutons principaux */}
        <div className="flex flex-wrap gap-4 justify-center mb-8">
          <Button asChild className="bg-yellow-500 text-blue-800 hover:bg-yellow-400 border-0">
            <Link href="/planning">
              <Calendar className="w-5 h-5 mr-2" />
              <span className="font-semibold">Calendrier</span>
            </Link>
          </Button>
          <Button asChild className="bg-white text-blue-800 hover:bg-gray-100 border-0">
            <Link href="/matches">
              <List className="w-5 h-5 mr-2" />
              <span className="font-semibold">Tous les matchs</span>
            </Link>
          </Button>
          <Button asChild className="bg-blue-500 text-white hover:bg-blue-400 border-0">
            <Link href="/stats">
              <BarChart className="w-5 h-5 mr-2" />
              <span className="font-semibold">Statistiques</span>
            </Link>
          </Button>
          <Button asChild className="bg-green-500 text-white hover:bg-green-400 border-0">
            <Link href="/buvettes">
              <Beer className="w-5 h-5 mr-2" />
              <span className="font-semibold">Gestion buvettes</span>
            </Link>
          </Button>
          <Button asChild className="bg-gray-700 text-white hover:bg-gray-600 border-0">
            <Link href="/upload">
              <Upload className="w-5 h-5 mr-2" />
              <span className="font-semibold">Uploader un fichier</span>
            </Link>
          </Button>
        </div>
      </section>

      {/* Section Info - Quick Links */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-blue-800 mb-6 text-center">Accès rapide</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Calendrier */}
          <Link href="/planning" className="card group hover:shadow-xl transition-shadow">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center mr-4">
                <Calendar className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="text-xl font-semibold text-blue-800">Calendrier</h3>
            </div>
            <p className="text-gray-600">
              Visualisez les matchs par date et par salle avec les horaires. Idéal pour organiser votre semaine.
            </p>
            <div className="mt-4 text-blue-600 font-medium group-hover:translate-x-1 transition-transform">
              → Voir le calendrier
            </div>
          </Link>

          {/* Tous les matchs */}
          <Link href="/matches" className="card group hover:shadow-xl transition-shadow">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
                <List className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-blue-800">Tous les matchs</h3>
            </div>
            <p className="text-gray-600">
              Liste complète de tous les matchs avec filtres par équipe, lieu, catégorie et saison.
            </p>
            <div className="mt-4 text-blue-600 font-medium group-hover:translate-x-1 transition-transform">
              → Voir la liste
            </div>
          </Link>

          {/* Statistiques */}
          <Link href="/stats" className="card group hover:shadow-xl transition-shadow">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mr-4">
                <BarChart className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-blue-800">Statistiques</h3>
            </div>
            <p className="text-gray-600">
              Graphiques et analyses des matchs par équipe, lieu et catégorie. Uniquement les équipes EHR.
            </p>
            <div className="mt-4 text-blue-600 font-medium group-hover:translate-x-1 transition-transform">
              → Voir les stats
            </div>
          </Link>

          {/* Gestion buvettes */}
          <Link href="/buvettes" className="card group hover:shadow-xl transition-shadow">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mr-4">
                <Beer className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-blue-800">Gestion buvettes</h3>
            </div>
            <p className="text-gray-600">
              Anticipez les besoins en buvette. Détection automatique des créneaux avec plusieurs matchs consécutifs.
            </p>
            <div className="mt-4 text-blue-600 font-medium group-hover:translate-x-1 transition-transform">
              → Voir les créneaux
            </div>
          </Link>

          {/* Uploader */}
          <div className="card group hover:shadow-xl transition-shadow cursor-pointer" onClick={() => window.location.href="/upload"}>
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mr-4">
                <Upload className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-blue-800">Uploader</h3>
            </div>
            <p className="text-gray-600">
              Importez un fichier Excel pour mettre à jour automatiquement le planning et les données.
            </p>
            <div className="mt-4 text-blue-600 font-medium group-hover:translate-x-1 transition-transform">
              → Uploader un fichier
            </div>
          </div>
        </div>
      </section>

      {/* Section spécial week-end */}
      <section className="bg-gradient-to-r from-blue-50 to-yellow-50 rounded-2xl p-8 mb-12">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-blue-800 mb-2">Matchs du Week-end</h2>
          <p className="text-gray-600">Voir les matchs à venir pour le week-end en cours</p>
        </div>
        <div className="flex justify-center">
          <Button asChild className="bg-blue-600 text-white hover:bg-blue-700">
            <Link href="/planning">
              <Trophy className="w-5 h-5 mr-2" />
              Voir les matchs du week-end
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

