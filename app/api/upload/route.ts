// app/api/upload/route.ts
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import XLSX from "xlsx";

// Mapping couleur RGB -> Salle
const COLOR_TO_LOCATION: Record<string, string> = {
  'FFFF00': 'Rodemack',
  '00B0F0': 'Hettange (Hall)',
  '92D050': 'Hettange (Poly)',
  'FFC000': 'Kanfen',
  'FFFFFF': 'Extérieur',
  'none': 'Extérieur'
};

// Normalisation des noms d'équipes
const TEAM_MAP: Record<string, string> = {
  'SENIORS HR': 'Seniors M', 'SENIORS G': 'Seniors M', 'SENIORS': 'Seniors M', 'SG': 'Seniors M',
  'SENIORS FILLES HR 1': 'Seniors F1', 'SENIORS FILLES 1': 'Seniors F1', 'SF1': 'Seniors F1',
  'SENIORS FILLES HR 2': 'Seniors F2', 'SENIORS FILLES 2': 'Seniors F2', 'SF2': 'Seniors F2',
  '- 17 ans G (Dépt)': 'M17 departementale', '17 ans G (Dépt)': 'M17 departementale',
  '- 17 ans G (Région)': 'M17 region', '17 ans G (Région)': 'M17 region',
  '- 17 ans F équip 1 ( CDF)': 'F17 CDF', '17 ans F équip 1 ( CDF)': 'F17 CDF',
  '- 17 ans F équip 2 ( Dépt)': 'F17 departementale', '17 ans F équip 2 ( Dépt)': 'F17 departementale',
  '- 15 ans  M (Région)': 'M15 region', '15 ans  M (Région)': 'M15 region',
  '- 15 ans  (Dépt)': 'M15 departementale', '15 ans (Dépt)': 'M15 departementale',
  '- 15 ans F (Région)': 'F15 region', '15 ans F (Région)': 'F15 region',
  '- 15 ans F (Dépt)': 'F15 departementale', '15 ans F (Dépt)': 'F15 departementale',
  '- 13 ans M (Région)': 'M13 region', '- 13 ans M (Dépt)': 'M13 departementale',
  '- 13 ans F (Dépt)': 'F13 departementale',
  '- 11 ans  Masculins (InterDépt)': 'M11 interdepartementale',
  '11 ans Féminines': 'F11 departementale', '- 11 ans Féminines': 'F11 departementale',
  'EHR 1': 'F17 CDF', 'EHR 2': 'F17 departementale'
};

const EHR_TEAMS = new Set([
  'Seniors M', 'Seniors F1', 'Seniors F2',
  'M17 departementale', 'M17 region',
  'F17 CDF', 'F17 departementale',
  'M15 region', 'M15 departementale',
  'F15 region', 'F15 departementale',
  'M13 region', 'M13 departementale',
  'F13 departementale',
  'M11 interdepartementale',
  'F11 departementale'
]);

function cleanText(str: string): string {
  if (!str) return '';
  return String(str).replace(/\r/g, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeTeam(name: string): string {
  if (!name) return '';
  let cleaned = String(name).trim().replace(/^[\s-]*/, '').replace(/\s+/g, ' ').trim();
  return TEAM_MAP[cleaned] || cleaned;
}

function isEHRTeam(name: string): boolean {
  if (!name) return false;
  const cleaned = String(name).trim();
  if (EHR_TEAMS.has(cleaned)) return true;
  if (/\bEHR\b/i.test(cleaned) || /\bHR\b/i.test(cleaned)) return true;
  return false;
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
  const cell = sheet[cellRef];
  if (cell && cell.s && cell.s.fgColor && cell.s.fgColor.rgb) {
    return cell.s.fgColor.rgb.replace('#', '').toUpperCase();
  }
  return 'FFFFFF';
}

function isMatchCell(str: string): boolean {
  if (!str || String(str).trim() === '') return false;
  const lower = String(str).toLowerCase().trim();
  const exclude = ['journée', 'report', 'exempt', 'dispo', 'réservation', 'coach', 'date', 'salles',
    'n°', 'bad', 'non dispo', 'match contre', 'uniquement', 'tournoi', 'inversion',
    'demande de report', 'refus', 'à placer', 'retrait', 'bloquée', 'skate',
    'camionnette', 'disponible', 'libre', 'à planifier', 'date bloquée'];
  if (exclude.some(kw => lower.includes(kw))) return false;
  if (lower === 'à' || lower === 'a' || lower === 'vs' || lower === 'match') return false;
  if (/^\d+$/.test(lower)) return false;
  return true;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { cellStyles: true, type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    // Lire les métadonnées
    const lastUpdated = data[0]?.[0]?.toString().replace('MAJ le ', '')?.trim() || null;
    const season = data[0]?.[5]?.toString().trim() || '2026-2027';

    // Lire les infos des colonnes (équipes en ligne 11, catégories en ligne 12)
    const teamsRow = data[11] || [];
    const categoryRow = data[12] || [];
    const coachRow = data[13] || [];

    // Map: colonne -> {team, category, coach}
    const columns: Map<number, {team: string; category: string; coach: string}> = new Map();
    for (let col = 5; col < teamsRow.length; col++) {
      const team = normalizeTeam(String(teamsRow[col] || ''));
      const category = cleanText(String(categoryRow[col] || ''));
      const coach = cleanText(String(coachRow[col] || ''));
      if (team && !team.startsWith('-')) {
        columns.set(col, { team, category, coach });
      }
    }

    const matches: any[] = [];

    // Parcourir les lignes pour trouver les dates
    for (let rowIdx = 14; rowIdx < data.length; rowIdx++) {
      const dateCell = data[rowIdx]?.[4]; // Colonne E (index 4)
      if (!dateCell || !String(dateCell).trim().includes('/')) continue;

      // Extraire date et jour
      const dateStr = String(dateCell).trim();
      const [datePart, dayPart] = dateStr.split('\n');
      const formattedDate = formatDate(datePart?.trim() || '');
      const dayName = dayPart?.trim() || null;
      if (!formattedDate) continue;

      // Lire les camionnettes pour cette date (colonnes C=2 et D=3)
      let dateCamionnette: string | null = null;
      for (let r = rowIdx; r <= rowIdx + 2 && r < data.length; r++) {
        const cC = cleanText(String(data[r]?.[2] || ''));
        const cD = cleanText(String(data[r]?.[3] || ''));
        if (cC && !dateCamionnette) {
          const normalized = normalizeTeam(cC.replace(/^Camionnette\s+/gi, '').trim());
          if (normalized && isEHRTeam(normalized)) dateCamionnette = normalized;
        }
        if (cD && !dateCamionnette) {
          const normalized = normalizeTeam(cD.replace(/^Camionnette\s+/gi, '').trim());
          if (normalized && isEHRTeam(normalized)) dateCamionnette = normalized;
        }
      }

      // Parcourir chaque colonne d'équipe pour cette date
      for (const [col, colInfo] of columns) {
        let matchText = '';
        let locationColor = 'FFFFFF';
        let matchTime: string | null = null;

        // Lire les 3 lignes pour ce match
        for (let offset = 0; offset < 3; offset++) {
          const checkRow = rowIdx + offset;
          if (checkRow >= data.length) continue;

          const cellValue = data[checkRow]?.[col];
          if (!cellValue) continue;

          const cellStr = String(cellValue).trim();
          
          // Si c'est une cellule de match valide
          if (isMatchCell(cellStr)) {
            if (!matchText) matchText = cellStr;
            
            // Obtenir la couleur
            const color = getCellColor(sheet, checkRow, col);
            if (color !== 'FFFFFF' && color !== 'none') {
              locationColor = color;
            }
          }
        }

        if (!matchText) continue;

        const location = COLOR_TO_LOCATION[locationColor] || 'Extérieur';
        const cleaned = cleanText(matchText);
        const time = extractTime(cleaned);
        
        // Déterminer home/away
        let homeTeam: string | null = null;
        let awayTeam: string | null = null;
        let isHome = false;
        let isAway = false;
        let finalLocation = location;

        // Nettoyer le texte du match
        let matchCleaned = cleaned;
        if (time) matchCleaned = cleaned.replace(/\s*à\s*\d{1,2}[h:]\d{2}/i, '').trim();
        matchCleaned = cleanText(matchCleaned).replace(/\bà\b/gi, '').replace(/\s+/g, ' ').trim();

        // Vérifier si c'est un match à domicile ou extérieur
        if (matchCleaned.includes(' vs ') || matchCleaned.includes(' - ')) {
          const separator = matchCleaned.includes(' vs ') ? ' vs ' : ' - ';
          const parts = matchCleaned.split(separator).map(p => p.trim());
          if (parts.length >= 2) {
            const t1 = normalizeTeam(parts[0]);
            const t2 = normalizeTeam(parts.slice(1).join(' '));
            const t1IsEHR = isEHRTeam(t1);
            const t2IsEHR = isEHRTeam(t2);

            if (t1IsEHR && !t2IsEHR) {
              homeTeam = colInfo.team;
              awayTeam = t2;
              isHome = true;
              isAway = false;
              finalLocation = location;
            } else if (t2IsEHR && !t1IsEHR) {
              homeTeam = t1;
              awayTeam = colInfo.team;
              isHome = false;
              isAway = true;
              finalLocation = 'Extérieur';
            } else if (t1IsEHR && t2IsEHR) {
              homeTeam = t1;
              awayTeam = t2;
              isHome = true;
              isAway = false;
              finalLocation = location;
            } else {
              homeTeam = colInfo.team;
              awayTeam = t1;
              isHome = true;
              isAway = false;
            }
          }
        } else {
          // Pas de séparateur - vérifier si c'est un nom d'équipe adverse
          const possibleOpponent = normalizeTeam(matchCleaned);
          const isOppEHR = isEHRTeam(possibleOpponent);

          if (isOppEHR && possibleOpponent !== colInfo.team) {
            homeTeam = colInfo.team;
            awayTeam = possibleOpponent;
            isHome = true;
            isAway = false;
            finalLocation = location;
          } else if (!isOppEHR && possibleOpponent.length >= 2) {
            if (location !== 'Extérieur' && location !== 'none') {
              homeTeam = colInfo.team;
              awayTeam = possibleOpponent;
              isHome = true;
              isAway = false;
              finalLocation = location;
            } else {
              homeTeam = possibleOpponent;
              awayTeam = colInfo.team;
              isHome = false;
              isAway = true;
              finalLocation = 'Extérieur';
            }
          } else {
            continue;
          }
        }

        if (isAway && !isHome) finalLocation = 'Extérieur';
        if (!homeTeam || homeTeam === '') continue;

        matches.push({
          date: formattedDate,
          day: dayName,
          home_team: homeTeam,
          away_team: awayTeam,
          match_display: `${homeTeam}${awayTeam ? ` vs ${awayTeam}` : ''}`,
          time: time,
          location: finalLocation,
          match_type: 'Championnat',
          category: colInfo.category || colInfo.team,
          is_home: isHome,
          is_away: isAway,
          is_internal: isEHRTeam(homeTeam) && (awayTeam ? isEHRTeam(awayTeam) : false),
          coach: colInfo.coach,
          season: season,
          last_updated: lastUpdated,
          camionnette: (isHome && !isAway && dateCamionnette) ? dateCamionnette : null
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

    // Sauvegarder
    const outputDir = join(process.cwd(), 'data');
    const outputFile = join(outputDir, 'matches.json');
    await mkdir(outputDir, { recursive: true });
    await writeFile(outputFile, JSON.stringify(uniqueMatches, null, 2));

    return NextResponse.json({ 
      success: true, 
      message: "Fichier traité avec succès.",
      matchesCount: uniqueMatches.length
    });

  } catch (error: any) {
    console.error("Erreur:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors du traitement du fichier." },
      { status: 500 }
    );
  }
}
