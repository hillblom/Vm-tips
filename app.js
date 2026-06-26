const API_URL = "https://vm-predictor.stefan-hillblom.workers.dev/";

const state = {
    allPredictions: {},
    allMatches: [],
    currentUser: "",
    matrixSortByRanking: true,
    hideFinishedMatches: false,
    trendChartInstance: null,
    simulationResult: null
};

const dom = {};

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

function getGroupStageMatches() {
    return state.allMatches.filter(match => match.stage === "GROUP_STAGE");
}

function getFinishedGroupMatches() {
    return getGroupStageMatches()
        .filter(match => match.status === "FINISHED")
        .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
}

function getMatchStatusLabel(match) {
    if (match.status === "FINISHED") return "Slut";
    if (["IN_PLAY", "PAUSED", "LIVE"].includes(match.status)) return "Pågår";
    return "Kommande";
}

function formatMatchDate(utcDate) {
    const date = new Date(utcDate);
    return {
        onlyDate: date.toLocaleDateString("sv-SE", { month: "short", day: "numeric" }),
        onlyTime: date.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })
    };
}

function calculatePointsAdvanced(match, predictionStr, userPredictions) {
    if (!predictionStr || predictionStr === "-") return 0;

    const apiHomeTLA = nameToTlaMap[match.homeTeam?.name] || match.homeTeam?.tla || "???";
    const apiAwayTLA = nameToTlaMap[match.awayTeam?.name] || match.awayTeam?.tla || "???";

    const normalKey = `${apiHomeTLA}-${apiAwayTLA}`;
    const reversedKey = `${apiAwayTLA}-${apiHomeTLA}`;
    
    let predHomeTLA = apiHomeTLA;
    let predAwayTLA = apiAwayTLA;
    let [predHomeScore, predAwayScore] = predictionStr.split("-").map(Number);

    if (!userPredictions?.[normalKey] && userPredictions?.[reversedKey]) {
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
    const userPredictions = user === "Kollektivet"
        ? getCollectivePredictions()
        : (state.allPredictions[user] || {});
    const finished = getFinishedGroupMatches();
    const toCount = limit !== null ? finished.slice(0, limit) : finished;

    toCount.forEach(match => {
        const key = getMatchKey(match);
        const prediction = getPredictionFromKey(userPredictions, key);
        if (prediction !== "-") {
            const pts = calculatePointsAdvanced(match, prediction, userPredictions);
            totalPoints += pts;
            if (pts === 12) p12++;
            if (pts === 0) p0++;
        }
    });

    return { totalPoints, p12, p0 };
}

function calculateAdvancedStats() {
    const finishedMatches = state.allMatches
        .filter(m => m.stage === "GROUP_STAGE" && m.status === "FINISHED")
        .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
        
    const users = Object.keys(state.allPredictions);
    
    if (finishedMatches.length === 0 || users.length === 0) return null;

    const userPositionsHistory = {};
    const exactResultsCount = {};
    const collectiveTwinCount = {}; // För Följa John
    
    users.forEach(u => {
        userPositionsHistory[u] = [];
        exactResultsCount[u] = 0;
        collectiveTwinCount[u] = 0;
    });

    // Variabler för match-statistik
    let easiestMatch = { matchStr: "", totalPoints: -1 };
    let hardestMatch = { matchStr: "", totalPoints: 9999 };
    let dividerMatch = { matchStr: "", spread: -1, avgPoints: 0 }; 
    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;

    const collectivePredictions = getCollectivePredictions(); // Hämta botens tips för Följa John

    // 1. Loopa match för match
    for (let i = 1; i <= finishedMatches.length; i++) {
        const currentMatches = finishedMatches.slice(0, i);
        const lastMatch = finishedMatches[i - 1];
        const matchKey = getMatchKey(lastMatch);
        const matchName = `${teamNamesSE[lastMatch.homeTeam.name] || lastMatch.homeTeam.name} - ${teamNamesSE[lastMatch.awayTeam.name] || lastMatch.awayTeam.name}`;

        // --- FLYTTAD HIT: Räkna matchutfall för hemmavinst, oavgjort, bortavinst ---
        const homeScore = lastMatch.score.fullTime.home;
        const awayScore = lastMatch.score.fullTime.away;
        
        if (homeScore > awayScore) {
            homeWins++;
        } else if (homeScore < awayScore) {
            awayWins++;
        } else {
            draws++;
        }
        // ------------------------------------------------------------------------

        let matchTotalPoints = 0;
        const matchPointsArray = []; // Sparar alla individuella poäng för denna match

        const snapshotRanking = users.map(user => {
            let pts = 0;
            const userPredictions = state.allPredictions[user] || {};

            currentMatches.forEach((m, idx) => {
                const key = getMatchKey(m);
                const prediction = getPredictionFromKey(userPredictions, key);
                
                if (prediction !== "-") {
                    const matchPoints = calculatePointsAdvanced(m, prediction, userPredictions);
                    pts += matchPoints;
                    
                    // Om vi utvärderar just den match vi loopar över i huvudloopen
                    if (idx === i - 1) {
                        matchTotalPoints += matchPoints;
                        matchPointsArray.push(matchPoints);

                        // Följa John: Kolla om användaren tippat exakt som "Kollektivet" (snittet) på denna match
                        const collPred = getPredictionFromKey(collectivePredictions, key);
                        if (collPred !== "-" && prediction === collPred) {
                            collectiveTwinCount[user]++;
                        }
                    }

                    // Om vi är på sista varvet (totalen), räkna exakta resultat
                    if (i === finishedMatches.length && matchPoints === 12) {
                        exactResultsCount[user]++;
                    }
                }
            });
            return { name: user, points: pts };
        });

        // Sortera för placeringshistorik
        snapshotRanking.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
        const orderedPoints = snapshotRanking.map(x => x.points);

        users.forEach(user => {
            const uData = snapshotRanking.find(x => x.name === user);
            const pos = orderedPoints.indexOf(uData.points) + 1;
            userPositionsHistory[user].push(pos);
        });

        // Beräkna Vattendelaren (Varians)
        if (matchPointsArray.length > 0) {
            const matchAvg = matchTotalPoints / matchPointsArray.length;
            const variance = matchPointsArray.reduce((sum, pts) => sum + Math.pow(pts - matchAvg, 2), 0) / matchPointsArray.length;

            if (variance > dividerMatch.spread) {
                dividerMatch = { 
                    matchStr: matchName, 
                    spread: variance, 
                    avgPoints: matchAvg
                };
            }
        }

        // Spara match-specifik statistik för lättaste/svåraste
        if (matchTotalPoints > easiestMatch.totalPoints) {
            easiestMatch = { matchStr: matchName, totalPoints: matchTotalPoints };
        }
        if (matchTotalPoints < hardestMatch.totalPoints) {
            hardestMatch = { matchStr: matchName, totalPoints: matchTotalPoints };
        }
    }

    // 2. Räkna ut personbunden statistik efter hela historiken
    let jojoTarget = { name: "", movement: -1 };
    let anchorTarget = { name: "", movement: 9999 };
    let expertTarget = { name: "", count: -1 };
    let johnTarget = { name: "", count: -1 };
    let spurtTarget = { name: "", climb: -999 };

    users.forEach(user => {
        const history = userPositionsHistory[user];
        let totalMovement = 0;

        for (let j = 1; j < history.length; j++) {
            totalMovement += Math.abs(history[j] - history[j - 1]);
        }

        if (totalMovement > jojoTarget.movement) jojoTarget = { name: user, movement: totalMovement };
        if (totalMovement < anchorTarget.movement) anchorTarget = { name: user, movement: totalMovement };
        if (exactResultsCount[user] > expertTarget.count) expertTarget = { name: user, count: exactResultsCount[user] };
        if (collectiveTwinCount[user] > johnTarget.count) johnTarget = { name: user, count: collectiveTwinCount[user] };

        // Spurtaren: Jämför placering nu mot för 5 matcher sedan
        if (history.length > 0) {
            const currentIndex = history.length - 1;
            const pastIndex = Math.max(0, currentIndex - 5);
            const climb = history[pastIndex] - history[currentIndex];
            
            if (climb > spurtTarget.climb) {
                spurtTarget = { name: user, climb: climb };
            }
        }
    });

    return {
        jojo: jojoTarget,
        anchor: anchorTarget,
        expert: expertTarget,
        john: johnTarget,
        spurt: spurtTarget,
        easiest: easiestMatch,
        hardest: hardestMatch,
        divider: dividerMatch,
        matchOutcomes: { homeWins, draws, awayWins }
    };
}

function renderMatches() {
    const tbody = document.getElementById("matches");
    if (!tbody) return;
    tbody.innerHTML = "";
    const userPredictions = state.allPredictions[state.currentUser] || {};

    state.allMatches.filter(m => m.stage === "GROUP_STAGE").forEach(match => {
        if (state.hideFinishedMatches && match.status === "FINISHED") return;

        const key = getMatchKey(match);
        const prediction = getPredictionFromKey(userPredictions, key);
        const homeScore = match.score.fullTime.home ?? "-";
        const awayScore = match.score.fullTime.away ?? "-";
        
        let points = "";
        if(match.status === "FINISHED" && prediction !== "-"){
            points = calculatePointsAdvanced(match, prediction, userPredictions);
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
                    <br>
                    <span class="match-t">${onlyTime}</span>
                </div>
                ${getBroadcasterHtml(match)}
            </td>
            <td>${teamNamesSE[match.homeTeam.name] || match.homeTeam.name} - ${teamNamesSE[match.awayTeam.name] || match.awayTeam.name}</td>
            <td>${homeScore}-${awayScore}</td>
            <td>${prediction}</td>
            <td>${points}</td>
            <td>${match.status === "FINISHED" ? "Slut" : (match.status === "IN_PLAY" || match.status === "PAUSED" || match.status === "LIVE" ? "Pågår" : "Kommande")}</td>
        `;
        tbody.appendChild(row);
    });
}

function renderRanking() {
    const tbody = document.getElementById("ranking-list");
    if (!tbody) return;
    tbody.innerHTML = "";

    const finishedMatches = state.allMatches.filter(m => m.stage === "GROUP_STAGE" && m.status === "FINISHED").sort((a,b) => new Date(a.utcDate) - new Date(b.utcDate));
    const allGroupMatches = state.allMatches.filter(m => m.stage === "GROUP_STAGE");
    const users = Object.keys(state.allPredictions);

    let ranking = users.map(user => {
        const stats = getUserStatsAtMatchLimit(user);
        return { name: user, total: stats.totalPoints, p12: stats.p12, p0: stats.p0 };
    });

    const collectiveStats = getUserStatsAtMatchLimit("Kollektivet");
    ranking.push({
        name: "🤖 Kollektivet",
        total: collectiveStats.totalPoints,
        p12: collectiveStats.p12,
        p0: collectiveStats.p0,
        isBot: true 
    });

    // --- HÄR SKJUTER VI IN DEN IMAGINÄRA RADEN ---
    if (state.simulationResult) {
        let simulatedPoints = 0;
        let simP12 = 0;
        let simP0 = 0;
        
        finishedMatches.forEach(m => {
            const pts = calculatePointsAdvanced(m, state.simulationResult);
            simulatedPoints += pts;
            if (pts === 12) simP12++;
            if (pts === 0) simP0++;
        });

        ranking.push({
            name: `🔮 Rad: ${state.simulationResult}`,
            total: simulatedPoints,
            p12: simP12,
            p0: simP0,
            isSimulation: true // Flagga för att identifiera raden vid utritning
        });
    }

    ranking.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    const playedCount = finishedMatches.length;
    const totalCount = allGroupMatches.length;
    const leftCount = totalCount - playedCount;

    document.getElementById("stats-played-rounds").innerText = playedCount;
    document.getElementById("stats-matches-left").innerText = leftCount;

    const trendMap = {};
    let maxClimb = 0; 
    let maxDrop = 0;  
    
    let raketNames = [];
    let fallNames = [];

    if (finishedMatches.length > 0) {
        const currentRanks = {};
        // Filtrera bort simuleringsraden när vi skapar "riktiga" placeringar för trender
        ranking.filter(x => !x.isSimulation).forEach((player, idx) => { currentRanks[player.name] = idx + 1; });

        const limit = Math.max(0, finishedMatches.length - 1); 
        const oldScores = users.map(u => ({ name: u, pts: getUserStatsAtMatchLimit(u, limit).totalPoints }));
        oldScores.sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
        
        const oldRanks = {};
        oldScores.forEach((player, idx) => { oldRanks[player.name] = idx + 1; });

        users.forEach(user => {
            const current = currentRanks[user];
            const old = oldRanks[user];
            const diff = old - current; 

            trendMap[user] = diff;

            if (diff > maxClimb) {
                maxClimb = diff;
                raketNames = [user]; 
            } else if (diff === maxClimb && diff > 0) {
                raketNames.push(user); 
            }

            if (diff < maxDrop) {
                maxDrop = diff;
                fallNames = [user]; 
            } else if (diff === maxDrop && diff < 0) {
                fallNames.push(user); 
            }
        });
    }

    if (maxClimb > 0) {
        document.getElementById("stats-max-climb").innerHTML = `${raketNames.join("<br>")} <span style="font-weight: bold; color: var(--success, #28a745); display: block; margin-top: 4px;">(+${maxClimb})</span>`;
    } else {
        document.getElementById("stats-max-climb").innerHTML = "Ingen förändring";
    }

    if (maxDrop < 0) {
        document.getElementById("stats-max-drop").innerHTML = `${fallNames.join("<br>")} <span style="font-weight: bold; color: var(--danger, #dc3545); display: block; margin-top: 4px;">(${maxDrop})</span>`;
    } else {
        document.getElementById("stats-max-drop").innerHTML = "Ingen förändring";
    }

    // Filtrera bort BÅDE boten och simulatorn när vi räknar ut de fasta placeringarna (för delad plats)
    const orderedPointsTable = ranking.filter(x => !x.isBot && !x.isSimulation).map(x => x.total);

    ranking.forEach((player, i) => {
        const row = document.createElement("tr");
        if (player.name === state.currentUser) row.classList.add("highlight-user-row");
        if (player.isBot) row.style.backgroundColor = "rgba(0, 123, 255, 0.15)";
        
        // Applicera den snygga lila stilen på simuleringsraden
        if (player.isSimulation) row.classList.add("highlight-simulation-row");
        
        let trendHtml = "";
        const userDiff = trendMap[player.name] || 0;

        if (finishedMatches.length > 0 && userDiff !== 0 && !player.isBot && !player.isSimulation) {
            if (userDiff > 0 && userDiff === maxClimb) {
                trendHtml = `<span class="trend-icon trend-green" title="Klättrat mest: +${userDiff} platser">▲</span>`;
            } else if (userDiff < 0 && Math.abs(userDiff) === Math.abs(maxDrop)) {
                trendHtml = `<span class="trend-icon trend-red" title="Fallit mest: -${Math.abs(userDiff)} platser">▼</span>`;
            }
        }

        // Varken boten eller simulatorn får ett eget placeringsnummer på sidan
        const posCell = (player.isBot || player.isSimulation) ? "-" : (orderedPointsTable.indexOf(player.total) + 1);

        row.innerHTML = `
            <td>${posCell} ${trendHtml}</td>
            <td><strong>${player.name}</strong></td>
            <td>${player.total}</td>
            <td style="text-align:center">${player.p12}</td>
            <td style="text-align:center">${player.p0}</td>
        `;
        tbody.appendChild(row);
    });
}

function renderMatrix() {
    // 1. SPARA SCROLL-POSITIONER (Både sidans höjdled, och wrapperns sidled/höjdled)
    const currentWindowScrollY = window.scrollY;
    const wrapperBefore = document.querySelector(".matrix-wrapper");
    const currentScrollLeft = wrapperBefore ? wrapperBefore.scrollLeft : 0;
    const currentScrollTop = wrapperBefore ? wrapperBefore.scrollTop : 0;

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
    
    // Här filtrerar vi matcherna så att de färdigspelade döljs helt om "state.hideFinishedMatches" är true
    const matches = state.allMatches
        .filter(m => m.stage === "GROUP_STAGE")
        .filter(m => !state.hideFinishedMatches || m.status !== "FINISHED")
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

    const users = Object.keys(state.allPredictions);

    // 1. Räkna ut poäng för ALLA deltagare först
    const rankingScores = users.map(user => {
        return { name: user, totalPoints: getUserStatsAtMatchLimit(user).totalPoints };
    });

    const collectiveTotal = getUserStatsAtMatchLimit("Kollektivet").totalPoints;
    rankingScores.push({ name: "🤖 Kollektivet", totalPoints: collectiveTotal, isBot: true });

    // 2. Sortera ALLTID efter ranking först för att räkna ut den fasta placeringen (inklusive delad plats)
    rankingScores.sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name));
    
    // Filtrera bort boten när vi skapar listan över poäng som avgör de riktiga placeringarna
    const orderedPoints = rankingScores.filter(x => !x.isBot).map(x => x.totalPoints);
    
    // Spara ranking-positionen som en egenskap på varje deltagare
    rankingScores.forEach((player, i) => {
        if (player.isBot) {
            player.rankingPos = "-"; // Ingen placering för Kollektivet
        } else {
            player.rankingPos = orderedPoints.indexOf(player.totalPoints) + 1;
        }
    });

    // 3. Om användaren har valt bokstavsordning, sorterar vi om listan NU
    if (!state.matrixSortByRanking) {
        rankingScores.sort((a, b) => a.name.localeCompare(b.name));
    }

    // 4. Rita ut tabellen
    rankingScores.forEach((player, i) => {
        const user = player.name;
        const row = document.createElement("tr");
        if (user === state.currentUser) row.classList.add("highlight-user-row");
        if (player.isBot) row.style.backgroundColor = "rgba(0, 123, 255, 0.15)";
        
        const displayPos = player.rankingPos;

        let html = `<td class="matrix-sticky-pos">${displayPos}</td><td class="matrix-sticky-name"><strong>${user}</strong></td>`;
        const currentPredictionsSource = player.isBot ? getCollectivePredictions() : (state.allPredictions[user] || {});
        
        matches.forEach(m => {
            const key = getMatchKey(m);
            const pred = getPredictionFromKey(currentPredictionsSource, key);
            
            if (m.status === "FINISHED") {
                const pts = calculatePointsAdvanced(m, pred);
                let cls = pts === 12 ? "green" : (pts === 0 ? "red" : "yellow");
                html += `<td class="${cls} matrix-tooltip-cell">
                            <div class="matrix-cell-pts">${pts}</div>
                            <span class="matrix-tooltip-box">${pred}</span>
                        </td>`;
            } else if (m.status === "IN_PLAY" || m.status === "LIVE") {
                const pts = calculatePointsAdvanced(m, pred);
                let cls = pts === 12 ? "green" : (pts === 0 ? "red" : "yellow");
                html += `<td class="${cls} matrix-tooltip-cell">
                            <div class="matrix-cell-pts text-muted"><em>(${pts})</em></div>
                            <span class="matrix-tooltip-box">${pred}</span>
                        </td>`;
            } else {
                html += `<td>
                            <div class="matrix-cell-pts text-muted">(${pred})</div>
                        </td>`;
            }
        });
        row.innerHTML = html;
        tbody.appendChild(row);
    });

    // 5. ÅTERSTÄLL SCROLLEN DIREKT EFTER RENDERING
    const wrapperAfter = document.querySelector(".matrix-wrapper");
    if (wrapperAfter) {
        wrapperAfter.scrollLeft = currentScrollLeft;
        wrapperAfter.scrollTop = currentScrollTop; // Återställer höjden inuti containern (om den har max-höjd)
    }
    window.scrollTo(window.scrollX, currentWindowScrollY); // Återställer höjden för hela webbläsarfönstret
}

function renderStats() {
    const container = document.getElementById("stats-container");
    if (!container) return;

    const advanced = calculateAdvancedStats();
    
    if (!advanced) {
        container.innerHTML = `<div class="card" style="grid-column: 1/-1; text-align: center; padding: 20px;">Ingen statistik tillgänglig förrän matcher har spelats färdigt.</div>`;
        return;
    }

    // Räkna ut snittpoäng per deltagare på matcherna för lätt/svår text
    const totalUsers = Object.keys(state.allPredictions).length;
    const easiestAvg = (advanced.easiest.totalPoints / totalUsers).toFixed(1);
    const hardestAvg = (advanced.hardest.totalPoints / totalUsers).toFixed(1);

    container.innerHTML = `
        <div class="stats-card accent-danger">
            <div>
                <h3>🎢 Placerings-jojo</h3>
                <div class="stats-main">${advanced.jojo.name}</div>
            </div>
            <p class="stats-sub">Har pendlat mest upp och ner. Totalt <strong>${advanced.jojo.movement}</strong> steg i placeringsförändringar.</p>
        </div>

        <div class="stats-card accent-green">
            <div>
                <h3>⚓ Placeringsankare</h3>
                <div class="stats-main">${advanced.anchor.name}</div>
            </div>
            <p class="stats-sub">Stabil som en klippa. Minst rörelse i tabellen med bara <strong>${advanced.anchor.movement}</strong> placeringsbyten.</p>
        </div>

        <div class="stats-card accent-blue">
            <div>
                <h3>🔮 Experten</h3>
                <div class="stats-main">${advanced.expert.name}</div>
            </div>
            <p class="stats-sub">Bäst på exakta resultat! Har prickat in helt rätt målsiffra (12p) <strong>${advanced.expert.count}</strong> gånger.</p>
        </div>

        <div class="stats-card accent-warning">
            <div>
                <h3>🐌 Spurtaren</h3>
                <div class="stats-main">${advanced.spurt.name}</div>
            </div>
            <p class="stats-sub">Formstarkast just nu! Har klättrat flest placeringar (<strong>${advanced.spurt.climb > 0 ? '+' : ''}${advanced.spurt.climb}</strong> platser) över de senaste 5 matcherna.</p>
        </div>

        <div class="stats-card accent-blue">
            <div>
                <h3>🦆 Följa John</h3>
                <div class="stats-main">${advanced.john.name}</div>
            </div>
            <p class="stats-sub">Gruppens osynliga tvilling! Den som har valt samma tipsrad som majoriteten (Kollektivet) flest gånger (<strong>${advanced.john.count}</strong> matcher).</p>
        </div>

        <div class="stats-card accent-danger">
            <div>
                <h3>⚡ Vattendelaren</h3>
                <div class="stats-main" style="font-size: 1.25rem; margin-top: 5px;">${advanced.divider.matchStr}</div>
            </div>
            <p class="stats-sub" style="margin-top: 10px;">Matchen som totalt splittrade gruppen i två läger. Här fanns det nästan inga lagom-tips, utan deltagarna spikade antingen resultatet helt eller bommade totalt. Gruppsnittet landade till slut på <strong>${advanced.divider.avgPoints.toFixed(1)}p</strong>.</p>
        </div>

        <div class="stats-card accent-green" style="grid-column: span 1;">
            <div>
                <h3>🎉 Lättaste matchen</h3>
                <div class="stats-main" style="font-size: 1.25rem; margin-top: 5px;">${advanced.easiest.matchStr}</div>
            </div>
            <p class="stats-sub" style="margin-top: 10px;">Här gösslades det med poäng! Matchen genererade ett snitt på grymma <strong>${easiestAvg}p</strong> per deltagare.</p>
        </div>

        <div class="stats-card accent-danger">
            <div>
                <h3>💀 Svårtippade matchen</h3>
                <div class="stats-main" style="font-size: 1.25rem; margin-top: 5px;">${advanced.hardest.matchStr}</div>
            </div>
            <p class="stats-sub" style="margin-top: 10px;">Här gick nästan hela gruppen bort sig. Matchen gav ett snitt på låga <strong>${hardestAvg}p</strong> per deltagare.</p>
        </div>

        <div class="stats-card accent-warning">
            <div>
                <h3>📊 Fördelning av resultat</h3>
                <div class="stats-main" style="font-size: 1.1rem; margin-top: 10px; display: flex; justify-content: space-between; padding: 0 10px;">
                    <span title="Hemmavinster">Hemmavinst: <strong>${advanced.matchOutcomes.homeWins}</strong></span>
                    <span title="Oavgjorda">Oavgjord: <strong>${advanced.matchOutcomes.draws}</strong></span>
                    <span title="Bortavinster">Bortavinst: <strong>${advanced.matchOutcomes.awayWins}</strong></span>
                </div>
            </div>
            <p class="stats-sub" style="margin-top: 15px; font-size: 0.85rem;">Hur matcherna har slutat hittills under gruppspelet.</p>
        </div>
    `;
}

/* function renderPlayoffs() {
    // 1. Mappa rundor till rätt behållare i index.html
    const containers = {
        'LAST_32': document.getElementById('bracket-r32'),
        'LAST_16': document.getElementById('bracket-r16'),
        'QUARTER_FINALS': document.getElementById('bracket-qf'),
        'SEMI_FINALS': document.getElementById('bracket-sf'),
        'FINAL': document.getElementById('bracket-final')
    };

    // Kör inte om bracketen inte finns i DOM
    if (!containers['LAST_32']) return;

    // Fast ordning på rundorna
    const stageOrder = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL'];

    // Hur många matcher varje runda ska ha i trädet
    const expectedCounts = {
        'LAST_32': 16,
        'LAST_16': 8,
        'QUARTER_FINALS': 4,
        'SEMI_FINALS': 2,
        'FINAL': 1
    };

    // 2. Hämta slutspelsmatcher från state
    const playoffMatches = (state.allMatches || [])
        .filter(match => stageOrder.includes(match.stage))
        .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

    console.log("Hittade antal slutspelsmatcher i API-datan:", playoffMatches.length);

    // 3. Gruppera per runda
    const groupedMatches = {
        'LAST_32': [],
        'LAST_16': [],
        'QUARTER_FINALS': [],
        'SEMI_FINALS': [],
        'FINAL': []
    };

    playoffMatches.forEach(match => {
        if (groupedMatches[match.stage]) {
            groupedMatches[match.stage].push(match);
        }
    });

    // Säker team-rendering
    const getTeamHTML = (team, score) => {
        const teamNameRaw = team?.name?.toLowerCase?.() || '';

        // Om lag inte är bestämt ännu
        if (
            !team ||
            !team.name ||
            teamNameRaw.includes('winner') ||
            teamNameRaw.includes('runner')
        ) {
            return `
                <div class="matchup-team">
                    <span class="undecided">Ej avgjort</span>
                    <span class="team-score">-</span>
                </div>
            `;
        }

        const teamName =
            (typeof teamNamesSE !== 'undefined' && teamNamesSE[team.name]) ||
            team.shortName ||
            team.name ||
            'Okänt lag';

        const crest = team.crest || 'https://crests.football-data.org/wm26.png';
        const displayScore = score !== null && score !== undefined ? score : '-';

        return `
            <div class="matchup-team">
                <span class="team-info">
                    <img src="${crest}" alt="${teamName}" class="flag-icon">
                    ${teamName}
                </span>
                <span class="team-score">${displayScore}</span>
            </div>
        `;
    };

    // 4. Rendera varje runda
    for (const stage of stageOrder) {
        const container = containers[stage];
        if (!container) continue;

        const matchesInRound = groupedMatches[stage] || [];
        const expectedCount = expectedCounts[stage];

        let roundHtml = '';

        // Vi renderar alltid fullt antal slots i trädet
        for (let i = 0; i < expectedCount; i++) {
            const match = matchesInRound[i] || null;
            const matchIndex = i + 1;

            // Viktigt för CSS-bracketen
            const matchupClasses = [
                'playoff-matchup',
                `match-${matchIndex}`,
                `round-${stage.toLowerCase()}`
            ].join(' ');

            if (match) {
                const matchDate = new Date(match.utcDate);

                const dayStr = matchDate.toLocaleDateString('sv-SE', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short'
                });

                const timeStr = matchDate.toLocaleTimeString('sv-SE', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const broadcasterHtml = match.broadcaster
                    ? `<span class="tv-channel">${match.broadcaster.toUpperCase()}</span>`
                    : `<span class="tv-channel"></span>`;

                roundHtml += `
                    <div class="${matchupClasses}" data-round="${stage}" data-match-index="${matchIndex}">
                        <div class="matchup-meta">
                            <span>${dayStr} - ${timeStr}</span>
                            ${broadcasterHtml}
                        </div>
                        <div class="matchup-teams">
                            ${getTeamHTML(match.homeTeam, match.score?.fullTime?.home)}
                            ${getTeamHTML(match.awayTeam, match.score?.fullTime?.away)}
                        </div>
                    </div>
                `;
            } else {
                // Placeholder om matchen inte finns ännu
                roundHtml += `
                    <div class="${matchupClasses} is-placeholder" data-round="${stage}" data-match-index="${matchIndex}">
                        <div class="matchup-meta">
                            <span>TBD</span>
                            <span class="tv-channel"></span>
                        </div>
                        <div class="matchup-teams">
                            ${getTeamHTML(null, null)}
                            ${getTeamHTML(null, null)}
                        </div>
                    </div>
                `;
            }
        }

        container.innerHTML = roundHtml;
    }
} */

function renderPlayoffs() {

    const root = document.getElementById("playoff-bracket");
    if (!root) return;

    root.innerHTML = "";

    const stageOrder = [
        "LAST_32",
        "LAST_16",
        "QUARTER_FINALS",
        "SEMI_FINALS",
        "FINAL"
    ];

    const stageTitles = {
        LAST_32: "Sextondelsfinaler",
        LAST_16: "Åttondelsfinaler",
        QUARTER_FINALS: "Kvartsfinaler",
        SEMI_FINALS: "Semifinaler",
        FINAL: "Final"
    };

    const expectedCounts = {
        LAST_32: 16,
        LAST_16: 8,
        QUARTER_FINALS: 4,
        SEMI_FINALS: 2,
        FINAL: 1
    };

    const playoffMatches = (state.allMatches || [])
        .filter(match => stageOrder.includes(match.stage))
        .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

    const grouped = {};

    stageOrder.forEach(stage => grouped[stage] = []);

    playoffMatches.forEach(match => {
        grouped[match.stage].push(match);
    });

    function teamHtml(team, score) {

        const undecided =
            !team ||
            !team.name ||
            /winner|runner|tbd|to be decided/i.test(team.name);

        if (undecided) {
            return `
                <div class="team">
                    <div class="team-left">
                        <span class="placeholder">Ej avgjort</span>
                    </div>
                    <div class="team-score">-</div>
                </div>
            `;
        }

        const name =
            (typeof teamNamesSE !== "undefined" &&
                teamNamesSE[team.name]) ||
            team.shortName ||
            team.name;

        const crest =
            team.crest ||
            "https://crests.football-data.org/wm26.png";

        return `
            <div class="team">
                <div class="team-left">
                    <img class="flag-icon"
                         src="${crest}"
                         alt="${name}">
                    <span>${name}</span>
                </div>

                <div class="team-score">
                    ${score ?? "-"}
                </div>
            </div>
        `;
    }

    function matchCard(match) {

        if (!match) {

            return `
                <div class="match-card placeholder">

                    <div class="match-header">
                        TBD
                    </div>

                    ${teamHtml(null)}
                    ${teamHtml(null)}

                </div>
            `;
        }

        const date = new Date(match.utcDate);

        const day =
            date.toLocaleDateString(
                "sv-SE",
                {
                    weekday: "short",
                    day: "numeric",
                    month: "short"
                });

        const time =
            date.toLocaleTimeString(
                "sv-SE",
                {
                    hour: "2-digit",
                    minute: "2-digit"
                });

        return `
            <div class="match-card">

                <div class="match-header">

                    <span>${day} ${time}</span>

                    <span class="tv">

                        ${(match.broadcaster && match.broadcaster !== "unknown") 
    ? match.broadcaster.toUpperCase() 
    : "<span style='color: var(--text-muted);'>Ännu okänt</span>"}

                    </span>

                </div>

                ${teamHtml(
                    match.homeTeam,
                    match.score?.fullTime?.home
                )}

                ${teamHtml(
                    match.awayTeam,
                    match.score?.fullTime?.away
                )}

            </div>
        `;
    }

    function buildRound(stage) {

        const round = document.createElement("div");
        round.className = "round";

        const title = document.createElement("div");
        title.className = "round-title";
        title.textContent = stageTitles[stage];

        round.appendChild(title);

        const body = document.createElement("div");
        body.className = "round-body";

        const matches = grouped[stage];

        const total = expectedCounts[stage];

        for (let i = 0; i < total; i++) {

            const wrapper = document.createElement("div");

            wrapper.className = "match-wrapper";

            wrapper.innerHTML =
                matchCard(matches[i]);

            if (stage !== "FINAL") {

                const connector =
                    document.createElement("div");

                connector.className =
                    "connector";

                connector.innerHTML = `
                    <div class="connector-h"></div>
                    <div class="connector-v"></div>
                `;

                wrapper.appendChild(connector);

            }

            body.appendChild(wrapper);

        }

        round.appendChild(body);

        return round;

    }

    stageOrder.forEach(stage => {

        root.appendChild(
            buildRound(stage)
        );

    });
    // ==========================================
    // Justera vertikalt avstånd mellan rundorna
    // ==========================================

    requestAnimationFrame(() => {

        const rounds = [...root.querySelectorAll(".round")];

        for (let r = 1; r < rounds.length; r++) {

            const previousCards =
                [...rounds[r - 1].querySelectorAll(".match-wrapper")];

            const currentCards =
                [...rounds[r].querySelectorAll(".match-wrapper")];

            currentCards.forEach((card, index) => {

                const first =
                    previousCards[index * 2];

                const second =
                    previousCards[index * 2 + 1];

                if (!first || !second) return;

                const y1 =
                    first.offsetTop +
                    first.offsetHeight / 2;

                const y2 =
                    second.offsetTop +
                    second.offsetHeight / 2;

                const target =
                    (y1 + y2) / 2;

                const current =
                    card.offsetTop +
                    card.offsetHeight / 2;

                const delta =
                    target - current;

                card.style.marginTop =
                    `${delta}px`;

            });

        }

        // ======================================
        // Rita connectorerna
        // ======================================

        const allRounds =
            [...root.querySelectorAll(".round")];

        allRounds.forEach((round, roundIndex) => {

            if (roundIndex === allRounds.length - 1)
                return;

            const wrappers =
                [...round.querySelectorAll(".match-wrapper")];

            wrappers.forEach((wrapper, index) => {

                const connector =
                    wrapper.querySelector(".connector");

                if (!connector)
                    return;

                const nextRound =
                    allRounds[roundIndex + 1];

                const nextCards =
                    [...nextRound.querySelectorAll(".match-wrapper")];

                const next =
                    nextCards[Math.floor(index / 2)];

                if (!next)
                    return;

                const yCurrent =
                    wrapper.offsetTop +
                    wrapper.offsetHeight / 2;

                const yNext =
                    next.offsetTop +
                    next.offsetHeight / 2;

                const vertical =
                    connector.querySelector(".connector-v");

                const diff =
                    yNext - yCurrent;

                vertical.style.height =
                    `${Math.abs(diff)}px`;

                if (diff >= 0) {

                    vertical.style.top = "50%";
                    vertical.style.bottom = "auto";

                } else {

                    vertical.style.bottom = "50%";
                    vertical.style.top = "auto";

                }

                connector.classList.toggle(
                    "down",
                    diff > 0
                );

                connector.classList.toggle(
                    "up",
                    diff < 0
                );

            });

        });

    });

}

// Hjälpfunktion för att veta hur många placeholders som behövs om API:et saknar framtida rundor
function getExpectedMatchCount(stage) {
    switch(stage) {
        case 'LAST_32': return 16;
        case 'LAST_16': return 8;
        case 'QUARTER_FINALS': return 4;
        case 'SEMI_FINALS': return 2;
        case 'FINAL': return 1;
        default: return 0;
    }
} 

function setupTabs() {
    const tabs = {
        "btn-matches": ["view-matches", false],
        "btn-ranking": ["view-ranking", false],
        "btn-matrix": ["view-matrix", true],
        "btn-trend": ["view-trend", false],
        "btn-stats": ["view-stats", false],
        "btn-playoffs": ["view-playoffs", false]
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

            // --- NYTT: NOLLSTÄLL SIMULERINGEN OM MAN LÄMNAR TABELLEN ---
            if (btnId !== "btn-ranking") {
                state.simulationResult = null;
                const simInput = document.getElementById("simulation-input");
                if (simInput) simInput.value = "";
            }
            // -----------------------------------------------------------

            // --- HÄR ÄR ÄNDRINGEN FÖR ATT DÖLJA/VISA FILTER-KNAPPEN ---
            const filterElement = document.getElementById("hide-finished-checkbox");
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
            if (btnId === "btn-trend") renderTrendChart();
            if (btnId === "btn-stats") renderStats();
            if (btnId === "btn-playoffs") renderPlayoffs();
        });
    });

    document.getElementById("btn-rules").addEventListener("click", () => document.getElementById("rules-modal").classList.remove("hidden"));
    document.querySelector(".close-btn").addEventListener("click", () => document.getElementById("rules-modal").classList.add("hidden"));
}

async function updateApiData() {
    try {
        // Hämta färsk matchdata med en timestamp för att förhindra cache
        const respM = await fetch(API_URL + "?t=" + Date.now());
        const data = await respM.json();
        state.allMatches = data.matches;

        // Uppdatera klockslaget för senaste uppdateringen
        const now = new Date();
        const timeStr = now.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const updatedEl = document.getElementById("last-updated");
        if (updatedEl) {
            updatedEl.innerText = `Uppdaterad: ${timeStr}`;
        } 

        // Rendera om den flik som för tillfället är synlig
        renderMatches();
        if (!document.getElementById("view-matrix").classList.contains("hidden")) renderMatrix();
        if (!document.getElementById("view-ranking").classList.contains("hidden")) renderRanking();
        if (!document.getElementById("view-trend").classList.contains("hidden")) renderTrendChart();
        if (!document.getElementById("view-stats").classList.contains("hidden")) renderStats();
    } catch (error) {
        console.error("Kunde inte hämta live-data från API:", error);
    }
}

async function start() {
    setupTabs();
    
    const respP = await fetch("predictions.json?v=" + Date.now());
    state.allPredictions = await respP.json();
    
    const selector = document.getElementById("user-selector");
    const userModal = document.getElementById("user-tips-modal");
    const closeUserBtn = document.querySelector(".close-user-modal-btn");

    if (closeUserBtn && userModal) {
        closeUserBtn.addEventListener("click", () => userModal.classList.add("hidden"));
        window.addEventListener("click", (e) => {
            if (e.target === userModal) {
                userModal.classList.add("hidden");
            }
        });
    }

    Object.keys(state.allPredictions)
    .sort((a, b) => a.localeCompare(b, 'sv'))
    .forEach(u => {
        const option = document.createElement("option");
        option.value = u;
        option.innerText = u;
        selector.appendChild(option);
    });
    
    state.currentUser = localStorage.getItem("selectedUser") || Object.keys(state.allPredictions)[0];
    selector.value = state.currentUser;

    selector.addEventListener("change", (e) => {
        state.currentUser = e.target.value;
        localStorage.setItem("selectedUser", state.currentUser);
        renderMatches();
        if (!document.getElementById("view-ranking").classList.contains("hidden")) renderRanking();
        if (!document.getElementById("view-matrix").classList.contains("hidden")) renderMatrix();
        if (!document.getElementById("view-trend").classList.contains("hidden")) renderTrendChart();
        if (!document.getElementById("view-stats").classList.contains("hidden")) renderStats();
    });

    document.getElementById("hide-finished-checkbox").addEventListener("change", (e) => {
        state.hideFinishedMatches = e.target.checked;
        renderMatches();
        const matrixView = document.getElementById("view-matrix");
        if (matrixView && !matrixView.classList.contains("hidden")) {
            renderMatrix();
        }
    });

    document.addEventListener("pointerdown", function() { /* Valfritt, men vi kör standard events nedan */ });
    
    document.addEventListener("click", function(e) {
        // 1. Klick på "Simulera"
        if (e.target && e.target.id === "btn-simulate") {
            runSimulation();
        }

        // 2. Klick på "Rensa"
        if (e.target && e.target.id === "btn-clear-simulation") {
            const input = document.getElementById("simulation-input");
            if (input) input.value = "";
            state.simulationResult = null;
            renderRanking();
        }
    });

    // Fångar upp Enter-tryck i samma fält
    document.addEventListener("keydown", function(e) {
        if (e.target && e.target.id === "simulation-input" && e.key === "Enter") {
            runSimulation();
        }
    });

    // En liten hjälpfunktion inuti start() för att slippa dubbelklippa logiken
    function runSimulation() {
        const input = document.getElementById("simulation-input");
        if (!input) return;
        
        const val = input.value.trim();
        if (/^\d+-\d+$/.test(val)) {
            state.simulationResult = val;
            renderRanking(); // Kör renderRanking som du ändrade till
        } else {
            alert("Ange resultatet i formatet hemmamål-bortamål, t.ex. '2-1'");
        }
    }

    // Kör första hämtningen direkt vid start
    await updateApiData();

    // Starta timern som körs var 30:e sekund framöver
    setInterval(updateApiData, 30000);
}

function renderTrendChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    // 1. Hämta alla färdigspelade gruppspelsmatcher i kronologisk ordning
    const finishedMatches = state.allMatches
        .filter(m => m.stage === "GROUP_STAGE" && m.status === "FINISHED")
        .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

    if (finishedMatches.length === 0) {
        // Om inga matcher spelas än, rensa grafen från minnet
        if (state.trendChartInstance) {
            state.trendChartInstance.destroy();
            state.trendChartInstance = null;
        }
        return;
    }

    // 2. Bygg upp historik per match för den valda deltagaren
    const labels = [];
    const positions = [];

    // Loopa igenom historien match för match
    for (let i = 1; i <= finishedMatches.length; i++) {
        const currentMatchesAtLimit = finishedMatches.slice(0, i);
        
        // Räkna ut totalpoäng för alla deltagare vid just detta tillfälle (match 'i')
        const users = Object.keys(state.allPredictions);
        const snapshotRanking = users.map(user => {
            let totalPoints = 0;
            const userPredictions = state.allPredictions[user] || {};
            
            currentMatchesAtLimit.forEach(match => {
                const key = getMatchKey(match);
                const prediction = getPredictionFromKey(userPredictions, key);
                if (prediction !== "-") {
                    totalPoints += calculatePointsAdvanced(match, prediction);
                }
            });
            return { name: user, points: totalPoints };
        });

        // Sortera för att få fram placeringen vid denna specifika match
        snapshotRanking.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
        const orderedPoints = snapshotRanking.map(x => x.points);
        
        // Hitta placeringen för den aktiva användaren (1-indexerat, hanterar delad plats)
        const userMatchData = snapshotRanking.find(x => x.name === state.currentUser);
        const currentPos = userMatchData ? orderedPoints.indexOf(userMatchData.points) + 1 : null;

        // Använd match-nyckeln (t.ex. "SWE-UKR") som etikett i x-axeln
        const lastMatch = currentMatchesAtLimit[currentMatchesAtLimit.length - 1];
        labels.push(getMatchKey(lastMatch));
        positions.push(currentPos);
    }

    // 3. UPPDATERA ELLER SKAPA GRAFEN
    if (state.trendChartInstance) {
        // Grafen finns redan! Uppdatera bara värdena sömlöst utan omritning/blink
        state.trendChartInstance.data.labels = labels;
        state.trendChartInstance.data.datasets[0].data = positions;
        
        // 'none' stänger av animationen just vid denna uppdatering så den känns helt stabil
        state.trendChartInstance.update('none'); 
    } else {
        // Första gången funktionen körs skapar vi grafen och sparar den i globala state
        state.trendChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '',
                    data: positions,
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    borderWidth: 3,
                    tension: 0.2, 
                    pointRadius: 4,
                    pointBackgroundColor: '#007bff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        reverse: true, // VÄNDER AXELN: Pos 1 hamnar högst upp!
                        min: 1,
                        max: 33,
                        ticks: {
                            stepSize: 1,
                            precision: 0
                        },
                        title: {
                            display: true,
                            text: 'Placering'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Matcher'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false,
                        position: 'top'
                    }
                }
            },
            plugins: [{
                id: 'customDataLabels',
                afterDatasetsDraw(chart) {
                    const { ctx, data } = chart;
                    ctx.save();
                    ctx.font = 'bold 12px sans-serif';
                    ctx.fillStyle = '#007bff'; 
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';

                    chart.getDatasetMeta(0).data.forEach((point, index) => {
                        const value = data.datasets[0].data[index];
                        if (value !== null && value !== undefined) {
                            ctx.fillText(value, point.x, point.y - 10);
                        }
                    });
                    ctx.restore();
                }
            }]
        });
    }
}

function getCollectivePredictions() {
    const collectivePreds = {};
    const users = Object.keys(state.allPredictions);
    if (users.length === 0) return collectivePreds;

    state.allMatches.filter(m => m.stage === "GROUP_STAGE").forEach(match => {
        const key = getMatchKey(match);
        let totalHomeScore = 0;
        let totalAwayScore = 0;
        let count = 0;

        users.forEach(user => {
            const pred = getPredictionFromKey(state.allPredictions[user], key);
            if (pred !== "-") {
                const [h, a] = pred.split("-").map(Number);
                if (!isNaN(h) && !isNaN(a)) {
                    totalHomeScore += h;
                    totalAwayScore += a;
                    count++;
                }
            }
        });

        if (count > 0) {
            const avgHome = Math.round(totalHomeScore / count);
            const avgAway = Math.round(totalAwayScore / count);
            collectivePreds[key] = `${avgHome}-${avgAway}`;
        } else {
            collectivePreds[key] = "-";
        }
    });

    return collectivePreds;
}

function toggleMatrixSort() {
    state.matrixSortByRanking = !state.matrixSortByRanking;
    renderMatrix();
}

// Hämta elementen från HTML
const btnChangelog = document.getElementById('btn-changelog');
const changelogModal = document.getElementById('changelog-modal');
const closeChangelog = document.getElementById('close-changelog');
const changelogContent = document.getElementById('changelog-content');

// 1. Klick på "Changelog"-knappen -> Hämta textfilen och öppna modalen
btnChangelog.addEventListener('click', () => {
    // Öppna modalen direkt
    changelogModal.classList.remove('hidden');
    
    // Hämta innehållet live från din textfil (lägg till ett unikt tidsindex så webbläsaren inte cachar den gamla filen)
    fetch('changelog.txt?v=' + new Date().getTime())
        .then(response => {
            if (!response.ok) {
                throw new Error('Kunde inte ladda changelog.txt');
            }
            return response.text();
        })
        .then(text => {
            // 1. Skydda mot oväntad HTML (XSS-säkerhet) eftersom vi ska använda innerHTML
            let formattedText = text
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");

            // 2. FIXA FET STIL: Gör om **text** till <strong>text</strong>
            formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

            // 3. FIXA PUNKT-LISTA: Rader som börjar med "-" eller "*" får en snygg indragen punkt
            formattedText = formattedText.replace(/^[-\*]\s+(.*)$/gm, '<span style="padding-left: 8px; display: inline-block;">• $1</span>');

            // Injektera den formaterade texten som HTML
            changelogContent.innerHTML = formattedText;
        })
        .catch(error => {
            changelogContent.textContent = 'Kunde inte ladda historiken just nu.';
            console.error(error);
        });
});

// 2. Klick på krysset -> Stäng modalen
closeChangelog.addEventListener('click', () => {
    changelogModal.classList.add('hidden');
});

// 3. Klick utanför modalen -> Stäng modalen
window.addEventListener('click', (e) => {
    if (e.target === changelogModal) {
        changelogModal.classList.add('hidden');
    }
});


start();