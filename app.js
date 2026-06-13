const API_URL = "https://vm-predictor.stefan-hillblom.workers.dev/";

let allPredictions = {};
let allMatches = [];
let currentUser = "";

async function loadPredictions() {
    const response = await fetch("./predictions.json");
    allPredictions = await response.json();
    
    // Sätt första personen i listan som standardanvändare
    const users = Object.keys(allPredictions);
    currentUser = users[0];
    
    // Fyll i dropdown-menyn i HTML
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

// Räknar ut totalpoäng för en specifik användare (endast gruppspel)
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

function renderMatches(matchesToRender) {
    const tbody = document.getElementById("matches");
    tbody.innerHTML = "";
    
    const userPredictions = allPredictions[currentUser] || {};

    matchesToRender.forEach(match => {
        // FILTER: Hoppa över matchen om det inte är gruppspel
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

        row.innerHTML = `
        <td>${new Date(match.utcDate).toLocaleString("sv-SE", {month: 'numeric', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</td>
        <td>${match.homeTeam.name} - ${match.awayTeam.name}</td>
        <td>${match.score.fullTime.home ?? "-"} - ${match.score.fullTime.away ?? "-"}</td>
        <td>${prediction}</td>
        <td>${points}</td>
        <td>${match.status}</td>
        `;

        tbody.appendChild(row);
    });
}

function renderRanking() {
    const tbody = document.getElementById("ranking-list");
    tbody.innerHTML = "";

    // Skapa en lista med alla användare och deras totala poäng
    const ranking = Object.keys(allPredictions).map(user => {
        return {
            name: user,
            points: getUserTotalPoints(user)
        };
    });

    // Sortera listan så att högst poäng kommer först
    ranking.sort((a, b) => b.points - a.points);

    // Rendera ut i rankingtabellen
    ranking.forEach((player, index) => {
        const row = document.createElement("tr");
        
        // Snygga till topp 3 lite extra
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
    const response = await fetch(API_URL);
    const data = await response.json();
    
    allMatches = data.matches;
    
    filterMatches();
    renderRanking();

    document.getElementById("lastUpdated").innerText = 
        `Uppdaterad ${new Date().toLocaleTimeString("sv-SE")}`;
}

function filterMatches() {
    const query = document.getElementById("search").value.toLowerCase();
    const filtered = allMatches.filter(match => 
        match.stage === "GROUP_STAGE" && (
            match.homeTeam.name.toLowerCase().includes(query) || 
            match.awayTeam.name.toLowerCase().includes(query)
        )
    );
    renderMatches(filtered);
}

// Logik för att växla mellan flikar
function setupTabs() {
    const btnMatches = document.getElementById("btn-matches");
    const btnRanking = document.getElementById("btn-ranking");
    const viewMatches = document.getElementById("view-matches");
    const viewRanking = document.getElementById("view-ranking");

    btnMatches.addEventListener("click", () => {
        btnMatches.classList.add("active");
        btnRanking.classList.remove("active");
        viewMatches.classList.remove("hidden");
        viewRanking.classList.add("hidden");
    });

    btnRanking.addEventListener("click", () => {
        btnRanking.classList.add("active");
        btnMatches.classList.remove("active");
        viewRanking.classList.remove("hidden");
        viewMatches.classList.add("hidden");
        renderRanking(); // Uppdatera listan när man klickar på den
    });
}

async function start(){
    await loadPredictions();
    await loadMatches();
    setupTabs();

    document.getElementById("search").addEventListener("input", filterMatches);
    
    // Lyssna på när man byter användare i dropdownen
    document.getElementById("user-selector").addEventListener("change", (e) => {
        currentUser = e.target.value;
        filterMatches();
    });

    setInterval(loadMatches, 30000);
}

start();
