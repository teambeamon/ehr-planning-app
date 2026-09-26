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
    'a placer', 'retrait', 'de france', 'de moselle'
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

function getLocationFromOffset(offset: number): string {
  const mod = offset % 3;
  if (mod === 0) return 'Hettange (Hall)';
  if (mod === 1) return 'Hettange (Poly)';
  return 'Rodemack';
}

function extractTime(cleaned: string): string | null {
  const timeMatch = cleaned.match(/à\s*(\d{1,2}[h:]\d{2})/i);
  return timeMatch ? timeMatch[1] : null;
}

function cleanCellStr(str: string): string {
  return str.replace(/\r/g, '').replace(/\n/g, ' ').trim().replace(/\s+/g, ' ');
}

function cleanTeamName(name: string): string {
  if (!name) return name;
  let cleaned = name.trim().replace(/^\s*[-–]\s*/, '').replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/^\s*vs\s+/i, '').trim();
  cleaned = cleaned.replace(/\s+vs\s*$/i, '').trim();
  cleaned = cleaned.replace(/^\s*à\s+/i, '').trim();
  cleaned = cleaned.replace(/\s+à\s*$/i, '').trim();
  return cleaned.replace(/\s+\(\s*\)/g, '');
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
    cleaned = cleaned.replace(/à\s*\d{1,2}[h:]\d{2}/i, '').trim();
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
  
  if (cleaned.includes(' et ') || (cleaned.includes(',') && cleaned.includes('EHR'))) {
    return null;
  }
  
  let homeTeam: string | null = null, awayTeam: string | null = null;
  let isHome = false, isAway = false, isInternal = false;
  
  if (cleaned.includes(' - ') || cleaned.includes(' vs ')) {
    const separator = cleaned.includes(' vs ') ? ' vs ' : ' - ';
    const parts = cleaned.split(separator).map(p => cleanCellStr(p));
    if (parts.length >= 2) {
      const t1 = cleanTeamName(parts[0]);
      const t2 = cleanTeamName(parts.slice(1).join(separator).trim());
      const t1IsEHR = t1.toUpperCase().includes('EHR');
      const t2IsEHR = t2.toUpperCase().includes('EHR');
      
      if (t1IsEHR && !t2IsEHR) { homeTeam = t1; awayTeam = t2; isHome = true; }
      else if (t2IsEHR && !t1IsEHR) { homeTeam = t2; awayTeam = t1; isAway = true; }
      else if (t1IsEHR && t2IsEHR) { homeTeam = t1; awayTeam = t2; isHome = true; isAway = true; isInternal = true; }
      else { homeTeam = t1; awayTeam = t2; }
      
      return { date, day, home_team: homeTeam, away_team: awayTeam, time, location,
               match_type: matchType, category: category || team, coach,
               is_home: isHome, is_away: isAway, is_internal: isInternal, original_team: team };
    }
  }
  
  if (cleaned.toUpperCase().includes('EHR')) {
    if (isNonMatchCell(cleaned)) return null;
    const ehrMatch = cleaned.match(/(EHR\s*\d*)/i);
    if (ehrMatch) {
      return { date, day, home_team: ehrMatch[1], away_team: null, time, location,
               match_type: matchType, category: category || team, coach,
               is_home: true, is_away: false, is_internal: false, original_team: team };
    }
  }
  
  if (team) {
    const cleanedOpponent = cleanTeamName(cleaned);
    const teamIsEHR = team.toUpperCase().includes('EHR');
    
    // Validation supplémentaire : si le nom de l'adversaire est trop court ou suspect, ignorer
    if (cleanedOpponent.length < 2) return null;
    if (isNonMatchCell(cleanedOpponent)) return null;
    
    if (teamIsEHR) {
      return { date, day, home_team: team, away_team: cleanedOpponent, time, location,
               match_type: matchType, category: category || team, coach,
               is_home: true, is_away: false, is_internal: false, original_team: team };
    } else {
      if (/^\d+$/.test(cleanedOpponent.trim())) return null;
      return { date, day, home_team: cleanedOpponent, away_team: team, time, location,
               match_type: matchType, category: category || team, coach,
               is_home: false, is_away: true, is_internal: false, original_team: team };
    }
  }
  return null;
}

function parseExcelData(data: any[][]): any[] {
  const matches: any[] = [];
  const lastUpdated = data[0]?.[0]?.toString().replace('MAJ le ', '')?.trim() || null;
  const season = data[0]?.[5]?.toString().trim() || 'SAISON 2026-2027';

  const teamsRow = data[11] || [];
  const categoriesRow = data[12] || [];
  const coachesRow = data[13] || [];

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

  let currentDate: string | null = null, currentDay: string | null = null;
  
  for (let row = 14; row < data.length; row++) {
    const rowData = data[row] || [];
    const offset = row - 14;
    const location = getLocationFromOffset(offset);
    
    let camionnette: string | null = null;
    for (const colIdx of [2, 3]) {
      const val = rowData[colIdx] ? String(rowData[colIdx]).trim() : null;
      if (val && !['Dispo Salles', 'Réservation camionnettes', 'N° 1', 'N° 2', 'Coach'].includes(val)) {
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
      
      const team = teamMap.get(col) || null;
      const category = categoryMap.get(col) || null;
      const coach = coachMap.get(col) || null;
      const matchInfo = parseMatchCell(cellStr, formattedDate, day, location, team, category, coach);
      if (matchInfo) {
        matchInfo.camionnette = camionnette;
        matchInfo.original_column = col;
        matchInfo.season = season;
        matchInfo.last_updated = lastUpdated;
        matches.push(matchInfo);
      }
    }
  }
  return matches;
}
