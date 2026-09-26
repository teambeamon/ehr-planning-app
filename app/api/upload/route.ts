// app/api/upload/route.ts
import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
    }

    // Sauvegarder le fichier temporairement
    const tempDir = join(process.cwd(), "temp");
    await mkdir(tempDir, { recursive: true });
    const tempFilePath = join(tempDir, `upload_${Date.now()}.xlsx`);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(tempFilePath, buffer);

    // Exécuter le script de parsing
    const scriptPath = join(process.cwd(), "scripts", "parse-excel.js");
    const { stdout, stderr } = await execAsync(
      `node ${scriptPath} ${tempFilePath} ${join(process.cwd(), "data", "matches.json")}`
    );

    if (stderr) {
      console.error("Erreur du script:", stderr);
      return NextResponse.json(
        { error: "Erreur lors du parsing du fichier." },
        { status: 500 }
      );
    }

    // Lire le nombre de matchs depuis la sortie
    const matchesCountMatch = stdout.match(/Found (\d+) matches/);
    const matchesCount = matchesCountMatch ? parseInt(matchesCountMatch[1]) : 0;

    return NextResponse.json({ 
      success: true, 
      message: "Fichier traité avec succès.",
      matchesCount
    });
  } catch (error) {
    console.error("Erreur lors du traitement du fichier :", error);
    return NextResponse.json(
      { error: "Erreur lors du traitement du fichier." },
      { status: 500 }
    );
  }
}
