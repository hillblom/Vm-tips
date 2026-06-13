const API_URL = "https://vm-predictor.stefan-hillblom.workers.dev/";

let predictions = {};
let allMatches = []; // Sparar matcherna globalt för sökfiltrering

async function loadPredictions() {
    const response = await fetch("./predictions.json");
    predictions = await response.json();
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

// Ny funktion som sköter själva renderingen av tabellen
function renderMatches(matchesToRender) {
    const tbody = document.getElementById("matches");
    tbody.innerHTML = "";
    let totalPoints = 0;

    matchesToRender.forEach(match => {
        const home = match.homeTeam.tla;
        const away = match.awayTeam.tla;
        const key = `${home}-${away}`;
        const prediction = predictions[key] || "-";
        
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
            totalPoints += points;
        }

        const row = document.createElement("tr");

        // Sätt bara färg om matchen faktiskt är slutspelad
        if (isFinished && prediction !== "-") {
            if(points === 12) row.classList.add("green");
            else if(points > 0) row.classList.add("yellow");
            else if(points === 0) row.classList.add("red");
        }

        row.innerHTML = `
        <td>${new Date(match.utcDate).toLocaleString("sv-SE")}</td>
        <td>${match.homeTeam.name} - ${match.awayTeam.name}</td>
        <td>${match.score.fullTime.home ?? "-"} - ${match.score.fullTime.away ?? "-"}</td>
        <td>${prediction}</td>
        <td>${points}</td>
        <td>${match.status}</td>
        `;

        tbody.appendChild(row);
    });

    // Uppdatera totalpoäng baserat på HELA datasetet, inte bara det som är filtrerat
    calculateAndDisplayTotalPoints();
}

// Räknar ut totalen baserat på all data
function calculateAndDisplayTotalPoints() {
    let total = 0;
    allMatches.forEach(match => {
        const key = `${match.homeTeam.tla}-${match.awayTeam.tla}`;
        const prediction = predictions[key];
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
    document.getElementById("totalPoints").innerText = `Poäng: ${total}`;
}

async function loadMatches(){
    const response = await fetch(API_URL);
    const data = await response.json();
    
    allMatches = data.matches; // Spara till global variabel
    
    // Kör filtreringen ifall användaren redan har skrivit något i sökrutan
    filterMatches();

    document.getElementById("lastUpdated").innerText = 
        `Uppdaterad ${new Date().toLocaleTimeString("sv-SE")}`;
}

// Filtreringsfunktion för sökfältet
function filterMatches() {
    const query = document.getElementById("search").value.toLowerCase();
    const filtered = allMatches.filter(match => 
        match.homeTeam.name.toLowerCase().includes(query) || 
        match.awayTeam.name.toLowerCase().includes(query)
    );
    renderMatches(filtered);
}

async function start(){
    await loadPredictions();
    await loadMatches();

    // Lyssna på sökfältet
    document.getElementById("search").addEventListener("input", filterMatches);

    setInterval(loadMatches, 30000);
}

start();
