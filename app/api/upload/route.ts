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
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as unknown[][];

    const matches = parseExcelData(jsonData);

    // Écrire les données dans un fichier JSON
    const dataDir = join(process.cwd(), "data");
    const filePath = join(dataDir, "matches.json");
    await writeFile(filePath, JSON.stringify(matches, null, 2));

    return NextResponse.json({ 
      success: true, 
      message: "Fichier traité avec succès.",
      matchesCount: matches.length
    });
  } catch (error) {
    console.error("Erreur lors du traitement du fichier :", error);
    return NextResponse.json(
      { error: "Erreur lors du traitement du fichier." },
      { status: 500 }
    );
  }
}

function isNonMatchCell(str: string): boolean {
  if (!str) return true;
  
  const lower = str.toLowerCase();
  const nonMatchIndicators = [
    'match ', 'tournoi', 'coupe', 'amical',
    'journée', 'report', 'hall non dispo', 'dispo',
    'réservation', 'n°', 'coach', 'date', 'salles',
    'bad', 'non dispo', 'vs p2h', 'et ', ' , '
  ];
  
  return nonMatchIndicators.some(indicator => lower.includes(indicator)) ||
         str === 'JOURNÉE' || str === 'Report' || str === 'Hall Non Dispo' ||
         str === 'Bad' || str === 'Non dispo' ||
         lower.includes('dispo') || lower.includes('réservation') ||
         lower.includes('n°') || lower.includes('coach') ||
         lower.includes('salles') ||
         (str.includes('vs') && str.includes(',')) || // Plusieurs matchs
         (str.includes('et') && str.includes('h')); // Plusieurs horaires
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

function getLocationFromOffset(offset: number): string {
  const mod = offset % 3;
  if (mod === 0) return 'Hettange (Hall)';
  if (mod === 1) return 'Hettange (Poly)';
  return 'Rodemack';
}

function parseMatchCell(
  cellStr: string,
  date: string | null,
  day: string | null,
  location: string,
  team: string | null,
  category: string | null,
  coach: string | null
): any {
  let cleaned = cellStr.replace(/\r/g, '').replace(/\n/g, ' ').trim();
  
  if (!cleaned || cleaned === '' || isNonMatchCell(cleaned)) {
    return null;
  }

  let homeTeam: string | null = null;
  let awayTeam: string | null = null;
  let time: string | null = null;
  let matchType = 'Championnat';
  
  // Extract time
  const timeMatch = cleaned.match(/à\s*(\d{1,2}h\d{2})/i);
  if (timeMatch) {
    time = timeMatch[1];
    cleaned = cleaned.replace(/à\s*\d{1,2}h\d{2}/i, '').trim();
  }
  
  // Detect match type
  if (cleaned.toLowerCase().includes('amical')) {
    matchType = 'Amical';
    cleaned = cleaned.replace(/amical/gi, '').trim();
  } else if (cleaned.toLowerCase().includes('tournoi')) {
    matchType = 'Tournoi';
    cleaned = cleaned.replace(/tournoi/gi, '').trim();
  } else if (cleaned.toLowerCase().includes('coupe')) {
    matchType = 'Coupe';
    cleaned = cleaned.replace(/coupe/gi, '').trim();
  }
  
  cleaned = cleaned.trim();
  
  // Détecter les équipes
  if (cleaned.includes(' - ')) {
    const parts = cleaned.split(' - ').map(p => p.trim());
    
    if (parts.length >= 2) {
      const team1 = parts[0];
      const team2 = parts.slice(1).join(' - ');
      
      const isHome = team1.toUpperCase().includes('EHR');
      const isAway = team2.toUpperCase().includes('EHR');
      const isInternal = isHome && isAway;
      
      if (isHome && !isAway) {
        homeTeam = team1;
        awayTeam = team2;
      } else if (isAway && !isHome) {
        homeTeam = team2;
        awayTeam = team1;
      } else if (isInternal) {
        homeTeam = team1;
        awayTeam = team2;
      } else {
        homeTeam = team1;
        awayTeam = team2;
      }
      
      return {
        date,
        day,
        home_team: homeTeam,
        away_team: awayTeam,
        time,
        location,
        match_type: matchType,
        category,
        coach,
        is_home: isHome,
        is_away: isAway,
        is_internal: isInternal,
        original_team: team,
        camionnette: null,
        season: '2026-2027',
        last_updated: null
      };
    }
  }
  
  // Si pas de " - ", mais que c'est un nom d'adversaire
  if (cleaned && !isNonMatchCell(cleaned)) {
    const isHome = team && team.toUpperCase().includes('EHR');
    const isAway = false;
    const isInternal = false;
    
    return {
      date,
      day,
      home_team: team || 'EHR',
      away_team: cleaned,
      time,
      location,
      match_type: matchType,
      category,
      coach,
      is_home: isHome,
      is_away: isAway,
      is_internal: isInternal,
      original_team: team,
      camionnette: null,
      season: '2026-2027',
      last_updated: null
    };
  }
  
  return null;
}

function parseExcelData(data: any[][]): any[] {
  const matches: any[] = [];
  
  // Extraire les métadonnées
  const lastUpdated = data[0]?.[0]?.toString().replace('MAJ le ', '')?.trim() || null;
  
  // Lignes d'en-tête (11 = équipes, 12 = catégories, 13 = coachs)
  const teamsRow = data[11] || [];
  const categoriesRow = data[12] || [];
  const coachesRow = data[13] || [];

  // Mapping colonne -> équipe, catégorie, coach
  const teamMap = new Map<number, string>();
  const categoryMap = new Map<number, string>();
  const coachMap = new Map<number, string>();

  for (let col = 5; col < Math.max(teamsRow.length, categoriesRow.length, coachesRow.length); col++) {
    if (teamsRow[col]) {
      teamMap.set(col, String(teamsRow[col]).trim());
    }
    if (categoriesRow[col]) {
      const cat = String(categoriesRow[col]).trim().replace(/\r/g, '').replace(/\n/g, ' ');
      categoryMap.set(col, cat);
    }
    if (coachesRow[col]) {
      coachMap.set(col, String(coachesRow[col]).trim());
    }
  }

  // Parser les matchs
  let currentDate: string | null = null;
  let currentDay: string | null = null;
  
  for (let row = 14; row < data.length; row++) {
    const rowData = data[row] || [];
    
    // Déterminer la salle par (row - 14) % 3
    const offset = row - 14;
    const location = getLocationFromOffset(offset);
    
    // Vérifier les camionnettes (colonnes 2 et 3)
    let camionnette: string | null = null;
    if (rowData[2]) {
      const val = String(rowData[2]).trim();
      if (val && val !== 'Dispo Salles' && val !== 'Réservation camionnettes' && val !== 'N° 1' && val !== 'N° 2') {
        camionnette = val;
      }
    }
    if (rowData[3] && !camionnette) {
      const val = String(rowData[3]).trim();
      if (val && val !== 'Dispo Salles' && val !== 'Réservation camionnettes' && val !== 'N° 1' && val !== 'N° 2') {
        camionnette = val;
      }
    }
    
    // Lire la date depuis la colonne 4
    let date: string | null = null;
    let day: string | null = null;
    const dateCell = rowData[4];
    if (dateCell && String(dateCell).trim().includes('/')) {
      const dateStr = String(dateCell).trim();
      const [datePart, dayPart] = dateStr.split('\n');
      date = datePart ? datePart.trim() : null;
      day = dayPart ? dayPart.trim() : null;
      currentDate = date;
      currentDay = day;
    }
    
    // Si pas de date dans la colonne 4, utiliser la date courante
    if (!date && currentDate) {
      date = currentDate;
      day = currentDay;
    }
    
    // Si on a une date, parser les matchs dans les colonnes 5+
    if (date) {
      const formattedDate = formatDate(date);
      
      for (let col = 5; col < rowData.length; col++) {
        const cellValue = rowData[col];
        if (!cellValue || String(cellValue).trim() === '') {
          continue;
        }
        
        const cellStr = String(cellValue).trim();
        
        // Skip non-match cells
        if (isNonMatchCell(cellStr)) {
          continue;
        }
        
        const team = teamMap.get(col) || null;
        const category = categoryMap.get(col) || null;
        const coach = coachMap.get(col) || null;
        
        const matchInfo = parseMatchCell(cellStr, formattedDate, day, location, team, category, coach);
        
        if (matchInfo) {
          matchInfo.camionnette = camionnette;
          matchInfo.original_column = col;
          matches.push(matchInfo);
        }
      }
    }
  }

  // Ajouter la date de dernière mise à jour
  matches.forEach(match => {
    match.last_updated = lastUpdated;
  });

  return matches;
}
