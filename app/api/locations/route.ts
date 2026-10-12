// app/api/locations/route.ts
import { NextResponse } from "next/server";
import { getLocations } from "@/lib/utils";

// Toujours frais : ces routes alimentent les filtres de la page matchs
export const dynamic = "force-dynamic";

export async function GET() {
  const locations = await getLocations();
  return NextResponse.json(locations);
}
