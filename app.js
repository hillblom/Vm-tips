const API_URL = "https://vm-predictor.stefan-hillblom.workers.dev/";

let allPredictions = {};
let allMatches = [];
let currentUser = "";

const teamNamesSE = {
    "Algeria": "Algeriet", "Argentina": "Argentina", "Australia": "Australien", "Austria": "Österrike",
    "Belgium": "Belgien", "Bosnia and Herzegovina": "Bosnien", "Bosnia-Herzegovina": "Bosnien", "Brazil": "Brasilien",
    "Canada": "Kanada", "Cape Verde": "Kap Verde", "Cape Verde Islands": "Kap Verde", "Colombia": "Colombia",
    "Croatia": "Kroatien", "Curaçao": "Curacao", "Curacao": "Curacao", "Czech Republic": "Tjeckien",
    "Czechia": "Tjeckien", "DR Congo": "DR Kongo", "Ecuador": "Ecuador", "Egypt": "Egypten",
    "El Salvador": "El Salvador", "England": "England", "France": "Frankrike", "Germany": "Tyskland",
    "Ghana": "Ghana", "Haiti": "Haiti", "Iran": "Iran", "Iraq": "Irak", "Ivory Coast": "Elfenbenskusten",
    "Japan": "Japan", "Jordan": "Jordanien", "Mexico": "Mexiko", "Morocco": "Marocko",
    "Netherlands": "Nederländerna", "New Zealand": "Nya Zeeland", "Norway": "Norge", "Panama": "Panama",
    "Paraguay": "Paraguay", "Portugal": "Portugal", "Qatar": "Qatar", "Saudi Arabia": "Saudiarabien",
    "Scotland": "Skottland", "Senegal": "Senegal", "South Africa": "Sydafrika", "South Korea": "Sydkorea",
    "Spain": "Spanien", "Sweden": "Sverige", "Switzerland": "Schweiz", "Tunisia": "Tunisien",
    "Turkey": "Turkiet", "United States": "USA", "Uruguay": "Uruguay", "Uzbekistan": "Uzbekistan"
};

function getTeamNameSE(engName) {
    if (!engName) return "?"; 
    return teamNamesSE[engName] || engName;
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

// NY FUNKTION: Letar efter matchen i din JSON oavsett landskod (HAI/HTI, URU/URY) eller ordning (hemma/borta)
function findPrediction(userPredictions, homeTLA, awayTLA) {
    if (!userPredictions) return "-";
    
    const h = homeTLA.toUpperCase();
    const a = awayTLA.toUpperCase();

    // Skapa alla tänkbara kombinationer av synonymer
    const homeOptions = [h];
    const awayOptions = [a];

    if (h === "HAI" || h === "HTI") homeOptions.push("HAI", "HTI");
    if (a === "HAI" || a === "HTI") awayOptions.push("HAI", "HTI");
    if (h === "URU" || h === "URY") homeOptions.push("URU", "URY");
    if (a === "URU" || a === "URY") awayOptions.push("URU", "URY");
    if (h === "SAU" || h === "KSA") homeOptions.push("SAU", "KSA");
    if (a === "SAU" || a === "KSA") awayOptions.push("SAU", "KSA");

    // 1. Sök först efter exakt matchning i rätt ordning (Hem-Bort)
    for (let homeOpt of homeOptions) {
        for (let awayOpt of awayOptions) {
            const key = `${homeOpt}-${awayOpt}`;
            if (userPredictions[key]) return userPredictions[key];
        }
    }

    // 2. Sök i omvänd ordning (Bort-Hem) ifall du vänt på det i din JSON
    for (let homeOpt of homeOptions) {
        for (let awayOpt of awayOptions) {
            const key = `${awayOpt}-${homeOpt}`;
            if (userPredictions[key]) {
                // Vänd på resultatet (t.ex. "0-2" blir "2-0") så att det matchar spelschemats hemma/borta
                const parts = userPredictions[key].split("-");
                if (parts.length === 2) return `${parts[1]}-${parts[0]}`;
            }
        }
    }

    return "-";
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
        if (match.stage !== "GROUP_STAGE" || !match.homeTeam?.tla || !match.awayTeam?.tla) return;
        
        const prediction = findPrediction(userPredictions, match.homeTeam.tla, match.awayTeam.tla);
        if(match.status === "FINISHED" && prediction && prediction !== "-") {
            const [pHome, pAway] = prediction.split("-").map(Number);
            total += calculatePoints(match.score.fullTime.home, match.score.fullTime.away, pHome, pAway);
        }
    });
    return total;
}

function renderMatches(matchesToRender) {
    const tbody = document.getElementById("matches");
    tbody.innerHTML = "";
    const userPredictions = allPredictions[currentUser] || {};

    matchesToRender.forEach(match => {
        if (match.stage !== "GROUP_STAGE") return;
        const homeTLA = match.homeTeam?.tla || "?";
        const awayTLA = match.awayTeam?.tla || "?";
        
        // Använd den smarta sökfunktionen
        const prediction = findPrediction(userPredictions, homeTLA, awayTLA);
        
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

        row.innerHTML = `
        <td>${new Date(match.utcDate).toLocaleString("sv-SE", {month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</td>
        <td>${getTeamNameSE(match.homeTeam?.name)} - ${getTeamNameSE(match.awayTeam?.name)}</td>
        <td>${match.score.fullTime.home ?? "-"} - ${match.score.fullTime.away ?? "-"}</td>
        <td>${prediction}</td>
        <td>${points}</td>
        <td>${getStatusSE(match.status)}</td>
        `;
        tbody.appendChild(row);
    });
}

function renderRanking() {
    const tbody = document.getElementById("ranking-list");
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
