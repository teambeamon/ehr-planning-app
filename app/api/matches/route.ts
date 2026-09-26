// app/api/matches/route.ts
import { NextResponse } from "next/server";
import { getFilteredMatches } from "@/lib/utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filters = {
    team: searchParams.get("team") || undefined,
    location: searchParams.get("location") || undefined,
    category: searchParams.get("category") || undefined,
    season: searchParams.get("season") || undefined,
  };

  const matches = getFilteredMatches(filters);
  return NextResponse.json(matches);
}
