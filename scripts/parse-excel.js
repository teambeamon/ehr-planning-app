// scripts/parse-excel-v11.js
// Parser CORRIGÉ et SIMPLIFIÉ
// Chaque COLONNE correspond à une ÉQUIPE FIXE (ligne 12 = équipes, colonnes F-W = 5-22)
// Chaque LIGNE avec une DATE en colonne E correspond à une date de matchs
// Les COLONNES C et D (indices 2 et 3) contiennent les réservations de CAMIONNETTES pour TOUTE la ligne

const XLSX = require('xlsx');
const { writeFileSync, mkdirSync, existsSync } = require('fs');
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

// Normalisation des noms d'équipes
const NORMALIZE_TEAMS = {
  'SENIORS HR': 'Seniors M',
  'SENIORS G': 'Seniors M',
  'SENIORS': 'Seniors M',
  'SENIORS FILLES HR 1': 'Seniors F1',
  'SENIORS FILLES 1': 'Seniors F1',
  'SENIORS F1': 'Seniors F1',
  'SENIORS FILLES HR 2': 'Seniors F2',
  'SENIORS FILLES 2': 'Seniors F2',
  'SENIORS F2': 'Seniors F2',
  '17 ans G (Dépt)': 'M17 departementale',
  '17 ans G': 'M17 departementale',
  '- 17 ans G (Dépt)': 'M17 departementale',
  '17 ans G (Région)': 'M17 region',
  '- 17 ans G (Région)': 'M17 region',
  '17 ans F équip 1 ( CDF)': 'F17 CDF',
  '17 ans F équip 1': 'F17 CDF',
  '- 17 ans F équip 1 ( CDF)': 'F17 CDF',
  '17 ans F équip 2 ( Dépt)': 'F17 departementale',
  '17 ans F équip 2': 'F17 departementale',
  '- 17 ans F équip 2 ( Dépt)': 'F17 departementale',
  '15 ans M (Région)': 'M15 region',
  '15 ans  M (Région)': 'M15 region',
  '15 ans M': 'M15 region',
  '- 15 ans  M (Région)': 'M15 region',
  '15 ans (Dépt)': 'M15 departementale',
  '- 15 ans  (Dépt)': 'M15 departementale',
  '15 ans': 'M15 departementale',
  '15 ans F (Région)': 'F15 region',
  '- 15 ans F (Région)': 'F15 region',
  '15 ans F': 'F15 region',
  '15 ans F (Dépt)': 'F15 departementale',
  '- 15 ans F (Dépt)': 'F15 departementale',
  '13 ans M (Région)': 'M13 region',
  '13 ans M': 'M13 region',
  '- 13 ans M (Région)': 'M13 region',
  '13 ans M (Dépt)': 'M13 departementale',
  '- 13 ans M (Dépt)': 'M13 departementale',
  '13 ans F (Dépt)': 'F13 departementale',
  '- 13 ans F (Dépt)': 'F13 departementale',
  '13 ans F': 'F13 departementale',
  '11 ans Masculins (InterDépt)': 'M11 interdepartementale',
  '11 ans Masculins': 'M11 interdepartementale',
  '- 11 ans Masculins (InterDépt)': 'M11 interdepartementale',
  '11 ans Féminines': 'F11 departementale',
  '- 11 ans Féminines': 'F11 departementale',
  'EHR 1': 'F17 CDF',
  'EHR 2': 'F17 departementale',
  'EHR': 'EHR',
  'Féminines EHR': 'F11 departementale'
};

// Liste des équipes EHR normalisées
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

// Mots-clés qui indiquent que ce n'est PAS un match
const NON_MATCH_KEYWORDS = [
  'journée', 'report', 'exempt', 'hall non dispo', 'dispo', 'réservation',
  'n°', 'coach', 'date', 'salles', 'bad', 'non dispo',
  'dispo salles', 'match contre', 'uniquement', 'tournaments', 'tournoi',
  '(match', 'inversion', 'demande de report', 'refus', 'a placer', 'retrait',
  'de france', 'de moselle', 'match à planifier', 'bloquée', 'skate',
  'réservation camionnettes', 'camionnette'
];

function normalizeTeamName(name) {
  if (!name) return name;
  let cleaned = String(name).trim();
  cleaned = cleaned.replace(/^[\s-]*/, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return NORMALIZE_TEAMS[cleaned] || cleaned;
}

function isEHRTeam(name) {
  if (!name) return false;
  const cleaned = String(name).trim();
  if (EHR_TEAMS.has(cleaned)) return true;
  if (/\bEHR\b/i.test(cleaned) || /\bHR\b/i.test(cleaned)) return true;
  return false;
}

function cleanText(str) {
  if (!str) return '';
  return String(str).replace(/\r/g, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
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
  const match = String(str).match(/à\s*(\d{1,2}[h:]\d{2})/i);
  return match ? match[1] : null;
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

// Obtenir la salle basée sur la couleur dans un rayon de lignes
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
  const lower = String(str).toLowerCase().trim();
  const trimmed = String(str).trim();
  
  if (NON_MATCH_KEYWORDS.some(kw => lower.includes(kw))) {
    return true;
  }
  
  if (/^ehr$/i.test(lower) || /^-?\s*ehr\s*$/i.test(lower)) {
    return true;
  }
  
  if (lower === 'à' || lower === 'a' || lower === 'match') return true;
  if (/^\d+$/.test(trimmed)) return true;
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) return true;
  
  return false;
}

function parseExcelFile(filePath) {
  const workbook = XLSX.readFile(filePath, { 
    cellStyles: true, 
    cellDates: true 
  });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false });
  
  console.log('Total rows:', jsonData.length);
  
  // Lire les métadonnées
  const lastUpdated = jsonData[0]?.[0]?.toString().replace('MAJ le ', '')?.trim() || null;
  const season = jsonData[0]?.[5]?.toString().trim() || 'SAISON 2026-2027';
  
  // Ligne 12 (index 11) = noms des équipes
  const teamsRow = jsonData[11] || [];
  
  // Mapping colonne -> équipe
  const columnToTeam = new Map();
  for (let col = 5; col < 23; col++) {
    if (teamsRow[col]) {
      let teamName = String(teamsRow[col]).trim();
      teamName = teamName.replace(/^[\s-]*/, '');
      teamName = teamName.replace(/\s+/g, ' ').trim();
      const normalized = normalizeTeamName(teamName);
      if (normalized && normalized !== 'null') {
        columnToTeam.set(col, normalized);
      }
    }
  }
  
  console.log('\nÉquipes par colonne:', Object.fromEntries(columnToTeam));
  
  const matches = [];
  
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
    
    // Lire les réservations de CAMIONNETTES pour cette ligne (colonnes C et D = indices 2 et 3)
    let lineCamionnetteC = null;
    let lineCamionnetteD = null;
    
    const camionnetteC = jsonData[row]?.[2];
    const camionnetteD = jsonData[row]?.[3];
    
    if (camionnetteC && String(camionnetteC).trim()) {
      const val = String(camionnetteC).trim();
      if (!['Dispo Salles', 'Réservation camionnettes', 'N° 1', 'N° 2', 'Coach', 
            'Réservation camionnette', 'Dispo', 'Salles', 'Réservation', 'camionnettes',
            'Réservation camionnette N°1', 'Réservation camionnette N°2'].includes(val)) {
        lineCamionnetteC = val;
      }
    }
    
    if (camionnetteD && String(camionnetteD).trim()) {
      const val = String(camionnetteD).trim();
      if (!['Dispo Salles', 'Réservation camionnettes', 'N° 1', 'N° 2', 'Coach', 
            'Réservation camionnette', 'Dispo', 'Salles', 'Réservation', 'camionnettes',
            'Réservation camionnette N°1', 'Réservation camionnette N°2'].includes(val)) {
        lineCamionnetteD = val;
      }
    }
    
    // Parcourir toutes les colonnes d'équipes (F-W = indices 5-22)
    for (let col = 5; col < 23; col++) {
      const team = columnToTeam.get(col);
      
      if (!team) continue;
      
      const cellValue = jsonData[row]?.[col];
      
      if (!cellValue || String(cellValue).trim() === '') {
        continue;
      }
      
      const cellStr = String(cellValue).trim();
      
      if (isNonMatchCell(cellStr)) {
        continue;
      }
      
      // Obtenir la salle basée sur la couleur de fond
      let cellLocation = getLocationForRow(firstSheet, row, col);
      
      // Vérifier si la cellule mentionne explicitement Kanfen
      if (cellStr.toLowerCase().includes('kanfen')) {
        cellLocation = 'Kanfen';
      }
      
      // Parser la cellule pour extraire les infos du match
      let cleaned = cleanText(cellStr);
      
      // Supprimer les commentaires après virgules
      cleaned = cleaned.replace(/\s*,\s*.*/g, '');
      
      // Extraire l'heure
      const time = extractTime(cleaned);
      
      // Nettoyer pour extraire les noms d'équipes
      let matchCleaned = time ? cleaned.replace(/à\s*\d{1,2}[h:]\d{2}/i, '').trim() : cleaned;
      matchCleaned = cleanText(matchCleaned);
      
      // Supprimer les commentaires entre parenthèses
      matchCleaned = matchCleaned.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
      
      // Déterminer home/away
      let homeTeam = null, awayTeam = null;
      let isHome = false, isAway = false;
      
      // Vérifier si le texte contient un séparateur
      if (matchCleaned.includes(' vs ') || matchCleaned.includes(' - ')) {
        const separator = matchCleaned.includes(' vs ') ? ' vs ' : ' - ';
        const parts = matchCleaned.split(separator).map(p => p.trim());
        
        if (parts.length >= 2) {
          let team1 = parts[0];
          let team2 = parts.slice(1).join(separator).trim();
          
          const t1IsEHR = isEHRTeam(team1);
          const t2IsEHR = isEHRTeam(team2);
          
          // Si team1 est EHR et team2 ne l'est pas
          if (t1IsEHR && !t2IsEHR) {
            homeTeam = team;
            awayTeam = normalizeTeamName(team2);
            isHome = true;
            isAway = false;
          }
          // Si team2 est EHR et team1 ne l'est pas
          else if (t2IsEHR && !t1IsEHR) {
            homeTeam = normalizeTeamName(team1);
            awayTeam = team;
            isHome = false;
            isAway = true;
            cellLocation = 'Extérieur';
          }
          // Si les deux sont EHR, match interne
          else if (t1IsEHR && t2IsEHR) {
            homeTeam = normalizeTeamName(team1);
            awayTeam = normalizeTeamName(team2);
            isHome = true;
            isAway = true;
          }
          // Aucun n'est EHR explicite, utiliser l'équipe de la colonne comme home
          else {
            homeTeam = team;
            awayTeam = normalizeTeamName(team1);
            isHome = true;
            isAway = false;
          }
        }
      } else {
        // Pas de séparateur, c'est un adversaire
        let opponent = cleanText(matchCleaned);
        
        // Nettoyer EHR/HR de l'adversaire
        if (/\bEHR\b/i.test(opponent) || /\bHR\b/i.test(opponent)) {
          opponent = opponent.replace(/\bEHR\s*\d*\b/gi, '').replace(/\bHR\s*\d*\b/gi, '');
          opponent = cleanText(opponent).replace(/^,\s*/, '');
        }
        
        if (opponent.length >= 2 && !isNonMatchCell(opponent)) {
          const opponentIsEHR = isEHRTeam(opponent);
          
          if (!opponentIsEHR) {
            homeTeam = team;
            awayTeam = normalizeTeamName(opponent);
            isHome = true;
            isAway = false;
          } else {
            homeTeam = normalizeTeamName(opponent);
            awayTeam = team;
            isHome = false;
            isAway = true;
            cellLocation = 'Extérieur';
          }
        } else {
          continue;
        }
      }
      
      // Si c'est à l'extérieur, la salle doit être Extérieur
      if (isAway && !isHome) {
        cellLocation = 'Extérieur';
      }
      
      // Si pas de home_team valide, sauter
      if (!homeTeam || homeTeam === 'null') {
        continue;
      }
      
      // Nettoyer les noms finaux
      homeTeam = normalizeTeamName(homeTeam);
      awayTeam = awayTeam ? normalizeTeamName(awayTeam) : null;
      
      // Déterminer la catégorie à partir de l'équipe de la colonne
      const category = team;
      
      const matchInfo = {
        date: formattedDate,
        day: currentDay,
        home_team: homeTeam,
        away_team: awayTeam,
        match_display: `${homeTeam}${awayTeam ? ` vs ${awayTeam}` : ''}`,
        time: time,
        location: cellLocation,
        match_type: 'Championnat',
        category: category,
        is_home: isHome,
        is_away: isAway,
        is_internal: isEHRTeam(homeTeam) && (awayTeam ? isEHRTeam(awayTeam) : false),
        original_column: col,
        original_row: row,
        season: season,
        last_updated: lastUpdated,
        // CAMIONNETTES : associer les camionnettes de la LIGNE à ce match
        // Si la ligne a une camionnette en C ou D, TOUTES les équipes de la ligne y ont accès
        camionnette: lineCamionnetteC || lineCamionnetteD
      };
      
      matches.push(matchInfo);
    }
  }
  
  return matches;
}

const args = process.argv.slice(2);
const inputFile = args[0] || '/Users/neobeamon/Downloads/derPLANNING MATCHS 2026-2027 HR.xlsx';
const outputDir = join(__dirname, '..', 'data');
const outputFile = join(outputDir, 'matches.json');

try {
  // Créer le répertoire data s'il n'existe pas
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  
  console.log('Parsing Excel file...\n');
  const matches = parseExcelFile(inputFile);
  writeFileSync(outputFile, JSON.stringify(matches, null, 2));
  console.log(`✅ Found ${matches.length} matches`);
  
  // Statistiques
  const locs = new Set();
  matches.forEach(m => m.location && locs.add(m.location));
  console.log('\nLocations:', Array.from(locs).sort());
  
  const homeMatches = matches.filter(m => m.is_home && !m.is_away);
  const awayMatches = matches.filter(m => m.is_away && !m.is_home);
  const internalMatches = matches.filter(m => m.is_internal);
  console.log(`\n📊 Stats:`);
  console.log(`  🏠 Home: ${homeMatches.length}`);
  console.log(`  🚀 Away: ${awayMatches.length}`);
  console.log(`  🔄 Internal: ${internalMatches.length}`);
  
  // Répartition par salle (uniquement domicile EHR)
  const homeWithLocation = matches.filter(m => m.is_home && !m.is_away && m.location && m.location !== 'Extérieur');
  console.log(`\n📍 Matches à domicile avec salle EHR: ${homeWithLocation.length}`);
  const locCount = {};
  homeWithLocation.forEach(m => {
    const loc = m.location || 'null';
    locCount[loc] = (locCount[loc] || 0) + 1;
  });
  console.log('Répartition par salle:', locCount);
  
  // Matches à l'extérieur
  console.log(`\n🚪 Matches à l'extérieur: ${awayMatches.length}`);
  
  // Camionnettes
  const withCamionnette = matches.filter(m => m.camionnette);
  console.log(`\n🚚 Camionnettes réservées: ${withCamionnette.length} matchs`);
  const camionnetteCount = {};
  withCamionnette.forEach(m => {
    const c = m.camionnette || 'Aucune';
    camionnetteCount[c] = (camionnetteCount[c] || 0) + 1;
  });
  console.log('Répartition camionnettes:', camionnetteCount);
  
  console.log(`\n✅ Saved to ${outputFile}`);
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
