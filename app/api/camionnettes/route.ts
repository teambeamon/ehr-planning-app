// app/api/camionnettes/route.ts
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { join } from "path";

export async function GET() {
  try {
    const dataDir = join(process.cwd(), "data");
    const filePath = join(dataDir, "camionnette-reservations.json");
    
    try {
      const fileContents = await fs.readFile(filePath, "utf8");
      const reservations = JSON.parse(fileContents);
      return NextResponse.json(reservations);
    } catch (error) {
      // Si le fichier n'existe pas, retourner un objet vide
      return NextResponse.json({});
    }
  } catch (error) {
    console.error("Erreur lors de la lecture des réservations de camionnettes :", error);
    return NextResponse.json({ error: "Erreur lors de la lecture des données" }, { status: 500 });
  }
}
