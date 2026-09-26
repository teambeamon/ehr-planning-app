// app/api/stats/route.ts
import { NextResponse } from "next/server";
import matchesData from "@/data/matches.json";
import { Match, getStats } from "@/lib/utils";

export async function GET() {
  try {
    const stats = getStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques :", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des statistiques." },
      { status: 500 }
    );
  }
}
