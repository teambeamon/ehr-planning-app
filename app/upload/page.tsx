// app/upload/page.tsx
import UploadForm from "@/components/UploadForm";

export default function UploadPage() {
  return (
    <div className="container mx-auto py-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Uploader un Nouveau Planning</h1>
      <p className="mb-4">
        Upload un fichier Excel contenant le planning des matchs. Les données seront automatiquement mises à jour.
      </p>
      <UploadForm />
    </div>
  );
}
