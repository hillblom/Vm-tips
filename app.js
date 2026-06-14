const API_URL = "https://vm-predictor.stefan-hillblom.workers.dev/";

let allPredictions = {};
let allMatches = [];
let currentUser = "";
let matrixSortByRanking = true; // true = sortera efter poäng (standard), false = sortera efter namn (A-Ö)

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
    if (match.broadcaster === "svt") {
        return `<img src="svt.png" class="tv-logo" alt="SVT">`;
    } else if (match.broadcaster === "tv4") {
        return `<img src="tv4.png" class="tv-logo" alt="TV4">`;
    }
    
    // Fallback om en match mot förmodan inte skulle matchas i kalendern
    return `<span style="font-size:0.7rem; color:var(--text-muted)">Ej klart</span>`;
}

function getSwedishDayName(dateString) {
    const date = new Date(dateString);
    const days = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
    return days[date.getDay()];
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
        if (selector) {
            selector.innerHTML = "";
            users.forEach(user => {
                const option = document.createElement("option");
                option.value = user; option.innerText = user;
                selector.appendChild(option);
            });
        }
    } catch (error) {
        const errEl = document.getElementById("lastUpdated");
        if (errEl) errEl.innerText = `Tips-fel: ${error.message}`;
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
        const dayName = getSwedishDayName(match.utcDate);
        const dayMonth = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
        const timeStr = dateObj.toLocaleTimeString("sv-SE", {hour: '2-digit', minute:'2-digit'});
        const tvHtml = getBroadcasterHtml(match);

        row.innerHTML = `
        <td style="vertical-align: middle;">
            <div class="date-cell-wrapper">
                <span class="date-text">${dayName} ${dayMonth} ${timeStr}</span>
                <span class="logo-container">${tvHtml}</span>
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

function renderMatrix() {
    const headerRow = document.getElementById("matrix-header");
    const tbody = document.getElementById("matrix-body");
    if (!headerRow || !tbody) return;

    headerRow.innerHTML = "";
    tbody.innerHTML = "";

    const validMatches = allMatches.filter(m => m.stage === "GROUP_STAGE");
    validMatches.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

    if (validMatches.length === 0) return;

    // Skapa en klickbar rubrik för deltagarkolumnen
    const thPlayer = document.createElement("th");
    thPlayer.style.cursor = "pointer";
    thPlayer.style.userSelect = "none";
    thPlayer.title = "Klicka för att ändra sortering (Namn / Ranking)";
    thPlayer.innerHTML = `Deltagare ${matrixSortByRanking ? "🏆" : "🔤"}`;
    
    thPlayer.addEventListener("click", () => {
        matrixSortByRanking = !matrixSortByRanking;
        renderMatrix();
    });
    headerRow.appendChild(thPlayer);

    // HÄR BYGGER VI RUBRIKERNA MED MATCHKOD + RESULTAT UNDER
    validMatches.forEach(match => {
        const th = document.createElement("th");
        const matchKey = getMatchKey(match) || "???";
        
        // Hämta mål om matchen har startat/avslutats
        const homeScore = match.score.fullTime.home ?? match.score.live?.home ?? null;
        const awayScore = match.score.fullTime.away ?? match.score.live?.away ?? null;
        
        // Om resultatet finns, lägg till det på en ny rad (<br>)
        const scoreLine = (homeScore !== null && awayScore !== null) ? `<br><span style="color: var(--primary-color); font-weight: 700;">${homeScore}-${awayScore}</span>` : "<br><span style='color: var(--text-muted); font-weight: 400;'>-</span>";

        th.innerHTML = `${matchKey}${scoreLine}`;
        th.title = `${getTeamNameSE(match.homeTeam?.name)} - ${getTeamNameSE(match.awayTeam?.name)}`;
        headerRow.appendChild(th);
    });

    // Sortera deltagarna baserat på vilket läge som är aktivt
    const users = Object.keys(allPredictions).sort((a, b) => {
        if (matrixSortByRanking) {
            return getUserTotalPoints(b) - getUserTotalPoints(a);
        } else {
            return a.localeCompare(b, 'sv');
        }
    });

    users.forEach(user => {
        const row = document.createElement("tr");
        const userPredictions = allPredictions[user] || {};

        const tdName = document.createElement("td");
        tdName.innerText = user;
        row.appendChild(tdName);

        validMatches.forEach(match => {
            const td = document.createElement("td");
            const key = getMatchKey(match);
            const prediction = getPredictionFromKey(userPredictions, key);
            
            const isFinished = match.status === "FINISHED";
            const homeScore = match.score.fullTime.home ?? match.score.live?.home ?? null;
            const awayScore = match.score.fullTime.away ?? match.score.live?.away ?? null;

            // HÄR SÄTTER VI DEN MINIMERADE TOOLTIPEN (Bara personens tips)
            if (prediction !== "-") {
                td.title = `${user}: ${prediction}`;
            }

            if (prediction === "-") {
                td.innerText = "-";
            } else if (homeScore !== null && awayScore !== null) {
                const [pHome, pAway] = prediction.split("-").map(Number);
                const points = calculatePoints(homeScore, awayScore, pHome, pAway);
                td.innerText = points;

                if (isFinished) {
                    if (points === 12) td.classList.add("matrix-cell-12");
                    else if (points > 0) td.classList.add("matrix-cell-good");
                    else if (points === 0) td.classList.add("matrix-cell-0");
                }
            } else {
                td.innerText = "✔"; 
                td.style.color = "var(--text-muted)";
            }
            row.appendChild(td);
        });

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
        
        const viewMatrix = document.getElementById("view-matrix");
        if(viewMatrix && !viewMatrix.classList.contains("hidden")) { 
            renderMatrix(); 
        }
        
        const luEl = document.getElementById("lastUpdated");
        if (luEl) luEl.innerText = `Uppdaterad ${new Date().toLocaleTimeString("sv-SE")}`;
    } catch (error) {
        const errEl = document.getElementById("lastUpdated");
        if (errEl) errEl.innerText = `Match-fel: ${error.message}`;
    }
}

function filterMatches() {
    if (!allMatches || allMatches.length === 0) return;
    const searchInput = document.getElementById("search");
    const query = searchInput ? searchInput.value.toLowerCase() : "";
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
    const btnMatrix = document.getElementById("btn-matrix"); 
    
    const viewMatches = document.getElementById("view-matches");
    const viewRanking = document.getElementById("view-ranking");
    const viewMatrix = document.getElementById("view-matrix"); 
    
    const btnRules = document.getElementById("btn-rules");
    const rulesModal = document.getElementById("rules-modal");
    const closeBtn = document.querySelector(".close-btn");

    function clearActive() {
        if(btnMatches) btnMatches.classList.remove("active");
        if(btnRanking) btnRanking.classList.remove("active");
        if(btnMatrix) btnMatrix.classList.remove("active");
        if(viewMatches) viewMatches.classList.add("hidden");
        if(viewRanking) viewRanking.classList.add("hidden");
        if(viewMatrix) viewMatrix.classList.add("hidden");
    }

    if(btnMatches && viewMatches) {
        btnMatches.addEventListener("click", () => {
            clearActive(); btnMatches.classList.add("active"); viewMatches.classList.remove("hidden");
        });
    }
    
    if(btnRanking && viewRanking) {
        btnRanking.addEventListener("click", () => {
            clearActive(); btnRanking.classList.add("active"); viewRanking.classList.remove("hidden");
            renderRanking();
        });
    }

    if(btnMatrix && viewMatrix) {
        btnMatrix.addEventListener("click", () => {
            clearActive(); btnMatrix.classList.add("active"); viewMatrix.classList.remove("hidden");
            renderMatrix(); 
        });
    }

    if(btnRules && rulesModal) {
        btnRules.addEventListener("click", (e) => {
            e.preventDefault(); 
            rulesModal.classList.remove("hidden");
        });
    }

    if(closeBtn && rulesModal) {
        closeBtn.addEventListener("click", () => { rulesModal.classList.add("hidden"); });
    }
    
    if(rulesModal) {
        window.addEventListener("click", (event) => { if (event.target === rulesModal) rulesModal.classList.add("hidden"); });
    }
}

async function start(){
    setupTabs();
    await loadPredictions();
    await loadMatches();
    
    const searchInput = document.getElementById("search");
    if(searchInput) {
        searchInput.addEventListener("input", filterMatches);
    }
    
    const selector = document.getElementById("user-selector");
    if (selector) {
        selector.addEventListener("change", (e) => { currentUser = e.target.value; filterMatches(); });
    }
    setInterval(loadMatches, 30000);
}
start();
