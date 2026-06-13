const API_URL = "https://vm-predictor.stefan-hillblom.workers.dev/";

let allPredictions = {};
let allMatches = [];
let currentUser = "";

async function loadPredictions() {
    const response = await fetch("./predictions.json");
    allPredictions = await response.json();
    
    // Sätt första personen i listan (t.ex. Stefan) som standardanvändare
    const users = Object.keys(allPredictions);
    currentUser = users[0];
    
    // Fyll i dropdown-menyn i HTML dynamiskt
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

// Hjälpfunktion för ommappning av matchstatus till svenska
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

// Räknar ut totalpoäng för en specifik användare (endast grundomgångar)
function getUserTotalPoints(user) {
    let total = 0;
    const userPredictions = allPredictions[user] || {};

    allMatches.forEach(match => {
        // FILTER: Bara grundomgångar/gruppspel
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

function renderMatches(matchesToRender
