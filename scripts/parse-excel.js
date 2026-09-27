// scripts/parse-excel-v10.js
// Parser FINAL CORRIGÉ - Basé sur l'alignement par COLONNE
// Chaque COLONNE correspond à une ÉQUIPE FIXE
// Les matchs dans une colonne appartiennent à l'équipe de cette colonne

const XLSX = require('xlsx');
const { writeFileSync } = require('fs');
const { join } = require('path');

// Mapping couleur RGB -> Salle
const COLOR_TO_LOCATION = {
  'FFFF00': 'Rodemack',
  '00B0F0': 'Hettange (Hall)',
  '92D050': 'Hettange (Poly)',
  'FFC000': 'Kanfen',
  'FFFFFF': 'Extérieur',
  'none': 'Extérieur'
};

// Liste des équipes EHR (normalisées)
const EHR_TEAM_NAMES = new Set([
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

// Mapping des noms d'équipes du fichier vers les noms normalisés
const TEAM_NAME_MAPPING = {
  "SENIORS HR": "Seniors M",
  "SENIORS FILLES HR 1": "Seniors F1",
  "SENIORS FILLES HR 2": "Seniors F2",
  "17 ans G (Dépt)": "M17 departementale",
  "17 ans G": "M17 departementale",
  "- 17 ans G (Dépt)": "M17 departementale",
  "17 ans F équip 1 ( CDF)": "F17 CDF",
  "17 ans F équip 1": "F17 CDF",
  "- 17 ans F équip 1 ( CDF)": "F17 CDF",
  "17 ans F équip 2 ( Dépt)": "F17 departementale",
  "17 ans F équip 2": "F17 departementale",
  "- 17 ans F équip 2 ( Dépt)": "F17 departementale",
  "15 ans M (Région)": "M15 region",
  "15 ans  M (Région)": "M15 region",
  "15 ans M": "M15 region",
  "- 15 ans  M (Région)": "M15 region",
  "15 ans (Dépt)": "M15 departementale",
  "- 15 ans  (Dépt)": "M15 departementale",
  "15 ans": "M15 departementale",
  "15 ans F (Région)": "F15 region",
  "- 15 ans F (Région)": "F15 region",
  "15 ans F": "F15 region",
  "15 ans F (Dépt)": "F15 departementale",
  "- 15 ans F (Dépt)": "F15 departementale",
  "13 ans M (Région)": "M13 region",
  "13 ans M": "M13 region",
  "- 13 ans M (Région)": "M13 region",
  "13 ans M (Dépt)": "M13 departementale",
  "- 13 ans M (Dépt)": "M13 departementale",
  "13 ans F (Dépt)": "F13 departementale",
  "- 13 ans F (Dépt)": "F13 departementale",
  "13 ans F": "F13 departementale",
  "11 ans Masculins (InterDépt)": "M11 interdepartementale",
  "11 ans Masculins": "M11 interdepartementale",
  "- 11 ans Masculins (InterDépt)": "M11 interdepartementale",
  "11 ans Féminines": "F11 departementale",
  "- 11 ans Féminines": "F11 departementale",
  "Tournoi -9/-11 Petit terrain": "Tournoi -9/-11",
  "Tournoi -9/-11": "Tournoi -9/-11",
  "Féminines EHR": "F11 departementale",
  "EHR 1": "F17 CDF",
  "EHR 2": "F17 departementale",
  "EHR": "EHR"
};

// Mots-clés indiquant que ce n'est pas un match
const NON_MATCH_INDICATORS = [
  'journée', 'report', 'exempt', 'hall non dispo', 'dispo', 'réservation',
  'n°', 'coach', 'date', 'salles', 'bad', 'non dispo', 'réservation camionnettes',
  'dispo salles', 'match contre', 'uniquement', 'tournaments', 'tournoi',
  '(match', 'inversion', 'demande de report', 'refus', 'a placer', 'retrait',
  'de france', 'de moselle', 'match à planifier', 'bloquée', 'skate'
];

function normalizeTeamName(teamName) {
  if (!teamName) return teamName;
  let cleaned = String(teamName).trim();
  cleaned = cleaned.replace(/^\s*[-–]\s*/, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/\s+\(.*?\)\s*/g, '');
  
  // Si le nom contient "EHR" ou "HR", extraire seulement la partie EHR/HR
  // Ex: "EHR 1 Homécourt" -> "EHR 1"
  if (/\bEHR\b/i.test(cleaned) || /\bHR\b/i.test(cleaned)) {
    const ehrMatch = cleaned.match(/\b(EHR[\s\-]?\d*|HR[\s\-]?\d*)\b/i);
    if (ehrMatch) {
      const ehrOnly = ehrMatch[1].replace(/\s+/g, ' ').trim();
      const normalized = TEAM_NAME_MAPPING[ehrOnly] || ehrOnly;
      if (normalized !== ehrOnly) {
        return normalized;
      }
    }
  }
  
  return TEAM_NAME_MAPPING[cleaned] || cleaned;
}

function isEHRTeam(name) {
  if (!name) return false;
  const cleaned = String(name).trim();
  if (EHR_TEAM_NAMES.has(cleaned)) return true;
  if (/\bEHR\b/i.test(cleaned) || /\bHR\b/i.test(cleaned)) return true;
  return false;
}

function cleanCellStr(str) {
  if (!str) return '';
  let cleaned = String(str).replace(/\r/g, '').replace(/\n/g, ' ').trim();
  cleaned = cleaned.replace(/\s+/g, ' ');
  return cleaned;
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return dateStr;
}

function extractTime(str) {
  const timeMatch = str.match(/à\s*(\d{1,2}[h:][0-9]{2})/i);
  return timeMatch ? timeMatch[1] : null;
}

function getCellColor(sheet, row, col) {
  const cellRef = XLSX.utils.encode_cell({r: row, c: col});
  const cell = sheet[cellRef];
  if (cell && cell.s && cell.s.fgColor) {
    return cell.s.fgColor.rgb || cell.s.fgColor.indexed || cell.s.fgColor.theme || 'none';
  }
  return 'none';
}

function getLocationFromColor(color) {
  return COLOR_TO_LOCATION[color] || 'Extérieur';
}

// Vérifie la couleur dans un rayon de 2 lignes autour
function getLocationForRow(sheet, row, col) {
  for (let offset = -2; offset <= 2; offset++) {
    const checkRow = row + offset;
    if (checkRow >= 0) {
      const checkColor = getCellColor(sheet, checkRow, col);
      const checkLocation = getLocationFromColor(checkColor);
      if (checkLocation !== 'Extérieur') {
        return checkLocation;
      }
    }
  }
  return 'Extérieur';
}

function isNonMatchCell(str) {
  if (!str) return true;
  const lower = str.toLowerCase().trim();
  const trimmed = str.trim();
  
  if (NON_MATCH_INDICATORS.some(indicator => lower.includes(indicator))) {
    return true;
  }
  
  if (lower === 'ehr' || lower === '- ehr' || /^-?\s*ehr\s*$/i.test(lower)) {
    return true;
  }
  
  if (lower === 'à' || lower === 'a' || lower === 'match') return true;
  if (/^\d+$/.test(trimmed)) return true;
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) return true;
  
  return false;
}

function parseMatchCell(cellStr, team, date, day, location) {
  let cleaned = cleanCellStr(cellStr);
  
  // Supprimer les commentaires après virgules
  cleaned = cleaned.replace(/\s*,\s*.*/g, '');
  
  if (!cleaned || isNonMatchCell(cleaned)) {
    return null;
  }
  
  const time = extractTime(cleaned);
  
  // Nettoyer pour extraire les noms
  let matchCleaned = cleaned;
  if (time) {
    matchCleaned = matchCleaned.replace(/à\s*\d{1,2}[h:][0-9]{2}/i, '').trim();
  }
  matchCleaned = cleanCellStr(matchCleaned);
  
  // Supprimer les commentaires entre parenthèses
  matchCleaned = matchCleaned.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  
  // Déterminer home/away basé sur la position de EHR/HR dans le texte
  let homeTeam = null, awayTeam = null;
  let isHome = false, isAway = false;
  
  const matchType = 'Championnat';
  
  // Vérifier si le texte contient un séparateur
  if (matchCleaned.includes(' vs ') || matchCleaned.includes(' - ')) {
    const separator = matchCleaned.includes(' vs ') ? ' vs ' : ' - ';
    const parts = matchCleaned.split(separator).map(p => p.trim());
    
    if (parts.length >= 2) {
      let team1 = parts[0];
      let team2 = parts.slice(1).join(separator).trim();
      
      const t1IsEHR = isEHRTeam(team1);
      const t2IsEHR = isEHRTeam(team2);
      
      // Si team1 est EHR, alors c'est à domicile pour l'équipe de la colonne
      if (t1IsEHR && !t2IsEHR) {
        homeTeam = team;
        awayTeam = team2;
        isHome = true;
        isAway = false;
      } 
      // Si team2 est EHR, alors c'est à l'extérieur
      else if (t2IsEHR && !t1IsEHR) {
        homeTeam = team1;
        awayTeam = team;
        isHome = false;
        isAway = true;
        location = 'Extérieur';
      }
      // Si les deux sont EHR, match interne
      else if (t1IsEHR && t2IsEHR) {
        homeTeam = team1;
        awayTeam = team2;
        isHome = true;
        isAway = true;
      }
      // Aucun n'est EHR, utiliser l'équipe de la colonne comme home
      else {
        homeTeam = team;
        awayTeam = team1;
        isHome = true;
        isAway = false;
      }
    }
  } else {
    // Pas de séparateur, c'est l'adversaire
    let opponent = cleanCellStr(matchCleaned);
    
    // Si l'adversaire contient "EHR" ou "HR", c'est probablement une cellule avec plusieurs infos
    // Ex: "EHR 1 Homécourt et Bousse" -> extraire "Homécourt et Bousse"
    // On remplace EHR/HR et les chiffres qui suivent par rien
    if (/\bEHR\b/i.test(opponent) || /\bHR\b/i.test(opponent)) {
      // Remplacer "EHR" ou "HR" suivi éventuellement d'un nombre et d'un espace par rien
      opponent = opponent.replace(/\bEHR\s*\d*\b/gi, '').replace(/\bHR\s*\d*\b/gi, '');
      opponent = cleanCellStr(opponent);
      // Supprimer les virgules au début
      opponent = opponent.replace(/^\s*,\s*/, '');
    }
    
    if (opponent.length >= 2 && !isNonMatchCell(opponent)) {
      // Vérifier si l'adversaire est EHR
      const opponentIsEHR = isEHRTeam(opponent);
      
      if (!opponentIsEHR) {
        // L'équipe de la colonne (EHR) joue contre l'adversaire à domicile
        homeTeam = team;
        awayTeam = opponent;
        isHome = true;
        isAway = false;
      } else {
        // L'adversaire est EHR, donc c'est à l'extérieur
        homeTeam = opponent;
        awayTeam = team;
        isHome = false;
        isAway = true;
        location = 'Extérieur';
      }
    } else {
      return null;
    }
  }
  
  // Si c'est à l'extérieur, la salle doit être Extérieur
  if (isAway && !isHome) {
    location = 'Extérieur';
  }
  
  // Nettoyer les noms
  homeTeam = normalizeTeamName(homeTeam);
  awayTeam = normalizeTeamName(awayTeam);
  
  return {
    date,
    day,
    home_team: homeTeam,
    away_team: awayTeam,
    match_display: `${homeTeam}${awayTeam ? ` vs ${awayTeam}` : ''}`,
    time,
    location,
    match_type: matchType,
    category: team,
    is_home: isHome,
    is_away: isAway,
    is_internal: isEHRTeam(homeTeam) && isEHRTeam(awayTeam)
  };
}

function parseExcelFile(filePath) {
  const workbook = XLSX.readFile(filePath, { 
    cellStyles: true, 
    cellNF: false, 
    cellHTML: false,
    cellDates: true 
  });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false });
  
  console.log('Total rows:', jsonData.length);
  
  // Lire les métadonnées
  const lastUpdated = jsonData[0]?.[0]?.toString().replace('MAJ le ', '')?.trim() || null;
  const season = jsonData[0]?.[5]?.toString().trim() || 'SAISON 2026-2027';
  
  // Ligne 12 (index 11) = équipes
  const teamsRow = jsonData[11] || [];
  
  // Construire la map colonne -> équipe
  const columnToTeam = new Map();
  
  for (let col = 5; col < 23; col++) {
    if (teamsRow[col]) {
      let teamName = String(teamsRow[col]).trim();
      teamName = teamName.replace(/^\s*[-–]\s*/, '');
      teamName = teamName.replace(/\s+/g, ' ').trim();
      const normalized = normalizeTeamName(teamName);
      if (normalized && normalized !== 'null') {
        columnToTeam.set(col, normalized);
      }
    }
  }
  
  console.log('\nÉquipes par colonne:', Object.fromEntries(columnToTeam));
  
  const matches = [];
  
  // Objet pour stocker les réservations de camionnettes par date
  // Format: { '2026-09-27': [{ team: 'Seniors M', camionnette: 'N°1' }, ...] }
  const camionnetteReservationsByDate = {};
  
  // Parcourir toutes les lignes à partir de la ligne 14 (index 13)
  for (let row = 14; row < jsonData.length; row++) {
    // Vérifier s'il y a une date en colonne E (index 4)
    const dateCell = jsonData[row]?.[4];
    let currentDate = null, currentDay = null;
    
    if (dateCell && String(dateCell).trim().includes('/')) {
      const dateStr = String(dateCell).trim();
      const [datePart, dayPart] = dateStr.split('\n');
      currentDate = datePart?.trim() || null;
      currentDay = dayPart?.trim() || null;
    }
    
    // Si pas de date sur cette ligne, essayer de trouver la date la plus proche au-dessus
    if (!currentDate) {
      for (let r = row - 1; r >= 14; r--) {
        const checkDateCell = jsonData[r]?.[4];
        if (checkDateCell && String(checkDateCell).trim().includes('/')) {
          const dateStr = String(checkDateCell).trim();
          const [datePart, dayPart] = dateStr.split('\n');
          currentDate = datePart?.trim() || null;
          currentDay = dayPart?.trim() || null;
          break;
        }
      }
    }
    
    if (!currentDate) {
      continue;
    }
    
    const formattedDate = formatDate(currentDate);
    
    // Parcourir toutes les colonnes d'équipes (F-W = 5-22)
    for (let col = 5; col < 23; col++) {
      const team = columnToTeam.get(col);
      
      // Si pas d'équipe définie pour cette colonne, sauter
      if (!team) continue;
      
      const cellValue = jsonData[row]?.[col];
      
      // Si cellule vide, sauter
      if (!cellValue || String(cellValue).trim() === '') {
        continue;
      }
      
      const cellStr = String(cellValue).trim();
      
      // Vérifier si c'est une cellule non-match
      if (isNonMatchCell(cellStr)) {
        continue;
      }
      
      // Obtenir la salle basée sur la couleur
      let cellLocation = getLocationForRow(firstSheet, row, col);
      
      // Vérifier si c'est une mention explicite de Kanfen
      if (cellStr.toLowerCase().includes('kanfen')) {
        cellLocation = 'Kanfen';
      }
      
      // Parser la cellule pour obtenir le match
      const matchInfo = parseMatchCell(cellStr, team, formattedDate, currentDay, cellLocation);
      
      if (matchInfo) {
        // Vérifier la camionnette UNIQUEMENT dans la cellule de l'équipe elle-même
        // Cela évite que toutes les équipes d'une ligne aient la même camionnette
        let camionnette = null;
        
        // Chercher dans la cellule de l'équipe (pas dans les colonnes C/D)
        const cellLower = cellStr.toLowerCase();
        if (cellLower.includes('camionnette') || cellLower.includes('camion')) {
          // Extraire le numéro ou le nom de la camionnette
          const camionMatch = cellStr.match(/(?:camionnette|camion|véhicule)\s*(?:n°\s*)?(\d+|[A-Za-z]+)/i);
          if (camionMatch) {
            camionnette = `N°${camionMatch[1].trim()}`;
          } else {
            // Si pas de numéro trouvé, prendre toute la mention
            camionnette = cellStr;
          }
          
          // Stocker dans les réservations par date
          if (!camionnetteReservationsByDate[formattedDate]) {
            camionnetteReservationsByDate[formattedDate] = [];
          }
          camionnetteReservationsByDate[formattedDate].push({
            team: team,
            camionnette: camionnette,
            column: col
          });
        }
        
        // Vérifier aussi les colonnes C et D (2 et 3) pour les réservations de camionnettes
        // qui sont globales à la ligne (indépendantes des équipes)
        let lineCamionnette = null;
        for (const colIdx of [2, 3]) {
          const val = jsonData[row]?.[colIdx] ? String(jsonData[row][colIdx]).trim() : null;
          if (val && val.toLowerCase().includes('camionnette') && 
              !['Dispo Salles', 'Réservation camionnettes', 'N° 1', 'N° 2', 'Coach', 
                'Réservation camionnette', 'Dispo', 'Salles', 'Réservation', 'camionnettes'].includes(val)) {
            lineCamionnette = val;
            break;
          }
        }
        
        // Si une camionnette est mentionnée dans les colonnes C/D, l'associer à TOUTES les équipes de cette ligne
        // mais de manière lisible
        if (lineCamionnette && !camionnette) {
          // Stocker dans les réservations par date avec indication "Ligne"
          if (!camionnetteReservationsByDate[formattedDate]) {
            camionnetteReservationsByDate[formattedDate] = [];
          }
          camionnetteReservationsByDate[formattedDate].push({
            team: team,
            camionnette: lineCamionnette,
            column: col,
            note: 'Réservation ligne'
          });
        }
        
        matchInfo.original_column = col;
        matchInfo.original_row = row;
        matchInfo.season = season;
        matchInfo.last_updated = lastUpdated;
        matchInfo.camionnette = camionnette || lineCamionnette;
        
        matches.push(matchInfo);
      }
    }
  }
  
  return { matches, camionnetteReservationsByDate };
}

const args = process.argv.slice(2);
const inputFile = args[0] || '/Users/neobeamon/Downloads/derPLANNING MATCHS 2026-2027 HR.xlsx';
const outputFile = args[1] || join(__dirname, '..', 'data', 'matches.json');

try {
  console.log('Parsing avec logique v10 (alignement par COLONNE)...\n');
  const { matches, camionnetteReservationsByDate } = parseExcelFile(inputFile);
  
  // Sauvegarder les matchs
  writeFileSync(outputFile, JSON.stringify(matches, null, 2));
  console.log(`Found ${matches.length} matches\n`);
  
  // Sauvegarder aussi les réservations de camionnettes
  const camionnetteFile = join(__dirname, '..', 'data', 'camionnette-reservations.json');
  writeFileSync(camionnetteFile, JSON.stringify(camionnetteReservationsByDate, null, 2));
  console.log(`Saved camionnette reservations to ${camionnetteFile}\n`);
  
  // Statistiques
  const locs = new Set();
  matches.forEach(m => m.location && locs.add(m.location));
  console.log('Locations:', Array.from(locs).sort());
  
  console.log(`\nStats:`);
  console.log(`  Home: ${matches.filter(m => m.is_home && !m.is_away).length}`);
  console.log(`  Away: ${matches.filter(m => m.is_away && !m.is_home).length}`);
  console.log(`  Internal: ${matches.filter(m => m.is_internal).length}`);
  
  // Répartition par salle (uniquement domicile EHR)
  const homeWithLocation = matches.filter(m => m.is_home && !m.is_away && m.location && m.location !== 'Extérieur');
  console.log(`\nMatches à domicile avec salle EHR: ${homeWithLocation.length}`);
  const locCount = {};
  homeWithLocation.forEach(m => {
    const loc = m.location || 'null';
    locCount[loc] = (locCount[loc] || 0) + 1;
  });
  console.log('Répartition par salle (domicile EHR):', locCount);
  
  // Matches à l'extérieur
  const awayMatches = matches.filter(m => m.is_away && !m.is_home);
  console.log(`\nMatches à l'extérieur: ${awayMatches.length}`);
  
  // Nombre de matchs par équipe EHR
  const ehrTeams = new Set(EHR_TEAM_NAMES);
  const teamMatchCount = {};
  matches.forEach(m => {
    if (m.home_team && ehrTeams.has(m.home_team)) {
      teamMatchCount[m.home_team] = (teamMatchCount[m.home_team] || 0) + 1;
    }
    if (m.away_team && ehrTeams.has(m.away_team)) {
      teamMatchCount[m.away_team] = (teamMatchCount[m.away_team] || 0) + 1;
    }
  });
  console.log('\nNombre de matchs par équipe EHR:');
  Object.entries(teamMatchCount).sort((a, b) => b[1] - a[1]).forEach(([team, count]) => {
    console.log(`  ${team}: ${count}`);
  });
  
  // Vérifier F17 CDF
  const f17cdfMatches = matches.filter(m => 
    (m.home_team === 'F17 CDF' || m.away_team === 'F17 CDF')
  );
  console.log(`\nF17 CDF: ${f17cdfMatches.length} matchs`);
  f17cdfMatches.slice(0, 10).forEach(m => {
    console.log(`  ${m.date} (${m.day}): ${m.home_team} vs ${m.away_team} - ${m.location} - ${m.time || '?'} - ${m.is_home ? 'DOM' : 'EXT'}`);
  });
  
  // Vérifier F17 departementale
  const f17depMatches = matches.filter(m => 
    (m.home_team === 'F17 departementale' || m.away_team === 'F17 departementale')
  );
  console.log(`\nF17 departementale: ${f17depMatches.length} matchs`);
  f17depMatches.slice(0, 10).forEach(m => {
    console.log(`  ${m.date} (${m.day}): ${m.home_team} vs ${m.away_team} - ${m.location} - ${m.time || '?'} - ${m.is_home ? 'DOM' : 'EXT'}`);
  });
  
  // Vérifier les matchs du 26/09
  const sep26Matches = matches.filter(m => m.date === '2026-09-26');
  console.log(`\nMatchs du 26/09/2026: ${sep26Matches.length} matchs`);
  sep26Matches.forEach(m => {
    console.log(`  ${m.home_team} vs ${m.away_team} - ${m.location} - ${m.time || '?'} - ${m.is_home ? 'DOM' : 'EXT'} (col ${m.original_column})`);
  });
  
  // Vérifier les matchs du 27/09
  const sep27Matches = matches.filter(m => m.date === '2026-09-27');
  console.log(`\nMatchs du 27/09/2026: ${sep27Matches.length} matchs`);
  sep27Matches.forEach(m => {
    console.log(`  ${m.home_team} vs ${m.away_team} - ${m.location} - ${m.time || '?'} - ${m.is_home ? 'DOM' : 'EXT'} (col ${m.original_column})`);
  });
  
  console.log('\nSaved to', outputFile);
} catch (error) {
  console.error('Error:', error); 
  process.exit(1);
}
