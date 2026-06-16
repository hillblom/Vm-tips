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
};

const nameToTlaMap = {
    "Argentina": "ARG", "Brazil": "BRA", "France": "FRA", "Germany": "GER", "Spain": "ESP", "Sweden": "SWE"
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

// Räknar ut trend-ikoner (senaste 3 matcherna)
function getTrendIconsHtml(user, finishedMatches) {
    const userPredictions = allPredictions[user] || {};
    // Ta de tre senaste färdigspelade matcherna
    const lastThree = finishedMatches.slice(-3);
    if (lastThree.length === 0) return `<span class="trend-dash">—</span>`;

    return lastThree.map(match => {
        const key = getMatchKey(match);
        const pred = getPredictionFromKey(userPredictions, key);
        if (pred === "-") return `<span class="trend-icon trend-dash">—</span>`;
        
        const [pH, pA] = pred.split("-").map(Number);
        const pts = calculatePoints(match.score.fullTime.home, match.score.fullTime.away, pH, pA);
        
        if (pts === 12) return `<span class="trend-icon trend-green">●</span>`;
        if (pts > 0) return `<span class="trend-icon trend-yellow">●</span>`;
        return `<span class="trend-icon trend-red">●</span>`;
    }).join("");
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

    const finishedMatches = allMatches.filter(m => m.stage === "GROUP_STAGE" && m.status === "FINISHED").sort((a,b) => new Date(a.utcDate) - new Date(b.utcDate));

    let ranking = Object.keys(allPredictions).map(user => {
        const stats = getUserStatsAtMatchLimit(user);
        return { name: user, total: stats.totalPoints, p12: stats.p12, p0: stats.p0 };
    });

    ranking.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    ranking.forEach((player, i) => {
        const row = document.createElement("tr");
        if (player.name === currentUser) row.classList.add("highlight-user-row");
        
        const trendHtml = getTrendIconsHtml(player.name, finishedMatches);

        row.innerHTML = `
            <td>${i + 1}</td>
            <td>
                <div class="ranking-name-wrapper">
                    <span>${player.name}</span>
                    <div class="trend-container">${trendHtml}</div>
                </div>
            </td>
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

    // Skapa headers med Match-kod överst och faktiskt resultat under (om färdigt)
    let headerHtml = "<th>Pos</th><th>Deltagare</th>";
    matches.forEach(m => {
        const key = getMatchKey(m);
        if (m.status === "FINISHED") {
            const res = `${m.score.fullTime.home}-${m.score.fullTime.away}`;
            headerHtml += `<th><div class="matrix-th-match">${key}</div><div class="matrix-th-res">${res}</div></th>`;
        } else {
            headerHtml += `<th><div class="matrix-th-match">${key}</div><div class="matrix-th-res">-</div></th>`;
        }
    });
    header.innerHTML = headerHtml;
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
                
                // Visar poäng stort, och gissat tips i rutan
                html += `<td class="${cls} matrix-tooltip-cell">
                            <div class="matrix-cell-pts">${pts}</div>
                            <div class="matrix-cell-pred">${pred}</div>
                         </td>`;
            } else {
                html += `<td><div class="matrix-cell-pred">${pred}</div></td>`;
            }
        });
        row.innerHTML = html;
        tbody.appendChild(row);
    });
}

function renderChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    const finishedMatches = allMatches
        .filter(m => m.stage === "GROUP_STAGE" && m.status === "FINISHED")
        .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

    if (finishedMatches.length === 0) return;

    const users = Object.keys(allPredictions);
    const labels = ["Start", ...finishedMatches.map(m => getMatchKey(m))];

    const playerHistory = {};
    users.forEach(user => {
        playerHistory[user] = { points: 0, history: [0] };
    });

    finishedMatches.forEach((match) => {
        const key = getMatchKey(match);
        const matchScores = [];

        users.forEach(user => {
            const userPredictions = allPredictions[user] || {};
            const prediction = getPredictionFromKey(userPredictions, key);
            if (prediction && prediction !== "-") {
                const [pH, pA] = prediction.split("-").map(Number);
                playerHistory[user].points += calculatePoints(match.score.fullTime.home, match.score.fullTime.away, pH, pA);
            }
            matchScores.push({ name: user, points: playerHistory[user].points });
        });

        matchScores.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

        matchScores.forEach((item, rankIdx) => {
            playerHistory[item.name].history.push(rankIdx + 1);
        });
    });

    users.forEach(user => {
        playerHistory[user].history[0] = playerHistory[user].history[1];
    });

    const datasets = users.map(user => {
        const isUser = user === currentUser;
        return {
            label: user,
            data: playerHistory[user].history,
            borderColor: isUser ? '#ffc107' : stringToColor(user),
            backgroundColor: isUser ? '#ffc107' : stringToColor(user),
            borderWidth: isUser ? 5 : 1,
            z: isUser ? 999 : 1,
            tension: 0.3,
            fill: false,
            pointRadius: isUser ? 4 : 1
        };
    });

    datasets.sort((a, b) => (a.label === currentUser ? 1 : -1));

    if (trendChartInstance) trendChartInstance.destroy();
    trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            resizeDelay: 100,
            interaction: { mode: 'nearest', intersect: false, axis: 'x' },
            plugins: { 
                legend: { display: false },
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
                    reverse: true,
                    min: 1, 
                    max: users.length,
                    ticks: { stepSize: 1, font: { size: 10 } },
                    title: { display: true, text: 'Placering i tabellen' }
                },
                x: {
                    title: { display: true, text: 'Matcher spelade' },
                    ticks: { font: { size: 10 } }
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

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    let color = '#';
    for (let i = 0; i < 3; i++) color += ('00' + ((hash >> (i * 8)) & 0xFF).toString(16)).slice(-2);
    return color;
}

async function start() {
    setupTabs();
    
    const respP = await fetch("predictions.json?v=" + Date.now());
    allPredictions = await respP.json();
    
    const selector = document.getElementById("user-selector");
    Object.keys(allPredictions).forEach(u => {
        const option = document.createElement("option");
        option.value = u;
        option.innerText = u;
        selector.appendChild(option);
    });
    
    currentUser = localStorage.getItem("selectedUser") || Object.keys(allPredictions)[0];
    selector.value = currentUser;

    selector.addEventListener("change", (e) => {
        currentUser = e.target.value;
        localStorage.setItem("selectedUser", currentUser);
        renderMatches();
        if (!document.getElementById("view-ranking").classList.contains("hidden")) renderRanking();
        if (!document.getElementById("view-matrix").classList.contains("hidden")) renderMatrix();
        if (!document.getElementById("view-chart").classList.contains("hidden")) renderChart();
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
