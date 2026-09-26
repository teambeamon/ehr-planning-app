// components/UploadForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type Toast = {
  title: string;
  description: string;
  variant?: "default" | "destructive";
};

// Fonction toast simplifiée (sera remplacée par shadcn/ui)
const toast = ({ title, description, variant = "default" }: Toast) => {
  const event = new CustomEvent("toast", { detail: { title, description, variant } });
  window.dispatchEvent(event);
};

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast({ title: "Erreur", description: "Veuillez sélectionner un fichier.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erreur lors de l'upload du fichier.");
      }

      toast({ title: "Succès", description: "Fichier uploadé et traité avec succès !" });
      router.refresh();
    } catch (error) {
      toast({ title: "Erreur", description: (error as Error).message, variant: "destructive" });
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
        />
      </div>
      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Upload en cours..." : "Uploader et mettre à jour"}
      </Button>
    </form>
  );
}
