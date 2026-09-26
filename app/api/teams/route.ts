// app/api/teams/route.ts
import { NextResponse } from "next/server";
import { getTeams } from "@/lib/utils";

export async function GET() {
  const teams = getTeams();
  return NextResponse.json(teams);
}
