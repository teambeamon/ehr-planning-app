// app/api/teams/route.ts
import { NextResponse } from "next/server";
import { getTeams } from "@/lib/utils";

// Toujours frais : ces routes alimentent les filtres de la page matchs
export const dynamic = "force-dynamic";

export async function GET() {
  const teams = await getTeams();
  return NextResponse.json(teams);
}
