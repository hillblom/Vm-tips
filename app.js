const API_URL = "https://vm-predictor.stefan-hillblom.workers.dev/";

let allPredictions = {};
let allMatches = [];
let currentUser = "";
let collapsedDays = {}; // Håller koll på vilka dagar som är minimerade

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

// Funktion som bestämmer TV-kanal baserat på matchdatum/tid eller lag.
// Justera länkarna till logotyper eller tiderna så att det matchar er faktiska TV-plan!
function getBroadcasterHtml(match) {
    const matchDate = new Date(match.utcDate);
    const day = matchDate.getDate();
    const hour = matchDate.getHours();
    
    // SVG eller PNG-länkar till officiella logotyper
    const svtLogo = "https://upload.wikimedia.org/wikipedia/commons/2/22/SVT_Logo_2016.svg";
    const tv4Logo = "https://upload.wikimedia.org/wikipedia/commons/e/e4/TV4_logo_2023.svg";

    // EXEMPEL-LOGIK: SVT sänder jämna datum, TV4 sänder udda datum. 
    // Ändra detta eller hårdkoda specifika matcher om du vill ha det exakt!
    if (day % 2 === 0) {
        return `<img src="${svtLogo}" class="tv-logo" alt="SVT" title="Sänds på SVT">`;
    } else {
        return `<img src="${tv4Logo}" class="tv-logo" alt="TV4" title="Sänds på TV4">`;
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
        if (!response.ok) throw new Error(`Kunde inte hämta predictions.json (Status ${response.status})`);
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
        case "POSTPONED": return "Uppskjuten";
        case "CANCELLED": return "Inställd";
        default: return status;
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

// NY FUNKTION: Renderar matchlistan grupperad per dag med expand/collapse-funktionalitet
function renderMatches(matchesToRender) {
    const viewMatchesContainer = document.getElementById("view-matches");
    
    // Rensa gamla tabeller men behåll sökfältet om det ligger där
    const searchWrapper = document.getElementById("search")?.parentElement;
    viewMatchesContainer.innerHTML = "";
    if (searchWrapper) {
        viewMatchesContainer.appendChild(searchWrapper);
    }

    if (matchesToRender.length === 0) {
        const emptyMsg = document.createElement("p");
        emptyMsg.innerText = "Inga matcher matchar sökningen.";
        emptyMsg.style.padding = "20px";
        viewMatchesContainer.appendChild(emptyMsg);
        return;
    }

    // 1. Gruppera matcherna per datum (t.ex. "Torsdag 14 Juni")
    const groups = {};
    matchesToRender.forEach(match => {
        if (match.stage !== "GROUP_STAGE") return;
        
        const dateObj = new Date(match.utcDate);
        const dateKey = dateObj.toLocaleDateString("sv-SE", { weekday: 'long', day: 'numeric', month: 'long' });
        const capitalizedDateKey = dateKey.charAt(0).toUpperCase() + dateKey.slice(1);

        if (!groups[capitalizedDateKey]) {
            groups[capitalizedDateKey] = [];
        }
        groups[capitalizedDateKey].push(match);
    });

    const userPredictions = allPredictions[currentUser] || {};

    // 2. Skapa en separat sektion/tabell för varje dag
    Object.keys(groups).forEach(dateLabel => {
        const dayContainer = document.createElement("div");
        dayContainer.className = "day-container";
        
        // Hämta status om dagen är minimerad sedan innan
        if (collapsedDays[dateLabel]) {
            dayContainer.classList.add("collapsed");
        }

        // Skapa klickbar rubrik (Accordion)
        const header = document.createElement("div");
        header.className = "day-header";
        if (collapsedDays[dateLabel]) header.classList.add("collapsed");
        header.innerHTML = `
            <span>${dateLabel}</span>
            <span class="day-toggle-icon">▼</span>
        `;

        // Wrapper för tabellen (behövs för snygg animering/gömning)
        const tableWrapper = document.createElement("div");
        tableWrapper.className = "table-wrapper";

        const table = document.createElement("table");
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Tid</th>
                    <th>Match</th>
                    <th>Resultat</th>
                    <th>Tips</th>
                    <th>Poäng</th>
                    <th>Sänds</th>
                </tr>
            </thead>
        `;

        const tbody = document.createElement("tbody");

        groups[dateLabel].forEach(match => {
            const key = getMatchKey(match);
            const prediction = getPredictionFromKey(userPredictions, key);
            
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

            const matchTime = new Date(match.utcDate).toLocaleTimeString("sv-SE", {hour: '2-digit', minute:'2-digit'});
            const tvHtml = getBroadcasterHtml(match);

            row.innerHTML = `
                <td>${matchTime}</td>
                <td>${getTeamNameSE(match.homeTeam?.name)} - ${getTeamNameSE(match.awayTeam?.name)}</td>
                <td>${match.score.fullTime.home ?? "-"} - ${match.score.fullTime.away ?? "-"}</td>
                <td>${prediction}</td>
                <td>${points}</td>
                <td style="text-align: center;">${tvHtml}</td>
            `;
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        tableWrapper.appendChild(table);
        dayContainer.appendChild(header);
        dayContainer.appendChild(tableWrapper);
        viewMatchesContainer.appendChild(dayContainer);

        // Klick-event för att minimera/expandera
        header.addEventListener("click", () => {
            const isCollapsed = dayContainer.classList.toggle("collapsed");
            header.classList.toggle("collapsed", isCollapsed);
            collapsedDays[dateLabel] = isCollapsed; // Spara statusen i minnet
        });
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
        if (!response.ok) throw new Error(`API-status ${status}`);
        const data = await response.json();
        allMatches = data.matches || [];
        filterMatches();
        renderRanking();
        document.getElementById("lastUpdated").innerText = `Uppdaterad ${new Date().toLocaleTimeString("sv-SE")}`;
    } catch (error) {
        if(document.getElementById("lastUpdated")) {
            document.getElementById("lastUpdated").innerText = `Match-fel: ${error.message}`;
        }
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
    
    if (!btnMatches) return;

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
    
    const searchInput = document.getElementById("search");
    if (searchInput) searchInput.addEventListener("input", filterMatches);
    
    const selector = document.getElementById("user-selector");
    if (selector) {
        selector.addEventListener("change", (e) => { currentUser = e.target.value; filterMatches(); });
    }
    setInterval(loadMatches, 30000);
}
start();
