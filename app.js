const API_URL = "https://vm-predictor.stefan-hillblom.workers.dev/";

const state = {
    allPredictions: {},
    allMatches: [],
    currentUser: "",
    matrixSortByRanking: true,
    hideFinishedMatches: false,
    trendChartInstance: null,
    simulationResult: null,
    currentStageFilter: localStorage.getItem("selectedStageFilter") || "GROUP_STAGE",
    teamGroups: {}
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

// NYTT: Går igenom matcherna och mappar lag till deras respektive grupper
function buildTeamGroupMapping() {
    state.teamGroups = {};
    state.allMatches.forEach(match => {
        if (match.stage === "GROUP_STAGE" && match.group) {
            if (match.homeTeam && match.homeTeam.name) {
                state.teamGroups[match.homeTeam.name] = match.group;
            }
            if (match.awayTeam && match.awayTeam.name) {
                state.teamGroups[match.awayTeam.name] = match.group;
            }
        }
    });
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

function getAllGroupMatchesChronological() {
    return getGroupStageMatches()
        .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
}

function escapeCsvValue(value) {
    const text = String(value ?? "");
    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

function downloadCsv(filename, rows) {
    const csvContent = rows
        .map(row => row.map(escapeCsvValue).join(","))
        .join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function exportRankingCsv() {
    const groupMatches = getAllGroupMatchesChronological();
    const participants = Object.keys(state.allPredictions).sort((a, b) => a.localeCompare(b, "sv"));

    if (groupMatches.length === 0 || participants.length === 0) {
        alert("Ingen data hittades att exportera.");
        return;
    }

    const headerRow = ["Deltagare"];
    groupMatches.forEach((match, index) => {
        headerRow.push(`${index + 1} ${getMatchKey(match)}`);
    });

    const rows = [headerRow];

    participants.forEach(name => {
        const userPredictions = state.allPredictions[name] || {};
        const row = [name];
        let cumulativeScore = 0;

        groupMatches.forEach(match => {
            const key = getMatchKey(match);
            const prediction = getPredictionFromKey(userPredictions, key);

            if (match.status === "FINISHED" && prediction !== "-") {
                cumulativeScore += calculatePointsAdvanced(match, prediction, userPredictions);
            }

            row.push(cumulativeScore);
        });

        rows.push(row);
    });

    downloadCsv("vm_tips_bar_race.csv", rows);
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

    // Uppdatera toggle-knappens text dynamiskt
    const toggleBtn = document.getElementById("btn-toggle-stage");
    if (toggleBtn) {
        if (state.currentStageFilter === "GROUP_STAGE") {
            toggleBtn.innerHTML = "Visar: 🏆 Gruppspel (Klicka för Slutspel)";
            toggleBtn.classList.remove("playoff-mode");
        } else {
            toggleBtn.innerHTML = "Visar: 🔥 Slutspel (Klicka för Gruppspel)";
            toggleBtn.classList.add("playoff-mode");
        }
    }

    // Styr synligheten för rubrikerna Tips och Poäng baserat på läge
    const isGroup = state.currentStageFilter === "GROUP_STAGE";
    const thTip = document.getElementById("th-match-tip");
    const thPts = document.getElementById("th-match-pts");
    
    if (thTip) thTip.style.display = isGroup ? "" : "none";
    if (thPts) thPts.style.display = isGroup ? "" : "none";

    // Sortera matcherna kronologiskt
    const sortedMatches = [...state.allMatches].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

    sortedMatches.forEach(match => {
        if (state.hideFinishedMatches && match.status === "FINISHED") return;

        // FILTRERING
        const isGroupStage = match.stage === "GROUP_STAGE";
        if (state.currentStageFilter === "GROUP_STAGE" && !isGroupStage) return;
        if (state.currentStageFilter === "PLAYOFF" && isGroupStage) return;

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
        const onlyDate = date.toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' }); 
        const onlyTime = date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

        // Hämta lagnamn på svenska
        let homeName = match.homeTeam && match.homeTeam.name 
            ? (teamNamesSE[match.homeTeam.name] || match.homeTeam.name) 
            : "Ej bestämt";
            
        let awayName = match.awayTeam && match.awayTeam.name 
            ? (teamNamesSE[match.awayTeam.name] || match.awayTeam.name) 
            : "Ej bestämt";
        
        // ÄNDRING: Lägg ENDAST till gruppnamnet om vi visar slutspelet (!isGroup) och matchen har en grupp i API-datan
        if (!isGroup) {
            const homeGroup = state.teamGroups[match.homeTeam.name];
            const awayGroup = state.teamGroups[match.awayTeam.name];

            if (homeGroup) {
                const groupLetter = homeGroup.replace("GROUP_", "");
                homeName += ` (${groupLetter})`;
            }
            if (awayGroup) {
                const groupLetter = awayGroup.replace("GROUP_", "");
                awayName += ` (${groupLetter})`;
            }
        }

        // Villkorliga tabellceller för Tips och Poäng
        const tipCellHtml = isGroup ? `<td>${prediction}</td>` : "";
        const ptsCellHtml = isGroup ? `<td>${points}</td>` : "";

        // Mappa match.stage till svensk text för slutspelsstatusen
        let stageStatusText = "";
        if (match.status === "FINISHED") {
            stageStatusText = "Slut";
        } else if (["IN_PLAY", "PAUSED", "LIVE"].includes(match.status)) {
            stageStatusText = "Pågår";
        } else {
            switch(match.stage) {
                case "LAST_16": case "ROUND_OF_16":
                    stageStatusText = "Åttondelsfinal"; break;
                case "QUARTER_FINALS":
                    stageStatusText = "Kvartsfinal"; break;
                case "SEMI_FINALS":
                    stageStatusText = "Semifinal"; break;
                case "THIRD_PLACE":
                    stageStatusText = "Bronsmatch"; break;
                case "FINAL":
                    stageStatusText = "Final"; break;
                default:
                    stageStatusText = "Kommande";
            }
        }

        row.innerHTML = `
            <td class="match-meta-cell">
                <div class="date-time-stack">
                    <span class="match-d">${onlyDate}</span>
                    <br>
                    <span class="match-t">${onlyTime}</span>
                </div>
                ${getBroadcasterHtml(match)}
            </td>
            <td>${homeName} - ${awayName}</td>
            <td>${homeScore}-${awayScore}</td>
            ${tipCellHtml}
            ${ptsCellHtml}
            <td>${stageStatusText}</td>
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

    function getPlaceholderName(matchNumber, side) {
    const finalMatch = state.allMatches.find(m => m.stage === "FINAL");
    const finalId = finalMatch ? finalMatch.matchNumber : 104;

    if (matchNumber === finalId) return side === "home" ? "Vinnare 101" : "Vinnare 102";
    if (matchNumber === 101) return side === "home" ? "Vinnare 97" : "Vinnare 98";
    if (matchNumber === 102) return side === "home" ? "Vinnare 99" : "Vinnare 100";
    
    if (matchNumber === 97) return side === "home" ? "Vinnare 89" : "Vinnare 90";
    if (matchNumber === 98) return side === "home" ? "Vinnare 93" : "Vinnare 94";
    if (matchNumber === 99) return side === "home" ? "Vinnare 91" : "Vinnare 92";
    if (matchNumber === 100) return side === "home" ? "Vinnare 95" : "Vinnare 96";

    // Åttondelsfinalernas invärden baserat på dina nya data
    const r16Mapping = {
        89: ["Vinnare 74", "Vinnare 77"],
        90: ["Vinnare 73", "Vinnare 75"],
        91: ["Vinnare 76", "Vinnare 78"],
        92: ["Vinnare 79", "Vinnare 80"],
        93: ["Vinnare 83", "Vinnare 84"],
        94: ["Vinnare 81", "Vinnare 82"],
        95: ["Vinnare 86", "Vinnare 88"],
        96: ["Vinnare 85", "Vinnare 87"]
    };

    if (r16Mapping[matchNumber]) {
        return side === "home" ? r16Mapping[matchNumber][0] : r16Mapping[matchNumber][1];
    }

    return "Ej klart";
}

function assignOfficialKnockoutMatchNumbers(matches) {
    const matchNumberById = new Map([
        [537417, 73], [537423, 76], [537415, 74], [537418, 75],
        [537424, 78], [537416, 77], [537425, 79], [537426, 80],
        [537422, 82], [537421, 81], [537420, 84], [537419, 83],
        [537429, 85], [537428, 88], [537427, 86], [537430, 87],
        [537375, 89], [537376, 90], [537377, 91], [537378, 92],
        [537379, 93], [537380, 94], [537381, 95], [537382, 96],
        [537383, 97], [537384, 98], [537385, 99], [537386, 100],
        [537387, 101], [537388, 102], [537389, 103], [537390, 104]
    ]);

    const stageFallbacks = {
        QUARTER_FINALS: [97, 98, 99, 100],
        SEMI_FINALS: [101, 102],
        THIRD_PLACE: [103],
        FINAL: [104]
    };

    matches.forEach(match => {
        if (matchNumberById.has(match.id)) {
            match.matchNumber = matchNumberById.get(match.id);
        }
    });

    Object.entries(stageFallbacks).forEach(([stage, numbers]) => {
        matches
            .filter(match => match.stage === stage)
            .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
            .forEach((match, index) => {
                if (!match.matchNumber && numbers[index]) {
                    match.matchNumber = numbers[index];
                }
            });
    });
}

function renderPlayoffBracket() {
    const container = document.getElementById("bracket-container");
    if (!container) return;

    container.innerHTML = "";
    container.classList.add("js-bracket");

    if (!document.getElementById("js-bracket-style")) {
        const style = document.createElement("style");
        style.id = "js-bracket-style";
        style.textContent = `
            #bracket-container.js-bracket {
                position: relative;
                display: flex;
                align-items: flex-start;
                gap: 34px;
                padding: 20px 30px;
                overflow-x: auto;
            }

            #bracket-container.js-bracket .bracket-lines {
                position: absolute;
                left: 0;
                top: 0;
                pointer-events: none;
                z-index: 1;
            }

            #bracket-container.js-bracket .bracket-column {
                width: 240px;
                min-width: 240px;
                padding: 0;
                position: relative;
                flex: none;
                z-index: 2;
            }

            #bracket-container.js-bracket .bracket-column h3 {
                height: 32px;
                margin-bottom: 20px;
            }

            #bracket-container.js-bracket .bracket-column-body {
                position: relative;
            }

            #bracket-container.js-bracket .bracket-match-wrapper {
                position: absolute;
                left: 0;
                right: 0;
                margin: 0;
                display: block;
                flex: none;
            }

            #bracket-container.js-bracket .bracket-match-card {
                width: 210px;
                margin: 0 auto;
            }

            #bracket-container.js-bracket .bracket-match-wrapper::before,
            #bracket-container.js-bracket .bracket-match-card::after {
                display: none !important;
                content: none !important;
            }

            #bracket-container.js-bracket .bracket-team-row.winner {
                background: var(--success-bg, #d4edda);
                color: var(--success-text, #155724);
                border-radius: 4px;
                font-weight: 700;
            }

            #bracket-container.js-bracket .bracket-team-row.winner .bracket-team-score {
                color: var(--success-text, #155724);
            }
        `;
        document.head.appendChild(style);
    }

    const cardHeight = 106;
    const rowGap = 16;
    const rowStep = cardHeight + rowGap;

    const rounds = [
        {
            stageKey: "LAST_32",
            title: "16-delsfinal",
            matchOrder: [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87]
        },
        {
            stageKey: "LAST_16",
            title: "Åttondelsfinal",
            matchOrder: [89, 90, 93, 94, 91, 92, 95, 96],
            sources: { 89: [74, 77], 90: [73, 75], 93: [83, 84], 94: [81, 82], 91: [76, 78], 92: [79, 80], 95: [86, 88], 96: [85, 87] }
        },
        {
            stageKey: "QUARTER_FINALS",
            title: "Kvartsfinal",
            matchOrder: [97, 98, 99, 100],
            sources: { 97: [89, 90], 98: [93, 94], 99: [91, 92], 100: [95, 96] }
        },
        {
            stageKey: "SEMI_FINALS",
            title: "Semifinal",
            matchOrder: [101, 102],
            sources: { 101: [97, 98], 102: [99, 100] }
        },
        {
            stageKey: "FINAL",
            title: "Final",
            matchOrder: [104],
            sources: { 104: [101, 102] }
        }
    ];

    const positions = new Map();

    rounds[0].matchOrder.forEach((matchNumber, index) => {
        positions.set(matchNumber, index * rowStep);
    });

    rounds.slice(1).forEach(round => {
        round.matchOrder.forEach(matchNumber => {
            const sourceNumbers = round.sources[matchNumber];
            const sourceCenters = sourceNumbers.map(number => positions.get(number) + cardHeight / 2);
            const center = sourceCenters.reduce((sum, value) => sum + value, 0) / sourceCenters.length;
            positions.set(matchNumber, center - cardHeight / 2);
        });
    });

    const bodyHeight = rounds[0].matchOrder.length * cardHeight + (rounds[0].matchOrder.length - 1) * rowGap;
    const cardByMatchNumber = new Map();

    rounds.forEach(round => {
        const roundColumn = document.createElement("div");
        roundColumn.className = "bracket-column";

        const roundTitle = document.createElement("h3");
        roundTitle.innerText = round.title;
        roundColumn.appendChild(roundTitle);

        const roundBody = document.createElement("div");
        roundBody.className = "bracket-column-body";
        roundBody.style.height = `${bodyHeight}px`;

        round.matchOrder.forEach(matchNumber => {
            const match = state.allMatches.find(m => m.matchNumber === matchNumber);

            const wrapper = document.createElement("div");
            wrapper.className = "bracket-match-wrapper";
            wrapper.style.top = `${positions.get(matchNumber)}px`;

            const matchCard = document.createElement("div");
            matchCard.className = "bracket-match-card";
            matchCard.dataset.matchNumber = matchNumber;

            if (match && (match.status === "LIVE" || match.status === "IN_PLAY")) {
                matchCard.classList.add("live-match");
            }

            const homeName = match?.homeTeam?.name
                ? (teamNamesSE[match.homeTeam.name] || match.homeTeam.name)
                : getPlaceholderName(matchNumber, "home");

            const awayName = match?.awayTeam?.name
                ? (teamNamesSE[match.awayTeam.name] || match.awayTeam.name)
                : getPlaceholderName(matchNumber, "away");

            const homeScoreValue = match?.score?.fullTime?.home;
            const awayScoreValue = match?.score?.fullTime?.away;
            const homeScore = homeScoreValue ?? "-";
            const awayScore = awayScoreValue ?? "-";
            const hasFinishedScore = match?.status === "FINISHED" && homeScoreValue !== null && homeScoreValue !== undefined && awayScoreValue !== null && awayScoreValue !== undefined;
            const homeWinnerClass = hasFinishedScore && homeScoreValue > awayScoreValue ? " winner" : "";
            const awayWinnerClass = hasFinishedScore && awayScoreValue > homeScoreValue ? " winner" : "";

            const timeStr = match?.utcDate
                ? new Date(match.utcDate).toLocaleDateString("sv-SE", { month: "short", day: "numeric" }) + " " +
                  new Date(match.utcDate).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })
                : "TBD";

            let broadcasterHtml = `<span class="bracket-tv-channel undecided" style="font-size:0.75rem; font-style:italic; color:var(--text-muted)">Ej bestämt</span>`;
            if (match?.broadcaster) {
                const bc = match.broadcaster.toLowerCase();
                if (bc === "svt") broadcasterHtml = `<img src="svt.png" class="tv-logo" alt="SVT" style="height: 14px; vertical-align: middle;">`;
                else if (bc === "tv4") broadcasterHtml = `<img src="tv4.png" class="tv-logo" alt="TV4" style="height: 14px; vertical-align: middle;">`;
                else broadcasterHtml = `<span class="bracket-tv-channel" style="font-size:0.75rem; font-weight:bold;">${match.broadcaster.toUpperCase()}</span>`;
            }

            matchCard.innerHTML = `
                <div class="bracket-match-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span class="bracket-match-time" style="font-size:0.8rem; color:var(--text-muted);">${timeStr}</span>
                    <div class="bracket-broadcaster">${broadcasterHtml}</div>
                </div>
                <div class="bracket-team-row${homeWinnerClass}">
                    <span class="bracket-team-name ${!match?.homeTeam?.name ? "placeholder" : ""}">${homeName}</span>
                    <span class="bracket-team-score">${homeScore}</span>
                </div>
                <div class="bracket-team-row${awayWinnerClass}">
                    <span class="bracket-team-name ${!match?.awayTeam?.name ? "placeholder" : ""}">${awayName}</span>
                    <span class="bracket-team-score">${awayScore}</span>
                </div>
            `;

            wrapper.appendChild(matchCard);
            roundBody.appendChild(wrapper);
            cardByMatchNumber.set(matchNumber, matchCard);
        });

        roundColumn.appendChild(roundBody);
        container.appendChild(roundColumn);
    });

    requestAnimationFrame(() => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.classList.add("bracket-lines");
        svg.setAttribute("width", container.scrollWidth);
        svg.setAttribute("height", container.scrollHeight);

        const containerRect = container.getBoundingClientRect();

        rounds.slice(1).forEach(round => {
            round.matchOrder.forEach(targetNumber => {
                const targetCard = cardByMatchNumber.get(targetNumber);
                if (!targetCard) return;

                round.sources[targetNumber].forEach(sourceNumber => {
                    const sourceCard = cardByMatchNumber.get(sourceNumber);
                    if (!sourceCard) return;

                    const sourceRect = sourceCard.getBoundingClientRect();
                    const targetRect = targetCard.getBoundingClientRect();

                    const x1 = sourceRect.right - containerRect.left + container.scrollLeft;
                    const y1 = sourceRect.top + sourceRect.height / 2 - containerRect.top + container.scrollTop;
                    const x2 = targetRect.left - containerRect.left + container.scrollLeft;
                    const y2 = targetRect.top + targetRect.height / 2 - containerRect.top + container.scrollTop;
                    const midX = x1 + (x2 - x1) / 2;

                    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    path.setAttribute("d", `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`);
                    path.setAttribute("fill", "none");
                    path.setAttribute("stroke", "var(--bracket-dark-border, #393e46)");
                    path.setAttribute("stroke-width", "2");
                    svg.appendChild(path);
                });
            });
        });

        container.prepend(svg);
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

            // --- NOLLSTÄLL SIMULERINGEN OM MAN LÄMNAR TABELLEN ---
            if (btnId !== "btn-ranking") {
                state.simulationResult = null;
                const simInput = document.getElementById("simulation-input");
                if (simInput) simInput.value = "";
            }
            // -----------------------------------------------------------

            // --- FILTER-KNAPPEN (DÖLJA/VISA PÅ RÄTT FLIKAR) ---
            const filterElement = document.getElementById("hide-finished-checkbox");
            const filterContainer = filterElement ? filterElement.parentElement : null;
            
            if (filterContainer) {
                // Dölj även filter-checkboxen i slutspelsträdet för att inte bryta strukturen
                if (btnId === "btn-ranking" || btnId === "btn-playoffs") {
                    filterContainer.style.display = "none";  
                } else {
                    filterContainer.style.display = "block"; // Visa i matcher och matris
                }
            }
            // --------------------------------------------------------

            if (btnId === "btn-matches") renderMatches();
            if (btnId === "btn-ranking") renderRanking();
            if (btnId === "btn-matrix") renderMatrix();
            if (btnId === "btn-trend") renderTrendChart();
            if (btnId === "btn-stats") renderStats();
            if (btnId === "btn-playoffs") renderPlayoffBracket(); // ÄNDRAD: Kör nu din nya träd-funktion
        });
    });

    document.getElementById("btn-rules").addEventListener("click", () => document.getElementById("rules-modal").classList.remove("hidden"));
    document.querySelector(".close-btn").addEventListener("click", () => document.getElementById("rules-modal").classList.add("hidden"));
}

async function updateApiData() {
    try {
        const respM = await fetch(API_URL + "?t=" + Date.now());
        const data = await respM.json();
        
        // --- NY KOD: Tilldela officiella matchnummer kronologiskt ---
        // Eftersom API:et oftast saknar 'matchNumber', bygger vi dem själva
        // baserat på avsparkstid, vilket matchar FIFAs officiella schema för VM 2026.
        
        const stages = [
            { key: "LAST_32", start: 73 },
            { key: "LAST_16", start: 89 },
            { key: "ROUND_OF_16", start: 89 }, // Gardering för olika API-namn
            { key: "QUARTER_FINALS", start: 97 },
            { key: "SEMI_FINALS", start: 101 },
            { key: "FINAL", start: 104 }
        ];

        assignOfficialKnockoutMatchNumbers(data.matches);
        // -------------------------------------------------------------

        state.allMatches = data.matches;
        buildTeamGroupMapping();

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
        if (!document.getElementById("view-playoffs").classList.contains("hidden")) renderPlayoffBracket();
        
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

    const toggleBtn = document.getElementById("btn-toggle-stage");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            // Växla värdet till motsatsen
            if (state.currentStageFilter === "GROUP_STAGE") {
                state.currentStageFilter = "PLAYOFF";
            } else {
                state.currentStageFilter = "GROUP_STAGE";
            }
            
            // Spara valet och rendera om
            localStorage.setItem("selectedStageFilter", state.currentStageFilter);
            renderMatches();
        });
    }

    document.getElementById('btn-export-csv').addEventListener('click', () => {
    // 1. Hämta alla färdigspelade matcher i kronologisk ordning
    const playedMatches = state.allMatches
        .filter(m => m.status === 'FINISHED') // Justera om du har en annan status för avslutade
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (playedMatches.length === 0) {
        alert("Inga spelade matcher hittades att exportera.");
        return;
    }

    // 2. Bygg rubrikraden (Kolumn 1 är Deltagare, sedan match för match)
    const headerRow = ["Deltagare"];
    playedMatches.forEach((match, index) => {
        // Skapar rubriker som "Match 1 (BRA-NOR)"
        headerRow.push(`Match ${index + 1} (${match.homeTeam}-${match.awayTeam})`);
    });

    // csvContent är strängen vi bygger upp, rad för rad
    let csvContent = headerRow.join(",") + "\n";

    // 3. Iterera genom alla deltagare
    const participants = Object.keys(state.allPredictions);

    participants.forEach(name => {
        let row = [name];
        let cumulativeScore = 0;

        playedMatches.forEach(match => {
            let pointsEarned = 0;

            // HÄR: Anropa din riktiga funktion för poängberäkning
            if (state.allPredictions[name] && state.allPredictions[name][match.id]) {
                // Exempel: Byt ut calculateMatchScore mot din faktiska poäng-funktion
                // pointsEarned = calculateMatchScore(state.allPredictions[name][match.id], match);
            }

            cumulativeScore += pointsEarned;
            row.push(cumulativeScore);
        });

        // Lägg till raden i CSV-strängen
        csvContent += row.join(",") + "\n";
    });

    // 4. Skapa filen och trigga nedladdning i webbläsaren
    // Lägger till BOM (\uFEFF) för att Excel ska förstå åäö korrekt
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "vm_tips_poangutveckling.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

    const exportCsvBtn = document.getElementById("btn-export-csv");
    if (exportCsvBtn) {
        const cleanExportCsvBtn = exportCsvBtn.cloneNode(true);
        exportCsvBtn.replaceWith(cleanExportCsvBtn);
        cleanExportCsvBtn.addEventListener("click", exportRankingCsv);
    }

    // --- Flourish Modal Logik ---
const btnFlourish = document.getElementById('btn-flourish-modal');
const flourishModal = document.getElementById('flourish-modal');
const closeFlourishBtn = document.getElementById('close-flourish-modal');

if (btnFlourish && flourishModal && closeFlourishBtn) {
    // Öppna modalen
    btnFlourish.addEventListener('click', () => {
        flourishModal.classList.remove('hidden');
    });

    // Stäng på krysset
    closeFlourishBtn.addEventListener('click', () => {
        flourishModal.classList.add('hidden');
    });

    // Stäng om man klickar i den mörka bakgrunden utanför den vita boxen
    flourishModal.addEventListener('click', (e) => {
        if (e.target === flourishModal) {
            flourishModal.classList.add('hidden');
        }
    });
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
