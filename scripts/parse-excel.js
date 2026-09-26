// scripts/parse-excel-v9.js
// Parser FINAL basé sur les COULEURS des cellules de match
// Chaque match a une couleur de fond qui détermine la salle

const XLSX = require('xlsx');
const { writeFileSync } = require('fs');
const { join } = require('path');

// Mapping couleur RGB -> Salle (basé sur les exemples utilisateur)
const COLOR_TO_LOCATION = {
  'FFFF00': 'Rodemack',        // Jaune
  '00B0F0': 'Hettange (Hall)',  // Bleu
  '92D050': 'Hettange (Poly)',  // Vert
  'FFC000': 'Kanfen',          // Orange (à confirmer)
  'FFFFFF': 'Extérieur',        // Blanc
  'none': 'Extérieur'          // Pas de couleur
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
  "- 17 ans G (Dépt)": "M17 departementale",
  "17 ans G": "M17 departementale",
  "- 17 ans F équip 1 ( CDF)": "F17 CDF",
  "17 ans F équip 1": "F17 CDF",
  "- 17 ans F équip 2 ( Dépt)": "F17 departementale",
  "17 ans F équip 2": "F17 departementale",
  "- 15 ans  M (Région)": "M15 region",
  "15 ans M": "M15 region",
  "15 ans  M": "M15 region",
  "- 15 ans  (Dépt)": "M15 departementale",
  "15 ans": "M15 departementale",
  "- 15 ans F (Région)": "F15 region",
  "15 ans F": "F15 region",
  "- 15 ans F (Dépt)": "F15 departementale",
  "- 13 ans M (Région)": "M13 region",
  "13 ans M": "M13 region",
  "- 13 ans M (Dépt)": "M13 departementale",
  "13 ans M": "M13 departementale",
  "- 13 ans F (Dépt)": "F13 departementale",
  "13 ans F": "F13 departementale",
  "- 11 ans Masculins (InterDépt)": "M11 interdepartementale",
  "11 ans Masculins": "M11 interdepartementale",
  "11 ans Masculins (InterDépt)": "M11 interdepartementale",
  "- 11 ans Féminines": "F11 departementale",
  "11 ans Féminines": "F11 departementale",
  "Tournoi -9/-11 Petit terrain": "Tournoi -9/-11",
  "Tournoi -9/-11": "Tournoi -9/-11",
  "Féminines EHR": "F11 departementale",
  "EHR 1": "F17 CDF",
  "EHR 2": "F17 departementale",
  "EHR": "EHR",
  "Masc EHR Dépt": "M17 departementale",
  "Masc EHR  -18G": "M17 departementale",
  "Féminines HR 1": "F17 CDF",
  "Féminines HR 2": "F17 departementale",
  "Masc -15G EHR 1": "M15 region",
  "Masc -15G EHR 2": "M15 departementale",
  "Masc-13G EHR 1": "M13 region",
  "Masc-13G  EHR 2": "M13 departementale",
  "Féminines -15F EHR 1": "F15 region",
  "Féminines -15F EHR 2": "F15 departementale",
  "Féminines -13F EHR": "F13 departementale",
  "Masculins -11G EHR 1": "M11 interdepartementale",
  "Masculins -11G EHR 2": "M11 interdepartementale",
  "Féminines -11 F EHR": "F11 departementale",
  "Féminines 1": "F17 CDF",
  "Féminines HR 1 championnat de france poule 9": "F17 CDF",
  "Féminines HR 2 départemental": "F17 departementale",
  "Masc -15G EHR 1 Poule": "M15 region",
  "Masc -15G EHR 2 Poule": "M15 departementale",
  "Féminines -15F EHR 1 Poule 2": "F15 region",
  "Féminines -15F EHR 2": "F15 departementale",
  "Masc-13G EHR 1 Poule 3": "M13 region",
  "-9 -11 Petit terrain": "Tournoi -9/-11"
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

function cleanTeamName(name) {
  if (!name) return name;
  let cleaned = String(name).trim();
  cleaned = cleaned.replace(/^\s*[-–]\s*/, '');
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/\s+\(.*?\)\s*/g, '');
  return cleaned;
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

// Fonction pour obtenir la couleur d'une cellule
function getCellColor(sheet, row, col) {
  const cellRef = XLSX.utils.encode_cell({r: row, c: col});
  const cell = sheet[cellRef];
  if (cell && cell.s && cell.s.fgColor) {
    return cell.s.fgColor.rgb || cell.s.fgColor.indexed || cell.s.fgColor.theme || 'none';
  }
  return 'none';
}

// Fonction pour obtenir la salle basée sur la couleur
function getLocationFromColor(color) {
  return COLOR_TO_LOCATION[color] || 'Extérieur';
}

// Obtenir la salle pour un match en vérifiant la couleur de la cellule
// et les cellules voisines dans un rayon de 2 lignes
function getLocationForMatch(sheet, row, col) {
  // Vérifier la couleur de la cellule du match elle-même
  const color = getCellColor(sheet, row, col);
  const location = getLocationFromColor(color);
  
  if (location !== 'Extérieur') {
    return location;
  }
  
  // Si pas de couleur sur la cellule du match, vérifier les lignes voisines
  // (les 3 lignes de couleur avant/après)
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
  
  // Si toujours pas de couleur, vérifier la colonne E (date) pour voir si c'est une ligne de date
  // et essayer de déduire la salle des autres colonnes sur les mêmes lignes
  const dateCell = getCellColor(sheet, row, 4); // Colonne E
  const dateColor = getLocationFromColor(dateCell);
  if (dateColor !== 'Extérieur') {
    return dateColor;
  }
  
  return 'Extérieur';
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
  // Ligne 13 (index 12) = catégories
  // Ligne 14 (index 13) = coachs
  const teamsRow = jsonData[11] || [];
  const categoriesRow = jsonData[12] || [];
  const coachesRow = jsonData[13] || [];
  
  // Construire les maps par colonne (équipes, catégories, coachs)
  const teamMap = new Map();
  const categoryMap = new Map();
  const coachMap = new Map();
  
  // Les équipes sont dans les colonnes F-W (5-22)
  for (let col = 5; col < 23; col++) {
    if (teamsRow[col]) {
      let teamName = String(teamsRow[col]).trim();
      teamName = teamName.replace(/^\s*[-–]\s*/, '');
      teamName = teamName.replace(/\s+/g, ' ').trim();
      const normalized = normalizeTeamName(teamName);
      teamMap.set(col, normalized);
    }
    if (categoriesRow[col]) {
      let cat = String(categoriesRow[col]).trim().replace(/\r/g, '').replace(/\n/g, ' ');
      cat = cat.replace(/\s+/g, ' ').trim();
      categoryMap.set(col, cat);
    }
    if (coachesRow[col]) {
      coachMap.set(col, String(coachesRow[col]).trim());
    }
  }
  
  console.log('\nÉquipes trouvées:', Array.from(teamMap.values()).filter(t => t && t !== 'null'));
  
  const matches = [];
  
  // Parcourir toutes les lignes à partir de la ligne 14 (index 13)
  for (let row = 14; row < jsonData.length; row++) {
    // Vérifier s'il y a une date en colonne E (index 4)
    const dateCell = jsonData[row]?.[4];
    let date = null, day = null;
    
    if (dateCell && String(dateCell).trim().includes('/')) {
      const dateStr = String(dateCell).trim();
      const [datePart, dayPart] = dateStr.split('\n');
      date = datePart?.trim() || null;
      day = dayPart?.trim() || null;
    }
    
    // Parcourir toutes les colonnes d'équipes (F-W = 5-22)
    for (let col = 5; col < 23; col++) {
      const team = teamMap.get(col) || null;
      const category = categoryMap.get(col) || null;
      const coach = coachMap.get(col) || null;
      
      // Si pas d'équipe définie pour cette colonne, sauter
      if (!team || team === 'null' || team === '') continue;
      
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
      
      // Si on n'a pas trouvé de date sur cette ligne, essayer de trouver la date la plus proche au-dessus
      let currentDate = date;
      let currentDay = day;
      if (!currentDate) {
        // Chercher la date la plus proche au-dessus
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
      
      // Obtenir la salle basée sur la couleur
      let cellLocation = getLocationForMatch(firstSheet, row, col);
      
      // Vérifier si c'est une mention explicite de Kanfen
      if (cellStr.toLowerCase().includes('kanfen')) {
        cellLocation = 'Kanfen';
      }
      
      // Extraire l'heure
      const time = extractTime(cellStr);
      
      // Nettoyer la cellule pour extraire les équipes
      let cleaned = cleanCellStr(cellStr);
      // Supprimer les commentaires entre parenthèses ou après virgules
      cleaned = cleaned.replace(/\s*\([^)]*\)\s*/g, ' ');
      cleaned = cleaned.replace(/\s*,\s*.*/g, ' '); // Supprimer tout après une virgule
      if (time) {
        cleaned = cleaned.replace(/à\s*\d{1,2}[h:][0-9]{2}/i, '').trim();
      }
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      
      // Déterminer si c'est un match à domicile ou extérieur
      let homeTeam = null, awayTeam = null;
      let isHome = false, isAway = false;
      let matchType = 'Championnat';
      
      // Vérifier si le texte contient un séparateur (vs ou -)
      if (cleaned.includes(' vs ') || cleaned.includes(' - ')) {
        const separator = cleaned.includes(' vs ') ? ' vs ' : ' - ';
        const parts = cleaned.split(separator).map(p => cleanTeamName(p.trim()));
        
        if (parts.length >= 2) {
          let team1 = parts[0];
          let team2 = parts.slice(1).join(separator).trim();
          team2 = cleanTeamName(team2);
          
          const t1IsEHR = isEHRTeam(team1);
          const t2IsEHR = isEHRTeam(team2);
          
          if (t1IsEHR && !t2IsEHR) {
            // Team1 est EHR, c'est à domicile
            homeTeam = team1;
            awayTeam = team2;
            isHome = true;
            isAway = false;
          } else if (t2IsEHR && !t1IsEHR) {
            // Team2 est EHR, c'est à l'extérieur
            homeTeam = team1;
            awayTeam = team2;
            isHome = false;
            isAway = true;
            cellLocation = 'Extérieur';
          } else if (t1IsEHR && t2IsEHR) {
            // Match interne EHR
            homeTeam = team1;
            awayTeam = team2;
            isHome = true;
            isAway = true;
          } else {
            // Aucun n'est EHR explicitement, utiliser l'équipe de la colonne
            if (isEHRTeam(team)) {
              homeTeam = team;
              awayTeam = team1;
              isHome = true;
              isAway = false;
            } else {
              homeTeam = team1;
              awayTeam = team2;
              isHome = false;
              isAway = true;
              cellLocation = 'Extérieur';
            }
          }
        }
      } else {
        // Pas de séparateur, vérifier si c'est un nom d'adversaire
        const cleanedOpponent = cleanTeamName(cleaned);
        
        if (cleanedOpponent.length >= 2 && !isNonMatchCell(cleanedOpponent)) {
          const currentTeamIsEHR = isEHRTeam(team);
          const opponentIsEHR = isEHRTeam(cleanedOpponent);
          
          if (currentTeamIsEHR && !opponentIsEHR) {
            // L'équipe EHR joue contre un adversaire (à domicile)
            homeTeam = team;
            awayTeam = cleanedOpponent;
            isHome = true;
            isAway = false;
          } else if (opponentIsEHR && !currentTeamIsEHR) {
            // L'adversaire est EHR, donc c'est à l'extérieur
            homeTeam = cleanedOpponent;
            awayTeam = team;
            isHome = false;
            isAway = true;
            cellLocation = 'Extérieur';
          } else {
            // Si les deux sont EHR ou aucun n'est EHR
            homeTeam = team;
            awayTeam = cleanedOpponent;
            isHome = currentTeamIsEHR;
            isAway = !currentTeamIsEHR;
            if (!currentTeamIsEHR) {
              cellLocation = 'Extérieur';
            }
          }
        } else {
          // Cellule non valide
          continue;
        }
      }
      
      // Vérifier le type de match
      const lowerCleaned = cleaned.toLowerCase();
      if (lowerCleaned.includes('amical')) {
        matchType = 'Amical';
      } else if (lowerCleaned.includes('tournoi')) {
        matchType = 'Tournoi';
      } else if (lowerCleaned.includes('coupe')) {
        matchType = 'Coupe';
      }
      
      // Si c'est un match à l'extérieur, la salle doit être Extérieur
      if (isAway && !isHome) {
        cellLocation = 'Extérieur';
      }
      
      // Nettoyer les noms d'équipes
      homeTeam = normalizeTeamName(homeTeam);
      awayTeam = normalizeTeamName(awayTeam);
      
      // Ne garder que les matchs impliquant une équipe EHR
      if (!isEHRTeam(homeTeam) && !isEHRTeam(awayTeam)) {
        continue;
      }
      
      // Filtrer les matchs où l'équipe est juste "EHR" sans autre détail
      if ((homeTeam === 'EHR' || homeTeam === null) && (awayTeam === 'EHR' || awayTeam === null)) {
        continue;
      }
      
      // Si un des deux est "EHR" seul, essayer de le remplacer par l'équipe de la colonne
      if (homeTeam === 'EHR' && team && team !== 'EHR') {
        homeTeam = team;
      }
      if (awayTeam === 'EHR' && team && team !== 'EHR') {
        awayTeam = team;
      }
      
      // Vérifier la camionnette (colonnes C et D = indices 2 et 3)
      let camionnette = null;
      for (const colIdx of [2, 3]) {
        const val = jsonData[row]?.[colIdx] ? String(jsonData[row][colIdx]).trim() : null;
        if (val && !['Dispo Salles', 'Réservation camionnettes', 'N° 1', 'N° 2', 'Coach', 
                      'Réservation camionnette', 'Dispo', 'Salles', 'Réservation', 'camionnettes'].includes(val)) {
          camionnette = val;
          break;
        }
      }
      
      const matchInfo = {
        date: formattedDate,
        day: currentDay,
        home_team: homeTeam,
        away_team: awayTeam,
        match_display: `${homeTeam}${awayTeam ? ` vs ${awayTeam}` : ''}`,
        time: time,
        location: cellLocation,
        match_type: matchType,
        category: category || homeTeam,
        coach: coach,
        is_home: isHome,
        is_away: isAway,
        is_internal: isEHRTeam(homeTeam) && isEHRTeam(awayTeam),
        original_team: team,
        original_column: col,
        original_row: row,
        season: season,
        last_updated: lastUpdated,
        camionnette: camionnette
      };
      
      matches.push(matchInfo);
    }
  }
  
  return matches;
}

const args = process.argv.slice(2);
const inputFile = args[0] || '/Users/neobeamon/Downloads/derPLANNING MATCHS 2026-2027 HR.xlsx';
const outputFile = args[1] || join(__dirname, '..', 'data', 'matches.json');

try {
  console.log('Parsing avec logique v9 (basée sur les couleurs des cellules)...\n');
  const matches = parseExcelFile(inputFile);
  writeFileSync(outputFile, JSON.stringify(matches, null, 2));
  console.log(`Found ${matches.length} matches\n`);
  
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
  
  // Vérifier les matchs de F17 departementale
  const f17depMatches = matches.filter(m => 
    (m.home_team === 'F17 departementale' || m.away_team === 'F17 departementale')
  );
  console.log(`\nF17 departementale: ${f17depMatches.length} matchs`);
  f17depMatches.forEach(m => {
    console.log(`  ${m.date} (${m.day}): ${m.home_team} vs ${m.away_team} - ${m.location} - ${m.time || '?'} - ${m.is_home ? 'DOM' : 'EXT'}`);
  });
  
  // Vérifier les matchs du 27/09
  const sep27Matches = matches.filter(m => m.date === '2026-09-27');
  console.log(`\nMatchs du 27/09/2026: ${sep27Matches.length} matchs`);
  sep27Matches.forEach(m => {
    console.log(`  ${m.home_team} vs ${m.away_team} - ${m.location} - ${m.time || '?'} - ${m.is_home ? 'DOM' : 'EXT'}`);
  });
  
  console.log('\nSaved to', outputFile);
} catch (error) {
  console.error('Error:', error); 
  process.exit(1);
}
