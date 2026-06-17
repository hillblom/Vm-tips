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
    "England": "ENG", "France": "FRA", "Germany": "GER", "Ghana": "GHA", "Haiti": "HAI",
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
    return `<span style="font-size:0.7rem; color:var(--text-muted)">-</span>`;
}

function getMatchKey(match) {
    const homeTLA = nameToTlaMap[match.homeTeam?.name] || match.homeTeam?.tla || "???";
    const awayTLA = nameToTlaMap[match.awayTeam?.name] || match.awayTeam?.tla || "???";
    return `${homeTLA}-${awayTLA}`;
}

function getPredictionFromKey(userPredictions, key) {
    if (!userPredictions || !key) return "-";
    if (userPredictions[key]) return userPredictions[key];
    
    const [teamA, teamB] = key.split("-");
    const reversedKey = `${teamB}-${teamA}`;
    if (userPredictions[reversedKey]) return userPredictions[reversedKey];
    
    return "-";
}

function calculatePointsAdvanced(match, predictionStr) {
    if (!predictionStr || predictionStr === "-") return 0;

    const apiHomeTLA = nameToTlaMap[match.homeTeam?.name] || match.homeTeam?.tla || "???";
    const apiAwayTLA = nameToTlaMap[match.awayTeam?.name] || match.awayTeam?.tla || "???";

    const normalKey = `${apiHomeTLA}-${apiAwayTLA}`;
    const reversedKey = `${apiAwayTLA}-${apiHomeTLA}`;
    
    let predHomeTLA = apiHomeTLA;
    let predAwayTLA = apiAwayTLA;
    let [predHomeScore, predAwayScore] = predictionStr.split("-").map(Number);

    if (!allPredictions[currentUser]?.[normalKey] && allPredictions[currentUser]?.[reversedKey]) {
        predHomeTLA = apiAwayTLA;
        predAwayTLA = apiHomeTLA;
    }

    const actualHome = match.score.fullTime.home;
    const actualAway = match.score.fullTime.away;

    const pHome = (predHomeTLA === apiHomeTLA) ? predHomeScore : predAwayScore;
    const pAway = (predAwayTLA === apiAwayTLA) ? predAwayScore : predHomeScore;

    if (actualHome === pHome && actualAway === pAway) return 12;

    const diff = Math.abs(actualHome - pHome) + Math.abs(actualAway - pAway);
    const actualOutcome = actualHome > actualAway ? "H" : (actualHome < actualAway ? "A" : "D");
    const predictedOutcome = pHome > pAway ? "H" : (pHome < pAway ? "A" : "D");

    let points = actualOutcome === predictedOutcome ? 10 - diff : 5 - diff;
    return Math.max(0, points);
}

function getUserStatsAtMatchLimit(user, limit = null) {
    let totalPoints = 0, p12 = 0, p0 = 0;
    const userPredictions = allPredictions[user] || {};
    const finished = allMatches.filter(m => m.stage === "GROUP_STAGE" && m.status === "FINISHED").sort((a,b) => new Date(a.utcDate) - new Date(b.utcDate));
    const toCount = limit !== null ? finished.slice(0, limit) : finished;

    toCount.forEach(match => {
        const key = getMatchKey(match);
        const prediction = getPredictionFromKey(userPredictions, key);
        if (prediction !== "-") {
            const pts = calculatePointsAdvanced(match, prediction);
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
            points = calculatePointsAdvanced(match, prediction);
        }

        const row = document.createElement("tr");
        if (match.status === "FINISHED" && prediction !== "-") {
            if (points === 12) row.classList.add("green");
            else if (points > 0) row.classList.add("yellow");
            else if (points === 0) row.classList.add("red");
        }

        const date = new Date(match.utcDate);
        // Vi separerar datum och tid i JS för full kontroll
        const onlyDate = date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' }); // Ex: "16 juni" eller "2026-06-16"
        const onlyTime = date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

        row.innerHTML = `
            <td class="match-meta-cell">
                <div class="date-time-stack">
                    <span class="match-d">${onlyDate}</span>
                    <span class="match-t">${onlyTime}</span>
                </div>
                ${getBroadcasterHtml(match)}
            </td>
            <td>${teamNamesSE[match.homeTeam.name] || match.homeTeam.name} - ${teamNamesSE[match.awayTeam.name] || match.awayTeam.name}</td>
            <td>${homeScore}-${awayScore}</td>
            <td>${prediction}</td>
            <td>${points}</td>
            <td>${match.status === "FINISHED" ? "Fulltid" : (match.status === "IN_PLAY" || match.status === "PAUSED" || match.status === "LIVE" ? "Pågår" : "Kommande")}</td>
        `;
        tbody.appendChild(row);
    });
}

function renderRanking() {
    const tbody = document.getElementById("ranking-list");
    if (!tbody) return;
    tbody.innerHTML = "";

    const finishedMatches = allMatches.filter(m => m.stage === "GROUP_STAGE" && m.status === "FINISHED").sort((a,b) => new Date(a.utcDate) - new Date(b.utcDate));
    const allGroupMatches = allMatches.filter(m => m.stage === "GROUP_STAGE");
    const users = Object.keys(allPredictions);

    let ranking = users.map(user => {
        const stats = getUserStatsAtMatchLimit(user);
        return { name: user, total: stats.totalPoints, p12: stats.p12, p0: stats.p0 };
    });

    ranking.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    // --- NYTT: UPPDATERA INFOPANELEN (Matcher kvar & Omgångar) ---
    // Räkna ut ett ungefärligt omgångsnummer (t.ex. antal spelade matcher dividerat med hur många matcher det är per omgång, eller bara antal spelade matcher)
    // Här sätter vi antal spelade gruppspelsmatcher som en indikator, eller ändra till din egen logik:
    const playedCount = finishedMatches.length;
    const totalCount = allGroupMatches.length;
    const leftCount = totalCount - playedCount;

    document.getElementById("stats-played-rounds").innerText = playedCount;
    document.getElementById("stats-matches-left").innerText = leftCount;


    // Trend-logik (Befintlig)
    const trendMap = {};
    let maxClimb = 0; 
    let maxDrop = 0;  
    let raketName = "Ingen";
    let fallName = "Ingen";

    if (finishedMatches.length > 0) {
        const currentRanks = {};
        ranking.forEach((player, idx) => { currentRanks[player.name] = idx + 1; });

        // Titta 3 matcher bakåt för trenden (precis som i din tidigare kod)
        const limit = Math.max(0, finishedMatches.length - 1); // Ändrat till -1 för att se förändringen sedan EXAKT förra matchen
        const oldScores = users.map(u => ({ name: u, pts: getUserStatsAtMatchLimit(u, limit).totalPoints }));
        oldScores.sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
        
        const oldRanks = {};
        oldScores.forEach((player, idx) => { oldRanks[player.name] = idx + 1; });

        users.forEach(user => {
            const current = currentRanks[user];
            const old = oldRanks[user];
            const diff = old - current; // Positivt = klättrat platser

            trendMap[user] = diff;

            if (diff > maxClimb) {
                maxClimb = diff;
                raketName = user;
            }
            if (diff < maxDrop) {
                maxDrop = diff;
                fallName = user;
            }
        });
    }

    // --- NYTT: SÄTT TEXT FÖR RAKET OCH FRITT FALL ---
    document.getElementById("stats-max-climb").innerText = maxClimb > 0 ? `${raketName} (+${maxClimb})` : "Ingen förändring";
    document.getElementById("stats-max-drop").innerText = maxDrop < 0 ? `${fallName} (${maxDrop})` : "Ingen förändring";


    // Rendera själva tabellraderna till vänster (Befintlig logik)
    ranking.forEach((player, i) => {
        const row = document.createElement("tr");
        if (player.name === currentUser) row.classList.add("highlight-user-row");
        
        let trendHtml = "";
        const userDiff = trendMap[player.name] || 0;

        if (finishedMatches.length > 0 && userDiff !== 0) {
            if (userDiff > 0 && userDiff === maxClimb) {
                trendHtml = `<span class="trend-icon trend-green" title="Klättrat mest: +${userDiff} platser">▲</span>`;
            } else if (userDiff < 0 && Math.abs(userDiff) === Math.abs(maxDrop)) {
                trendHtml = `<span class="trend-icon trend-red" title="Fallit mest: -${Math.abs(userDiff)} platser">▼</span>`;
            }
        }

        row.innerHTML = `
            <td>${i + 1} ${trendHtml}</td>
            <td><strong>${player.name}</strong></td>
            <td>${player.total}</td>
            <td style="text-align:center">${player.p12}</td>
            <td style="text-align:center">${player.p0}</td>
        `;
        tbody.appendChild(row);
    });
}

function renderMatrix() {
    const matrixView = document.getElementById("view-matrix");
    if (!matrixView) return;

    matrixView.innerHTML = `
        <div class="card">
            <div class="matrix-wrapper">
                <table class="matrix-table">
                    <thead>
                        <tr id="matrix-header"></tr>
                    </thead>
                    <tbody id="matrix-body"></tbody>
                </table>
            </div>
        </div>
    `;

    const header = document.getElementById("matrix-header");
    const tbody = document.getElementById("matrix-body");
    
    // NYTT: Här filtrerar vi matcherna så att de färdigspelade döljs helt om "hideFinishedMatches" är true
    const matches = allMatches
        .filter(m => m.stage === "GROUP_STAGE")
        .filter(m => !hideFinishedMatches || m.status !== "FINISHED")
        .sort((a,b) => new Date(a.utcDate) - new Date(b.utcDate));

    let headerHtml = "<th class='matrix-sticky-pos'>Pos</th><th class='matrix-sticky-name' style='cursor: pointer; user-select: none;' onclick='toggleMatrixSort()'>Deltagare ↕️</th>";
    matches.forEach(m => {
        const key = getMatchKey(m);
        const homeFullName = teamNamesSE[m.homeTeam.name] || m.homeTeam.name;
        const awayFullName = teamNamesSE[m.awayTeam.name] || m.awayTeam.name;
        let resHtml = `<div class="matrix-th-res">-</div>`;
        if (m.status === "FINISHED") {
            resHtml = `<div class="matrix-th-res">${m.score.fullTime.home ?? 0}-${m.score.fullTime.away ?? 0}</div>`;
        } else if (m.status === "IN_PLAY" || m.status === "LIVE") {
            // Lägger till parenteser runt liveresultatet på översta raden
            resHtml = `<div class="matrix-th-res">(${m.score.fullTime.home ?? 0}-${m.score.fullTime.away ?? 0})</div>`;
        }        
            headerHtml += `
            <th class="matrix-tooltip-cell">
                <div class="matrix-th-match">${key}</div>
                ${resHtml}
                <span class="matrix-tooltip-box">${homeFullName} - ${awayFullName}</span>
            </th>`;
    });
    header.innerHTML = headerHtml;

    const users = Object.keys(allPredictions);

    // 1. Räkna ut poäng för ALLA deltagare först
    const rankingScores = users.map(user => {
        return { name: user, totalPoints: getUserStatsAtMatchLimit(user).totalPoints };
    });

    // 2. Sortera ALLTID efter ranking först för att räkna ut den fasta placeringen (inklusive delad plats)
    rankingScores.sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name));
    
    const orderedPoints = rankingScores.map(x => x.totalPoints);
    
    // Spara ranking-positionen som en egenskap på varje deltagare
    rankingScores.forEach((player, i) => {
        player.rankingPos = orderedPoints.indexOf(player.totalPoints) + 1;
    });

    // 3. Om användaren har valt bokstavsordning, sorterar vi om listan NU (men behåller .rankingPos intakt!)
    if (!matrixSortByRanking) {
        rankingScores.sort((a, b) => a.name.localeCompare(b.name));
    }

    // 4. Rita ut tabellen
    rankingScores.forEach((player, i) => {
        const user = player.name;
        const row = document.createElement("tr");
        if (user === currentUser) row.classList.add("highlight-user-row");
        
        const displayPos = player.rankingPos;

        let html = `<td class="matrix-sticky-pos">${displayPos}</td><td class="matrix-sticky-name"><strong>${user}</strong></td>`;
        
        // Loopen använder nu den dynamiskt filtrerade "matches"-arrayen så kolumnmängden matchar exakt
        matches.forEach(m => {
            const key = getMatchKey(m);
            const pred = getPredictionFromKey(allPredictions[user], key);
            
            if (m.status === "FINISHED") {
            // Spelad match = vanliga klara färger och poäng
            const pts = calculatePointsAdvanced(m, pred);
            let cls = pts === 12 ? "green" : (pts === 0 ? "red" : "yellow");
            html += `<td class="${cls} matrix-tooltip-cell">
                        <div class="matrix-cell-pts">${pts}</div>
                        <span class="matrix-tooltip-box">${pred}</span>
                    </td>`;
        } else if (m.status === "IN_PLAY" || m.status === "LIVE") {
    // Pågående match = räkna ut poäng, behåll färgkodning men lägg poängen inom parentes (och kursivt)
            const pts = calculatePointsAdvanced(m, pred);
            let cls = pts === 12 ? "green" : (pts === 0 ? "red" : "yellow");
            html += `<td class="${cls} matrix-tooltip-cell">
                        <div class="matrix-cell-pts text-muted"><em>(${pts})</em></div>
                        <span class="matrix-tooltip-box">${pred}</span>
                    </td>`;
        } else {
            // Kommande match = visa bara tipset inom parentes
            html += `<td>
                        <div class="matrix-cell-pts text-muted">(${pred})</div>
                    </td>`;
        }
        });
        row.innerHTML = html;
        tbody.appendChild(row);
    });
}

function setupTabs() {
    const tabs = {
        "btn-matches": ["view-matches", false],
        "btn-ranking": ["view-ranking", false],
        "btn-matrix": ["view-matrix", true]
    };

    Object.keys(tabs).forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        
        btn.addEventListener("click", () => {
            Object.values(tabs).forEach(v => {
                const el = document.getElementById(v[0]);
                if (el) el.classList.add("hidden");
            });
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            
            const [viewId, fullWidth] = tabs[btnId];
            const currentView = document.getElementById(viewId);
            if (currentView) currentView.classList.remove("hidden");
            btn.classList.add("active");
            
            const container = document.getElementById("main-container");
            if (container) {
                fullWidth ? container.classList.add("full-width") : container.classList.remove("full-width");
            }

            // --- HÄR ÄR ÄNDRINGEN FÖR ATT DÖLJA/VISA FILTER-KNAPPEN ---
            // Vi letar efter checkboxen. Om din checkbox ligger i en container (t.ex. en label eller div), 
            // kan du byta ut "hide-finished-checkbox" mot det ID:t istället.
            const filterElement = document.getElementById("hide-finished-checkbox");
            
            // Om du har en tillhörande text/label till knappen som du vill dölja, 
            // döljer vi oftast dess förälder (parent) för att få med allt:
            const filterContainer = filterElement ? filterElement.parentElement : null;
            
            if (filterContainer) {
                if (btnId === "btn-ranking") {
                    filterContainer.style.display = "none";  // Dölj i tabellfliken
                } else {
                    filterContainer.style.display = "block"; // Visa i matcher och matris
                }
            }
            // --------------------------------------------------------

            if (btnId === "btn-ranking") renderRanking();
            if (btnId === "btn-matrix") renderMatrix();
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

    const userModal = document.getElementById("user-tips-modal");
    const closeUserBtn = document.querySelector(".close-user-modal-btn");

    if (closeUserBtn && userModal) {
    // Stäng via krysset
    closeUserBtn.addEventListener("click", () => userModal.classList.add("hidden"));
    
    // Stäng om man klickar utanför rutan
    window.addEventListener("click", (e) => {
        if (e.target === userModal) {
            userModal.classList.add("hidden");
        }
    });
}

    // Vi sorterar nycklarna alfabetiskt med hänsyn till svenska tecken (Å, Ä, Ö) innan loopen körs
    Object.keys(allPredictions)
    .sort((a, b) => a.localeCompare(b, 'sv'))
    .forEach(u => {
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
    });

    document.getElementById("hide-finished-checkbox").addEventListener("change", (e) => {
        hideFinishedMatches = e.target.checked;
        renderMatches();

        const matrixView = document.getElementById("view-matrix");
    if (matrixView && !matrixView.classList.contains("hidden")) {
        renderMatrix();
    }
    });

    const respM = await fetch(API_URL + "?t=" + Date.now());
    const data = await respM.json();
    allMatches = data.matches;

   const now = new Date();
    const timeStr = now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const updatedEl = document.getElementById("last-updated");
    if (updatedEl) {
        updatedEl.innerText = `Uppdaterad: ${timeStr}`;
    } 
    
    // RENDERAR ALLT PÅ REKTIGT NÄR API-SVARET HAR LANDAT:
    renderMatches();
    if (!document.getElementById("view-matrix").classList.contains("hidden")) renderMatrix();
    if (!document.getElementById("view-ranking").classList.contains("hidden")) renderRanking();
}

function toggleMatrixSort() {
    matrixSortByRanking = !matrixSortByRanking;
    renderMatrix();
}


start();