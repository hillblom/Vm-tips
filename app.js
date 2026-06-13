const API_URL = "https://vm-predictor.stefan-hillblom.workers.dev/";

let allPredictions = {};
let allMatches = [];
let currentUser = "";

async function loadPredictions() {
    // Ändrat till "predictions.json" utan ./ för bättre kompatibilitet med GitHub
    const response = await fetch("predictions.json");
    allPredictions = await response.json();
    
    const users = Object.keys(allPredictions);
    currentUser = users[0];
    
    const selector = document.getElementById("user-selector");
    selector.innerHTML = "";
    users.forEach(user => {
        const option = document.createElement("option");
        option.value = user;
        option.innerText = user;
        selector.appendChild(option);
    });
}

function getOutcome(home, away) {
    if(home > away) return "H";
    if(home < away) return "A";
    return "D";
}

function calculatePoints(actualHome, actualAway, predictedHome, predictedAway){
    if(actualHome === predictedHome && actualAway === predictedAway){
        return 12;
    }
    const diff = Math.abs(actualHome - predictedHome) + Math.abs(actualAway - predictedAway);
    const actual = getOutcome(actualHome, actualAway);
    const predicted = getOutcome(predictedHome, predictedAway);

    let points = actual === predicted ? 10 - diff : 5 - diff;
    return Math.max(0, points);
}

function getStatusSE(status) {
    switch (status) {
        case "FINISHED":
            return "Fulltid";
        case "IN_PLAY":
        case "PAUSED":
            return "Pågår";
        case "TIMED":
        case "SCHEDULED":
            return "Kommande";
        case "POSTPONED":
            return "Uppskjuten";
        case "CANCELLED":
            return "Inställd";
        default:
            return status;
    }
}

function getUserTotalPoints(user) {
    let total = 0;
    const userPredictions = allPredictions[user] || {};

    allMatches.forEach(match => {
        if (match.stage !== "GROUP_STAGE") return;

        const key = `${match.homeTeam.tla}-${match.awayTeam.tla}`;
        const prediction = userPredictions[key];
        
        if(match.status === "FINISHED" && prediction && prediction !== "-") {
            const [pHome, pAway] = prediction.split("-").map(Number);
            total += calculatePoints(
                match.score.fullTime.home,
                match.score.fullTime.away,
                pHome,
                pAway
            );
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

        const home = match.homeTeam.tla;
        const away = match.awayTeam.tla;
        const key = `${home}-${away}`;
        const prediction = userPredictions[key] || "-";
        
        let points = "";
        let isFinished = match.status === "FINISHED";

        if(isFinished && prediction !== "-"){
            const [pHome, pAway] = prediction.split("-").map(Number);
            points = calculatePoints(
                match.score.fullTime.home,
                match.score.fullTime.away,
                pHome,
                pAway
            );
        }

        const row = document.createElement("tr");

        if (isFinished && prediction !== "-") {
            if(points === 12) row.classList.add("green");
            else if(points > 0) row.classList.add("yellow");
            else if(points === 0) row.classList.add("red");
        }

        const statusSE = getStatusSE(match.status);

        row.innerHTML = `
        <td>${new Date(match.utcDate).toLocaleString("sv-SE", {month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</td>
        <td>${match.homeTeam.name} - ${match.awayTeam.name}</td>
        <td>${match.score.fullTime.home ?? "-"} - ${match.score.fullTime.away ?? "-"}</td>
        <td>${prediction}</td>
        <td>${points}</td>
        <td>${statusSE}</td>
        `;

        tbody.appendChild(row);
    });
}

function renderRanking() {
    const tbody = document.getElementById("ranking-list");
    tbody.innerHTML = "";

    const ranking = Object.keys(allPredictions).map(user => {
        return {
            name: user,
            points: getUserTotalPoints(user)
        };
    });

    ranking.sort((a, b) => b.points - a.points);

    ranking.forEach((player, index) => {
        const row = document.createElement("tr");
        if(index === 0) row.style.fontWeight = "bold";

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${player.name}</td>
            <td><strong>${player.points} p</strong></td>
        `;
        tbody.appendChild(row);
    });
}

async function loadMatches(){
    const response = await
