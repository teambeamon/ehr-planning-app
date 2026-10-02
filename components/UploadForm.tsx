// components/UploadForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [matchesCount, setMatchesCount] = useState<number | null>(null);
  const [committedToGitHub, setCommittedToGitHub] = useState(false);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
      setSuccessMessage(null);
      setMatchesCount(null);
      setCommittedToGitHub(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError("Veuillez sélectionner un fichier.");
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de l'upload du fichier.");
      }

      const result = await response.json();
      
      // Sauvegarder les données dans localStorage (temporaire)
      if (result.matches && result.matches.length > 0) {
        localStorage.setItem('lastUploadedMatches', JSON.stringify(result.matches));
        localStorage.setItem('lastUploadedDate', new Date().toISOString());
      }
      
      setSuccessMessage(result.message);
      setMatchesCount(result.matchesCount);
      setCommittedToGitHub(result.committedToGitHub || false);
      
      // Rafraîchir la page après un délai
      setTimeout(() => {
        router.refresh();
      }, 1500);

    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="file" className="block text-sm font-medium text-gray-700">
          Fichier Excel du planning
        </label>
        <Input
          id="file"
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileChange}
          className="mt-1"
          disabled={isLoading}
        />
        <p className="text-sm text-gray-500 mt-1">
          Sélectionnez un fichier Excel contenant le planning des matchs.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-600" />
          <span>
            {successMessage}
            {matchesCount !== null && (
              <span className="ml-2 font-semibold">{matchesCount} matchs trouvés</span>
            )}
          </span>
        </div>
      )}

      {/* Message différent selon si commit GitHub a réussi */}
      {successMessage && !committedToGitHub && (
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-sm text-yellow-800">
          <strong>⚠️ Action requise :</strong> Les données ont été traitées mais n'ont pas pu être sauvegardées automatiquement sur GitHub.
          <br />
          <strong>Pour finaliser :</strong> Téléchargez le fichier JSON ci-dessous et placez-le dans <code>data/matches.json</code> de votre dépôt GitHub, puis faites un commit.
          <br />
          <Button 
            className="mt-2"
            onClick={() => {
              const storedMatches = localStorage.getItem('lastUploadedMatches');
              if (storedMatches) {
                const blob = new Blob([storedMatches], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'matches.json';
                a.click();
                URL.revokeObjectURL(url);
              }
            }}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Télécharger matches.json
          </Button>
        </div>
      )}

      {successMessage && committedToGitHub && (
        <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-sm text-green-800">
          <strong>✅ Succès !</strong> Le fichier a été traité et sauvegardé automatiquement sur GitHub.
          <br />
          Les données seront disponibles après le déploiement Vercel (quelques minutes).
          <br />
          <Button 
            className="mt-2"
            onClick={() => router.refresh()}
          >
            Rafraîchir la page
          </Button>
        </div>
      )}

      <Button type="submit" disabled={isLoading || !file} className="w-full">
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Upload en cours...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            Uploader et traiter
          </>
        )}
      </Button>
    </form>
  );
}
