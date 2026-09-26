// scripts/parse-excel.js
// Parser corrigé selon les spécifications de l'utilisateur
const XLSX = require('xlsx');
const { writeFileSync } = require('fs');
const { join } = require('path');

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

  for (let col = 5; col < Math.max(teamsRow.length, categoriesRow.length, coachesRow.length); col++) {
    if (teamsRow[col]) {
      let teamName = String(teamsRow[col]).trim();
      teamName = teamName.replace(/^\s*[-–]\s*/, '');
      teamName = teamName.replace(/\s+/g, ' ').trim();
      teamMap.set(col, teamName);
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
      
      // La salle est déterminée par la COLONNE, pas par la ligne !
      let cellLocation = getLocationFromColumn(col);
      
      // Si la cellule contient "Kanfen", le match a lieu à Kanfen
      if (cellStr.toLowerCase().includes('kanfen')) {
        cellLocation = 'Kanfen';
      }
      
      const team = teamMap.get(col) || null;
      const category = categoryMap.get(col) || null;
      const coach = coachMap.get(col) || null;
      
      const matchInfo = parseMatchCell(cellStr, formattedDate, day, cellLocation, team, category, coach);
      
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

function getLocationFromColumn(col) {
  const offset = col - 4;
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

function parseMatchCell(cellStr, date, day, location, team, category, coach) {
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
  
  const isEHRTeam = (name) => {
    if (!name) return false;
    const upper = name.toUpperCase().trim();
    return upper === 'EHR' || upper === 'EHR 1' || upper === 'EHR 2' || /^EHR\s*\d*$/.test(upper);
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
        homeTeam = team || team1;
        awayTeam = team2;
        isHome = true;
        isAway = false;
      } else if (t2IsEHR && !t1IsEHR) {
        homeTeam = team1;
        awayTeam = team || team2;
        isHome = false;
        isAway = true;
      } else if (t1IsEHR && t2IsEHR) {
        homeTeam = team || team1;
        awayTeam = team2;
        isHome = true;
        isAway = true;
      } else {
        homeTeam = team1;
        awayTeam = team2;
      }
      
      const matchDisplay = `${homeTeam} vs ${awayTeam}`;
      const finalLocation = isHome ? location : "Extérieur";
      
      return {
        date,
        day,
        home_team: homeTeam,
        away_team: awayTeam,
        match_display: matchDisplay,
        time,
        location: finalLocation,
        match_type: matchType,
        category: category || team,
        coach,
        is_home: isHome,
        is_away: isAway,
        is_internal: false,
        original_team: team
      };
    }
  }
  
  // Cas 2: Une seule équipe mentionnée
  const ehrPattern = /\bEHR\s*\d*\b/i;
  const ehrExactMatch = cleaned.match(ehrPattern);
  if (ehrExactMatch) {
    if (isNonMatchCell(cleaned)) return null;
    
    const ehrMatch = cleaned.match(/(EHR\s*\d*)/i);
    if (ehrMatch) {
      const homeTeam = team || ehrMatch[1];
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
        original_team: team
      };
    }
  }
  
  // Cas 3: Match avec un adversaire sans EHR mentionnée
  if (team) {
    const cleanedOpponent = cleanTeamName(cleaned);
    
    if (cleanedOpponent.length < 2) return null;
    if (isNonMatchCell(cleanedOpponent)) return null;
    
    const teamIsEHR = isEHRTeam(team);
    
    if (teamIsEHR) {
      const matchDisplay = `${team} vs ${cleanedOpponent}`;
      return {
        date,
        day,
        home_team: team,
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
        original_team: team
      };
    } else {
      if (/^\d+$/.test(cleanedOpponent.trim())) return null;
      const matchDisplay = `${cleanedOpponent} vs ${team}`;
      return {
        date,
        day,
        home_team: cleanedOpponent,
        away_team: team,
        match_display: matchDisplay,
        time,
        location: "Extérieur",
        match_type: matchType,
        category: category || team,
        coach,
        is_home: false,
        is_away: true,
        is_internal: false,
        original_team: team
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
  cleaned = cleaned.replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/^\s*vs\s+/i, '').trim();
  cleaned = cleaned.replace(/\s+vs\s*$/i, '').trim();
  cleaned = cleaned.replace(/^\s*à\s+/i, '').trim();
  cleaned = cleaned.replace(/\s+à\s*$/i, '').trim();
  cleaned = cleaned.replace(/\s+\(\s*\)/g, '');
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
  
  console.log('Saved to', outputFile);
} catch (error) {
  console.error('Error:', error); 
  process.exit(1);
}
