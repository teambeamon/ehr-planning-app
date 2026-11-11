// app/api/team-links/route.ts
import { NextResponse } from "next/server";
import { initializeTeamLinksTable, getTeamLinks, saveTeamLink } from "@/lib/db-team-links";

// Toujours frais : état partagé entre les utilisateurs
export const dynamic = "force-dynamic";

export async function GET() {
  const links = await getTeamLinks();
  return NextResponse.json(links);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const team = typeof body.team === "string" ? body.team.trim() : "";
    const url = typeof body.url === "string" ? body.url.trim() : "";

    if (!team) {
      return NextResponse.json({ error: "Équipe manquante." }, { status: 400 });
    }
    if (url && !/^https?:\/\/.+/i.test(url)) {
      return NextResponse.json(
        { error: "Lien invalide : il doit commencer par http:// ou https://" },
        { status: 400 }
      );
    }

    await initializeTeamLinksTable();
    await saveTeamLink(team, url);
    const links = await getTeamLinks();
    return NextResponse.json(links);
  } catch (error) {
    console.error("Erreur sauvegarde lien équipe:", error);
    return NextResponse.json({ error: "Erreur lors de l'enregistrement." }, { status: 500 });
  }
}
