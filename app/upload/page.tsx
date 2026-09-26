// app/upload/page.tsx
import UploadForm from "@/components/UploadForm";
import Link from "next/link";

export default function UploadPage() {
  return (
    <div className="container-custom animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="card mb-8">
          <div className="flex items-center mb-6">
            <div className="w-14 h-14 bg-yellow-100 rounded-xl flex items-center justify-center mr-4">
              <span className="text-3xl">📤</span>
            </div>
            <div>
              <h1 className="page-title">Uploader un Nouveau Planning</h1>
              <p className="page-subtitle">
                Importez un fichier Excel contenant le planning des matchs. 
                Les données seront automatiquement mises à jour.
              </p>
            </div>
          </div>
          
          <div className="alert alert-warning mb-8">
            <strong>⚠️ Format attendu :</strong>
            <ul className="list-disc list-inside mt-2">
              <li>Fichier Excel (.xlsx ou .xls)</li>
              <li>Colonnes : Date, Équipe à domicile, Adversaire, Heure, Lieu, Catégorie</li>
              <li>Les noms de colonnes peuvent varier (détection automatique)</li>
            </ul>
          </div>
          
          <UploadForm />
          
          <div className="mt-8 text-center">
            <Link href="/matches" className="link">
              ← Retour au Planning
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
