// app/classement/page.tsx
"use client";

import { useState, useEffect } from "react";
import { getTeamDisplayName } from "@/lib/utils";
import { ExternalLink, Pencil, Trash2, Check, X, Plus, Loader2 } from "lucide-react";

// Équipes du club (noms normalisés), regroupées par catégorie
const TEAM_SECTIONS: { title: string; teams: string[] }[] = [
  { title: "Seniors", teams: ["Seniors M", "Seniors F1", "Seniors F2"] },
  {
    title: "17 ans",
    teams: ["M17Dep1", "M17Dep2", "F17CDF", "F17Dep"],
  },
  { title: "15 ans", teams: ["M15", "F15"] },
  { title: "13 ans", teams: ["M13", "F13"] },
  { title: "11 ans", teams: ["M11", "F11"] },
];

function TeamLinkCard({
  team,
  url,
  onSaved,
  onError,
}: {
  team: string;
  url: string;
  onSaved: (links: Record<string, string>) => void;
  onError: (message: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setValue(url || "");
    setEditing(true);
  };

  const save = async (newUrl: string) => {
    setSaving(true);
    try {
      const response = await fetch("/api/team-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team, url: newUrl.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        onError(data.error || "Erreur lors de l'enregistrement.");
        return;
      }
      onSaved(data);
      setEditing(false);
    } catch {
      onError("Erreur réseau lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5 flex flex-col gap-3">
      <h3 className="text-lg font-bold text-blue-800">{getTeamDisplayName(team)}</h3>

      {!editing && (
        <div className="flex flex-wrap items-center gap-2">
          {url ? (
            <>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary px-4 py-2 text-sm flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Voir le classement et les résultats
              </a>
              <button
                onClick={startEdit}
                className="btn-outline px-3 py-2"
                aria-label="Modifier le lien"
                title="Modifier le lien"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => save("")}
                disabled={saving}
                className="btn-outline px-3 py-2 disabled:opacity-50"
                aria-label="Supprimer le lien"
                title="Supprimer le lien"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </>
          ) : (
            <button onClick={startEdit} className="btn-outline px-4 py-2 text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Ajouter le lien FFHandball
            </button>
          )}
        </div>
      )}

      {editing && (
        <div className="flex flex-col gap-2">
          <input
            type="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://www.ffhandball.fr/competitions/..."
            className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => save(value)}
              disabled={saving}
              className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Enregistrer
            </button>
            <button
              onClick={() => setEditing(false)}
              className="btn-outline px-4 py-2 text-sm flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Annuler
            </button>
            {url && (
              <button
                onClick={() => {
                  setValue("");
                  save("");
                }}
                disabled={saving}
                className="text-sm text-red-600 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClassementPage() {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLinks = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/team-links");
      const data = await response.json();
      setLinks(data || {});
    } catch {
      setError("Impossible de charger les liens.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLinks();
  }, []);

  return (
    <div className="container-custom animate-fade-in">
      <div className="mb-8">
        <h1 className="page-title">Classements</h1>
        <p className="page-subtitle">
          Classements et résultats de chaque équipe sur FFHandball - collez le lien de la page
          de championnat depuis ffhandball.fr, il sera accessible ici en un clic.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6">
          {error}
          <button onClick={() => setError(null)} className="ml-3 underline">
            fermer
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-blue-600 text-lg">Chargement des classements...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {TEAM_SECTIONS.map(({ title, teams }) => (
            <section key={title}>
              <h2 className="text-xl font-bold text-blue-800 mb-4 border-b-2 border-yellow-400 pb-2 inline-block">
                {title}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.map((team) => (
                  <TeamLinkCard
                    key={team}
                    team={team}
                    url={links[team] || ""}
                    onSaved={(newLinks) => {
                      setLinks(newLinks);
                      setError(null);
                    }}
                    onError={setError}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
