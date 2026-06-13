const API_URL = "https://vm-predictor.stefan-hillblom.workers.dev/";

let allPredictions = {};
let allMatches = [];
let currentUser = "";

const teamNamesSE = {
    "Algeria": "Algeriet", "Argentina": "Argentina", "Australia": "Australien", "Austria": "Österrike",
    "Belgium": "Belgien", "Bosnia and Herzegovina": "Bosnien", "Bosnia-Herzegovina": "Bosnien", "Brazil": "Brasilien",
    "Canada": "Kanada", "Cape Verde": "Kap Verde", "Cape-Verde": "Kap Verde", "Cape Verde Islands": "Kap Verde", "Colombia": "Colombia",
    "Croatia": "Kroatien", "Curaçao": "Curacao", "Curacao": "Curacao", "Czech Republic": "Tjeckien",
    "Czechia": "Tjeckien", "DR Kongo": "DR Kongo", "DR Congo": "DR Kongo", "Ecuador": "Ecuador", "Egypt": "Egypten",
    "El Salvador": "El Salvador", "England": "England", "France": "Frankrike", "Germany": "Tyskland",
    "Ghana": "Ghana", "Haiti": "Haiti", "Hait": "Haiti", "Iran": "Iran", "Iraq": "Irak", "Ivory Coast": "Elfenbenskusten",
    "Japan": "Japan", "Jordan": "Jordanien", "Mexico": "Mexiko", "Morocco": "Marocko",
    "Netherlands": "Nederländerna", "New Zealand": "Nya Zeeland", "Norway": "Norge", "Panama": "Panama",
    "Paraguay": "Paraguay", "Portugal": "Portugal", "Qatar": "Qatar", "Saudi Arabia": "Saudiarabien", "Saudi-Arabia": "Saudiarabien",
    "Scotland": "Skottland", "Senegal": "Senegal", "South Africa": "Sydafrika", "South Korea": "Sydkorea",
    "Spain": "Spanien", "Sweden": "Sverige", "Switzerland": "Schweiz", "Tunisia": "Tunisien",
    "Turkey": "Turkiet", "United States": "USA", "Uruguay": "Uruguay", "Uzbekistan": "Uzbekistan"
};

const nameToTlaMap = {
    "Algeria": "ALG", "Argentina": "ARG", "Australia": "AUS", "Austria": "AUT",
    "Belgium": "BEL", "Bosnia and Herzegovina": "BIH", "Bosnia-Herzegovina": "BIH", "Brazil": "BRA",
    "Canada": "CAN", "Cape Verde": "CPV", "Cape-Verde": "CPV", "Colombia": "COL",
    "Croatia": "CRO", "Curaçao": "CUW", "Curacao": "CUW", "Czech Republic": "CZE", "Czechia": "CZE",
    "DR Congo": "COD", "DR Kongo": "COD", "Ecuador": "ECU", "Egypt": "EGY", "El Salvador": "SLV",
    "England": "ENG", "France": "FRA", "Germany": "GER", "Ghana": "GHA", 
    "Haiti": "HAI", "Hait": "HAI",
    "Iran": "IRN", "Iraq": "IRQ", "Ivory Coast": "CIV", "Japan": "JPN", "Jordan": "JOR",
    "Mexico": "MEX", "Morocco": "MAR", "Netherlands": "NED", "New Zealand": "NZL",
    "Norway": "NOR", "Panama": "PAN", "Paraguay": "PAR", "Portugal": "POR", "Qatar": "QAT",
    "Saudi Arabia": "KSA", "Saudi-Arabia": "KSA", "Scotland": "SCO", "Senegal": "SEN", "South Africa": "RSA",
    "South Korea": "KOR", "Spain": "ESP", "Sweden": "SWE", "Switzerland": "SUI",
    "Tunisia": "TUN", "Turkey": "TUR", "United States": "USA", "Uruguay": "URY", "Uzbekistan": "UZB"
};

function getBroadcasterHtml(match) {
    const matchDate = new Date(match.utcDate);
    const day = matchDate.getDate();
    
    // Returnerar CSS-brickor istället för trasiga bildlänkar
    if (day % 2 === 0) {
        return `<span class="tv-badge svt">SVT</span>`;
    } else {
        return `<span class="tv-badge tv4">TV4</span>`;
    }
}

function getTeamNameSE(engName) {
    if (!engName) return "?"; 
    return teamNamesSE[engName] || engName;
}

function getMatchKey(match) {
    const homeName = match.homeTeam?.name;
    const awayName = match.awayTeam?.name;
    if (!homeName || !awayName) return null;
    const homeTLA = nameToTlaMap[homeName] || match.homeTeam?.tla;
    const awayTLA = nameToTlaMap[awayName] || match.awayTeam?.tla;
    if (!homeTLA || !awayTLA) return null;
    return `${homeTLA.toUpperCase()}-${awayTLA.toUpperCase()}`;
}

function getPredictionFromKey(userPredictions, key) {
    if (!userPredictions || !key) return "-";
    if (userPredictions[key]) return userPredictions[key];
    let altKey = key.replace("HAI", "HTI").replace("KSA", "SAU").replace("URY", "URU");
    if (userPredictions[altKey]) return userPredictions[altKey];
    const parts = key.split("-");
    const reverseKey = `${parts[1]}-${parts[0]}`;
    if (userPredictions[reverseKey]) {
        const scoreParts = userPredictions[reverseKey].split("-");
        if (scoreParts.length === 2) return `${scoreParts[1]}-${scoreParts[0]}`;
    }
    let altReverseKey = reverseKey.replace("HAI", "HTI").replace("KSA", "SAU").replace("URY", "URU");
    if (userPredictions[altReverseKey]) {
        const scoreParts = userPredictions[altReverseKey].split("-");
        if (scoreParts.length === 2) return `${scoreParts[1]}-${scoreParts[0]}`;
    }
    return "-";
}

async function loadPredictions() {
    try {
        const response = await fetch("predictions.json?v=" + new Date().getTime());
        if (!response.ok) throw new Error(`Kunde inte hämta predictions.json`);
        allPredictions = await response.json();
        const users = Object.keys(allPredictions);
        if (users.length
