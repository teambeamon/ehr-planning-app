// app/api/seasons/route.ts
import { NextResponse } from "next/server";
import { getSeasons } from "@/lib/utils";

// Toujours frais : ces routes alimentent les filtres de la page matchs
export const dynamic = "force-dynamic";

export async function GET() {
  const seasons = await getSeasons();
  return NextResponse.json(seasons);
}
