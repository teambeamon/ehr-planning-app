// app/api/buvettes/authorizations/route.ts
import { NextResponse } from "next/server";
import {
  initializeBuvetteAuthTable,
  getBuvetteAuthorizations,
  setBuvetteAuthorization,
} from "@/lib/db-buvettes";

// Toujours frais : état partagé entre les utilisateurs
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await initializeBuvetteAuthTable();
    const authorizations = await getBuvetteAuthorizations();
    return NextResponse.json({ success: true, authorizations });
  } catch (error: any) {
    console.error("Erreur autorisations:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de la récupération des autorisations." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await initializeBuvetteAuthTable();
    const body = await request.json();
    const { date, location, done } = body;
    if (typeof date !== "string" || typeof location !== "string" || typeof done !== "boolean") {
      return NextResponse.json(
        { error: "Paramètres requis : date (string), location (string), done (boolean)." },
        { status: 400 }
      );
    }
    await setBuvetteAuthorization(date, location, done);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Erreur autorisations:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors de l'enregistrement." },
      { status: 500 }
    );
  }
}
