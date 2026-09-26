// app/api/upload/route.ts
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { writeFile } from "fs/promises";
import { join } from "path";

function getLocationFromColumn(col: number): string {
  const offset = col - 5;
  const mod = offset % 3;
  if (mod === 0) return 'Hettange (Hall)';
  if (mod === 1) return 'Hettange (Poly)';
  return 'Rodemack';
}

function isNonMatchCell(str: string): boolean {
  if (!str) return true;
  const lower = str.toLowerCase().trim();
  const trimmed = str.trim();
  
  const nonMatchIndicators = [
    'journée', 'report', 'exempt',
    'hall non dispo', 'dispo', 'réservation',
    'n°', 'coach', 'date', 'salles', 'bad', 'non dispo',
    'réservation camionnettes', 'dispo salles',
    'match contre', 'uniquement', 'tournaments', 'tournoi',
    '(match', 'inversion', 'demande de report', 'refus',
    'a placer', 'retrait', 'de france', 'de moselle',
    'match', 'à placer'
  ];
  
  if (nonMatchIndicators.some(indicator => lower.includes(indicator))) {
    return true;
  }
  
  const exactMatches = ['match', 'match contre ?'];
  if (exactMatches.some(m => lower === m)) {
    return true;
  }
  
  if (lower === 'à' || lower === 'a') return true;
  if (/^\d+$/.test(trimmed)) return true;
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) return true;
  
  return false;
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
  }
  return dateStr;
}

function extractTime(cleaned: string): string | null {
  const timeMatch = cleaned.match(/à\s*(\d{1,2}[h:][0-9]{2})/i);
  return timeMatch ? timeMatch[1] : null;
}

function cleanCellStr(str: string): string {
  let cleaned = str.replace(/\r/g, '').replace(/\n/g, ' ').trim();
  cleaned = cleaned.replace(/\s+/g, ' ');
  return cleaned;
}

function cleanTeamName(name: string): string {
  if (!name) return name;
  let cleaned = name.trim();
  cleaned = cleaned.replace(/^\s*[-–]\s*/, '');
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/^\s*vs\s+/i, '').trim();
  cleaned = cleaned.replace(/\s+vs\s*$/i, '').trim();
  cleaned = cleaned.replace(/^\s*à\s+/i, '').trim();
  cleaned = cleaned.replace(/\s+à\s*$/i, '').trim();
  cleaned = cleaned.replace(/\s+\(\s*\)/g, '');
  return cleaned;
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
  let cleaned = cleanCellStr(cellStr);
  if (!cleaned || cleaned === '' || isNonMatchCell(cleaned)) return null;
  
  const time = extractTime(cleaned);
  if (time) {
    cleaned = cleaned.replace(/à\s*\d{1,2}[h:][0-9]{2}/i, '').trim();
  } else {
    cleaned = cleaned.replace(/\s*à\s*/gi, ' ').trim();
  }
  cleaned = cleanCellStr(cleaned);
  
  let matchType = 'Championnat';
  const lowerCleaned = cleaned.toLowerCase();
  if (lowerCleaned.includes('amical')) {
    matchType = 'Amical'; cleaned = cleaned.replace(/amical/gi, '').trim();
  } else if (lowerCleaned.includes('tournoi')) {
    matchType = 'Tournoi'; cleaned = cleaned.replace(/tournoi/gi, '').trim();
  } else if (lowerCleaned.includes('coupe')) {
    matchType = 'Coupe'; cleaned = cleaned.replace(/coupe/gi, '').trim();
  }
  cleaned = cleanCellStr(cleaned);
  
  const isEHRTeam = (name: string) => {
    if (!name) return false;
    const upper = name.toUpperCase().trim();
    return upper === 'EHR' || upper === 'EHR 1' || upper === 'EHR 2' || /^EHR\s*\d*$/.test(upper);
  };
  
  let homeTeam: string | null = null, awayTeam: string | null = null;
  let isHome = false, isAway = false;
  
  if (cleaned.includes(' - ') || cleaned.includes(' vs ')) {
    const separator = cleaned.includes(' vs ') ? ' vs ' : ' - ';
    const parts = cleaned.split(separator).map(p => cleanCellStr(p));
    if (parts.length >= 2) {
      let team1 = cleanTeamName(parts[0]);
      let team2 = cleanTeamName(parts.slice(1).join(separator).trim());
      
      const t1IsEHR = isEHRTeam(team1);
      const t2IsEHR = isEHRTeam(team2);
      
      if (t1IsEHR && !t2IsEHR) { homeTeam = team || team1; awayTeam = team2; isHome = true; }
      else if (t2IsEHR && !t1IsEHR) { homeTeam = team1; awayTeam = team || team2; isAway = true; }
      else if (t1IsEHR && t2IsEHR) { homeTeam = team || team1; awayTeam = team2; isHome = true; isAway = true; }
      else { homeTeam = team1; awayTeam = team2; }
      
      const matchDisplay = `${homeTeam} vs ${awayTeam}`;
      const finalLocation = isHome ? location : "Extérieur";
      
      return { date, day, home_team: homeTeam, away_team: awayTeam, match_display: matchDisplay, time, location: finalLocation,
               match_type: matchType, category: category || team, coach,
               is_home: isHome, is_away: isAway, is_internal: false, original_team: team };
    }
  }
  
  const ehrPattern = /\bEHR\s*\d*\b/i;
  const ehrExactMatch = cleaned.match(ehrPattern);
  if (ehrExactMatch) {
    if (isNonMatchCell(cleaned)) return null;
    const ehrMatch = cleaned.match(/(EHR\s*\d*)/i);
    if (ehrMatch) {
      const homeTeam = team || ehrMatch[1];
      const matchDisplay = homeTeam;
      return { date, day, home_team: homeTeam, away_team: null, match_display: matchDisplay, time, location,
               match_type: matchType, category: category || team, coach,
               is_home: true, is_away: false, is_internal: false, original_team: team };
    }
  }
  
  if (team) {
    const cleanedOpponent = cleanTeamName(cleaned);
    if (cleanedOpponent.length < 2) return null;
    if (isNonMatchCell(cleanedOpponent)) return null;
    
    const teamIsEHR = isEHRTeam(team);
    
    if (teamIsEHR) {
      const matchDisplay = `${team} vs ${cleanedOpponent}`;
      return { date, day, home_team: team, away_team: cleanedOpponent, match_display: matchDisplay, time, location,
               match_type: matchType, category: category || team, coach,
               is_home: true, is_away: false, is_internal: false, original_team: team };
    } else {
      if (/^\d+$/.test(cleanedOpponent.trim())) return null;
      const matchDisplay = `${cleanedOpponent} vs ${team}`;
      return { date, day, home_team: cleanedOpponent, away_team: team, match_display: matchDisplay, time, location: "Extérieur",
               match_type: matchType, category: category || team, coach,
               is_home: false, is_away: true, is_internal: false, original_team: team };
    }
  }
  
  return null;
}

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

    // Extraire les métadonnées
    const lastUpdated = jsonData[0]?.[0]?.toString().replace('MAJ le ', '')?.trim() || null;
    const season = jsonData[0]?.[5]?.toString().trim() || 'SAISON 2026-2027';

    const teamsRow = jsonData[11] || [];
    const categoriesRow = jsonData[12] || [];
    const coachesRow = jsonData[13] || [];

    const teamMap = new Map<number, string>();
    const categoryMap = new Map<number, string>();
    const coachMap = new Map<number, string>();

    for (let col = 5; col < Math.max(teamsRow.length, categoriesRow.length, coachesRow.length); col++) {
      if (teamsRow[col]) {
        let teamName = String(teamsRow[col]).trim().replace(/^\s*[-–]\s*/, '').replace(/\s+/g, ' ').trim();
        teamMap.set(col, teamName);
      }
      if (categoriesRow[col]) {
        let cat = String(categoriesRow[col]).trim().replace(/\r/g, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        categoryMap.set(col, cat);
      }
      if (coachesRow[col]) {
        coachMap.set(col, String(coachesRow[col]).trim());
      }
    }

    const matches: any[] = [];
    let currentDate: string | null = null, currentDay: string | null = null;

    for (let row = 14; row < jsonData.length; row++) {
      const rowData = jsonData[row] || [];

      let camionnette: string | null = null;
      for (const colIdx of [2, 3]) {
        const val = rowData[colIdx] ? String(rowData[colIdx]).trim() : null;
        if (val && !['Dispo Salles', 'Réservation camionnettes', 'N° 1', 'N° 2', 'Coach', 'Réservation camionnette'].includes(val)) {
          camionnette = val; break;
        }
      }

      let date: string | null = null, day: string | null = null;
      const dateCell = rowData[4];
      if (dateCell && String(dateCell).trim().includes('/')) {
        const dateStr = String(dateCell).trim();
        const [datePart, dayPart] = dateStr.split('\n');
        date = datePart?.trim() || null; day = dayPart?.trim() || null;
        currentDate = date; currentDay = day;
      }
      if (!date) { date = currentDate; day = currentDay; }
      if (!date) continue;

      const formattedDate = formatDate(date);
      for (let col = 5; col < rowData.length; col++) {
        const cellValue = rowData[col];
        if (!cellValue || String(cellValue).trim() === '') continue;
        const cellStr = String(cellValue).trim();
        if (isNonMatchCell(cellStr)) continue;
        
        let cellLocation = getLocationFromColumn(col);
        if (cellStr.toLowerCase().includes('kanfen')) {
          cellLocation = 'Kanfen';
        }
        
        const team = teamMap.get(col) || null;
        const category = categoryMap.get(col) || null;
        const coach = coachMap.get(col) || null;
        const matchInfo = parseMatchCell(cellStr, formattedDate, day, cellLocation, team, category, coach);
        if (matchInfo) {
          matchInfo.camionnette = camionnette;
          matchInfo.original_column = col;
          matchInfo.season = season;
          matchInfo.last_updated = lastUpdated;
          matches.push(matchInfo);
        }
      }
    }

    // Write data to JSON file
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
