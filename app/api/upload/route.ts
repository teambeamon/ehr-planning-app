// app/api/upload/route.ts
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { saveAllMatches, initializeMatchesTable } from "@/lib/db-matches";

// Mapping couleur RGB -> Salle
const COLOR_TO_LOCATION: Record<string, string> = {
  'FFFF00': 'Rodemack',
  '00CCFF': 'Hettange (Hall)',
  '00B0F0': 'Hettange (Hall)',
  '99CC00': 'Hettange (Poly)',
  '92D050': 'Hettange (Poly)',
  'FFCC00': 'Kanfen',
  'FFC000': 'Kanfen',
  'FF0000': 'Extérieur',
  'FFFFFF': 'Extérieur',
  'none': 'Extérieur'
};

// Normalisation des noms d'équipes
function normalizeTeamName(name: string): string {
  if (!name) return '';
  let cleaned = String(name)
    .replace(/\r/g, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  cleaned = cleaned.replace(/^[\s-]*/, '').trim();
  cleaned = cleaned.replace(/\s*\([^)]*\)/g, '').trim();
  cleaned = cleaned
    .replace(/EHR\s*[-vs]?\s*/gi, '')
    .replace(/HR\s*[-vs]?\s*/gi, '')
    .replace(/^17 ans F.*/i, 'F17')
    .replace(/^17 ans [MG].*/i, 'M17')
    .replace(/^15 ans F.*/i, 'F15')
    .replace(/^15 ans [MG].*/i, 'M15')
    .replace(/^13 ans F.*/i, 'F13')
    .replace(/^13 ans [MG].*/i, 'M13')
    .replace(/^11 ans F.*/i, 'F11')
    .replace(/^11 ans [MG].*/i, 'M11')
    .replace(/^18 ans F.*/i, 'F18')
    .replace(/^18 ans [MG].*/i, 'M18')
    .replace(/Seniors Filles\s*1/i, 'Seniors F1')
    .replace(/Seniors Filles\s*2/i, 'Seniors F2')
    .replace(/Seniors HR/i, 'Seniors M')
    .replace(/SENIORS/i, 'Seniors M')
    .replace(/Féminines/i, 'F')
    .replace(/Masculins?/i, 'M')
    .replace(/Garçons?/i, 'M')
    .replace(/EHR/i, '')
    .replace(/HR/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  const mapping: Record<string, string> = {
    'SM': 'Seniors M',
    'SF1': 'Seniors F1', 'Seniors F1': 'Seniors F1',
    'SF2': 'Seniors F2', 'Seniors F2': 'Seniors F2',
    'M18': 'M18', 'F18': 'F18',
    'M17': 'M17', 'F17': 'F17', 'M15': 'M15', 'F15': 'F15',
    'M13': 'M13', 'F13': 'F13', 'M11': 'M11', 'F11': 'F11'
  };
  return mapping[cleaned] || cleaned;
}

function getCategoryFromText(text: string): string {
  if (!text) return '';
  const cleaned = String(text).replace(/\r/g, '').replace(/\n/g, ' ').trim();
  if (cleaned.includes('CDF')) return 'CDF';
  if (cleaned.includes('Région')) return 'Régional';
  if (cleaned.includes('Dépt') || cleaned.includes('Départementale')) return 'Départemental';
  if (cleaned.includes('InterDépt') || cleaned.includes('Interdépartemental')) return 'Interdépartemental';
  if (cleaned.includes('Excellence')) return 'Excellence';
  return cleaned.substring(0, 50);
}

const EHR_TEAMS = new Set<string>([
  'Seniors M', 'Seniors F1', 'Seniors F2',
  'M18', 'F18', 'M17', 'F17', 'M15', 'F15', 'M13', 'F13', 'M11', 'F11'
]);

function isEHRTeam(name: string): boolean {
  if (!name) return false;
  const cleaned = String(name).trim();
  if (EHR_TEAMS.has(cleaned)) return true;
  if (/\bEHR\b/i.test(cleaned)) return true;
  const normalized = normalizeTeamName(cleaned);
  return EHR_TEAMS.has(normalized);
}

function cleanText(str: string): string {
  if (!str) return '';
  return String(str).replace(/\r/g, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatDate(dateStr: string): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return null;
}

function extractTime(str: string): string | null {
  if (!str) return null;
  const match = String(str).match(/(\d{1,2})[h:](\d{2})/i);
  return match ? `${match[1]}:${match[2]}` : null;
}

function getCellColor(sheet: XLSX.WorkSheet, row: number, col: number): string {
  const cellRef = XLSX.utils.encode_cell({r: row, c: col});
  const cell = sheet[cellRef] as XLSX.CellObject | undefined;
  if (cell && cell.s && cell.s.fgColor && (cell.s.fgColor as any).rgb) {
    return (cell.s.fgColor as any).rgb.replace('#', '').toUpperCase();
  }
  return 'FFFFFF';
}

function isNonMatchCell(str: string): boolean {
  if (!str || String(str).trim() === '') return true;
  const lower = String(str).toLowerCase().trim();
  const exclude = ['journée', 'report', 'exempt', 'dispo', 'réservation', 'coach', 'date', 'salles',
    'n°', 'bad', 'non dispo', 'match contre', 'uniquement', 'tournoi', 'inversion',
    'demande de report', 'refus', 'à placer', 'retrait', 'bloquée', 'skate',
    'camionnette', 'disponible', 'libre', 'à planifier', 'date bloquée', 'amical',
    'forfait', 'poly non dispo', 'hall et poly non dispo', 'hall non dispo',
    'fch vide', 'festiva', 'basket', 'volley'];
  if (exclude.some(kw => lower.includes(kw))) return true;
  if (lower === 'à' || lower === 'vs' || lower === 'match') return true;
  if (/^\d+$/.test(lower)) return true;
  return false;
}

function parseMatchText(text: string): {home: string | null; away: string | null; time: string | null} {
  let cleaned = cleanText(text);
  const timeMatch = cleaned.match(/(\d{1,2})[h:](\d{2})/i);
  let time: string | null = null;
  if (timeMatch) {
    time = `${timeMatch[1]}:${timeMatch[2]}`;
    cleaned = cleaned.replace(/\s*[à a]\s*\d{1,2}[h:]*\d{2}/i, '').trim();
  }
  const separators = [/\s*vs\s*/i, /\s*-\s*/];
  let home: string | null = null;
  let away: string | null = null;
  for (const sep of separators) {
    const parts = cleaned.split(sep);
    if (parts.length === 2) {
      home = normalizeTeamName(parts[0].trim());
      away = normalizeTeamName(parts[1].trim());
      break;
    } else if (parts.length > 2) {
      const ehrIndex = parts.findIndex(p => /EHR/i.test(p) || isEHRTeam(p));
      if (ehrIndex >= 0) {
        if (ehrIndex === 0) {
          home = normalizeTeamName(parts[0].trim());
          away = normalizeTeamName(parts.slice(1).join(' ').trim());
        } else {
          home = normalizeTeamName(parts.slice(0, ehrIndex).join(' ').trim());
          away = normalizeTeamName(parts.slice(ehrIndex).join(' ').trim());
        }
        break;
      }
    }
  }
  if (!home && !away) {
    home = normalizeTeamName(cleaned);
  }
  return { home, away, time };
}

interface ColumnInfo {
  team: string;
  category: string;
  location: string;
  coach: string;
}

async function parseExcelFile(buffer: Buffer): Promise<any[]> {
  const workbook = XLSX.read(buffer, { cellStyles: true, type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

  const lastUpdatedRaw = data[0]?.[0];
  const lastUpdated = lastUpdatedRaw ? String(lastUpdatedRaw).replace('MAJ le ', '').trim() : null;
  const season = data[0]?.[5]?.toString().trim() || '2025-2026';

  // Déterminer la colonne de date
  let dateCol = 5;
  for (let c = 0; c < 10; c++) {
    const header = String(data[8]?.[c] || '').toLowerCase();
    if (header.includes('date')) {
      dateCol = c;
      break;
    }
  }
  
  // Lire les salles des colonnes (lignes 8-10)
  const headerRows = {
    hall: data[8] || [],
    poly: data[9] || [],
    rodemack: data[10] || []
  };
  
  const columns: Map<number, ColumnInfo> = new Map();
  const teamsRow = data[11] || [];
  const categoryRow = data[12] || [];
  const coachRow = data[13] || [];
  
  for (let col = dateCol + 1; col < Math.min(teamsRow.length, dateCol + 20); col++) {
    const rawTeam = String(teamsRow[col] || '');
    const team = normalizeTeamName(rawTeam);
    const category = getCategoryFromText(String(categoryRow[col] || ''));
    const coach = cleanText(String(coachRow[col] || ''));
    
    let location = 'Extérieur';
    const hallVal = headerRows.hall[col];
    const polyVal = headerRows.poly[col];
    const rodemackVal = headerRows.rodemack[col];
    if (hallVal && String(hallVal).trim()) {
      location = 'Hettange (Hall)';
    } else if (polyVal && String(polyVal).trim()) {
      location = 'Hettange (Poly)';
    } else if (rodemackVal && String(rodemackVal).trim()) {
      location = 'Rodemack';
    }
    
    if (team && !team.startsWith('-')) {
      columns.set(col, { team, category, location, coach });
    }
  }

  const matches: any[] = [];

  for (let rowIdx = 14; rowIdx < data.length; rowIdx++) {
    const dateCell = data[rowIdx]?.[dateCol];
    if (!dateCell || !String(dateCell).trim().includes('/')) continue;

    const dateStr = String(dateCell).trim();
    const [datePart, dayPart] = dateStr.split('\n');
    const formattedDate = formatDate(datePart?.trim() || '');
    const dayName = dayPart?.trim() || null;
    if (!formattedDate) continue;

    // Lire les camionnettes (colonnes 2 et 3)
    let dateCamionnette: string | null = null;
    for (let r = rowIdx; r <= rowIdx + 2 && r < data.length; r++) {
      const cC = cleanText(String(data[r]?.[2] || ''));
      const cD = cleanText(String(data[r]?.[3] || ''));
      if (cC && /camionnette/i.test(cC.toLowerCase())) {
        const team = normalizeTeamName(cC.replace(/camionnette/gi, '').trim());
        if (team && EHR_TEAMS.has(team)) {
          dateCamionnette = team;
          break;
        }
      }
      if (cD && /camionnette/i.test(cD.toLowerCase())) {
        const team = normalizeTeamName(cD.replace(/camionnette/gi, '').trim());
        if (team && EHR_TEAMS.has(team)) {
          dateCamionnette = team;
          break;
        }
      }
    }

    for (const [col, colInfo] of Array.from(columns.entries())) {
      let matchText = '';
      let locationColor = 'FFFFFF';

      for (let offset = 0; offset < 3; offset++) {
        const checkRow = rowIdx + offset;
        if (checkRow >= data.length) continue;
        const cellValue = data[checkRow]?.[col];
        if (!cellValue) continue;
        const cellStr = String(cellValue).trim();
        if (!isNonMatchCell(cellStr)) {
          if (!matchText) matchText = cellStr;
          const color = getCellColor(sheet, checkRow, col);
          if (color !== 'FFFFFF' && color !== 'none') {
            locationColor = color;
          }
        }
      }

      if (!matchText) continue;

      let finalLocation = COLOR_TO_LOCATION[locationColor] || colInfo.location;
      if (finalLocation === 'Extérieur' && colInfo.location !== 'Extérieur') {
        finalLocation = colInfo.location;
      }

      const parsed = parseMatchText(matchText);
      let homeTeam = parsed.home;
      let awayTeam = parsed.away;
      const time = parsed.time || extractTime(matchText);

      if (!homeTeam && !awayTeam) {
        homeTeam = colInfo.team;
      }
      
      if (!homeTeam) continue;
      
      let isHome = false;
      let isAway = false;
      
      if (homeTeam && awayTeam) {
        const homeIsEHR = isEHRTeam(homeTeam);
        const awayIsEHR = isEHRTeam(awayTeam);
        
        if (homeIsEHR && !awayIsEHR) {
          isHome = true;
          isAway = false;
          if (finalLocation === 'Extérieur') {
            finalLocation = colInfo.location !== 'Extérieur' ? colInfo.location : 'Extérieur';
          }
        } else if (!homeIsEHR && awayIsEHR) {
          isHome = false;
          isAway = true;
          finalLocation = 'Extérieur';
        } else if (homeIsEHR && awayIsEHR) {
          isHome = true;
          isAway = false;
          finalLocation = colInfo.location !== 'Extérieur' ? colInfo.location : 'Rodemack';
        } else {
          isHome = finalLocation !== 'Extérieur';
          isAway = finalLocation === 'Extérieur';
        }
      } else {
        if (isEHRTeam(homeTeam)) {
          isHome = finalLocation !== 'Extérieur';
          isAway = finalLocation === 'Extérieur';
        } else {
          continue;
        }
      }

      if (homeTeam && isEHRTeam(homeTeam)) {
        homeTeam = normalizeTeamName(homeTeam);
      }
      if (awayTeam && isEHRTeam(awayTeam)) {
        awayTeam = normalizeTeamName(awayTeam);
      }

      matches.push({
        date: formattedDate,
        day: dayName,
        home_team: homeTeam,
        away_team: awayTeam,
        time: time,
        location: finalLocation,
        match_type: 'Championnat',
        category: colInfo.category || colInfo.team,
        coach: colInfo.coach,
        is_home: isHome,
        is_away: isAway,
        is_internal: isHome && awayTeam && isEHRTeam(homeTeam) && isEHRTeam(awayTeam),
        season: season,
        last_updated: lastUpdated,
        camionnette: (isHome && !isAway && dateCamionnette && dateCamionnette === homeTeam) ? dateCamionnette : null
      });
    }
  }

  const seen = new Set();
  const uniqueMatches = matches.filter(m => {
    const key = `${m.date}-${m.home_team}-${m.away_team}-${m.time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniqueMatches;
}

export async function POST(request: Request) {
  try {
    await initializeMatchesTable();
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const matches = await parseExcelFile(buffer);

    await saveAllMatches(matches);

    return NextResponse.json({ 
      success: true, 
      message: `Fichier traité avec succès! ${matches.length} matchs enregistrés dans la base de données.`,
      matchesCount: matches.length,
      matches: matches,
    });

  } catch (error: any) {
    console.error("Erreur:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors du traitement du fichier." },
      { status: 500 }
    );
  }
}
