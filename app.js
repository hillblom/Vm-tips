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
    
    // Inbakade, stabila SVG-data (slipper externa laddningsproblem)
    const svtSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 40"><path fill="%23FFFFFF" d="M0 0h140v40H0z"/><path fill="%231e3a8a" d="M22 12h8l4 11 4-11h8v16h-7v-8l-3 8h-4l-3-8v8h-7V12zm38 0h8l5 16h-7l-1-4h-4l-1 4h-7l5-16zm2 4l-1 5h2l-1-5zm22-4h14v4h-10v2h8v4h-8v2h10v4H84V12z"/></svg>`;
    const tv4Svg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><path fill="%23E2231A" d="M0 0h60v40H0z"/><text x="12" y="28" fill="white" font-family="sans-serif" font-weight="900" font-size="24">TV4</text></svg>`;

    if (day % 2 === 0) {
        return `<img src="${svtSvg}" class="tv-logo" alt="SVT" title="SVT">`;
    } else {
        return `<img src="${tv4Svg}" class="tv-logo" alt="TV4" title="TV4">`;
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
        if (users.length === 0) throw new Error("predictions.json är tom");
        currentUser = users[0];
        
        const selector = document.getElementById("user-selector");
        selector.innerHTML = "";
        users.forEach(user => {
            const option = document.createElement("option");
            option.value = user; option.innerText = user;
            selector.appendChild(option);
        });
    } catch (error) {
        document.getElementById("lastUpdated").innerText = `Tips-fel: ${error.message}`;
    }
}

function getOutcome(home, away) {
    if(home > away) return "H";
    if(home < away) return "A";
    return "D";
}

function calculatePoints(actualHome, actualAway, predictedHome, predictedAway){
    if(actualHome === predictedHome && actualAway === predictedAway) return 12;
    const diff = Math.abs(actualHome - predictedHome) + Math.abs(actualAway - predictedAway);
    const actual = getOutcome(actualHome, actualAway);
    const predicted = getOutcome(predictedHome, predictedAway);
    let points = actual === predicted ? 10 - diff : 5 - diff;
    return Math.max(0, points);
}

function getStatusSE(status) {
    switch (status) {
        case "FINISHED": return "Fulltid";
        case "IN_PLAY":
        case "PAUSED": return "Pågår";
        case "TIMED":
        case "SCHEDULED": return "Kommande";
        default: return "Kommande";
    }
}

function getUserTotalPoints(user) {
    let total = 0;
    const userPredictions = allPredictions[user] || {};
    allMatches.forEach(match => {
        if (match.stage !== "GROUP_STAGE") return;
        const key = getMatchKey(match);
        const prediction = getPredictionFromKey(userPredictions, key);
        if(match.status === "FINISHED" && prediction && prediction !== "-") {
            const [pHome, pAway] = prediction.split("-").map(Number);
            total += calculatePoints(match.score.fullTime.home, match.score.fullTime.away, pHome, pAway);
        }
    });
    return total;
}

function renderMatches(matchesToRender) {
    const tbody = document.getElementById("matches");
    if (!tbody) return;
    tbody.innerHTML = "";
    const userPredictions = allPredictions[currentUser] || {};

    matchesToRender.forEach(match => {
        if (match.stage !== "GROUP_STAGE") return;
        
        const key = getMatchKey(match);
        const prediction = getPredictionFromKey(userPredictions, key);
        
        // Hämtar mål oavsett om matchen spelas just nu eller är avklarad
        const homeScore = match.score.fullTime.home ?? match.score.live?.home ?? null;
        const awayScore = match.score.fullTime.away ?? match.score.live?.away ?? null;
        const scoreStr = (homeScore !== null && awayScore !== null) ? `${homeScore} - ${awayScore}` : "- - -";

        let points = "";
        let isFinished = match.status === "FINISHED";
        if(isFinished && prediction !== "-"){
            const [pHome, pAway] = prediction.split("-").map(Number);
            points = calculatePoints(match.score.fullTime.home, match.score.fullTime.away, pHome, pAway);
        }

        const row = document.createElement("tr");
        if (isFinished && prediction !== "-") {
            if(points === 12) row.classList.add("green");
            else if(points > 0) row.classList.add("yellow");
            else if(points === 0) row.classList.add("red");
        }

        const dateObj = new Date(match.utcDate);
        const dayMonth = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
        const timeStr = dateObj.toLocaleTimeString("sv-SE", {hour: '2-digit', minute:'2-digit'});
        const tvHtml = getBroadcasterHtml(match);

        row.innerHTML = `
        <td style="vertical-align: middle; padding: 6px 10px;">
            <div style="display: flex; align-items: center; gap: 12px; justify-content: space-between; max-width: 110px;">
                <div style="color: var(--text-muted); font-size: 0.8rem; line-height: 1.3; white-space: nowrap;">
                    <div>${dayMonth} ${timeStr}</div>
                </div>
                <div style="display: flex; align-items: center; flex-shrink: 0;">
                    ${tvHtml}
                </div>
            </div>
        </td>
        <td style="vertical-align: middle;">${getTeamNameSE(match.homeTeam?.name)} - ${getTeamNameSE(match.awayTeam?.name)}</td>
        <td style="vertical-align: middle;">${scoreStr}</td>
        <td style="vertical-align: middle;">${prediction}</td>
        <td style="vertical-align: middle;">${points}</td>
        <td style="vertical-align: middle;">${getStatusSE(match.status)}</td>
        `;
        tbody.appendChild(row);
    });
}

function renderRanking() {
    const tbody = document.getElementById("ranking-list");
    if (!tbody) return;
    tbody.innerHTML = "";
    const ranking = Object.keys(allPredictions).map(user => ({ name: user, points: getUserTotalPoints(user) }));
    ranking.sort((a, b) => b.points - a.points);
    ranking.forEach((player, index) => {
        const row = document.createElement("tr");
        if(index === 0) row.style.fontWeight = "bold";
        row.innerHTML = `<td>${index + 1}</td><td>${player.name}</td><td><strong>${player.points} p</strong></td>`;
        tbody.appendChild(row);
    });
}

async function loadMatches(){
    try {
        const response = await fetch(API_URL + "?_cb=" + new Date().getTime());
        if (!response.ok) throw new Error(`API-status ${response.status}`);
        const data = await response.json();
        allMatches = data.matches || [];
        filterMatches();
        renderRanking();
        document.getElementById("lastUpdated").innerText = `Uppdaterad ${new Date().toLocaleTimeString("sv-SE")}`;
    } catch (error) {
        document.getElementById("lastUpdated").innerText = `Match-fel: ${error.message}`;
    }
}

function filterMatches() {
    if (!allMatches || allMatches.length === 0) return;
    const query = document.getElementById("search").value.toLowerCase();
    const filtered = allMatches.filter(match => {
        const homeSE = getTeamNameSE(match.homeTeam?.name).toLowerCase();
        const awaySE = getTeamNameSE(match.awayTeam?.name).toLowerCase();
        return match.stage === "GROUP_STAGE" && (homeSE.includes(query) || awaySE.includes(query));
    });
    renderMatches(filtered);
}

function setupTabs() {
    const btnMatches = document.getElementById("btn-matches");
    const btnRanking = document.getElementById("btn-ranking");
    const viewMatches = document.getElementById("view-matches");
    const viewRanking = document.getElementById("view-ranking");
    btnMatches.addEventListener("click", () => {
        btnMatches.classList.add("active"); btnRanking.classList.remove("active");
        viewMatches.classList.remove("hidden"); viewRanking.classList.add("hidden");
    });
    btnRanking.addEventListener("click", () => {
        btnRanking.classList.add("active"); btnMatches.classList.remove("active");
        viewRanking.classList.remove("hidden"); viewMatches.classList.add("hidden");
        renderRanking();
    });
}

async function start(){
    setupTabs();
    await loadPredictions();
    await loadMatches();
    document.getElementById("search").addEventListener("input", filterMatches);
    const selector = document.getElementById("user-selector");
    if (selector) {
        selector.addEventListener("change", (e) => { currentUser = e.target.value; filterMatches(); });
    }
    setInterval(loadMatches, 30000);
}
start();
