// app/api/changes/route.ts
import { NextResponse } from "next/server";
import { getUploadHistory, getUploadSnapshot } from "@/lib/db-upload-history";

export async function GET() {
  try {
    const history = await getUploadHistory();
    
    // Enrichir avec les snapshots pour calculer les différences
    const enrichedHistory = [];
    
    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      const snapshot = await getUploadSnapshot(entry.file_hash);
      
      enrichedHistory.push({
        ...entry,
        matches: snapshot ? JSON.parse(snapshot) : [],
      });
    }
    
    // Calculer les différences entre chaque upload consécutif
    const historyWithChanges = [];
    
    for (let i = 0; i < enrichedHistory.length; i++) {
      const current = enrichedHistory[i];
      const previous = i > 0 ? enrichedHistory[i - 1] : null;
      
      let changes = null;
      if (previous) {
        const prevByKey = new Map<string, any>();
        const currByKey = new Map<string, any>();
        
        const makeKey = (m: any) => `${m.date}-${m.home_team}-${m.away_team}-${m.time || ''}`;
        
        current.matches.forEach((m: any) => {
          const key = makeKey(m);
          currByKey.set(key, m);
        });
        
        previous.matches.forEach((m: any) => {
          const key = makeKey(m);
          prevByKey.set(key, m);
        });
        
        const added: any[] = [];
        const removed: any[] = [];
        
        for (const [key, currMatch] of Array.from(currByKey.entries())) {
          if (!prevByKey.has(key)) {
            added.push(currMatch);
          }
        }
        
        for (const [key, prevMatch] of Array.from(prevByKey.entries())) {
          if (!currByKey.has(key)) {
            removed.push(prevMatch);
          }
        }
        
        changes = { added, removed };
      }
      
      historyWithChanges.push({
        ...current,
        changes,
        matches: undefined, // Ne pas retourner tous les matchs pour limiter la taille
      });
    }
    
    return NextResponse.json({
      success: true,
      history: historyWithChanges,
    });
    
  } catch (error: any) {
    console.error("Erreur:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de la récupération de l'historique." },
      { status: 500 }
    );
  }
}
