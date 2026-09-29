// scripts/parse-excel-v12.js
// Parser CORRIGÉ selon la logique utilisateur
// Structure du fichier:
// - Ligne 12: noms des équipes (par colonne)
// - Chaque case dans la colonne E qui est une date correspond à 3 lignes pour décrire le match
// - Les 3 lignes (date + 0, date + 1, date + 2) ont la couleur qui détermine la salle
// - Colonne E: date du match
// - Colonnes C et D: réservations de camionnettes pour TOUTE la ligne
// - Jaune = Rodemack, Bleu = Hall Hettange, Vert = Poly Hettange, Orange = Kanfen, Blanc = Extérieur

const XLSX = require('xlsx');
const { writeFileSync, mkdirSync, existsSync } = require('fs');
const { join } = require('path');

// Mapping couleur RGB -> Salle (corrigé selon spécifications utilisateur)
const COLOR_TO_LOCATION = {
  'FFFF00': 'Rodemack',        // Jaune
  '00B0F0': 'Hettange (Hall)',  // Bleu
  '92D050': 'Hettange (Poly)',  // Vert
  'FFC000': 'Kanfen',          // Orange
  'FFFFFF': 'Extérieur',        // Blanc
  'none': 'Extérieur'
};

// Normalisation des noms d'équipes (simplifié et corrigé)
const NORMALIZE_TEAMS = {
  'SENIORS HR': 'Seniors M',
  'SENIORS G': 'Seniors M',
  'SENIORS': 'Seniors M',
  'SG': 'Seniors M',
  'SENIORS FILLES HR 1': 'Seniors F1',
  'SENIORS FILLES 1': 'Seniors F1',
  'SENIORS F1': 'Seniors F1',
  'SF1': 'Seniors F1',
  'SENIORS FILLES HR 2': 'Seniors F2',
  'SENIORS FILLES 2': 'Seniors F2',
  'SENIORS F2': 'Seniors F2',
  'SF2': 'Seniors F2',
  '17 ans G (Dépt)': 'M17 departementale',
  '17 ans G': 'M17 departementale',
  '- 17 ans G (Dépt)': 'M17 departementale',
  '17G Dep': 'M17 departementale',
  '17 ans G (Région)': 'M17 region',
  '- 17 ans G (Région)': 'M17 region',
  '17G Reg': 'M17 region',
  '17 ans F équip 1 ( CDF)': 'F17 CDF',
  '17 ans F équip 1': 'F17 CDF',
  '- 17 ans F équip 1 ( CDF)': 'F17 CDF',
  '17F1 CDF': 'F17 CDF',
  '17 ans F équip 2 ( Dépt)': 'F17 departementale',
  '17 ans F équip 2': 'F17 departementale',
  '- 17 ans F équip 2 ( Dépt)': 'F17 departementale',
  '17F1 Dep': 'F17 departementale',
  '15 ans M (Région)': 'M15 region',
  '15 ans  M (Région)': 'M15 region',
  '15 ans M': 'M15 region',
  '- 15 ans  M (Région)': 'M15 region',
  '15M Reg': 'M15 region',
  '15 ans (Dépt)': 'M15 departementale',
  '- 15 ans  (Dépt)': 'M15 departementale',
  '15 ans': 'M15 departementale',
  '15M Dep': 'M15 departementale',
  '15 ans F (Région)': 'F15 region',
  '- 15 ans F (Région)': 'F15 region',
  '15F Reg': 'F15 region',
  '15 ans F': 'F15 region',
  '15 ans F (Dépt)': 'F15 departementale',
  '- 15 ans F (Dépt)': 'F15 departementale',
  '15F Dep': 'F15 departementale',
  '13 ans M (Région)': 'M13 region',
  '13 ans M': 'M13 region',
  '- 13 ans M (Région)': 'M13 region',
  '13M Reg': 'M13 region',
  '13 ans M (Dépt)': 'M13 departementale',
  '- 13 ans M (Dépt)': 'M13 departementale',
  '13M Dep': 'M13 departementale',
  '13 ans F (Dépt)': 'F13 departementale',
  '- 13 ans F (Dépt)': 'F13 departementale',
  '13F Dep': 'F13 departementale',
  '11 ans Masculins (InterDépt)': 'M11 interdepartementale',
  '11 ans Masculins': 'M11 interdepartementale',
  '- 11 ans Masculins (InterDépt)': 'M11 interdepartementale',
  '11M Inter': 'M11 interdepartementale',
  '11 ans Féminines': 'F11 departementale',
  '- 11 ans Féminines': 'F11 departementale',
  '11F Dep': 'F11 departementale',
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
  'réservation camionnettes', 'camionnette', 'réservation camionnette',
  'disponible', 'libre'
];

function normalizeTeamName(name) {
  if (!name) return name;
  let cleaned = String(name).trim();
  cleaned = cleaned.replace(/^[\[\]{}\s-]*/, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/[\[\]{}]/g, '').trim();
  return NORMALIZE_TEAMS[cleaned] || cleaned;
}

function isEHRTeam(name) {
  if (!name) return false;
  const cleaned = String(name).trim();
  if (EHR_TEAMS.has(cleaned)) return true;
  // Vérifier les variantes
  const variants = [
    cleaned.replace(/\s+/g, ' '),
    cleaned.toUpperCase(),
    cleaned.toLowerCase()
  ];
  for (const variant of variants) {
    if (EHR_TEAMS.has(variant)) return true;
  }
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
  if (!str) return null;
  // Extraire l'heure dans différents formats
  // Gérer "à 14h00", "14h00", "à 9h30", etc.
  const match = String(str).match(/(\d{1,2}[h:]\d{2})/i);
  return match ? match[1] : null;
}

function getCellColor(sheet, row, col) {
  const cellRef = XLSX.utils.encode_cell({r: row, c: col});
  const cell = sheet[cellRef];
  if (cell && cell.s && cell.s.fgColor) {
    const color = cell.s.fgColor.rgb || cell.s.fgColor.indexed || cell.s.fgColor.theme || 'none';
    // Normaliser la couleur (enlever le # si présent)
    return color.replace('#', '').toUpperCase();
  }
  return 'none';
}

function getLocationFromColor(color) {
  return COLOR_TO_LOCATION[color] || 'Extérieur';
}

// Vérifier si une cellule représente un match
function isNonMatchCell(str) {
  if (!str || String(str).trim() === '') return true;
  const lower = String(str).toLowerCase().trim();
  const trimmed = String(str).trim();
  
  // Vérifier les mots-clés
  if (NON_MATCH_KEYWORDS.some(kw => lower.includes(kw))) {
    return true;
  }
  
  // Cas spéciaux
  if (lower === 'à' || lower === 'a' || lower === 'match') return true;
  if (/^\d+$/.test(trimmed)) return true;
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) return true;
  if (lower === 'ehr' || lower === '- ehr' || lower === 'ehr -') return true;
  
  return false;
}

// Fonction principale de parsing
function parseExcelFile(filePath) {
  const workbook = XLSX.readFile(filePath, { 
    cellStyles: true, 
    cellDates: true, 
    cellHTML: false
  });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false });
  
  console.log('Total rows:', jsonData.length);
  
  // Lire les métadonnées
  const lastUpdated = jsonData[0]?.[0]?.toString().replace('MAJ le ', '')?.trim() || null;
  const season = jsonData[0]?.[5]?.toString().trim() || '2026-2027';
  
  // Ligne 12 (index 11) = noms des équipes
  const teamsRow = jsonData[11] || [];
  // Ligne 13 (index 12) = catégories
  const categoryRow = jsonData[12] || [];
  
  // Mapping colonne -> équipe et catégorie
  const columnInfo = new Map();
  for (let col = 5; col < 23; col++) {
    if (teamsRow[col]) {
      let teamName = String(teamsRow[col]).trim();
      teamName = teamName.replace(/^[\s-]*/, '');
      teamName = teamName.replace(/\s+/g, ' ').trim();
      const normalized = normalizeTeamName(teamName);
      
      let category = null;
      if (categoryRow[col]) {
        category = String(categoryRow[col]).trim();
        category = category.replace(/^[\s-]*/, '');
        category = category.replace(/\s+/g, ' ').trim();
      }
      
      if (normalized && normalized !== 'null') {
        columnInfo.set(col, {
          team: normalized,
          category: category,
          originalName: teamName
        });
      }
    }
  }
  
  console.log('\nÉquipes par colonne:', Object.fromEntries(Array.from(columnInfo.entries()).map(([col, info]) => [col, info])));
  
  const matches = [];
  
  // Parcourir toutes les lignes à partir de la ligne 14 (index 13)
  // Chaque DATE en colonne E (index 4) correspond à une ligne de base
  // Chaque date utilise 3 lignes: la ligne de la date + les 2 lignes suivantes
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
    
    if (!currentDate) {
      // Pas de date sur cette ligne, passer
      continue;
    }
    
    const formattedDate = formatDate(currentDate);
    
    // Lire les réservations de CAMIONNETTES pour cette ligne (colonnes C et D = indices 2 et 3)
    // Ces réservations s'appliquent à TOUTES les équipes de cette ligne
    let lineCamionnette = null;
    
    const camionnetteC = jsonData[row]?.[2];
    const camionnetteD = jsonData[row]?.[3];
    
    // Fonction pour normaliser les noms de camionnettes
    const normalizeCamionnette = (val) => {
      if (!val) return null;
      const trimmed = String(val).trim();
      
      // Ignorer les en-têtes
      const excluded = ['Dispo Salles', 'Réservation camionnettes', 'N° 1', 'N° 2', 'Coach', 
                        'Réservation camionnette', 'Dispo', 'Salles', 'Réservation', 'camionnettes',
                        'Réservation camionnette N°1', 'Réservation camionnette N°2',
                        'Disponible', 'Libre', 'Camionnette N°1', 'Camionnette N°2'];
      
      if (excluded.includes(trimmed) || trimmed.length > 100) {
        return null;
      }
      
      // Nettoyer les noms
      let cleaned = trimmed;
      cleaned = cleaned.replace(/^-+/g, '').trim();
      cleaned = cleaned.replace(/^Camionnette\s+/gi, '').trim();
      cleaned = cleaned.replace(/^N°\s+/gi, '').trim();
      
      // Normaliser les abréviations
      const camionnetteMappings = {
        'SG': 'Seniors M',
        'SF1': 'Seniors F1',
        'SF2': 'Seniors F2',
        'SF 1': 'Seniors F1',
        '-17 CDF': 'F17 CDF',
        '17 CDF': 'F17 CDF',
        '-15 G': 'M15 region',
        '15 G': 'M15 region',
        '-17 Dep': 'F17 departementale',
        '-15 Dep': 'M15 departementale',
        'M17 Dep': 'M17 departementale',
        'F17 Dep': 'F17 departementale',
        'M15 Dep': 'M15 departementale',
        'F15 Dep': 'F15 departementale',
        'M13 Dep': 'M13 departementale',
        'F13 Dep': 'F13 departementale',
      };
      
      return camionnetteMappings[cleaned] || cleaned;
    };
    
    if (camionnetteC && String(camionnetteC).trim()) {
      const val = String(camionnetteC).trim();
      const normalized = normalizeCamionnette(val);
      if (normalized) {
        lineCamionnette = normalized;
      }
    }
    
    if (camionnetteD && String(camionnetteD).trim() && !lineCamionnette) {
      const val = String(camionnetteD).trim();
      const normalized = normalizeCamionnette(val);
      if (normalized) {
        lineCamionnette = normalized;
      }
    }
    
    // Parcourir toutes les colonnes d'équipes (F-W = indices 5-22)
    for (let col = 5; col < 23; col++) {
      const columnData = columnInfo.get(col);
      if (!columnData) continue;
      
      const team = columnData.team;
      const category = columnData.category;
      
      // Lire les 3 lignes pour ce match (row, row+1, row+2)
      // La couleur de fond doit être vérifiée sur ces lignes
      const cellValue = jsonData[row]?.[col];
      
      if (!cellValue || String(cellValue).trim() === '') {
        continue;
      }
      
      const cellStr = String(cellValue).trim();
      
      if (isNonMatchCell(cellStr)) {
        continue;
      }
      
      // Obtenir la salle basée sur la couleur de fond des 3 lignes
      // Vérifier la couleur de la ligne courante, et si blanc, vérifier les lignes suivantes
      let cellLocation = getLocationFromColor(getCellColor(firstSheet, row, col));
      
      // Si la couleur est Extérieur/Blanc, vérifier les lignes row+1 et row+2
      if (cellLocation === 'Extérieur' || cellLocation === 'none') {
        // Vérifier les 2 lignes suivantes
        for (let offset = 1; offset <= 2; offset++) {
          const checkRow = row + offset;
          if (checkRow < jsonData.length) {
            const checkColor = getCellColor(firstSheet, checkRow, col);
            const checkLocation = getLocationFromColor(checkColor);
            if (checkLocation !== 'Extérieur' && checkLocation !== 'none') {
              cellLocation = checkLocation;
              break;
            }
          }
        }
      }
      
      // Vérifier si la cellule mentionne explicitement Kanfen
      if (cellStr.toLowerCase().includes('kanfen')) {
        cellLocation = 'Kanfen';
      }
      
      // Parser la cellule pour extraire les infos du match
      let cleaned = cleanText(cellStr);
      
      // Supprimer les commentaires après virgules
      cleaned = cleaned.replace(/\s*,\s*.*/g, '');
      
      // Extraire l'heure (avec "à" ou sans)
      const time = extractTime(cleaned);
      
      // Nettoyer pour extraire les noms d'équipes
      // Supprimer l'heure ET le "à" qui la précède
      let matchCleaned = cleaned;
      if (time) {
        // Supprimer "à HHhMM" ou "HHhMM"
        matchCleaned = cleaned.replace(/\s*à?\s*\d{1,2}[h:]\d{2}/i, '').trim();
      }
      matchCleaned = cleanText(matchCleaned);
      
      // Supprimer les mots isolés comme "à"
      matchCleaned = matchCleaned.replace(/\bà\b/gi, '').trim();
      matchCleaned = matchCleaned.replace(/\s+/g, ' ').trim();
      
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
          let team1 = normalizeTeamName(parts[0]);
          let team2 = normalizeTeamName(parts.slice(1).join(separator).trim());
          
          const t1IsEHR = isEHRTeam(team1);
          const t2IsEHR = isEHRTeam(team2);
          
          // Si team1 est EHR et team2 ne l'est pas
          if (t1IsEHR && !t2IsEHR) {
            homeTeam = team;
            awayTeam = team2;
            isHome = true;
            isAway = false;
          }
          // Si team2 est EHR et team1 ne l'est pas
          else if (t2IsEHR && !t1IsEHR) {
            homeTeam = team1;
            awayTeam = team;
            isHome = false;
            isAway = true;
            cellLocation = 'Extérieur';
          }
          // Si les deux sont EHR, match interne
          else if (t1IsEHR && t2IsEHR) {
            homeTeam = team1;
            awayTeam = team2;
            isHome = true;
            isAway = true;
          }
          // Aucun n'est EHR explicite, utiliser l'équipe de la colonne comme home
          else {
            homeTeam = team;
            awayTeam = team1;
            isHome = true;
            isAway = false;
          }
        }
      } else {
        // Pas de séparateur, c'est un adversaire
        let opponent = cleanText(matchCleaned);
        
        // Nettoyer EHR/HR de l'adversaire
        opponent = opponent.replace(/\bEHR\s*\d*\b/gi, '');
        opponent = opponent.replace(/\bHR\s*\d*\b/gi, '');
        opponent = cleanText(opponent).replace(/^,?\s*/, '');
        
        const opponentIsEHR = isEHRTeam(opponent);
        
        if (!opponentIsEHR && opponent.length >= 2) {
          homeTeam = team;
          awayTeam = normalizeTeamName(opponent);
          isHome = true;
          isAway = false;
        } else if (opponentIsEHR) {
          homeTeam = normalizeTeamName(opponent);
          awayTeam = team;
          isHome = false;
          isAway = true;
          cellLocation = 'Extérieur';
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
      const finalCategory = category || team;
      
      // Créer le display name du match
      const matchDisplay = `${homeTeam}${awayTeam ? ` vs ${awayTeam}` : ''}`;
      
      const matchInfo = {
        date: formattedDate,
        day: currentDay,
        home_team: homeTeam,
        away_team: awayTeam,
        match_display: matchDisplay,
        time: time,
        location: cellLocation,
        match_type: 'Championnat',
        category: finalCategory,
        is_home: isHome,
        is_away: isAway,
        is_internal: isEHRTeam(homeTeam) && (awayTeam ? isEHRTeam(awayTeam) : false),
        original_column: col,
        original_row: row,
        season: season,
        last_updated: lastUpdated,
        // Les camionnettes ne sont associées qu'aux matchs à domicile EHR
        camionnette: (isHome && !isAway && lineCamionnette) ? lineCamionnette : null
      };
      
      matches.push(matchInfo);
    }
  }
  
  // Eliminer les doublons basés sur date + équipe + heure
  const uniqueMatches = [];
  const seen = new Set();
  matches.forEach(match => {
    const key = `${match.date}-${match.home_team}-${match.time}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueMatches.push(match);
    }
  });
  
  return uniqueMatches;
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
  
  console.log('Parsing Excel file...');
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
  
  // Equipes
  const ehrTeamCounts = {};
  matches.forEach(m => {
    if (m.is_home && EHR_TEAMS.has(m.home_team)) {
      ehrTeamCounts[m.home_team] = (ehrTeamCounts[m.home_team] || 0) + 1;
    }
  });
  console.log('\n👥 Matches par équipe EHR (domicile):', ehrTeamCounts);
  
  console.log(`\n✅ Saved to ${outputFile}`);
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
