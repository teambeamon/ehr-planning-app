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
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setError(null);
      setSuccessMessage(null);
      setMatchesCount(null);
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
      
      setSuccessMessage(result.message);
      setMatchesCount(result.matchesCount);
      
      // Rafraîchir la page après un délai pour voir les nouvelles données
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
              <span className="ml-2 font-semibold">{matchesCount} matchs enregistrés</span>
            )}
          </span>
        </div>
      )}

      {/* Message de succès - tout est automatique maintenant */}
      {successMessage && (
        <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-sm text-green-800">
          <strong>✅ Succès !</strong> Le fichier a été traité et les données sont maintenant disponibles.
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
            Traitement en cours...
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
