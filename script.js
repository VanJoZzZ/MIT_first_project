// PENALTY MIND GAMES
// Classroom version: HTML + CSS + JavaScript + p5.js + Adafruit IO

// =============================================================
// PART 1 / 4 : TEAM SELECTION AND PAGES
// =============================================================

// ESPN team crest IDs. The logos are loaded from the web.
const clubs = {
    "Liverpool": 364,
    "Arsenal": 359,
    "Tottenham": 367,
    "Manchester United": 360,
    "Manchester City": 382,
    "Chelsea": 363,
    "Newcastle United": 361,
    "Real Madrid": 86,
    "Barcelona": 83,
    "Bayern Munich": 132,
    "PSG": 160,
    "Inter Milan": 110,
    "AC Milan": 103,
    "Juventus": 111,
    "Borussia Dortmund": 124
};


let teamA = "Liverpool";
let teamB = "Arsenal";

// Find an element in the HTML, just like in our DWW exercises.
function byId(id) {
    return document.querySelector("#" + id);
}

function showPage(page) {
    byId("homePage").classList.add("hidden");
    byId("gamePage").classList.add("hidden");
    byId("leaguePage").classList.add("hidden");
    byId(page).classList.remove("hidden");
}

// Display the chosen club crest directly from ESPN.
function showCrest(id, team) {
    let container = byId(id);
    container.innerHTML = "";

    let image = document.createElement("img");
    image.src = "https://a.espncdn.com/i/teamlogos/soccer/500/" + clubs[team] + ".png";
    image.alt = team + " crest";
    image.title = team;

    container.appendChild(image);
}

function prepareTeams() {
    let listA = byId("teamA");
    let listB = byId("teamB");

    for (let name in clubs) {
        listA.add(new Option(name, name));
        listB.add(new Option(name, name));
    }

    listA.value = teamA;
    listB.value = teamB;

    listA.addEventListener("change", updateTeams);
    listB.addEventListener("change", updateTeams);
    listA.addEventListener("input", updateTeams);
    listB.addEventListener("input", updateTeams);
    updateTeams();
}

function updateTeams() {
    showCrest("crestA", byId("teamA").value);
    showCrest("crestB", byId("teamB").value);

    // A clear warning appears only if both players select the same club.
    if (byId("teamA").value === byId("teamB").value) {
        byId("teamMessage").textContent = "Please choose two different teams.";
    } else {
        byId("teamMessage").textContent = "";
    }
}

function startMatch() {
    teamA = byId("teamA").value;
    teamB = byId("teamB").value;

    if (teamA === teamB) {
        byId("teamMessage").textContent = "Choose two different teams.";
        return;
    }

    byId("teamMessage").textContent = "";
    byId("nameA").textContent = teamA;
    byId("nameB").textContent = teamB;
    showCrest("matchCrestA", teamA);
    showCrest("matchCrestB", teamB);

    showPage("gamePage");
    resetGame();
}

byId("startButton").addEventListener("click", startMatch);
byId("backButton").addEventListener("click", function () {
    showPage("homePage");
});
byId("restartButton").addEventListener("click", startMatch);
byId("standingsButton").addEventListener("click", function () {
    showLeague();
    showPage("leaguePage");
});
byId("leagueBackButton").addEventListener("click", function () {
    showPage("gamePage");
});

prepareTeams();


// =============================================================
// PART 2 / 4 : PENALTY GAME WITH p5.js
// =============================================================

let aim = 90;
let power = 60;
let move = 50;
let angle = 0;

let scores = [0, 0];
let shotCount = 0;
let shooting = false;
let shotFrame = 0;
let currentShot = null;
let lastJump = null;
let messageTime = 0;

function resetGame() {
    scores = [0, 0];
    shotCount = 0;
    shooting = false;
    currentShot = null;
    lastJump = null;
    messageTime = 0;

    byId("score").textContent = "0 - 0";
    byId("shotNumber").textContent = "Penalty 1 / 10";
    byId("resultText").textContent = "Ready to shoot";
    byId("shootData").textContent = "READY";
    byId("jumpData").textContent = "READY";
    byId("restartButton").classList.add("hidden");
}

// p5.js calls setup() only once.
function setup() {
    let canvas = createCanvas(750, 430);
    canvas.parent("pitch");
    textFont("Arial");
}

// p5.js calls draw() again and again to animate the ball.
function draw() {
    background("#155a37");

    // Grass stripes
    noStroke();
    fill("#1b6841");
    rect(0, 0, 750, 95);
    rect(0, 190, 750, 95);
    rect(0, 380, 750, 50);

    // Goal and net
    stroke(255);
    strokeWeight(4);
    noFill();
    rect(175, 65, 400, 160);

    stroke(255, 255, 255, 75);
    strokeWeight(1);
    for (let x = 195; x < 575; x += 25) {
        line(x, 65, x, 225);
    }
    for (let y = 90; y < 225; y += 25) {
        line(175, y, 575, y);
    }

    // Show the predicted ball path before the shot.
    // Both the guide and the actual shot use the same target position.
    if (!shooting && shotCount < 10) {
        let target = getShotTarget(aim, power);
        drawShotGuide(target.x, target.y);
    }

    // Move sets the horizontal position. Angle sets the jump height.
    let keeperX = map(move, 0, 100, 180, 570);
    let keeperY = 190;

    if (lastJump) {
        let elapsed = Date.now() - lastJump.time;
        let lift = 0;

        // Rise quickly, stay up briefly, then return to the ground.
        if (elapsed < 250) {
            lift = lastJump.height * elapsed / 250;
        } else if (elapsed < 900) {
            lift = lastJump.height;
        } else if (elapsed < 1200) {
            lift = lastJump.height * (1200 - elapsed) / 300;
        } else {
            lastJump = null;
        }

        if (lastJump) {
            keeperX = lastJump.x;
            keeperY = keeperY - lift;
        }
    }

    drawKeeper(keeperX, keeperY);

    let ballX = 375;
    let ballY = 350;

    if (shooting) {
        shotFrame++;
        // More power means fewer frames, so the ball travels faster.
        let progress = min(shotFrame / currentShot.frames, 1);

        ballX = lerp(375, currentShot.x, progress);
        ballY = lerp(350, currentShot.y, progress);
        ballY = ballY - sin(progress * PI) * 45;

        // A save happens whenever the moving ball touches the keeper.
        // No jump is required: the keeper can also save while standing.
        if (ballTouchesKeeper(ballX, ballY, keeperX, keeperY)) {
            currentShot.saved = true;
        }

        if (progress === 1) {
            finishShot();
        }
    }

    drawBall(ballX, ballY);

    // Goal message appears briefly on the pitch.
    if (Date.now() < messageTime) {
        fill("#f6ff89");
        noStroke();
        textAlign(CENTER);
        textSize(45);
        text(byId("resultText").textContent, 375, 55);
    }
}

// Aim controls left/right; power controls the height of the landing point.
// The goal is from x = 175 to 575 and y = 65 to 225.
function getShotTarget(shotAim, shotPower) {
    return {
        x: 135 + shotAim * 480 / 180,
        y: 255 - shotPower * 210 / 100
    };
}

// Draw a dashed line and a crosshair to show the expected landing point.
function drawShotGuide(targetX, targetY) {
    let onTarget = targetX >= 175 && targetX <= 575;
    onTarget = onTarget && targetY >= 65 && targetY <= 225;

    let guideColor = onTarget ? "#f5e96a" : "#ff987c";
    stroke(guideColor);
    strokeWeight(3);

    // Dashed trajectory from the football to the goal.
    for (let i = 0; i < 20; i += 2) {
        let start = i / 20;
        let end = (i + 1) / 20;

        // Use the same arc as the moving ball.
        line(
            lerp(375, targetX, start),
            lerp(350, targetY, start) - sin(start * PI) * 45,
            lerp(375, targetX, end),
            lerp(350, targetY, end) - sin(end * PI) * 45
        );
    }

    // Crosshair / projected landing point.
    noFill();
    strokeWeight(3);
    circle(targetX, targetY, 34);
    line(targetX - 25, targetY, targetX - 10, targetY);
    line(targetX + 10, targetY, targetX + 25, targetY);
    line(targetX, targetY - 25, targetX, targetY - 10);
    line(targetX, targetY + 10, targetX, targetY + 25);

    noStroke();
    fill(guideColor);
    circle(targetX, targetY, 7);
}

function drawKeeper(x, y) {
    // Head
    noStroke();
    fill("#e7bb8c");
    circle(x, y - 40, 28);

    // Shirt
    fill("#f2aa27");
    rect(x - 18, y - 25, 36, 42, 7);

    // Arms and legs
    stroke("#f2aa27");
    strokeWeight(9);
    line(x - 14, y - 12, x - 43, y + 2);
    line(x + 14, y - 12, x + 43, y + 2);

    stroke("#162d20");
    line(x - 8, y + 17, x - 15, y + 46);
    line(x + 8, y + 17, x + 15, y + 46);
}

function drawBall(x, y) {
    stroke("#222222");
    strokeWeight(2);
    fill(255);
    circle(x, y, 27);
    fill("#222222");
    circle(x, y, 10);
}

// Check if the football touches the drawn goalkeeper.
// The ball has a radius of 13.5 pixels (diameter 27).
function ballTouchesKeeper(ballX, ballY, keeperX, keeperY) {
    let ballRadius = 13.5;

    // Head: two circles touch when their centers are close enough.
    let headDistance = Math.hypot(ballX - keeperX, ballY - (keeperY - 40));
    if (headDistance <= ballRadius + 14) {
        return true;
    }

    // Body: find the closest point on the goalkeeper's shirt rectangle.
    let nearestX = Math.max(keeperX - 18, Math.min(ballX, keeperX + 18));
    let nearestY = Math.max(keeperY - 25, Math.min(ballY, keeperY + 17));
    if (Math.hypot(ballX - nearestX, ballY - nearestY) <= ballRadius) {
        return true;
    }

    // Arms and legs: check the distance from the ball to each line segment.
    function touchesLimb(x1, y1, x2, y2) {
        let dx = x2 - x1;
        let dy = y2 - y1;
        let progress = ((ballX - x1) * dx + (ballY - y1) * dy) / (dx * dx + dy * dy);

        progress = Math.max(0, Math.min(1, progress));

        let nearX = x1 + dx * progress;
        let nearY = y1 + dy * progress;

        // Limbs are 9 pixels wide in drawKeeper().
        return Math.hypot(ballX - nearX, ballY - nearY) <= ballRadius + 4.5;
    }

    return touchesLimb(keeperX - 14, keeperY - 12, keeperX - 43, keeperY + 2) ||
        touchesLimb(keeperX + 14, keeperY - 12, keeperX + 43, keeperY + 2) ||
        touchesLimb(keeperX - 8, keeperY + 17, keeperX - 15, keeperY + 46) ||
        touchesLimb(keeperX + 8, keeperY + 17, keeperX + 15, keeperY + 46);
}

function jump() {
    if (shotCount === 10) {
        return;
    }

    // Move selects left/right; Angle selects low or high dive.
    // Angle -90 = stay low, +90 = reach the top corners.
    let x = map(move, 0, 100, 180, 570);
    let height = map(angle, -90, 90, 0, 125);

    lastJump = {
        x: x,
        height: height,
        time: Date.now()
    };

    byId("jumpData").textContent = "JUMP!";
}

function shoot() {
    if (shooting || shotCount === 10 || byId("gamePage").classList.contains("hidden")) {
        return;
    }

    shooting = true;
    shotFrame = 0;

    let target = getShotTarget(aim, power);

    currentShot = {
        x: target.x,
        y: target.y,
        aim: aim,
        power: power,
        // Power 0: 62 frames; Power 100: 22 frames.
        frames: Math.round(62 - power * 0.4),
        time: Date.now(),
        saved: false
    };

    byId("shootData").textContent = "SHOOT!";
    byId("resultText").textContent = "Shooting...";
}

function finishShot() {
    shooting = false;
    shotCount++;

    // A miss happens when the landing point is outside the goal.
    let missed = currentShot.x < 175 || currentShot.x > 575;
    missed = missed || currentShot.y < 65 || currentShot.y > 225;

    // A save is recorded only when the ball actually touches the keeper.
    let saved = currentShot.saved;

    if (saved) {
        // Contact always counts as a save, even if the ball was headed wide.
        byId("resultText").textContent = "SAVED!";
    } else if (missed) {
        byId("resultText").textContent = "MISS!";
    } else {
        // Teams take turns: A, B, A, B...
        let player = (shotCount - 1) % 2;
        scores[player]++;
        byId("resultText").textContent = "GOAL! SIUUUU!";
        playGoalSound();
    }

    messageTime = Date.now() + 1300;
    byId("score").textContent = scores[0] + " - " + scores[1];
    byId("shootData").textContent = "READY";
    byId("jumpData").textContent = "READY";
    lastJump = null;

    if (shotCount < 10) {
        byId("shotNumber").textContent = "Penalty " + (shotCount + 1) + " / 10";
    } else {
        byId("shotNumber").textContent = "FULL TIME";
        byId("restartButton").classList.remove("hidden");
        saveMatch();
    }
}

// Play the provided goal sound file. No synthetic voice fallback.
function playGoalSound() {
    let audio = new Audio("assets/siuuu.mp3");

    audio.play().catch(function () {
        console.log("Goal sound not available: add assets/siuuu.mp3.");
    });
}


// =============================================================
// PART 3 / 4 : LEAGUE TABLE
// =============================================================

let matches = [];

try {
    matches = JSON.parse(localStorage.getItem("penaltyMatches")) || [];
} catch (error) {
    matches = [];
}

function saveMatch() {
    matches.push({
        teamA: teamA,
        teamB: teamB,
        goalsA: scores[0],
        goalsB: scores[1]
    });

    try {
        localStorage.setItem("penaltyMatches", JSON.stringify(matches));
    } catch (error) {
        console.log("Could not save the league table.");
    }
}

function showLeague() {
    let table = {};

    function addTeam(name) {
        if (!table[name]) {
            table[name] = { name: name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
        }
    }

    matches.forEach(function (match) {
        addTeam(match.teamA);
        addTeam(match.teamB);

        let a = table[match.teamA];
        let b = table[match.teamB];

        a.p++;
        b.p++;
        a.gf += match.goalsA;
        a.ga += match.goalsB;
        b.gf += match.goalsB;
        b.ga += match.goalsA;

        if (match.goalsA > match.goalsB) {
            a.w++;
            a.pts += 3;
            b.l++;
        } else if (match.goalsA < match.goalsB) {
            b.w++;
            b.pts += 3;
            a.l++;
        } else {
            a.d++;
            b.d++;
            a.pts++;
            b.pts++;
        }
    });

    let teams = Object.values(table);

    teams.sort(function (a, b) {
        return b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga);
    });

    byId("leagueBody").innerHTML = "";

    teams.forEach(function (team) {
        let row = document.createElement("tr");
        let values = [team.name, team.p, team.w, team.d, team.l,
                      team.gf - team.ga, team.pts];

        values.forEach(function (value) {
            let cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        byId("leagueBody").appendChild(row);
    });

    if (teams.length === 0) {
        byId("leagueBody").innerHTML = "<tr><td colspan='7'>No matches yet.</td></tr>";
    }
}


// =============================================================
// PART 4 / 4 : ESP32 + ADAFRUIT IO
// =============================================================

// Today's class uses: new AdafruitIO(username, key) and IO.getData().
let IO = null;
let firstData = true;
let lastShootCount = 0;
let lastJumpCount = 0;
let updateTimer = null;

function updateControlData() {
    byId("aimData").textContent = aim;
    byId("powerData").textContent = power;
    byId("moveData").textContent = move;
    byId("angleData").textContent = angle;

    let target = getShotTarget(aim, power);
    let status = "ON TARGET";

    if (target.x < 175 || target.x > 575) {
        status = "WIDE";
    } else if (target.y < 65) {
        status = "OVER THE BAR";
    } else if (target.y > 225) {
        status = "TOO LOW";
    }

    byId("targetData").textContent = status;
}

function readAdafruit() {
    IO.getData("penalty-controls", function (response) {
        if (!Array.isArray(response.json) || response.json.length === 0) {
            byId("connectionStatus").textContent = "No data in penalty-controls";
            return;
        }

        // One feed value contains: aim,power,move,angle,shootCount,jumpCount
        let data = response.json[0].value.split(",").map(Number);

        if (data.length !== 6 || data.some(Number.isNaN)) {
            byId("connectionStatus").textContent = "Invalid feed data";
            return;
        }

        aim = data[0];
        power = data[1];
        move = data[2];
        angle = data[3];
        updateControlData();
        byId("connectionStatus").textContent = "Connected - data received";

        // Establish a baseline on the first reading.
        if (firstData) {
            lastShootCount = data[4];
            lastJumpCount = data[5];
            firstData = false;
            return;
        }

        // Handle ESP32 restarts (its button counters return to zero).
        if (data[4] < lastShootCount) lastShootCount = data[4];
        if (data[5] < lastJumpCount) lastJumpCount = data[5];

        // Process Jump first if both buttons changed between readings.
        if (data[5] > lastJumpCount) {
            jump();
        }

        if (data[4] > lastShootCount) {
            shoot();
        }

        lastShootCount = data[4];
        lastJumpCount = data[5];
    });
}

byId("connectButton").addEventListener("click", function () {
    let name = byId("userName").value.trim();
    let key = byId("apiKey").value.trim();

    if (!name || !key) {
        byId("connectionStatus").textContent = "Enter username and AIO key";
        return;
    }

    if (typeof AdafruitIO === "undefined") {
        byId("connectionStatus").textContent = "Adafruit IO library did not load";
        return;
    }

    IO = new AdafruitIO(name, key, 1);
    firstData = true;
    byId("connectionStatus").textContent = "Connecting...";

    if (updateTimer) {
        clearInterval(updateTimer);
    }

    readAdafruit();
    updateTimer = setInterval(readAdafruit, 3000);
});

// The four sliders are only for testing without an ESP32.
["Aim", "Power", "Move", "Angle"].forEach(function (name) {
    byId("demo" + name).addEventListener("input", function () {
        if (name === "Aim") aim = Number(this.value);
        if (name === "Power") power = Number(this.value);
        if (name === "Move") move = Number(this.value);
        if (name === "Angle") angle = Number(this.value);
        updateControlData();
    });
});

byId("demoJump").addEventListener("click", jump);
byId("demoShoot").addEventListener("click", shoot);

// Move the mouse over the pitch to aim, then click to shoot.
// On-screen controls work even when there is no ESP32 connected.
function aimWithMouse(event) {
    if (shooting || shotCount === 10 || IO !== null) {
        return;
    }

    let canvas = byId("pitch").querySelector("canvas");

    if (!canvas) {
        return;
    }

    let rectangle = canvas.getBoundingClientRect();
    let x = (event.clientX - rectangle.left) * 750 / rectangle.width;
    let y = (event.clientY - rectangle.top) * 430 / rectangle.height;

    aim = Math.round(constrain(map(x, 135, 615, 0, 180), 0, 180));
    power = Math.round(constrain(map(y, 255, 45, 0, 100), 0, 100));

    byId("demoAim").value = aim;
    byId("demoPower").value = power;
    updateControlData();
}

byId("pitch").addEventListener("mousemove", aimWithMouse);
byId("pitch").addEventListener("click", function (event) {
    aimWithMouse(event);
    shoot();
});

// Keyboard shortcuts: SPACE = shoot, J = jump.
document.addEventListener("keydown", function (event) {
    if (byId("gamePage").classList.contains("hidden")) {
        return;
    }

    // Don't intercept typing in the Adafruit settings.
    if (event.target.tagName === "INPUT" || event.target.tagName === "SELECT") {
        return;
    }

    if (event.code === "Space") {
        event.preventDefault();
        shoot();
    }

    if (event.key.toLowerCase() === "j") {
        jump();
    }
});

updateControlData();
