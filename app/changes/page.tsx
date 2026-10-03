// app/changes/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function ChangesPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/changes');
        if (!response.ok) {
          throw new Error('Erreur lors de la récupération de l\'historique');
        }
        const data = await response.json();
        setHistory(data.history || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHistory();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-4">
        <h1 className="text-2xl font-bold mb-4">Historique des Changements</h1>
        <p>Chargement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-4">
        <h1 className="text-2xl font-bold mb-4">Historique des Changements</h1>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="container mx-auto py-4">
        <h1 className="text-2xl font-bold mb-4">Historique des Changements</h1>
        <p>Aucun historique disponible. Upload un fichier pour commencer.</p>
        <Link href="/upload" className="text-blue-500 hover:underline">
          → Aller à la page d'upload
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Historique des Changements</h1>
        <Link href="/upload" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Upload Nouveau Fichier
        </Link>
      </div>

      <div className="space-y-6">
        {history.map((entry, index) => {
          const date = new Date(entry.uploaded_at);
          const formattedDate = date.toLocaleString('fr-FR');
          
          return (
            <div key={entry.id || index} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h2 className="text-lg font-semibold">
                    Upload #{history.length - index} - {formattedDate}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Fichier: {entry.filename} | {entry.match_count} matchs | Saison: {entry.season}
                    {entry.last_updated ? ` | MAJ: ${entry.last_updated}` : ''}
                  </p>
                </div>
              </div>

              {entry.changes && (
                <div className="mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border-l-4 border-green-500 pl-3">
                      <h3 className="font-medium text-green-600">
                        ✅ {entry.changes.added.length} matchs ajoutés
                      </h3>
                      {entry.changes.added.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {entry.changes.added.slice(0, 5).map((match: any, i: number) => (
                            <li key={i} className="text-sm">
                              {match.date} - {match.home_team} vs {match.away_team}
                              {match.time ? ` à ${match.time}` : ''} - {match.location}
                            </li>
                          ))}
                          {entry.changes.added.length > 5 && (
                            <li className="text-sm text-gray-500">+ {entry.changes.added.length - 5} autres...</li>
                          )}
                        </ul>
                      )}
                    </div>
                    
                    <div className="border-l-4 border-red-500 pl-3">
                      <h3 className="font-medium text-red-600">
                        ❌ {entry.changes.removed.length} matchs supprimés
                      </h3>
                      {entry.changes.removed.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {entry.changes.removed.slice(0, 5).map((match: any, i: number) => (
                            <li key={i} className="text-sm">
                              {match.date} - {match.home_team} vs {match.away_team}
                              {match.time ? ` à ${match.time}` : ''} - {match.location}
                            </li>
                          ))}
                          {entry.changes.removed.length > 5 && (
                            <li className="text-sm text-gray-500">+ {entry.changes.removed.length - 5} autres...</li>
                          )}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!entry.changes && (
                <p className="text-sm text-gray-500 mt-2">Premier upload - pas de comparaison disponible</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
