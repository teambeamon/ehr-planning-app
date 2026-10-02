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

// Normalisation des noms d'équipes - utiliser une approche plus robuste
function normalizeTeamName(name: string): string {
  if (!name) return '';
  
  // Nettoyer le texte
  let cleaned = String(name)
    .replace(/\r/g, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s-]*/, '')
    .trim();
  
  // Supprimer les parenthèses et leur contenu pour simplifier
  cleaned = cleaned.replace(/\s*\([^)]*\)/g, '').trim();
  
  // Remplacer les variations courantes
  cleaned = cleaned
    .replace(/^17 ans F.*/i, 'F17')
    .replace(/^17 ans G.*/i, 'M17')
    .replace(/^15 ans F.*/i, 'F15')
    .replace(/^15 ans M.*/i, 'M15')
    .replace(/^13 ans F.*/i, 'F13')
    .replace(/^13 ans M.*/i, 'M13')
    .replace(/^11 ans F.*/i, 'F11')
    .replace(/^11 ans Masculins.*/i, 'M11')
    .replace(/Seniors Filles/i, 'SF')
    .replace(/Seniors HR/i, 'SM')
    .replace(/Seniors G/i, 'SM')
    .replace(/SENIORS/i, 'SM')
    .replace(/Féminines/i, 'F')
    .replace(/Masculins?/i, 'M')
    .replace(/Garçons?/i, 'M')
    .replace(/ans/i, '')
    .replace(/EHR/i, '')
    .replace(/HR/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Mapping final
  const mapping: Record<string, string> = {
    'SM': 'Seniors M',
    'SF 1': 'Seniors F1', 'SF1': 'Seniors F1',
    'SF 2': 'Seniors F2', 'SF2': 'Seniors F2',
    'M17': 'M17',
    'F17': 'F17',
    'M15': 'M15',
    'F15': 'F15',
    'M13': 'M13',
    'F13': 'F13',
    'M11': 'M11',
    'F11': 'F11'
  };
  
  return mapping[cleaned] || cleaned;
}

function getCategoryFromText(text: string): string {
  if (!text) return '';
  const cleaned = String(text).replace(/\r/g, '').replace(/\n/g, ' ').trim();
  if (cleaned.includes('CDF') || cleaned.includes('Championnat de France')) return 'CDF';
  if (cleaned.includes('Région') || cleaned.includes('Regional')) return 'Régional';
  if (cleaned.includes('Dépt') || cleaned.includes('Departement') || cleaned.includes('Départementale')) return 'Départemental';
  if (cleaned.includes('InterDépt') || cleaned.includes('Interdepartement')) return 'Interdépartemental';
  return cleaned.substring(0, 50);
}

// Équipes EHR valides
const EHR_TEAMS = new Set([
  'Seniors M', 'Seniors F1', 'Seniors F2',
  'M17', 'F17',
  'M15', 'F15',
  'M13', 'F13',
  'M11', 'F11'
]);

function isEHRTeam(name: string): boolean {
  if (!name) return false;
  const cleaned = String(name).trim();
  if (EHR_TEAMS.has(cleaned)) return true;
  if (/\bEHR\b/i.test(cleaned) || /\bHR\b/i.test(cleaned)) return true;
  // Vérifier si c'est une équipe EHR normalisée
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
  const cell = sheet[cellRef];
  if (cell && cell.s && cell.s.fgColor && cell.s.fgColor.rgb) {
    return cell.s.fgColor.rgb.replace('#', '').toUpperCase();
  }
  return 'FFFFFF';
}

function isNonMatchCell(str: string): boolean {
  if (!str || String(str).trim() === '') return true;
  const lower = String(str).toLowerCase().trim();
  const exclude = ['journée', 'report', 'exempt', 'dispo', 'réservation', 'coach', 'date', 'salles',
    'n°', 'bad', 'non dispo', 'match contre', 'uniquement', 'tournoi', 'inversion',
    'demande de report', 'refus', 'à placer', 'retrait', 'bloquée', 'skate',
    'camionnette', 'disponible', 'libre', 'à planifier', 'date bloquée', 'amical'];
  if (exclude.some(kw => lower.includes(kw))) return true;
  if (lower === 'à' || lower === 'vs' || lower === 'match') return true;
  if (/^\d+$/.test(lower)) return true;
  // Si ça contient plusieurs noms d'équipes séparés par des virgules, ignorer
  if (lower.includes(',') && lower.split(',').length > 1) return true;
  if (lower.includes('et') && lower.split('et').length > 1) return true;
  return false;
}

function getOpponentFromText(text: string, ehrTeam: string): {opponent: string | null; isHome: boolean} {
  // Nettoyer le texte
  let cleaned = cleanText(text);
  
  // Supprimer l'heure
  cleaned = cleaned.replace(/\s*à\s*\d{1,2}[h:]*\d{2}/i, '').trim();
  
  // Si le texte commence par "EHR" ou contient "EHR" en premier
  if (/^EHR/i.test(cleaned) || /^EHR\s+/i.test(cleaned)) {
    // Exemple: "EHR - Villers" -> opponent = Villers, isHome = true
    const opponent = cleaned
      .replace(/^EHR\s*[-vs]?\s*/i, '')
      .replace(/^HR\s*[-vs]?\s*/i, '')
      .trim();
    return { opponent: opponent || null, isHome: true };
  }
  
  // Si le texte finit par "EHR" ou contient "vs EHR"
  if (/\s*[-vs]?\s*EHR\s*$/i.test(cleaned) || /\s*[-vs]?\s*EHR$/i.test(cleaned)) {
    // Exemple: "Villers - EHR" -> opponent = Villers, isHome = false
    const opponent = cleaned
      .replace(/\s*[-vs]?\s*EHR\s*$/i, '')
      .replace(/\s*[-vs]?\s*EHR$/i, '')
      .trim();
    return { opponent: opponent || null, isHome: false };
  }
  
  // Si le texte contient "EHR" au milieu
  if (/(^|\s)EHR(\s|$)/i.test(cleaned)) {
    // Exemple: "Villers vs EHR" ou "EHR vs Villers"
    const parts = cleaned.split(/[-vs]/i).map(p => p.trim());
    if (parts.length >= 2) {
      for (let i = 0; i < parts.length; i++) {
        if (isEHRTeam(parts[i]) || /EHR/i.test(parts[i])) {
          // EHR est dans cette partie
          if (i === 0) {
            // EHR est en premier -> match à domicile
            const opponentParts = parts.slice(1);
            return { opponent: opponentParts.join(' '), isHome: true };
          } else {
            // EHR n'est pas en premier -> match à l'extérieur
            const opponentParts = parts.slice(0, i);
            return { opponent: opponentParts.join(' '), isHome: false };
          }
        }
      }
    }
    // Par défaut
    return { opponent: cleaned, isHome: true };
  }
  
  // Sinon, le texte est probablement le nom de l'opponent
  // Vérifier si c'est un match à domicile (la couleur de la cellule l'indiquera)
  return { opponent: cleaned, isHome: true };
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

    // Map: colonne -> {team, category}
    const columns: Map<number, {team: string; category: string}> = new Map();
    for (let col = 5; col < teamsRow.length; col++) {
      const rawTeam = String(teamsRow[col] || '');
      const team = normalizeTeamName(rawTeam);
      const category = getCategoryFromText(String(categoryRow[col] || ''));
      if (team && !team.startsWith('-')) {
        columns.set(col, { team, category });
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
          const team = normalizeTeamName(cC.replace(/^Camionnette\s+/gi, '').trim());
          if (team && EHR_TEAMS.has(team)) dateCamionnette = team;
        }
        if (cD && !dateCamionnette) {
          const team = normalizeTeamName(cD.replace(/^Camionnette\s+/gi, '').trim());
          if (team && EHR_TEAMS.has(team)) dateCamionnette = team;
        }
      }

      // Parcourir chaque colonne d'équipe pour cette date
      for (const [col, colInfo] of columns) {
        let matchText = '';
        let locationColor = 'FFFFFF';

        // Lire les 3 lignes pour ce match
        for (let offset = 0; offset < 3; offset++) {
          const checkRow = rowIdx + offset;
          if (checkRow >= data.length) continue;

          const cellValue = data[checkRow]?.[col];
          if (!cellValue) continue;

          const cellStr = String(cellValue).trim();
          
          // Si c'est une cellule de match valide
          if (!isNonMatchCell(cellStr)) {
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

        // Utiliser la fonction de détection d'opponent
        const opponentResult = getOpponentFromText(cleaned, colInfo.team);
        
        if (opponentResult.opponent && opponentResult.opponent !== '') {
          // On a trouvé un opponent
          const normalizedOpponent = normalizeTeamName(opponentResult.opponent);
          
          if (opponentResult.isHome) {
            homeTeam = colInfo.team;
            awayTeam = normalizedOpponent;
            isHome = true;
            isAway = false;
            finalLocation = location;
          } else {
            homeTeam = normalizedOpponent;
            awayTeam = colInfo.team;
            isHome = false;
            isAway = true;
            finalLocation = 'Extérieur';
          }
        } else {
          // Pas d'opponent détecté - vérifier la couleur
          if (location !== 'Extérieur' && location !== 'none') {
            // Si la couleur indique une salle EHR, c'est probablement un match à domicile
            // sans opponent spécifié (ex: "Match à 14h00")
            homeTeam = colInfo.team;
            awayTeam = null;
            isHome = true;
            isAway = false;
            finalLocation = location;
          } else {
            // Sinon ignorer
            continue;
          }
        }

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
