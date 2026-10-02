// app/api/upload/route.ts
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

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
function normalizeTeamName(name: string): string {
  if (!name) return '';
  
  let cleaned = String(name)
    .replace(/\r/g, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s-]*/, '')
    .trim();
  
  cleaned = cleaned.replace(/\s*\([^)]*\)/g, '').trim();
  
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
  
  const mapping: Record<string, string> = {
    'SM': 'Seniors M',
    'SF 1': 'Seniors F1', 'SF1': 'Seniors F1',
    'SF 2': 'Seniors F2', 'SF2': 'Seniors F2',
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
  return cleaned.substring(0, 50);
}

const EHR_TEAMS = new Set<string>([
  'Seniors M', 'Seniors F1', 'Seniors F2',
  'M17', 'F17', 'M15', 'F15', 'M13', 'F13', 'M11', 'F11'
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
    'camionnette', 'disponible', 'libre', 'à planifier', 'date bloquée', 'amical'];
  if (exclude.some(kw => lower.includes(kw))) return true;
  if (lower === 'à' || lower === 'vs' || lower === 'match') return true;
  if (/^\d+$/.test(lower)) return true;
  if (lower.includes(',') && lower.split(',').length > 1) return true;
  if (lower.includes('et') && lower.split('et').length > 1) return true;
  return false;
}

function getOpponentFromText(text: string, ehrTeam: string): {opponent: string | null; isHome: boolean} {
  let cleaned = cleanText(text);
  cleaned = cleaned.replace(/\s*à\s*\d{1,2}[h:]*\d{2}/i, '').trim();
  
  if (/^EHR/i.test(cleaned)) {
    const opponent = cleaned.replace(/^EHR\s*[-vs]?\s*/i, '').replace(/^HR\s*[-vs]?\s*/i, '').trim();
    return { opponent: opponent || null, isHome: true };
  }
  
  if (/\s*[-vs]?\s*EHR\s*$/i.test(cleaned)) {
    const opponent = cleaned.replace(/\s*[-vs]?\s*EHR\s*$/i, '').trim();
    return { opponent: opponent || null, isHome: false };
  }
  
  if (/(^|\s)EHR(\s|$)/i.test(cleaned)) {
    const parts = cleaned.split(/[-vs]/i).map(p => p.trim());
    if (parts.length >= 2) {
      for (let i = 0; i < parts.length; i++) {
        if (isEHRTeam(parts[i]) || /EHR/i.test(parts[i])) {
          if (i === 0) {
            return { opponent: parts.slice(1).join(' '), isHome: true };
          } else {
            return { opponent: parts.slice(0, i).join(' '), isHome: false };
          }
        }
      }
    }
    return { opponent: cleaned, isHome: true };
  }
  
  return { opponent: cleaned, isHome: true };
}

// Type pour les colonnes
interface ColumnInfo {
  team: string;
  category: string;
}

// Fonction pour commiter sur GitHub
async function commitToGitHub(matches: any[], token: string, repo: string, branch: string = 'main') {
  try {
    // Récupérer le dernier commit
    const apiUrl = `https://api.github.com/repos/${repo}/contents/data/matches.json`;
    
    const headers = {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'EHR-Planning-Agent'
    };
    
    // D'abord, essayer de récupérer le SHA du fichier existant
    let sha: string | null = null;
    try {
      const getResponse = await fetch(apiUrl, { headers });
      if (getResponse.ok) {
        const fileData = await getResponse.json();
        sha = fileData.sha;
      }
    } catch (e) {
      // Fichier n'existe pas encore
      sha = null;
    }
    
    // Préparer le contenu
    const content = JSON.stringify(matches, null, 2);
    const encodedContent = Buffer.from(content).toString('base64');
    
    // Créer ou mettre à jour le fichier
    const method = sha ? 'PUT' : 'PUT';
    const body = JSON.stringify({
      message: `Mise à jour du planning - ${new Date().toLocaleString('fr-FR')}`,
      content: encodedContent,
      branch: branch,
      ...(sha ? { sha } : {})
    });
    
    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('GitHub API error:', error);
      return { success: false, error: error.message || 'Erreur GitHub API' };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Error committing to GitHub:', error);
    return { success: false, error: error.message };
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { cellStyles: true, type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    // @ts-ignore - sheet_to_json returns any[][] but TypeScript doesn't know that
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    // Lire les métadonnées
    const lastUpdated = data[0]?.[0]?.toString().replace('MAJ le ', '')?.trim() || null;
    const season = data[0]?.[5]?.toString().trim() || '2026-2027';

    // Lire les infos des colonnes
    const teamsRow = data[11] || [];
    const categoryRow = data[12] || [];

    // Map: colonne -> {team, category}
    const columns: Map<number, ColumnInfo> = new Map();
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
      const dateCell = data[rowIdx]?.[4];
      if (!dateCell || !String(dateCell).trim().includes('/')) continue;

      const dateStr = String(dateCell).trim();
      const [datePart, dayPart] = dateStr.split('\n');
      const formattedDate = formatDate(datePart?.trim() || '');
      const dayName = dayPart?.trim() || null;
      if (!formattedDate) continue;

      // Lire les camionnettes
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

      // Parcourir chaque colonne d'équipe
      const columnsArray = Array.from(columns.entries());
      
      for (const [col, colInfo] of columnsArray) {
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

        const location = COLOR_TO_LOCATION[locationColor] || 'Extérieur';
        const cleaned = cleanText(matchText);
        const time = extractTime(cleaned);
        
        let homeTeam: string | null = null;
        let awayTeam: string | null = null;
        let isHome = false;
        let isAway = false;
        let finalLocation = location;

        const opponentResult = getOpponentFromText(cleaned, colInfo.team);
        
        if (opponentResult.opponent) {
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
        } else if (location !== 'Extérieur') {
          homeTeam = colInfo.team;
          awayTeam = null;
          isHome = true;
          isAway = false;
          finalLocation = location;
        } else {
          continue;
        }

        if (!homeTeam) continue;

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

    // Essayer de commiter sur GitHub si un token est disponible
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPO || 'teambeamon/ehr-planning-app';
    
    let committedToGitHub = false;
    if (githubToken && githubToken !== 'your-github-token') {
      const commitResult = await commitToGitHub(uniqueMatches, githubToken, githubRepo);
      committedToGitHub = commitResult.success;
    }

    return NextResponse.json({ 
      success: true, 
      message: committedToGitHub 
        ? "Fichier traité et sauvegardé sur GitHub avec succès!" 
        : "Fichier traité avec succès. Téléchargez les données pour les sauvegarder.",
      matchesCount: uniqueMatches.length,
      matches: uniqueMatches,
      committedToGitHub
    });

  } catch (error: any) {
    console.error("Erreur:", error);
    return NextResponse.json(
      { error: error.message || "Erreur lors du traitement du fichier." },
      { status: 500 }
    );
  }
}
