// scripts/parse-excel-new.js
// Nouveau parser selon les spécifications de l'utilisateur
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
  // Ligne 11 = équipes, Ligne 12 = catégories, Ligne 13 = coachs
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
      // Nettoyer les noms d'équipes
      teamName = teamName.replace(/^\s*[-–]\s*/, '');
      teamName = teamName.replace(/\s+/g, ' ').trim();
      teamMap.set(col, teamName);
    }
    if (categoriesRow[col]) {
      let cat = String(categoriesRow[col]).trim().replace(/\r/g, '').replace(/\n/g, ' ');
      // Nettoyer les catégories - supprimer tous les espaces en trop et les espaces en début/fin
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
    
    // Déterminer le lieu par (row - 14) % 3
    const offset = row - 14;
    const location = getLocationFromOffset(offset);
    
    // Extraire les informations de camionnette depuis les colonnes 2 et 3
    let camionnette = null;
    for (const colIdx of [2, 3]) {
      const val = rowData[colIdx] ? String(rowData[colIdx]).trim() : null;
      if (val && !['Dispo Salles', 'Réservation camionnettes', 'N° 1', 'N° 2', 'Coach'].includes(val)) {
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
    
    // Si pas de date dans cette ligne, utiliser la date courante
    if (!date) {
      date = currentDate;
      day = currentDay;
    }
    
    // Si on n'a toujours pas de date, on passe
    if (!date) {
      continue;
    }
    
    const formattedDate = formatDate(date);
    
    // Parser les matchs dans les colonnes 5+ (colonne 5 = index 5)
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
        matchInfo.season = season;
        matchInfo.last_updated = lastUpdated;
        matches.push(matchInfo);
      }
    }
  }
  
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
  const lower = str.toLowerCase().trim();
  const trimmed = str.trim();
  
  // Cas spéciaux à ignorer
  const nonMatchIndicators = [
    'journée', 'report', 'exempt',
    'hall non dispo', 'dispo', 'réservation',
    'n°', 'coach', 'date', 'salles', 'bad', 'non dispo',
    'réservation camionnettes', 'dispo salles',
    'match contre', 'uniquement', 'tournaments', 'tournoi',
    '(match', 'inversion', 'demande de report', 'refus',
    'a placer', 'retrait', 'de france', 'de moselle'
  ];
  
  if (nonMatchIndicators.some(indicator => lower.includes(indicator))) {
    return true;
  }
  
  // Vérifier les exact matches
  const exactMatches = ['match', 'match contre ?'];
  if (exactMatches.some(m => lower === m)) {
    return true;
  }
  
  // Vérifier si c'est juste "à" ou "a" (sans heure)
  if (lower === 'à' || lower === 'a') {
    return true;
  }
  
  // Vérifier si c'est juste un nombre
  if (/^\d+$/.test(trimmed)) {
    return true;
  }
  
  // Vérifier si c'est entre parenthèses (comme "(match à Metz)")
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    return true;
  }
  
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
  // Extraire l'heure depuis "à HHhMM" ou "à HH:MM"
  // Gérer les cas comme "à" sans heure
  const timeMatch = cleaned.match(/à\s*(\d{1,2}[h:]\d{2})/i);
  if (timeMatch) {
    return timeMatch[1];
  }
  return null;
}

function cleanCellStr(str) {
  // Nettoyer la chaîne : supprimer les retours à la ligne et les espaces multiples
  let cleaned = str.replace(/\r/g, '').replace(/\n/g, ' ').trim();
  cleaned = cleaned.replace(/\s+/g, ' ');
  return cleaned;
}

function parseMatchCell(cellStr, date, day, location, team, category, coach) {
  let cleaned = cleanCellStr(cellStr);
  
  if (!cleaned || cleaned === '' || isNonMatchCell(cleaned)) {
    return null;
  }
  
  // Extraire l'heure et la supprimer de la chaîne
  const time = extractTime(cleaned);
  if (time) {
    cleaned = cleaned.replace(/à\s*\d{1,2}[h:]\d{2}/i, '').trim();
  } else {
    // Supprimer "à" sans heure
    cleaned = cleaned.replace(/\s*à\s*/gi, ' ').trim();
  }
  
  cleaned = cleanCellStr(cleaned);
  
  // Détecter le type de match
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
  
  // Gérer les cellules avec plusieurs matchs (ex: "P2H, EHR 1 et Rombas 3")
  // Ces cas sont complexes, on va essayer de les ignorer ou de les parser partiellement
  // Selon l'utilisateur, ce sont des matchs à planifier
  const hasEHR = /\bEHR\b/.test(cleaned.toUpperCase());
  if (cleaned.includes(' et ') || (cleaned.includes(',') && hasEHR)) {
    // Essayer de parser chaque partie
    // Mais pour l'instant, on va ignorer ces cas complexes
    // On pourrait les ajouter comme matchs multiples, mais c'est complexe
    // Pour l'instant, on retourne null pour ces cas
    return null;
  }
  
  // Détecter les séparateurs
  let homeTeam = null, awayTeam = null;
  let isHome = false, isAway = false, isInternal = false;
  
  // Cas 1: Format "Team1 - Team2" ou "Team1 vs Team2"
  if (cleaned.includes(' - ') || cleaned.includes(' vs ')) {
    const separator = cleaned.includes(' vs ') ? ' vs ' : ' - ';
    const parts = cleaned.split(separator).map(p => cleanCellStr(p));
    
    if (parts.length >= 2) {
      const team1 = parts[0];
      const team2 = parts.slice(1).join(separator).trim();
      
      // Nettoyer les noms d'équipes
      const t1 = cleanTeamName(team1);
      const t2 = cleanTeamName(team2);
      
      // Déterminer si c'est un match à domicile (EHR en premier)
      // Vérifier que c'est exactement EHR (pas juste une sous-chaîne comme "Behren")
      const t1IsEHR = t1.toUpperCase().trim() === 'EHR' || t1.toUpperCase().trim() === 'EHR 1' || t1.toUpperCase().trim() === 'EHR 2' || t1.toUpperCase().match(/^EHR\s*\d*$/);
      const t2IsEHR = t2.toUpperCase().trim() === 'EHR' || t2.toUpperCase().trim() === 'EHR 1' || t2.toUpperCase().trim() === 'EHR 2' || t2.toUpperCase().match(/^EHR\s*\d*$/);
      
      if (t1IsEHR && !t2IsEHR) {
        // EHR est en premier = match à domicile
        // Remplacer EHR par le nom complet de l'équipe
        homeTeam = team || t1;
        awayTeam = t2;
        isHome = true;
        isAway = false;
        isInternal = false;
      } else if (t2IsEHR && !t1IsEHR) {
        // EHR est en second = match à l'extérieur
        homeTeam = t1;
        // Remplacer EHR par le nom complet de l'équipe
        awayTeam = team || t2;
        isHome = false;
        isAway = true;
        isInternal = false;
      } else if (t1IsEHR && t2IsEHR) {
        // Match interne entre deux équipes EHR
        homeTeam = team || t1;
        awayTeam = t2;
        isHome = true;
        isAway = true;
        isInternal = true;
      } else {
        // Match qui ne concerne pas EHR ?
        // On l'inclut quand même mais pas marqué comme home/away
        homeTeam = t1;
        awayTeam = t2;
        isHome = false;
        isAway = false;
        isInternal = false;
      }
      
      // Créer un affichage du match
      const matchDisplay = `${homeTeam} vs ${awayTeam}`;
      
      return {
        date,
        day,
        home_team: homeTeam,
        away_team: awayTeam,
        match_display: matchDisplay,
        time,
        location,
        match_type: matchType,
        category: category || team,
        coach,
        is_home: isHome,
        is_away: isAway,
        is_internal: isInternal,
        original_team: team
      };
    }
  }
  
  // Cas 2: Une seule équipe mentionnée (peut-être un adversaire seul)
  // Vérifier si c'est une équipe EHR (match exact)
  const ehrExactMatch = cleaned.match(/\bEHR\b/i);
  if (ehrExactMatch) {
    // C'est un match concernant EHR
    // Si c'est juste "EHR" ou "EHR 1" ou "EHR 2", c'est peut-être un match à domicile sans adversaire ?
    // Ou c'est un match mal formaté
    
    // Vérifier si ça contient "Exempt" ou autres mots clés
    if (isNonMatchCell(cleaned)) {
      return null;
    }
    
    // Si c'est juste un nom d'équipe EHR sans adversaire
    // On va considérer que c'est un match à domicile contre un adversaire inconnu
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
        location,
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
  
  // Cas 3: Match avec un adversaire sans EHR mentionnée explicitement
  // C'est probablement un match où l'équipe de la colonne est l'adversaire
  // Mais selon l'utilisateur, le premier nom est le club qui reçoit
  // Si la cellule contient juste un nom (pas de séparateur), c'est peut-être un match à l'extérieur
  if (team) {
    // Utiliser l'équipe de la colonne comme équipe à domicile
    const cleanedOpponent = cleanTeamName(cleaned);
    
    // Validation supplémentaire : si le nom de l'adversaire est trop court ou suspect, ignorer
    if (cleanedOpponent.length < 2) return null;
    if (isNonMatchCell(cleanedOpponent)) return null;
    
    // Vérifier si l'équipe de la colonne est EHR (match exact)
    const teamIsEHR = team && (team.toUpperCase().trim() === 'EHR' || team.toUpperCase().trim() === 'EHR 1' || team.toUpperCase().trim() === 'EHR 2' || team.toUpperCase().match(/^EHR\s*\d*$/));
    
    if (teamIsEHR) {
      // Match à domicile
      const matchDisplay = `${team} vs ${cleanedOpponent}`;
      return {
        date,
        day,
        home_team: team,
        away_team: cleanedOpponent,
        match_display: matchDisplay,
        time,
        location,
        match_type: matchType,
        category: category || team,
        coach,
        is_home: true,
        is_away: false,
        is_internal: false,
        original_team: team
      };
    } else {
      // Match à l'extérieur
      if (/^\d+$/.test(cleanedOpponent.trim())) return null;
      const matchDisplay = `${cleanedOpponent} vs ${team}`;
      return {
        date,
        day,
        home_team: cleanedOpponent,
        away_team: team,
        match_display: matchDisplay,
        time,
        location,
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
  
  // Si on arrive ici, on n'a pas pu parser le match
  console.log('⚠️  Impossible de parser:', cellStr);
  return null;
}

function cleanTeamName(name) {
  if (!name) return name;
  let cleaned = name.trim();
  
  // Supprimer les tirets au début
  cleaned = cleaned.replace(/^\s*[-–]\s*/, '');
  
  // Nettoyer les espaces multiples
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Supprimer "vs" à la fin ou au début
  cleaned = cleaned.replace(/^\s*vs\s+/i, '').trim();
  cleaned = cleaned.replace(/\s+vs\s*$/i, '').trim();
  
  // Supprimer "à" à la fin ou au début
  cleaned = cleaned.replace(/^\s*à\s+/i, '').trim();
  cleaned = cleaned.replace(/\s+à\s*$/i, '').trim();
  
  // Supprimer les parenthèses vides ou mal formées
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
  
  // Statistiques
  const locs = new Set(); matches.forEach(m => m.location && locs.add(m.location));
  console.log('Locations:', Array.from(locs));
  console.log(`Stats: Home=${matches.filter(m=>m.is_home).length}, Away=${matches.filter(m=>m.is_away).length}, Internal=${matches.filter(m=>m.is_internal).length}`);
  
  const t = new Set(); matches.forEach(m => { if(m.home_team) t.add(m.home_team); if(m.away_team) t.add(m.away_team); });
  console.log(`Teams: ${t.size} unique teams`);
  console.log('Unique teams:', Array.from(t).sort());
  
  const prob = matches.filter(m => (m.home_team&&m.home_team.includes('vs'))||(m.away_team&&m.away_team.includes('vs')));
  if (prob.length > 0) {
    console.log(`⚠️  Problematic (contains vs): ${prob.length}`);
    prob.slice(0, 5).forEach(m => console.log(`  - home="${m.home_team}", away="${m.away_team}"`));
  } else {
    console.log('✓ No problematic matches (vs in team names)');
  }
  
  console.log('Saved to', outputFile);
} catch (error) {
  console.error('Error:', error); 
  process.exit(1);
}
