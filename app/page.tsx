// app/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-3xl font-bold">Bienvenue sur le Planning EHR</h1>
      <p className="text-lg">
        Gérez et consultez les matchs de l'Entente Hettange Rodemack.
      </p>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/matches">Voir le Planning</Link>
        </Button>
        <Button asChild>
          <Link href="/stats">Voir les Statistiques</Link>
        </Button>
        <Button asChild>
          <Link href="/upload">Uploader un Nouveau Fichier</Link>
        </Button>
      </div>
    </div>
  );
}
