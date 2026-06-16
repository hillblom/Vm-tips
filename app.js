const API_URL = "https://vm-predictor.stefan-hillblom.workers.dev/";

let allPredictions = {};
let allMatches = [];
let currentUser = "";
let matrixSortByRanking = true; 
let hideFinishedMatches = false;
let trendChartInstance = null;

const teamNamesSE = {
    "Algeria": "Algeriet", "Argentina": "Argentina", "Australia": "Australien", "Austria": "Österrike",
    "Belgium": "Belgien", "Brazil": "Brasilien", "Canada": "Kanada", "Croatia": "Kroatien",
    "Czechia": "Tjeckien", "Denmark": "Danmark", "England": "England", "France": "Frankrike",
    "Germany": "Tyskland", "Italy": "Italien", "Mexico": "Mexiko", "Morocco": "Marocko",
    "Netherlands": "Nederländerna", "Norway": "Norge", "Portugal": "Portugal", "Spain": "Spanien",
    "Sweden": "Sverige", "Switzerland": "Schweiz", "United States": "USA", "Uruguay": "Uruguay"
    // Fyll på vid behov...
};

const nameToTlaMap = {
    "Argentina": "ARG", "Brazil": "BRA", "France": "FRA", "Germany": "GER", "Spain": "ESP", "Sweden": "SWE"
    // Fyll på vid behov...
};

function getBroadcasterHtml(match) {
    if (match.broadcaster === "svt") return `<img src="svt.png" class="tv-logo" alt="SVT">`;
    if (match.broadcaster === "tv4") return `<img src="tv4.png" class="tv-logo" alt="TV4">`;
    return `<span style="font-size:0.7rem; color:var(--text-muted)">-</span>`;
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
        if (points === 12) row.classList.add("green");
        else if (points > 0) row.classList.add("yellow");
        else if (points === 0 && match.status === "FINISHED") row.classList.add("red");

        const date = new Date(match.utcDate);
        row.innerHTML = `
            <td>${date.toLocaleDateString('sv-SE')} ${getBroadcasterHtml(match)}</td>
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

function getUserStatsAtMatchLimit(user, limit = null) {
    let totalPoints = 0, p12 = 0, p0 = 0;
    const userPredictions = allPredictions[user] || {};
    const finished = allMatches.filter(m => m.status === "FINISHED").sort((a,b) => new Date(a.utcDate) - new Date(b.utcDate));
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

function renderChart() {
    const ctx = document.getElementById('trendChart');
    const finished = allMatches.filter(m => m.status === "FINISHED").sort((a,b) => new Date(a.utcDate) - new Date(b.utcDate));
    if (!ctx || finished.length === 0) return;

    const datasets = Object.keys(allPredictions).map(user => {
        const history = [0]; 
        let currentPoints = 0;
        finished.forEach(m => {
            const pred = getPredictionFromKey(allPredictions[user], getMatchKey(m));
            if (pred !== "-") {
                const [pH, pA] = pred.split("-").map(Number);
                currentPoints += calculatePoints(m.score.fullTime.home, m.score.fullTime.away, pH, pA);
            }
            history.push(currentPoints);
        });

        const isUser = user === currentUser;
        return {
            label: user,
            data: history,
            borderColor: isUser ? '#ffc107' : stringToColor(user),
            borderWidth: isUser ? 5 : 1,
            z: isUser ? 100 : 1,
            tension: 0.3
        };
    });

    if (trendChartInstance) trendChartInstance.destroy();
    trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: ["Start", ...finished.map((_, i) => i+1)], datasets },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, // Mycket viktigt för att CSS-höjden ska gälla!
            resizeDelay: 100,            // Väntar 100ms efter resize innan den ritar om för bättre prestanda
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
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
    const respP = await fetch("predictions.json?v=" + Date.now());
    allPredictions = await respP.json();
    
    const selector = document.getElementById("user-selector");
    Object.keys(allPredictions).forEach(u => selector.innerHTML += `<option value="${u}">${u}</option>`);
    currentUser = localStorage.getItem("selectedUser") || Object.keys(allPredictions)[0];
    selector.value = currentUser;

    selector.addEventListener("change", (e) => {
        currentUser = e.target.value;
        localStorage.setItem("selectedUser", currentUser);
        renderMatches();
    });

    document.getElementById("hide-finished-checkbox").addEventListener("change", (e) => {
        hideFinishedMatches = e.target.checked;
        renderMatches();
    });

    const respM = await fetch(API_URL);
    const data = await respM.json();
    allMatches = data.matches;
    renderMatches();
}

start();
