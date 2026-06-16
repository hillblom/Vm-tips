const API_URL = "https://vm-predictor.stefan-hillblom.workers.dev/";

let allPredictions = {};
let allMatches = [];
let currentUser = "";
let matrixSortByRanking = true; 
let hideFinishedMatches = false;
let trendChartInstance = null;

const teamNamesSE = {
    "Algeria": "Algeriet", "Argentina": "Argentina", "Australia": "Australien", "Austria": "Österrike",
    "Belgium": "Belgien", "Bosnia and Herzegovina": "Bosnien", "Bosnia-Herzegovina": "Bosnien", "Brazil": "Brasilien",
    "Canada": "Kanada", "Cape Verde": "Kap Verde", "Cape-Verde": "Kap Verde", "Colombia": "Colombia",
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
    if (match.broadcaster === "svt") return `<img src="svt.png" class="tv-logo" alt="SVT">`;
    if (match.broadcaster === "tv4") return `<img src="tv4.png" class="tv-logo" alt="TV4">`;
    return `<span style="font-size:0.7rem; color:var(--text-muted)">Ej klart</span>`;
}

function getMatchKey(match) {
    const homeTLA = nameToTlaMap[match.homeTeam?.name] || match.homeTeam?.tla || "???";
    const awayTLA = nameToTlaMap[match.awayTeam?.name] || match.awayTeam?.tla || "???";
    return `${homeTLA}-${awayTLA}`;
}

function getPredictionFromKey(userPredictions, key) {
    if (!userPredictions || !key) return "-";
    return userPredictions[key] || "-";
}

function calculatePoints(actualHome, actualAway, predictedHome, predictedAway){
    if(actualHome === predictedHome && actualAway === predictedAway) return 12;
    const diff = Math.abs(actualHome - predictedHome) + Math.abs(actualAway - predictedAway);
    const actualOutcome = actualHome > actualAway ? "H" : (actualHome < actualAway ? "A" : "D");
    const predictedOutcome = predictedHome > predictedAway ? "H" : (predictedHome < predictedAway ? "A" : "D");
    let points = actualOutcome === predictedOutcome ? 10 - diff : 5 - diff;
    return Math.max(0, points);
}

function getUserStatsAtMatchLimit(user, limit = null) {
    let totalPoints = 0, p12 = 0, p0 = 0;
    const userPredictions = allPredictions[user] || {};
    const finished = allMatches.filter(m => m.stage === "GROUP_STAGE" && m.status === "FINISHED").sort((a,b) => new Date(a.utcDate) - new Date(b.utcDate));
    const toCount = limit !== null ? finished.slice(0, limit) : finished;

    toCount.forEach(match => {
        const prediction = getPredictionFromKey(userPredictions, getMatchKey(match));
        if (prediction !== "-") {
            const [pH, pA] = prediction.split("-").map(Number);
            const pts = calculatePoints(match.score.fullTime.home, match.score.fullTime.away, pH, pA);
            totalPoints += pts;
            if (pts === 12) p12++;
            if (pts === 0) p0++;
        }
    });
    return { totalPoints, p12, p0 };
}

function renderMatches() {
    const tbody = document.getElementById("matches");
    if (!tbody) return;
    tbody.innerHTML = "";
    const userPredictions = allPredictions[currentUser] || {};

    allMatches.filter(m => m.stage === "GROUP_STAGE").forEach(match => {
        if (hideFinishedMatches && match.status === "FINISHED") return;

        const key = getMatchKey(match);
        const prediction = getPredictionFromKey(userPredictions, key);
        const homeScore = match.score.fullTime.home ?? "-";
        const awayScore = match.score.fullTime.away ?? "-";
        
        let points = "";
        if(match.status === "FINISHED" && prediction !== "-"){
            const [pH, pA] = prediction.split("-").map(Number);
            points = calculatePoints(match.score.fullTime.home, match.score.fullTime.away, pH, pA);
        }

        const row = document.createElement("tr");
        if (match.status === "FINISHED" && prediction !== "-") {
            if (points === 12) row.classList.add("green");
            else if (points > 0) row.classList.add("yellow");
            else if (points === 0) row.classList.add("red");
        }

        const date = new Date(match.utcDate);
        row.innerHTML = `
            <td>${date.toLocaleDateString('sv-SE')} ${date.toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'})} ${getBroadcasterHtml(match)}</td>
            <td>${teamNamesSE[match.homeTeam.name] || match.homeTeam.name} - ${teamNamesSE[match.awayTeam.name] || match.awayTeam.name}</td>
            <td>${homeScore} - ${awayScore}</td>
            <td>${prediction}</td>
            <td>${points}</td>
            <td>${match.status === "FINISHED" ? "Fulltid" : "Kommande"}</td>
        `;
        tbody.appendChild(row);
    });
}

function renderRanking() {
    const tbody = document.getElementById("ranking-list");
    if (!tbody) return;
    tbody.innerHTML = "";

    let ranking = Object.keys(allPredictions).map(user => {
        const stats = getUserStatsAtMatchLimit(user);
        return { name: user, total: stats.totalPoints, p12: stats.p12, p0: stats.p0 };
    });

    ranking.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    ranking.forEach((player, i) => {
        const row = document.createElement("tr");
        if (player.name === currentUser) row.classList.add("highlight-user-row");
        row.innerHTML = `
            <td>${i + 1}</td>
            <td>${player.name}</td>
            <td>${player.total}</td>
            <td style="text-align:center">${player.p12}</td>
            <td style="text-align:center">${player.p0}</td>
        `;
        tbody.appendChild(row);
    });
}

function renderMatrix() {
    const header = document.getElementById("matrix-header");
    const tbody = document.getElementById("matrix-body");
    const matches = allMatches.filter(m => m.stage === "GROUP_STAGE").sort((a,b) => new Date(a.utcDate) - new Date(b.utcDate));

    header.innerHTML = "<th>Pos</th><th>Deltagare</th>" + matches.map(m => `<th>${getMatchKey(m)}</th>`).join("");
    tbody.innerHTML = "";

    const users = Object.keys(allPredictions).sort((a,b) => getUserStatsAtMatchLimit(b).totalPoints - getUserStatsAtMatchLimit(a).totalPoints);

    users.forEach((user, i) => {
        const row = document.createElement("tr");
        if (user === currentUser) row.classList.add("highlight-user-row");
        let html = `<td class="matrix-sticky-pos">${i+1}</td><td class="matrix-sticky-name">${user}</td>`;
        
        matches.forEach(m => {
            const pred = getPredictionFromKey(allPredictions[user], getMatchKey(m));
            if (m.status === "FINISHED") {
                const [pH, pA] = pred.split("-").map(Number);
                const pts = calculatePoints(m.score.fullTime.home, m.score.fullTime.away, pH, pA);
                let cls = pts === 12 ? "green" : (pts === 0 ? "red" : "yellow");
                html += `<td class="${cls} matrix-tooltip-cell">${pts}<span class="matrix-tooltip-box">${pred.replace("-", " - ")}</span></td>`;
            } else {
                html += `<td>(${pred})</td>`;
            }
        });
        row.innerHTML = html;
        tbody.appendChild(row);
    });
}

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    let color = '#';
    for (let i = 0; i < 3; i++) color += ('00' + ((hash >> (i * 8)) & 0xFF).toString(16)).slice(-2);
    return color;
}

// GENERERA OCH RENDERA TRENDGRAFEN (UPPDATERAD LOGIK FÖR PLACERING)
function renderChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    // Hämta färdigspelade gruppspelsmatcher kronologiskt
    const finishedMatches = allMatches
        .filter(m => m.stage === "GROUP_STAGE" && m.status === "FINISHED")
        .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

    if (finishedMatches.length === 0) return;

    const users = Object.keys(allPredictions);
    
    // Labels för X-axeln (Match-keys)
    const labels = ["Start", ...finishedMatches.map(m => getMatchKey(m))];

    // Strukturerad datalagring för att bygga linjerna
    const playerHistory = {};
    users.forEach(user => {
        playerHistory[user] = {
            points: 0,
            history: [0] // Startposition (justeras nedan)
        };
    });

    // Loopa match för match och räkna ut ackumulerad poängställning sekventiellt
    finishedMatches.forEach((match, matchIndex) => {
        const key = getMatchKey(match);
        const matchScores = [];

        users.forEach(user => {
            const userPredictions = allPredictions[user] || {};
            const prediction = getPredictionFromKey(userPredictions, key);
            if (prediction && prediction !== "-") {
                const [pH, pA] = prediction.split("-").map(Number);
                const pts = calculatePoints(match.score.fullTime.home, match.score.fullTime.away, pH, pA);
                playerHistory[user].points += pts;
            }
            matchScores.push({ name: user, points: playerHistory[user].points });
        });

        // Sortera poängställningen efter denna match (med alfabetisk tie-breaker)
        matchScores.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

        // Ge varje spelare dess placering (1 till X) efter denna match
        matchScores.forEach((item, rankIdx) => {
            playerHistory[item.name].history.push(rankIdx + 1);
        });
    });

    // Fyll i startpositionen på ett snyggare sätt (samma som efter första matchen)
    users.forEach(user => {
        playerHistory[user].history[0] = playerHistory[user].history[1];
    });

    // Bygg ihop datasets för Chart.js
    const datasets = users.map(user => {
        const isUser = user === currentUser;
        return {
            label: user,
            data: playerHistory[user].history,
            borderColor: isUser ? '#ffc107' : stringToColor(user), // Highlighta guld/gul
            backgroundColor: isUser ? '#ffc107' : stringToColor(user),
            borderWidth: isUser ? 5 : 1, // Tjockare linje för vald användare
            z: isUser ? 999 : 1,         // Lägg den valda linjen överst
            tension: 0.3,
            fill: false,
            pointRadius: isUser ? 4 : 1
        };
    });

    // Sortera datasets så den markerade användaren ritas sist (hamnar överst)
    datasets.sort((a, b) => (a.label === currentUser ? 1 : -1));

    if (trendChartInstance) trendChartInstance.destroy();
    trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, // Krävs för dynamisk höjd
            resizeDelay: 100,
            interaction: {
                mode: 'nearest',
                intersect: false,
                axis: 'x'
            },
            plugins: { 
                legend: { display: false }, // Dölj legend högst upp, för rörigt med 33 namn
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: Placering ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: { 
                y: { 
                    reverse: true, // VÄND AXELN! Placering 1 ska vara högst upp, inte längst ner
                    min: 1, 
                    max: users.length,
                    ticks: {
                        stepSize: 1,
                        font: { size: 10 }
                    },
                    title: {
                        display: true,
                        text: 'Placering i tabellen'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Matcher spelade'
                    },
                    ticks: {
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}

function setupTabs() {
    const tabs = {
        "btn-matches": ["view-matches", false],
        "btn-ranking": ["view-ranking", false],
        "btn-matrix": ["view-matrix", true],
        "btn-chart": ["view-chart", true]
    };

    Object.keys(tabs).forEach(btnId => {
        document.getElementById(btnId).addEventListener("click", () => {
            Object.values(tabs).forEach(v => document.getElementById(v[0]).classList.add("hidden"));
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            
            const [viewId, fullWidth] = tabs[btnId];
            document.getElementById(viewId).classList.remove("hidden");
            document.getElementById(btnId).classList.add("active");
            
            const container = document.getElementById("main-container");
            fullWidth ? container.classList.add("full-width") : container.classList.remove("full-width");

            if (btnId === "btn-ranking") renderRanking();
            if (btnId === "btn-matrix") renderMatrix();
            if (btnId === "btn-chart") renderChart();
        });
    });

    document.getElementById("btn-rules").addEventListener("click", () => document.getElementById("rules-modal").classList.remove("hidden"));
    document.querySelector(".close-btn").addEventListener("click", () => document.getElementById("rules-modal").classList.add("hidden"));
}

async function start() {
    setupTabs();
    
    // Ladda predictions först
    const respP = await fetch("predictions.json?v=" + Date.now());
    allPredictions = await respP.json();
    
    // Bygg deltagar-rullist
    const selector = document.getElementById("user-selector");
    Object.keys(allPredictions).forEach(u => {
        const option = document.createElement("option");
        option.value = u;
        option.innerText = u;
        selector.appendChild(option);
    });
    
    // Hämta sparad användare
    currentUser = localStorage.getItem("selectedUser") || Object.keys(allPredictions)[0];
    selector.value = currentUser;

    // Lyssna på ändringar av användare
    selector.addEventListener("change", (e) => {
        currentUser = e.target.value;
        localStorage.setItem("selectedUser", currentUser);
        renderMatches();
        // Uppdatera även andra vyer om de är öppna
        if (!document.getElementById("view-ranking").classList.contains("hidden")) renderRanking();
        if (!document.getElementById("view-matrix").classList.contains("hidden")) renderMatrix();
        if (!document.getElementById("view-chart").classList.contains("hidden")) renderChart();
    });

    // Lyssna på filter-checkbox
    document.getElementById("hide-finished-checkbox").addEventListener("change", (e) => {
        hideFinishedMatches = e.target.checked;
        renderMatches();
    });

    // Ladda matcher och rendera
    const respM = await fetch(API_URL);
    const data = await respM.json();
    allMatches = data.matches;
    renderMatches();
}

start();
