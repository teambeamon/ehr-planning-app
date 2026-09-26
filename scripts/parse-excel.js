// scripts/parse-excel.js
// Script pour parser le fichier Excel de planning EHR
// Utilisation: node scripts/parse-excel.js /chemin/vers/fichier.xlsx

const XLSX = require('xlsx');
const { writeFileSync } = require('fs');
const { join } = require('path');

function parseExcelFile(filePath, outputFile) {
  const workbook = XLSX.readFile(filePath);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

  // Extraire les métadonnées
  const lastUpdated = jsonData[0]?.[0]?.toString().replace('MAJ le ', '')?.trim() || null;
  const season = jsonData[0]?.[5] || '2026-2027';

  // Lignes d'en-tête
  const teamsRow = jsonData[11] || [];
  const categoriesRow = jsonData[12] || [];
  const coachesRow = jsonData[13] || [];

  // Mapping colonne -> équipe, catégorie, coach
  const teamMap = new Map();
  const categoryMap = new Map();
  const coachMap = new Map();

  for (let col = 5; col < Math.max(teamsRow.length, categoriesRow.length, coachesRow.length); col++) {
    if (teamsRow[col]) {
      teamMap.set(col, String(teamsRow[col]).trim());
    }
    if (categoriesRow[col]) {
      const cat = String(categoriesRow[col]).trim().replace(/\r/g, '').replace(/\n/g, ' ');
      categoryMap.set(col, cat);
    }
    if (coachesRow[col]) {
      coachMap.set(col, String(coachesRow[col]).trim());
    }
  }

  // Parser les matchs
  const matches = [];
  let currentDate = null;
  let currentDay = null;
  
  for (let row = 14; row < jsonData.length; row++) {
    const rowData = jsonData[row] || [];
    
    // Déterminer la salle par (row - 14) % 3
    const offset = row - 14;
    const location = getLocationFromOffset(offset);
    
    // Vérifier les camionnettes (colonnes 2 et 3)
    let camionnette = null;
    if (rowData[2]) {
      const val = String(rowData[2]).trim();
      if (val && val !== 'Dispo Salles' && val !== 'Réservation camionnettes' && val !== 'N° 1' && val !== 'N° 2') {
        camionnette = val;
      }
    }
    if (rowData[3] && !camionnette) {
      const val = String(rowData[3]).trim();
      if (val && val !== 'Dispo Salles' && val !== 'Réservation camionnettes' && val !== 'N° 1' && val !== 'N° 2') {
        camionnette = val;
      }
    }
    
    // Lire la date depuis la colonne 4
    let date = null;
    let day = null;
    const dateCell = rowData[4];
    if (dateCell && String(dateCell).trim().includes('/')) {
      const dateStr = String(dateCell).trim();
      const [datePart, dayPart] = dateStr.split('\n');
      date = datePart ? datePart.trim() : null;
      day = dayPart ? dayPart.trim() : null;
      currentDate = date;
      currentDay = day;
    }
    
    // Si pas de date dans la colonne 4, utiliser la date courante
    if (!date && currentDate) {
      date = currentDate;
      day = currentDay;
    }
    
    // Si on a une date, parser les matchs dans les colonnes 5+
    if (date) {
      const formattedDate = formatDate(date);
      
      for (let col = 5; col < rowData.length; col++) {
        const cellValue = rowData[col];
        if (!cellValue || String(cellValue).trim() === '') {
          continue;
        }
        
        const cellStr = String(cellValue).trim();
        
        // Skip non-match cells
        if (isNonMatchCell(cellStr)) {
          continue;
        }
        
        const team = teamMap.get(col) || null;
        const category = categoryMap.get(col) || null;
        const coach = coachMap.get(col) || null;
        
        const matchInfo = parseMatchCell(cellStr, formattedDate, day, location, team, category, coach);
        
        if (matchInfo) {
          matchInfo.camionnette = camionnette;
          matchInfo.original_column = col;
          matches.push(matchInfo);
        }
      }
    }
  }

  // Ajouter la date de dernière mise à jour
  matches.forEach(match => {
    match.last_updated = lastUpdated;
    match.season = season;
  });

  // Sauvegarder dans le fichier
  writeFileSync(outputFile, JSON.stringify(matches, null, 2));
  
  return matches;
}

function getLocationFromOffset(offset) {
  const mod = offset % 3;
  if (mod === 0) return 'Hettange (Hall)';
  if (mod === 1) return 'Hettange (Poly)';
  return 'Rodemack';
}

function isNonMatchCell(str) {
  if (!str) return true;
  
  const lower = str.toLowerCase();
  const nonMatchIndicators = [
    'match ', 'tournoi', 'coupe', 'amical',
    'journée', 'report', 'hall non dispo', 'dispo',
    'réservation', 'n°', 'coach', 'date', 'salles',
    'bad', 'non dispo'
  ];
  
  return nonMatchIndicators.some(indicator => lower.includes(indicator)) ||
         str === 'JOURNÉE' || str === 'Report' || str === 'Hall Non Dispo' ||
         str === 'Bad' || str === 'Non dispo' ||
         lower.includes('dispo') || lower.includes('réservation') ||
         lower.includes('n°') || lower.includes('coach') ||
         lower.includes('salles') ||
         (str.includes('vs') && str.includes(',')) ||
         (str.includes('et') && str.includes('h'));
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

function parseMatchCell(cellStr, date, day, location, team, category, coach) {
  let cleaned = cellStr.replace(/\r/g, '').replace(/\n/g, ' ').trim();
  
  if (!cleaned || cleaned === '' || isNonMatchCell(cleaned)) {
    return null;
  }

  let homeTeam = null;
  let awayTeam = null;
  let time = null;
  let matchType = 'Championnat';
  
  // Extract time
  const timeMatch = cleaned.match(/à\s*(\d{1,2}h\d{2})/i);
  if (timeMatch) {
    time = timeMatch[1];
    cleaned = cleaned.replace(/à\s*\d{1,2}h\d{2}/i, '').trim();
  }
  
  // Detect match type
  if (cleaned.toLowerCase().includes('amical')) {
    matchType = 'Amical';
    cleaned = cleaned.replace(/amical/gi, '').trim();
  } else if (cleaned.toLowerCase().includes('tournoi')) {
    matchType = 'Tournoi';
    cleaned = cleaned.replace(/tournoi/gi, '').trim();
  } else if (cleaned.toLowerCase().includes('coupe')) {
    matchType = 'Coupe';
    cleaned = cleaned.replace(/coupe/gi, '').trim();
  }
  
  cleaned = cleaned.trim();
  
  if (cleaned.includes(' - ')) {
    const parts = cleaned.split(' - ').map(p => p.trim());
    
    if (parts.length >= 2) {
      const team1 = parts[0];
      const team2 = parts.slice(1).join(' - ');
      
      const isHome = team1.toUpperCase().includes('EHR');
      const isAway = team2.toUpperCase().includes('EHR');
      const isInternal = isHome && isAway;
      
      if (isHome && !isAway) {
        homeTeam = team1;
        awayTeam = team2;
      } else if (isAway && !isHome) {
        homeTeam = team2;
        awayTeam = team1;
      } else if (isInternal) {
        homeTeam = team1;
        awayTeam = team2;
      } else {
        homeTeam = team1;
        awayTeam = team2;
      }
      
      return {
        date,
        day,
        home_team: homeTeam,
        away_team: awayTeam,
        time,
        location,
        match_type: matchType,
        category,
        coach,
        is_home: isHome,
        is_away: isAway,
        is_internal: isInternal,
        original_team: team,
        camionnette: null,
        season: '2026-2027',
        last_updated: null
      };
    }
  }
  
  if (cleaned && !isNonMatchCell(cleaned)) {
    const isHome = team && team.toUpperCase().includes('EHR');
    const isAway = false;
    const isInternal = false;
    
    return {
      date,
      day,
      home_team: team || 'EHR',
      away_team: cleaned,
      time,
      location,
      match_type: matchType,
      category,
      coach,
      is_home: isHome,
      is_away: isAway,
      is_internal: isInternal,
      original_team: team,
      camionnette: null,
      season: '2026-2027',
      last_updated: null
    };
  }
  
  return null;
}

// Exécuter le script
const args = process.argv.slice(2);
const inputFile = args[0] || '/Users/neobeamon/Downloads/derPLANNING MATCHS 2026-2027 HR.xlsx';
const outputFile = args[1] || join(__dirname, '..', 'data', 'matches.json');

try {
  console.log('Parsing Excel file...');
  console.log('Input:', inputFile);
  console.log('Output:', outputFile);
  
  const matches = parseExcelFile(inputFile, outputFile);
  console.log(`Found ${matches.length} matches`);
  
  // Statistiques
  const locations = new Set();
  matches.forEach(m => {
    if (m.location) locations.add(m.location);
  });
  console.log('\nLocations:', Array.from(locations));
  
  const homeMatches = matches.filter(m => m.is_home).length;
  const awayMatches = matches.filter(m => m.is_away).length;
  const internalMatches = matches.filter(m => m.is_internal).length;
  console.log(`\nStatistiques: Total=${matches.length}, Domicile=${homeMatches}, Extérieur=${awayMatches}, Interne=${internalMatches}`);
  
  const locationCounts = {};
  matches.forEach(m => {
    const loc = m.location || 'Unknown';
    locationCounts[loc] = (locationCounts[loc] || 0) + 1;
  });
  console.log('\nPar location:', locationCounts);
  
  console.log('\nMatches saved to', outputFile);
  
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}
