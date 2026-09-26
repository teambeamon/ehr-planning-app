// scripts/parse-excel-v2.js
// Parser corrigé avec normalisation des noms d'équipes
const XLSX = require('xlsx');
const { writeFileSync } = require('fs');
const { join } = require('path');

// Mapping pour normaliser les noms d'équipes (après nettoyage)
// Note: les espaces à l'intérieur des parenthèses sont conservés
const teamNameMapping = {
  "SENIORS HR": "Seniors M",
  "SENIORS FILLES HR 1": "Seniors F1",
  "SENIORS FILLES HR 2": "Seniors F2",
  "17 ans G (Dépt)": "M17 departementale",
  "17 ans F équip 1 ( CDF)": "F17 CDF",
  "17 ans F équip 2 ( Dépt)": "F17 departementale",
  "15 ans M (Région)": "M15 region",
  "15 ans (Dépt)": "M15 departementale",
  "15 ans F (Région)": "F15 region",
  "15 ans F (Dépt)": "F15 departementale",
  "13 ans M (Région)": "M13 region",
  "13 ans M (Dépt)": "M13 departementale",
  "13 ans F (Dépt)": "F13 departementale",
  "11 ans Masculins (InterDépt)": "M11 interdepartementale",
  "11 ans Féminines": "F11 departementale",
  "Tournoi -9/-11 Petit terrain": "Tournoi -9/-11",
  // Noms alternatifs
  "EHR 1": "F17 CDF",  // À vérifier
  "EHR 2": "F17 departementale",  // À vérifier
  "EHR": "EHR"
};

// Mapping des catégories
const categoryMapping = {
  "Masc EHR Dépt": "Masc EHR Dépt",
  "Féminines 1\r\nPré Nationale": "Féminines Pré Nationale",
  "Masc EHR  -18G": "Masc EHR U18",
  "Féminines HR 1\r\n Championnat de France Poule 9": "Féminines HR CDF Poule 9",
  "Féminines HR 2\r\nDépartemental": "Féminines HR Départ",
  " Masc -15G EHR 1\r\n": "Masc EHR U15 Région",
  " Masc -15G EHR 2\r\nPoule": "Masc EHR U15 Départ",
  "Féminines -15F EHR 1\r\nPoule 2": "Féminines EHR U15 Région",
  "Féminines -15F EHR 2\r\n": "Féminines EHR U15 Départ",
  " Masc-13G EHR 1\r\nPoule 3\r\n": "Masc EHR U13 Région",
  " Masc-13G  EHR 2\r\nPoule 3": "Masc EHR U13 Départ",
  "Féminines -13F EHR\r\nPoule 1": "Féminines EHR U13 Départ",
  "Masculins -11G EHR 1\r\n": "Masc EHR U11 InterDépart",
  "Masculins -11G EHR 2\r\n": "Masc EHR U11 InterDépart",
  "Féminines -11 F EHR \r\n": "Féminines EHR U11",
  "-9 -11 Petit terrain": "Tournoi -9/-11",
  "Féminines EHR \r\n": "Féminines EHR"
};

// Fonction pour normaliser le nom d'une équipe
function normalizeTeamName(teamName) {
  if (!teamName) return teamName;
  
  // Nettoyer le nom (comme dans le parser principal)
  let cleaned = String(teamName).trim();
  cleaned = cleaned.replace(/^\s*[-–]\s*/, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Appliquer le mapping
  return teamNameMapping[cleaned] || cleaned;
}

// Fonction pour normaliser la catégorie
function normalizeCategory(category) {
  if (!category) return category;
  
  let cleaned = String(category).trim();
  cleaned = cleaned.replace(/\r/g, '').replace(/\n/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return categoryMapping[cleaned] || cleaned;
}

// Fonction pour obtenir le nom simplifié d'une équipe (sans le préfixe)
function getSimpleTeamName(teamName) {
  if (!teamName) return teamName;
  
  let cleaned = String(teamName).trim();
  cleaned = cleaned.replace(/^\s*[-–]\s*/, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Supprimer les numéros d'équipe (équip 1, équip 2, etc.)
  cleaned = cleaned.replace(/\s*\(.*?\)/g, '').trim();
  
  // Extraire le type et la catégorie
  const match = cleaned.match(/^(\d+)\s+ans\s+([MF])\s*(.*)/);
  if (match) {
    const age = match[1];
    const gender = match[2] === 'M' ? 'M' : 'F';
    const level = match[3].toLowerCase();
    
    if (level.includes('region') || level.includes('région')) {
      return `${gender}${age} region`;
    } else if (level.includes('dept') || level.includes('dépt') || level.includes('départemental')) {
      return `${gender}${age} departementale`;
    } else if (level.includes('inter')) {
      return `${gender}${age} interdepartementale`;
    }
  }
  
  // Pour les seniors
  if (cleaned.toLowerCase().includes('seniors')) {
    if (cleaned.toLowerCase().includes('filles') || cleaned.toLowerCase().includes('féminines')) {
      return cleaned.includes('1') ? 'Seniors F1' : cleaned.includes('2') ? 'Seniors F2' : 'Seniors F';
    }
    return 'Seniors M';
  }
  
  return cleaned;
}

function parseExcelFile(filePath) {
  const workbook = XLSX.readFile(filePath);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

  // Extraire les métadonnées depuis la ligne 0
  const lastUpdated = jsonData[0]?.[0]?.toString().replace('MAJ le ', '')?.trim() || null;
  const season = jsonData[0]?.[5]?.toString().trim() || 'SAISON 2026-2027';

  // Lignes d'en-tête selon les specs de l'utilisateur
  // Ligne 11 = noms des équipes
  // Ligne 12 = catégories
  // Ligne 13 = coachs
  const teamsRow = jsonData[11] || [];
  const categoriesRow = jsonData[12] || [];
  const coachesRow = jsonData[13] || [];

  // Mapping colonne -> équipe, catégorie, coach
  const teamMap = new Map();
  const categoryMap = new Map();
  const coachMap = new Map();
  const simpleTeamMap = new Map();

  for (let col = 5; col < Math.max(teamsRow.length, categoriesRow.length, coachesRow.length); col++) {
    if (teamsRow[col]) {
      let teamName = String(teamsRow[col]).trim();
      teamName = teamName.replace(/^\s*[-–]\s*/, '');
      teamName = teamName.replace(/\s+/g, ' ').trim();
      
      // Normaliser le nom
      const normalizedName = normalizeTeamName(teamName);
      const simpleName = getSimpleTeamName(teamName);
      
      teamMap.set(col, normalizedName);
      simpleTeamMap.set(col, simpleName);
    }
    if (categoriesRow[col]) {
      let cat = String(categoriesRow[col]).trim().replace(/\r/g, '').replace(/\n/g, ' ');
      cat = cat.replace(/\s+/g, ' ').trim();
      categoryMap.set(col, normalizeCategory(cat));
    }
    if (coachesRow[col]) {
      coachMap.set(col, String(coachesRow[col]).trim());
    }
  }

  const matches = [];
  let currentDate = null, currentDay = null;

  // Parser les matchs à partir de la ligne 14
  for (let row = 14; row < jsonData.length; row++) {
    const rowData = jsonData[row] || [];
    
    // Extraire les informations de camionnette depuis les colonnes 2 et 3
    let camionnette = null;
    for (const colIdx of [2, 3]) {
      const val = rowData[colIdx] ? String(rowData[colIdx]).trim() : null;
      if (val && !['Dispo Salles', 'Réservation camionnettes', 'N° 1', 'N° 2', 'Coach', 'Réservation camionnette'].includes(val)) {
        camionnette = val;
        break;
      }
    }
    
    // Lire la date depuis la colonne 4
    let date = null, day = null;
    const dateCell = rowData[4];
    if (dateCell && String(dateCell).trim().includes('/')) {
      const dateStr = String(dateCell).trim();
      const [datePart, dayPart] = dateStr.split('\n');
      date = datePart?.trim() || null;
      day = dayPart?.trim() || null;
      currentDate = date;
      currentDay = day;
    }
    
    if (!date) {
      date = currentDate;
      day = currentDay;
    }
    
    if (!date) {
      continue;
    }
    
    const formattedDate = formatDate(date);
    
    // Parser les matchs dans les colonnes 5+
    for (let col = 5; col < rowData.length; col++) {
      const cellValue = rowData[col];
      if (!cellValue || String(cellValue).trim() === '') {
        continue;
      }
      
      const cellStr = String(cellValue).trim();
      
      if (isNonMatchCell(cellStr)) {
        continue;
      }
      
      // La salle est déterminée par la LIGNE (pattern basé sur les lignes)
      // (row - 12) % 3:
      // 0 = Hettange (Hall)
      // 1 = Hettange (Poly)
      // 2 = Rodemack
      let cellLocation = getLocationFromRow(row);
      
      // Si la cellule contient "Kanfen", le match a lieu à Kanfen
      if (cellStr.toLowerCase().includes('kanfen')) {
        cellLocation = 'Kanfen';
      }
      
      const team = teamMap.get(col) || null;
      const simpleTeam = simpleTeamMap.get(col) || null;
      const category = categoryMap.get(col) || null;
      const coach = coachMap.get(col) || null;
      
      const matchInfo = parseMatchCell(cellStr, formattedDate, day, cellLocation, team, simpleTeam, category, coach);
      
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

function getLocationFromRow(row) {
  const offset = row - 12;
  const mod = offset % 3;
  
  if (mod === 0) return 'Hettange (Hall)';
  if (mod === 1) return 'Hettange (Poly)';
  return 'Rodemack';
}

function isNonMatchCell(str) {
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
    'a placer', 'retrait', 'de france', 'de moselle',
    'match', 'à placer'
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

function formatDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
  }
  return dateStr;
}

function extractTime(cleaned) {
  const timeMatch = cleaned.match(/à\s*(\d{1,2}[h:][0-9]{2})/i);
  return timeMatch ? timeMatch[1] : null;
}

function cleanCellStr(str) {
  let cleaned = str.replace(/\r/g, '').replace(/\n/g, ' ').trim();
  cleaned = cleaned.replace(/\s+/g, ' ');
  return cleaned;
}

function parseMatchCell(cellStr, date, day, location, team, simpleTeam, category, coach) {
  let cleaned = cleanCellStr(cellStr);
  
  if (!cleaned || cleaned === '' || isNonMatchCell(cleaned)) {
    return null;
  }
  
  const time = extractTime(cleaned);
  if (time) {
    cleaned = cleaned.replace(/à\s*\d{1,2}[h:][0-9]{2}/i, '').trim();
  } else {
    cleaned = cleaned.replace(/\s*à\s*/gi, ' ').trim();
  }
  cleaned = cleanCellStr(cleaned);
  
  let matchType = 'Championnat';
  const lowerCleaned = cleaned.toLowerCase();
  
  if (lowerCleaned.includes('amical')) {
    matchType = 'Amical';
    cleaned = cleaned.replace(/amical/gi, '').trim();
  } else if (lowerCleaned.includes('tournoi')) {
    matchType = 'Tournoi';
    cleaned = cleaned.replace(/tournoi/gi, '').trim();
  } else if (lowerCleaned.includes('coupe')) {
    matchType = 'Coupe';
    cleaned = cleaned.replace(/coupe/gi, '').trim();
  }
  cleaned = cleanCellStr(cleaned);
  
  // Liste des noms normalisés qui sont des équipes EHR
  const ehrTeamNames = new Set([
    'Seniors M', 'Seniors F1', 'Seniors F2',
    'M17 departementale', 'F17 CDF', 'F17 departementale',
    'M15 region', 'M15 departementale', 'F15 region', 'F15 departementale',
    'M13 region', 'M13 departementale', 'F13 departementale',
    'M11 interdepartementale', 'F11 departementale'
  ]);

  // Déterminer si c'est un match à domicile ou à l'extérieur
  const isEHRTeam = (name) => {
    if (!name) return false;
    // Accepter EHR, EHR 1, EHR 2, HR (comme dans SENIORS HR)
    // Utiliser \b pour éviter de matcher "HREN", "HRA", etc.
    if (/\bEHR\b/i.test(name) || /\bHR\b/i.test(name)) {
      return true;
    }
    // Accepter les noms normalisés
    return ehrTeamNames.has(name);
  };
  
  let homeTeam = null, awayTeam = null;
  let isHome = false, isAway = false;
  
  // Cas 1: Format "Team1 - Team2" ou "Team1 vs Team2"
  if (cleaned.includes(' - ') || cleaned.includes(' vs ')) {
    const separator = cleaned.includes(' vs ') ? ' vs ' : ' - ';
    const parts = cleaned.split(separator).map(p => cleanCellStr(p));
    
    if (parts.length >= 2) {
      let team1 = cleanTeamName(parts[0]);
      let team2 = cleanTeamName(parts.slice(1).join(separator).trim());
      
      const t1IsEHR = isEHRTeam(team1);
      const t2IsEHR = isEHRTeam(team2);
      
      if (t1IsEHR && !t2IsEHR) {
        // EHR est en premier, donc match à domicile
        homeTeam = team || simpleTeam || team1;
        awayTeam = team2;
        isHome = true;
        isAway = false;
      } else if (t2IsEHR && !t1IsEHR) {
        // EHR est en second, donc match à l'extérieur
        homeTeam = team1;
        awayTeam = team || simpleTeam || team2;
        isHome = false;
        isAway = true;
      } else if (t1IsEHR && t2IsEHR) {
        // Les deux sont EHR (match interne)
        homeTeam = team || simpleTeam || team1;
        awayTeam = team2;
        isHome = true;
        isAway = true;
      } else {
        // Aucun des deux n'est EHR, mais on a une équipe associée
        if (team) {
          homeTeam = team;
          awayTeam = team1;
          isHome = true;
          isAway = false;
        } else {
          homeTeam = team1;
          awayTeam = team2;
        }
      }
      
      const finalLocation = isHome ? location : "Extérieur";
      
      return {
        date,
        day,
        home_team: homeTeam,
        away_team: awayTeam,
        match_display: isHome ? `${homeTeam} vs ${awayTeam}` : `${homeTeam} vs ${awayTeam}`,
        time,
        location: finalLocation,
        match_type: matchType,
        category: category || team,
        coach,
        is_home: isHome,
        is_away: isAway,
        is_internal: false,
        original_team: team,
        simple_team: simpleTeam
      };
    }
  }
  
  // Cas 2: Une seule équipe mentionnée (match à domicile par défaut)
  const ehrPattern = /\bEHR\s*\d*\b/i;
  const ehrExactMatch = cleaned.match(ehrPattern);
  
  if (ehrExactMatch) {
    if (isNonMatchCell(cleaned)) return null;
    
    const ehrMatch = cleaned.match(/(EHR\s*\d*)/i);
    if (ehrMatch) {
      const homeTeam = team || simpleTeam || ehrMatch[1];
      const matchDisplay = homeTeam;
      return {
        date,
        day,
        home_team: homeTeam,
        away_team: null,
        match_display: matchDisplay,
        time,
        location: location,
        match_type: matchType,
        category: category || team,
        coach,
        is_home: true,
        is_away: false,
        is_internal: false,
        original_team: team,
        simple_team: simpleTeam
      };
    }
  }
  
  // Cas 3: Match avec un adversaire sans EHR mentionnée
  if (team || simpleTeam) {
    const cleanedOpponent = cleanTeamName(cleaned);
    
    if (cleanedOpponent.length < 2) return null;
    if (isNonMatchCell(cleanedOpponent)) return null;
    
    const teamIsEHR = isEHRTeam(team || simpleTeam || '');
    
    if (teamIsEHR) {
      // Notre équipe est EHR, donc match à domicile
      const homeTeam = team || simpleTeam;
      const matchDisplay = `${homeTeam} vs ${cleanedOpponent}`;
      return {
        date,
        day,
        home_team: homeTeam,
        away_team: cleanedOpponent,
        match_display: matchDisplay,
        time,
        location: location,
        match_type: matchType,
        category: category || team,
        coach,
        is_home: true,
        is_away: false,
        is_internal: false,
        original_team: team,
        simple_team: simpleTeam
      };
    } else {
      // Notre équipe n'est pas EHR, mais c'est un match à l'extérieur
      if (/^\d+$/.test(cleanedOpponent.trim())) return null;
      const matchDisplay = `${cleanedOpponent} vs ${team || simpleTeam}`;
      return {
        date,
        day,
        home_team: cleanedOpponent,
        away_team: team || simpleTeam,
        match_display: matchDisplay,
        time,
        location: "Extérieur",
        match_type: matchType,
        category: category || team,
        coach,
        is_home: false,
        is_away: true,
        is_internal: false,
        original_team: team,
        simple_team: simpleTeam
      };
    }
  }
  
  console.log('⚠️ Impossible de parser:', cellStr);
  return null;
}

function cleanTeamName(name) {
  if (!name) return name;
  let cleaned = name.trim();
  cleaned = cleaned.replace(/^\s*[-–]\s*/, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  // Ne pas supprimer "vs" ou "à" car ils sont déjà traités par le split
  cleaned = cleaned.replace(/\s+(\(.*?\))\s*/g, '');
  return cleaned;
}

// Exécuter le script
const args = process.argv.slice(2);
const inputFile = args[0] || '/Users/neobeamon/Downloads/derPLANNING MATCHS 2026-2027 HR.xlsx';
const outputFile = args[1] || join(__dirname, '..', 'data', 'matches.json');

try {
  console.log('Parsing...');
  const matches = parseExcelFile(inputFile);
  writeFileSync(outputFile, JSON.stringify(matches, null, 2));
  console.log(`Found ${matches.length} matches`);
  
  const locs = new Set(); matches.forEach(m => m.location && locs.add(m.location));
  console.log('Locations:', Array.from(locs));
  console.log(`Stats: Home=${matches.filter(m=>m.is_home).length}, Away=${matches.filter(m=>m.is_away).length}, Internal=${matches.filter(m=>m.is_internal).length}`);
  
  const t = new Set(); matches.forEach(m => { if(m.home_team) t.add(m.home_team); if(m.away_team) t.add(m.away_team); });
  console.log(`Teams: ${t.size} unique teams`);
  console.log('Team names:', Array.from(t).sort());
  
  const homeWithLocation = matches.filter(m => m.is_home && m.location);
  console.log(`\nMatches à domicile avec salle: ${homeWithLocation.length}`);
  const locCount = {};
  homeWithLocation.forEach(m => {
    const loc = m.location || 'null';
    locCount[loc] = (locCount[loc] || 0) + 1;
  });
  console.log('Répartition par salle (domicile):', locCount);
  
  const awayWithoutLocation = matches.filter(m => m.is_away && !m.location);
  console.log(`Matches à l\'extérieur sans salle EHR: ${awayWithoutLocation.length}`);
  
  // Vérifier les équipes simples
  const simpleTeams = new Set();
  matches.forEach(m => { if(m.simple_team) simpleTeams.add(m.simple_team); });
  console.log(`\nSimple team names: ${simpleTeams.size}`);
  console.log('Simple teams:', Array.from(simpleTeams).sort());
  
  console.log('Saved to', outputFile);
} catch (error) {
  console.error('Error:', error); 
  process.exit(1);
}
