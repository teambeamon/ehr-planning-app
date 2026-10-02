// app/api/teams/route.ts
import { NextResponse } from "next/server";
import { getTeams } from "@/lib/utils";

export async function GET() {
  const teams = await getTeams();
  return NextResponse.json(teams);
}
