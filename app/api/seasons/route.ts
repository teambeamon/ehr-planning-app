// app/api/seasons/route.ts
import { NextResponse } from "next/server";
import { getSeasons } from "@/lib/utils";

export async function GET() {
  const seasons = await getSeasons();
  return NextResponse.json(seasons);
}
