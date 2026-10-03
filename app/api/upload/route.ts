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
    .replace(/Seniors Filles\s*HR\s*1/i, 'Seniors F1')
    .replace(/Seniors Filles\s*1/i, 'Seniors F1')
    .replace(/Seniors Filles\s*HR\s*2/i, 'Seniors F2')
    .replace(/Seniors Filles\s*2/i, 'Seniors F2')
    .replace(/Seniors\s*HR/i, 'Seniors M')
    .replace(/Seniors\s*G/i, 'Seniors M')
    .replace(/^18 ans F.*/i, 'F18')
    .replace(/^18 ans [MG].*/i, 'M18')
    .replace(/^17 ans F.*/i, 'F17')
    .replace(/^17 ans [MG].*/i, 'M17')
    .replace(/^15 ans F.*/i, 'F15')
    .replace(/^15 ans [MG].*/i, 'M15')
    .replace(/^15 ans\s*/i, 'M15')
    .replace(/^13 ans F.*/i, 'F13')
    .replace(/^13 ans [MG].*/i, 'M13')
    .replace(/^13 ans\s*/i, 'M13')
    .replace(/^11 ans F.*/i, 'F11')
    .replace(/^11 ans [MG].*/i, 'M11')
    .replace(/^11 ans\s*/i, 'M11')
    .replace(/Féminines/i, 'F')
    .replace(/Féminine/i, 'F')
    .replace(/Masculins?/i, 'M')
    .replace(/Masculin/i, 'M')
    .replace(/Garçons?/i, 'M')
    .replace(/Garçon/i, 'M')
    .replace(/EHR/gi, '')
    .replace(/HR/gi, '')
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
  const result = mapping[cleaned] || cleaned;
  return result.replace(/\s+/g, ' ').trim();
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
    'n°', 'bad', 'non dispo', 'match contre', 'tournoi', 'inversion',
    'demande de report', 'refus', 'à placer', 'retrait', 'bloquée',
    'camionnette', 'disponible', 'libre', 'à planifier', 'date bloquée', 'amical',
    'forfait', 'poly non dispo', 'hall et poly non dispo', 'hall non dispo',
    'fch vide', 'festiva', 'basket', 'volley', 'match'];
  if (exclude.some(kw => lower.includes(kw))) return true;
  if (lower === 'à' || lower === 'vs') return true;
  if (/^\d+$/.test(lower)) return false; // NE PAS exclure les numéros (1, 2, 3)
  if (/^[\s-]+$/.test(lower)) return true;
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
  coach: string;
}

// Fonction principale de parsing
async function parseExcelFile(buffer: Buffer): Promise<any[]> {
  const workbook = XLSX.read(buffer, { cellStyles: true, type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

  // Lire les métadonnées
  const lastUpdatedRaw = data[0]?.[0];
  const lastUpdated = lastUpdatedRaw ? String(lastUpdatedRaw).replace('MAJ le ', '').trim() : null;
  const season = data[0]?.[5]?.toString().trim() || '2025-2026';

  // Colonne de date est la colonne 4 (E)
  const dateCol = 4;
  
  // Lire les infos des colonnes (équipes en ligne 11, catégories en ligne 12, coachs en ligne 13)
  const teamsRow = data[11] || [];
  const categoryRow = data[12] || [];
  const coachRow = data[13] || [];
  
  // Créer une map: colonne -> {team, category, coach}
  const columns: Map<number, ColumnInfo> = new Map();
  for (let col = dateCol + 1; col < Math.min(50, teamsRow.length); col++) {
    const rawTeam = String(teamsRow[col] || '');
    const team = normalizeTeamName(rawTeam);
    if (team && !team.startsWith('-') && team.trim() !== '') {
      columns.set(col, {
        team: team,
        category: getCategoryFromText(String(categoryRow[col] || '')),
        coach: cleanText(String(coachRow[col] || ''))
      });
    }
  }

  const matches: any[] = [];
  const processedRows = new Set<number>();

  // Parcourir toutes les lignes à partir de 14
  for (let rowIdx = 14; rowIdx < data.length; rowIdx++) {
    // Si cette ligne a déjà été traitée, skip
    if (processedRows.has(rowIdx)) continue;
    
    const dateCell = data[rowIdx]?.[dateCol];
    if (!dateCell || !String(dateCell).trim().includes('/')) {
      continue;
    }

    const dateStr = String(dateCell).trim();
    const [datePart, dayPart] = dateStr.split('\n');
    const formattedDate = formatDate(datePart?.trim() || '');
    const dayName = dayPart?.trim() || null;
    if (!formattedDate) continue;

    // Détecter la taille du bloc (cellules fusionnées dans la colonne date)
    let blockSize = 1;
    for (let offset = 1; offset <= 2; offset++) {
      const nextRow = rowIdx + offset;
      if (nextRow >= data.length) break;
      if (!data[nextRow]?.[dateCol] || String(data[nextRow]?.[dateCol]).trim() === '') {
        blockSize = offset + 1;
      } else {
        break;
      }
    }
    
    // Marquer toutes les lignes du bloc comme traitées
    for (let i = 0; i < blockSize; i++) {
      processedRows.add(rowIdx + i);
    }

    // Lire les camionnettes pour ce bloc (colonnes 2 et 3)
    let dateCamionnette: string | null = null;
    for (let r = rowIdx; r < rowIdx + blockSize && r < data.length; r++) {
      const cC = cleanText(String(data[r]?.[2] || ''));
      const cD = cleanText(String(data[r]?.[3] || ''));
      if (cC && /camionnette/i.test(cC.toLowerCase())) {
        const team = normalizeTeamName(cC.replace(/camionnette/gi, '').trim());
        if (team && EHR_TEAMS.has(team)) {
          dateCamionnette = team;
        }
      }
      if (cD && /camionnette/i.test(cD.toLowerCase())) {
        const team = normalizeTeamName(cD.replace(/camionnette/gi, '').trim());
        if (team && EHR_TEAMS.has(team)) {
          dateCamionnette = team;
        }
      }
    }

    // Parcourir chaque colonne d'équipe
    for (const [col, colInfo] of Array.from(columns.entries())) {
      let matchText = '';
      let locationColor = 'FFFFFF';
      let foundMatch = false;

      // Lire toutes les lignes du bloc
      for (let offset = 0; offset < blockSize; offset++) {
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
          foundMatch = true;
        }
      }

      if (!foundMatch) continue;

      // Déterminer la salle à partir de la couleur
      let finalLocation = COLOR_TO_LOCATION[locationColor] || 'Extérieur';
      
      const parsed = parseMatchText(matchText);
      let home = parsed.home;
      let away = parsed.away;
      const time = parsed.time || extractTime(matchText);

      // Si home ou away est un numéro, cela fait référence à l'équipe de la colonne
      if (home && /^\d+$/.test(home)) {
        const colIndex = Array.from(columns.keys()).indexOf(col);
        const targetColIndex = colIndex + (parseInt(home) - 1);
        const targetCol = Array.from(columns.keys())[targetColIndex];
        const targetColInfo = columns.get(targetCol);
        if (targetColInfo) {
          home = targetColInfo.team;
        } else {
          home = colInfo.team;
        }
      }
      if (away && /^\d+$/.test(away)) {
        const colIndex = Array.from(columns.keys()).indexOf(col);
        const targetColIndex = colIndex + (parseInt(away) - 1);
        const targetCol = Array.from(columns.keys())[targetColIndex];
        const targetColInfo = columns.get(targetCol);
        if (targetColInfo) {
          away = targetColInfo.team;
        } else {
          away = colInfo.team;
        }
      }
      
      // Si pas de home/away, utiliser l'équipe de la colonne
      if (!home && !away) {
        home = colInfo.team;
      }
      if (!home) continue;
      
      // Déterminer isHome/isAway
      let isHome = false;
      let isAway = false;
      
      if (home && away) {
        const homeIsEHR = isEHRTeam(home);
        const awayIsEHR = isEHRTeam(away);
        if (homeIsEHR && !awayIsEHR) {
          isHome = true; isAway = false;
          if (finalLocation === 'Extérieur') finalLocation = 'Rodemack';
        } else if (!homeIsEHR && awayIsEHR) {
          isHome = false; isAway = true; finalLocation = 'Extérieur';
        } else if (homeIsEHR && awayIsEHR) {
          isHome = true; isAway = false; finalLocation = finalLocation !== 'Extérieur' ? finalLocation : 'Rodemack';
        } else {
          isHome = finalLocation !== 'Extérieur'; isAway = finalLocation === 'Extérieur';
        }
      } else {
        if (isEHRTeam(home)) {
          isHome = finalLocation !== 'Extérieur'; isAway = finalLocation === 'Extérieur';
        } else {
          continue;
        }
      }

      if (home && isEHRTeam(home)) home = normalizeTeamName(home);
      if (away && isEHRTeam(away)) away = normalizeTeamName(away);

      matches.push({
        date: formattedDate,
        day: dayName,
        home_team: home,
        away_team: away,
        time: time,
        location: finalLocation,
        match_type: 'Championnat',
        category: colInfo.category,
        coach: colInfo.coach,
        is_home: isHome,
        is_away: isAway,
        is_internal: isHome && away && isEHRTeam(home) && isEHRTeam(away),
        season: season,
        last_updated: lastUpdated,
        camionnette: (isHome && !isAway && dateCamionnette && dateCamionnette === home) ? dateCamionnette : null
      });
    }
  }

  // Supprimer les doublons
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
