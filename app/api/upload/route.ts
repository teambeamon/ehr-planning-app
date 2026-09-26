// app/api/upload/route.ts
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { writeFile } from "fs/promises";
import { join } from "path";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

    const matches = parseExcelData(jsonData);

    // Écrire les données dans un fichier JSON
    const dataDir = join(process.cwd(), "data");
    const filePath = join(dataDir, "matches.json");
    await writeFile(filePath, JSON.stringify(matches, null, 2));

    return NextResponse.json({ success: true, message: "Fichier traité avec succès." });
  } catch (error) {
    console.error("Erreur lors du traitement du fichier :", error);
    return NextResponse.json(
      { error: "Erreur lors du traitement du fichier." },
      { status: 500 }
    );
  }
}

function parseExcelData(data: any[][]): any[] {
  const matches: any[] = [];
  const headers = data[0];

  const dateIndex = headers.findIndex((h: any) => String(h).includes("Date") || String(h).includes("JOUR"));
  const homeTeamIndex = headers.findIndex((h: any) => String(h).includes("Équipe") || String(h).includes("EHR"));
  const awayTeamIndex = headers.findIndex((h: any) => String(h).includes("Adversaire") || String(h).includes("vs"));
  const timeIndex = headers.findIndex((h: any) => String(h).includes("Heure") || String(h).includes("à"));
  const locationIndex = headers.findIndex((h: any) => String(h).includes("Lieu") || String(h).includes("Salle"));
  const matchTypeIndex = headers.findIndex((h: any) => String(h).includes("Type") || String(h).includes("Match"));
  const categoryIndex = headers.findIndex((h: any) => String(h).includes("Catégorie") || String(h).includes("Âge"));
  const seasonIndex = headers.findIndex((h: any) => String(h).includes("Saison"));

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.every((cell) => !cell)) continue;

    const match: any = {
      date: row[dateIndex] ? String(row[dateIndex]).trim().split("\n")[0] : null,
      day: row[dateIndex] ? String(row[dateIndex]).trim().split("\n")[1]?.trim() : null,
      home_team: row[homeTeamIndex] ? String(row[homeTeamIndex]).trim() : null,
      away_team: row[awayTeamIndex] ? String(row[awayTeamIndex]).trim() : null,
      time: row[timeIndex] ? String(row[timeIndex]).trim().split("à")[1]?.trim() : null,
      location: row[locationIndex] ? String(row[locationIndex]).trim() : null,
      match_type: row[matchTypeIndex] ? String(row[matchTypeIndex]).trim() : "Championnat",
      category: row[categoryIndex] ? String(row[categoryIndex]).trim() : null,
      season: row[seasonIndex] ? String(row[seasonIndex]).trim() : "2026-2027",
    };

    if (match.date && match.home_team && match.location) {
      matches.push(match);
    }
  }

  return matches;
}
