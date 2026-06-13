const API_URL =
  "https://vm-predictor.stefan-hillblom.workers.dev/";

let predictions = {};

async function loadPredictions() {
    const response = await fetch("./predictions.json");
    predictions = await response.json();
}

function getOutcome(home, away) {
    if(home > away) return "H";
    if(home < away) return "A";
    return "D";
}

function calculatePoints(actualHome, actualAway,
                         predictedHome, predictedAway){

    if(actualHome === predictedHome &&
       actualAway === predictedAway){
        return 12;
    }

    const diff =
        Math.abs(actualHome - predictedHome) +
        Math.abs(actualAway - predictedAway);

    const actual =
        getOutcome(actualHome, actualAway);

    const predicted =
        getOutcome(predictedHome, predictedAway);

    let points =
        actual === predicted
        ? 10 - diff
        : 5 - diff;

    return Math.max(0, points);
}

async function loadMatches(){

    const response =
        await fetch(API_URL);

    const data =
        await response.json();

    const tbody =
        document.getElementById("matches");

    tbody.innerHTML = "";

    let totalPoints = 0;

    data.matches.forEach(match => {

        const home =
            match.homeTeam.tla;

        const away =
            match.awayTeam.tla;

        const key =
            `${home}-${away}`;

        const prediction =
            predictions[key] || "-";

        let points = "";

        if(
            match.status === "FINISHED" &&
            prediction !== "-"
        ){

            const [pHome,pAway] =
                prediction.split("-").map(Number);

            points =
                calculatePoints(
                    match.score.fullTime.home,
                    match.score.fullTime.away,
                    pHome,
                    pAway
                );

            totalPoints += points;
        }

        const row =
            document.createElement("tr");

        if(points === 12)
            row.classList.add("green");
        else if(points > 0)
            row.classList.add("yellow");
        else if(points === 0)
            row.classList.add("red");

        row.innerHTML = `
        <td>
        ${new Date(match.utcDate)
            .toLocaleString("sv-SE")}
        </td>

        <td>
        ${match.homeTeam.name}
        -
        ${match.awayTeam.name}
        </td>

        <td>
        ${match.score.fullTime.home ?? "-"}
        -
        ${match.score.fullTime.away ?? "-"}
        </td>

        <td>${prediction}</td>

        <td>${points}</td>

        <td>${match.status}</td>
        `;

        tbody.appendChild(row);
    });

    document.getElementById(
        "totalPoints"
    ).innerText =
        `Poäng: ${totalPoints}`;

    document.getElementById(
        "lastUpdated"
    ).innerText =
        `Uppdaterad ${new Date()
            .toLocaleTimeString("sv-SE")}`;
}

async function start(){

    await loadPredictions();

    await loadMatches();

    setInterval(
        loadMatches,
        30000
    );
}

start();
