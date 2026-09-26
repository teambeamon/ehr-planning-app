// app/api/locations/route.ts
import { NextResponse } from "next/server";
import { getLocations } from "@/lib/utils";

export async function GET() {
  const locations = getLocations();
  return NextResponse.json(locations);
}
