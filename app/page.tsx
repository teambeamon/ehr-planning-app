// app/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
        <div className="flex flex-wrap gap-4 justify-center">
          <Button asChild className="bg-yellow-500 text-blue-800 hover:bg-yellow-400 border-0">
            <Link href="/matches">
              <span className="font-semibold">Voir le Planning</span>
            </Link>
          </Button>
          <Button asChild className="bg-white text-blue-800 hover:bg-gray-100 border-0">
            <Link href="/stats">
              <span className="font-semibold">Voir les Statistiques</span>
            </Link>
          </Button>
          <Button asChild className="bg-blue-500 text-white hover:bg-blue-400 border-0">
            <Link href="/upload">
              <span className="font-semibold">Uploader un Nouveau Fichier</span>
            </Link>
          </Button>
        </div>
      </section>

      {/* Section Info */}
      <section className="grid md:grid-cols-3 gap-8">
        <div className="stat-card animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
              <span className="text-2xl text-blue-600">📅</span>
            </div>
            <h3 className="text-xl font-semibold text-blue-800">Planning Complet</h3>
          </div>
          <p className="text-gray-600">
            Consultez tous les matchs de la saison 2026-2027 organisés par date, équipe et lieu.
          </p>
        </div>

        <div className="stat-card animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center mr-4">
              <span className="text-2xl text-yellow-600">📊</span>
            </div>
            <h3 className="text-xl font-semibold text-blue-800">Statistiques</h3>
          </div>
          <p className="text-gray-600">
            Analysez les performances par équipe, catégorie et lieu avec des graphiques interactifs.
          </p>
        </div>

        <div className="stat-card animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
              <span className="text-2xl text-blue-600">📤</span>
            </div>
            <h3 className="text-xl font-semibold text-blue-800">Upload Facile</h3>
          </div>
          <p className="text-gray-600">
            Importez vos fichiers Excel de planning en un clic pour mettre à jour les données.
          </p>
        </div>
      </section>
    </div>
  );
}
