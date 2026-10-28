// PENALTY MIND GAMES
// This file controls the three pages, the match, and the Arduino.

// 1. BASIC DATA ------------------------------------------------------

const clubs = {
    'Liverpool': 364,
    'Arsenal': 359,
    'Tottenham': 367,
    'Manchester United': 360,
    'Manchester City': 382,
    'Chelsea': 363,
    'Newcastle United': 361,
    'Real Madrid': 86,
    'Barcelona': 83,
    'Bayern Munich': 132,
    'PSG': 160,
    'Inter Milan': 110,
    'AC Milan': 103,
    'Juventus': 111,
    'Borussia Dortmund': 124
};

const saveKey = 'penaltyMindGames:standings:v3';
const clubNames = Object.keys(clubs);
const shotLimit = 10;

let teamA = 'Liverpool';
let teamB = 'Arsenal';
let goals = [0, 0];
let shots = 0;
let shooting = false;
let matchSaved = false;
let shotVersion = 0;
let jumpedRecently = false;
let jumpedDuringShot = false;
let jumpPosition = 50;
let jumpAngle = 0;
let jumpTime = 0;
let soundEnabled = true;
let results = [];

// The four values represent the Arduino potentiometers.
let controls = {
    aim: 90,
    power: 50,
    move: 50,
    angle: 0
};

// Short helper: find an HTML element by its id.
function get(id) {
    return document.querySelector('#' + id);
}

// Remember previously played matches (if any).
try {
    const oldData = JSON.parse(localStorage.getItem(saveKey));
    if (oldData && Array.isArray(oldData.matches)) {
        results = oldData.matches;
    }
} catch (error) {
    results = [];
}

// 2. PAGE NAVIGATION -------------------------------------------------

function showPage(pageId) {
    get('startPage').classList.add('hidden');
    get('matchPage').classList.add('hidden');
    get('leaguePage').classList.add('hidden');

    get(pageId).classList.remove('hidden');

    if (pageId === 'leaguePage') {
        showLeague();
    }

    window.scrollTo(0, 0);
}

// 3. TEAM BADGES AND TEAM SELECTION ---------------------------------

function makeBadge(name) {
    const badge = document.createElement('span');
    badge.className = 'club-badge';

    const initials = document.createElement('span');
    initials.className = 'initials';
    initials.textContent = name.slice(0, 3).toUpperCase();
    badge.appendChild(initials);

    // If the logo is unavailable, the initials remain visible.
    if (clubs[name]) {
        const image = document.createElement('img');
        image.src = 'https://a.espncdn.com/i/teamlogos/soccer/500/' + clubs[name] + '.png';
        image.alt = name + ' crest';
        image.onload = function () {
            badge.classList.add('loaded');
        };
        badge.appendChild(image);
    }

    return badge;
}

function updateTeamPicker(player) {
    const select = get('team' + player);
    const custom = get('custom' + player);
    const chosenBadge = get('chosenBadge' + player);

    custom.classList.toggle('hidden', select.value !== 'Custom team');

    const name = select.value === 'Custom team' ? custom.value.trim() : select.value;
    chosenBadge.replaceChildren(makeBadge(name || 'Custom'));

    const buttons = get('badges' + player).querySelectorAll('button');
    buttons.forEach(function (button) {
        button.classList.toggle('selected', button.title === select.value);
    });
}

function setupTeamPicker(player) {
    const select = get('team' + player);
    const badgeGrid = get('badges' + player);

    clubNames.forEach(function (name) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);

        const button = document.createElement('button');
        button.className = 'badge-choice';
        button.title = name;
        button.setAttribute('aria-label', 'Choose ' + name);
        button.appendChild(makeBadge(name));

        button.addEventListener('click', function () {
            select.value = name;
            updateTeamPicker(player);
        });

        badgeGrid.appendChild(button);
    });

    const customOption = document.createElement('option');
    customOption.value = 'Custom team';
    customOption.textContent = 'Custom team';
    select.appendChild(customOption);

    select.value = player === 'A' ? 'Liverpool' : 'Arsenal';
    select.addEventListener('change', function () {
        updateTeamPicker(player);
    });

    get('custom' + player).addEventListener('input', function () {
        updateTeamPicker(player);
    });

    updateTeamPicker(player);
}

function selectedName(player) {
    const select = get('team' + player);
    let value = select.value;

    if (value === 'Custom team') {
        value = get('custom' + player).value;
    }

    return value.trim().replace(/\s+/g, ' ').slice(0, 28);
}

function startMatch() {
    const a = selectedName('A');
    const b = selectedName('B');

    if (!a || !b || a.toLowerCase() === b.toLowerCase()) {
        get('teamMessage').textContent = 'Please choose two different team names.';
        return;
    }

    teamA = a;
    teamB = b;

    get('matchNameA').textContent = teamA;
    get('matchNameB').textContent = teamB;
    get('matchBadgeA').replaceChildren(makeBadge(teamA));
    get('matchBadgeB').replaceChildren(makeBadge(teamB));

    resetMatch();
    showPage('matchPage');

    // Short introduction before the shootout begins.
    get('introA').textContent = teamA;
    get('introB').textContent = teamB;
    get('intro').classList.remove('hidden');
    setTimeout(function () {
        get('intro').classList.add('hidden');
    }, 1600);
}

// 4. MATCH CONTROLS --------------------------------------------------

function updateControls() {
    controls.aim = Number(get('aim').value);
    controls.power = Number(get('power').value);
    controls.move = Number(get('move').value);
    controls.angle = Number(get('angle').value);

    get('aimValue').textContent = controls.aim + '°';
    get('powerValue').textContent = controls.power + '%';
    get('moveValue').textContent = controls.move + '%';
    get('angleValue').textContent = controls.angle + '°';

    // The goalkeeper stays inside the goal area.
    get('keeper').style.left = controls.move + '%';
}

function resetBall() {
    const ball = get('ball');
    ball.style.transition = 'none';
    ball.style.left = '50%';
    ball.style.bottom = '7%';
    ball.classList.remove('kicked');

    // Allow the next kick to use the CSS transition again.
    void ball.offsetWidth;
    ball.style.transition = '';
}

function resetMatch() {
    // Ignore any unfinished shot from the previous match.
    shotVersion++;
    goals = [0, 0];
    shots = 0;
    shooting = false;
    matchSaved = false;
    jumpedRecently = false;
    jumpedDuringShot = false;

    get('goalEffect').classList.add('hidden');
    get('standingsResultBtn').classList.add('hidden');
    get('shotHistory').textContent = 'Five penalties per team.';
    get('resultTitle').textContent = 'READY FOR KICKOFF';
    get('resultDetail').textContent = 'Use the controls to aim, then press SHOOT.';

    resetBall();
    updateScore();
}

function updateScore() {
    get('scoreA').textContent = goals[0];
    get('scoreB').textContent = goals[1];
    get('shotCount').textContent = 'SHOT ' + shots + ' / ' + shotLimit;

    if (shots === shotLimit) {
        get('turnText').textContent = 'FULL TIME';
    } else {
        get('turnText').textContent = 'NEXT: ' + (shots % 2 === 0 ? teamA : teamB);
    }
}

function jump() {
    if (shots === shotLimit && !shooting) {
        return;
    }

    jumpTime = Date.now();
    jumpedRecently = true;
    jumpPosition = controls.move;
    jumpAngle = controls.angle;

    if (shooting) {
        jumpedDuringShot = true;
    }

    const keeper = get('keeper');
    keeper.style.setProperty('--dive', controls.angle / 3 + 'deg');
    keeper.classList.add('jumping');

    setTimeout(function () {
        keeper.classList.remove('jumping');
        jumpedRecently = false;
    }, 650);
}

function shoot() {
    if (shooting || shots >= shotLimit) {
        return;
    }

    shooting = true;
    shotVersion++;
    const thisShot = shotVersion;
    const shooter = shots % 2;
    const shotAim = controls.aim;
    const shotPower = controls.power;

    // A goalkeeper who jumped just before the shot can still make a save.
    jumpedDuringShot = jumpedRecently && Date.now() - jumpTime < 350;

    get('resultTitle').textContent = 'SHOT IN PROGRESS...';
    get('resultDetail').textContent = (shooter === 0 ? teamA : teamB) + ' takes the penalty.';
    get('goalEffect').classList.add('hidden');

    resetBall();
    const ball = get('ball');

    // Aim determines horizontal position; power determines height.
    setTimeout(function () {
        ball.classList.add('kicked');
        ball.style.left = (5 + shotAim / 180 * 90) + '%';
        ball.style.bottom = (32 + shotPower / 100 * 55) + '%';
    }, 25);

    // Wait for the animation, then decide if it was a goal or save.
    setTimeout(function () {
        if (thisShot === shotVersion) {
            finishShot(shooter, shotAim, shotPower);
        }
    }, 800);
}

function finishShot(shooter, aim, power) {
    // 1. Extreme angles / power miss the target.
    const badAim = aim < 28 || aim > 152;
    const badPower = power < 20 || power > 92;
    const missed = badAim || badPower;

    // 2. The keeper can save if they jumped toward the ball in time.
    const shotX = 5 + aim / 180 * 90;
    const keeperX = 19 + jumpPosition / 100 * 62;
    const difference = shotX - keeperX;
    const keeperIsClose = Math.abs(difference) < 7;
    const keeperDivesLeft = difference < 0 && jumpAngle < -15;
    const keeperDivesRight = difference > 0 && jumpAngle > 15;
    const diveMatches = keeperIsClose || keeperDivesLeft || keeperDivesRight;

    const saved = !missed &&
        jumpedDuringShot &&
        Math.abs(difference) < 18 &&
        diveMatches;

    let result = 'GOAL';

    if (missed) {
        result = 'MISS';
    } else if (saved) {
        result = 'SAVE';
    } else {
        goals[shooter]++;
        playSiu();
    }

    shots++;
    jumpedDuringShot = false;

    get('resultTitle').textContent = result + '!';
    if (result === 'GOAL') {
        get('resultDetail').textContent = 'What a finish! SIUUUUUU!';
    } else if (result === 'SAVE') {
        get('resultDetail').textContent = 'The goalkeeper stops it!';
    } else {
        get('resultDetail').textContent = 'The ball missed the target.';
    }

    get('shotHistory').textContent = (shooter === 0 ? teamA : teamB) +
        ' · ' + result + ' · Score: ' + goals[0] + ' - ' + goals[1];

    if (result === 'GOAL') {
        const effect = get('goalEffect');
        effect.classList.remove('hidden');
        setTimeout(function () {
            effect.classList.add('hidden');
        }, 1350);
    }

    updateScore();

    if (shots === shotLimit) {
        finishMatch();
    }

    // Reset the ball before another shot can begin.
    const thisShot = shotVersion;
    setTimeout(function () {
        if (thisShot !== shotVersion) {
            return;
        }
        resetBall();
        shooting = false;
    }, 550);
}

// 5. GOAL SOUND ------------------------------------------------------

// You can also replace this URL with a local file: assets/siuuu.mp3
const siuAudio = new Audio(
    'https://tiengdong.com/wp-content/uploads/am-thanh-siuuu-www_tiengdong_com.mp3'
);

function playSiu() {
    if (!soundEnabled) {
        return;
    }

    siuAudio.pause();
    siuAudio.currentTime = 0;

    // Use speech as a fallback if the external sound is unavailable.
    siuAudio.play().catch(function () {
        if ('speechSynthesis' in window) {
            const voice = new SpeechSynthesisUtterance('Siuuuuu!');
            voice.lang = 'en-US';
            voice.rate = 0.75;
            window.speechSynthesis.speak(voice);
        }
    });
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    get('soundBtn').textContent = soundEnabled ? '🔊 Sound On' : '🔇 Sound Off';

    if (!soundEnabled) {
        siuAudio.pause();
        if ('speechSynthesis' in window) {
            speechSynthesis.cancel();
        }
    }
}

// 6. LEAGUE TABLE ----------------------------------------------------

function finishMatch() {
    let winner = 'Draw';

    if (goals[0] > goals[1]) {
        winner = teamA + ' wins!';
    } else if (goals[1] > goals[0]) {
        winner = teamB + ' wins!';
    }

    get('resultTitle').textContent = 'FULL TIME · ' + winner;
    get('standingsResultBtn').classList.remove('hidden');

    if (matchSaved) {
        return;
    }
    matchSaved = true;

    results.push({
        a: teamA,
        b: teamB,
        goalsA: goals[0],
        goalsB: goals[1],
        date: new Date().toISOString()
    });

    try {
        localStorage.setItem(saveKey, JSON.stringify({ matches: results }));
    } catch (error) {
        get('resultDetail').textContent = 'Match ended. Browser storage is unavailable.';
    }
}

function calculateTable() {
    const table = {};

    results.forEach(function (match) {
        [match.a, match.b].forEach(function (name) {
            if (!table[name]) {
                table[name] = {
                    name: name,
                    p: 0,
                    w: 0,
                    d: 0,
                    l: 0,
                    gf: 0,
                    ga: 0,
                    pts: 0
                };
            }
        });

        const a = table[match.a];
        const b = table[match.b];

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
        } else if (match.goalsB > match.goalsA) {
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

    return Object.values(table).sort(function (a, b) {
        return b.pts - a.pts ||
            (b.gf - b.ga) - (a.gf - a.ga) ||
            b.gf - a.gf;
    });
}

function showLeague() {
    const teams = calculateTable();
    const rows = get('leagueRows');
    rows.replaceChildren();

    get('clubTotal').textContent = teams.length;
    get('matchTotal').textContent = results.length;
    get('goalTotal').textContent = results.reduce(function (sum, match) {
        return sum + match.goalsA + match.goalsB;
    }, 0);

    teams.forEach(function (team, index) {
        const row = document.createElement('tr');
        const values = [
            index + 1,
            team.name,
            team.p,
            team.w,
            team.d,
            team.l,
            team.gf,
            team.ga,
            team.gf - team.ga,
            team.pts
        ];

        values.forEach(function (value, i) {
            const cell = document.createElement('td');

            if (i === 1) {
                const club = document.createElement('div');
                club.className = 'club-cell';
                const image = document.createElement('span');
                image.className = 'table-badge';
                image.appendChild(makeBadge(team.name));
                club.appendChild(image);
                club.appendChild(document.createTextNode(team.name));
                cell.appendChild(club);
            } else {
                cell.textContent = value;
            }

            row.appendChild(cell);
        });

        rows.appendChild(row);
    });

    const history = get('recentMatches');
    history.replaceChildren();

    results.slice(-10).reverse().forEach(function (match) {
        const item = document.createElement('div');
        item.className = 'history-item';

        const badgeA = document.createElement('span');
        badgeA.className = 'table-badge';
        badgeA.appendChild(makeBadge(match.a));

        const badgeB = document.createElement('span');
        badgeB.className = 'table-badge';
        badgeB.appendChild(makeBadge(match.b));

        const score = match.a + ' ' + match.goalsA +
            ' - ' + match.goalsB + ' ' + match.b;

        item.append(badgeA, score, badgeB);
        history.appendChild(item);
    });

    if (results.length === 0) {
        history.textContent = 'No matches played yet.';
    }
}

function downloadCSV() {
    const header = 'Club,Played,Wins,Draws,Losses,GF,GA,Points';
    const lines = calculateTable().map(function (team) {
        const name = '"' + team.name.replace(/"/g, '""') + '"';
        return [name, team.p, team.w, team.d, team.l, team.gf, team.ga, team.pts].join(',');
    });

    const csv = [header, ...lines].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = 'penalty-league.csv';
    link.click();
    URL.revokeObjectURL(link.href);
}

// 7. ARDUINO CONNECTION ----------------------------------------------

// Expected data line: AIM,POWER,MOVE,ANGLE,SHOOT,JUMP
// Example: 90,50,50,0,0,0
// A four-value line is also accepted, but physical buttons need six values.
let serialPort = null;
let serialReader = null;
let lastShootButton = 0;
let lastJumpButton = 0;

function readArduinoLine(line) {
    const data = line.trim().split(',').map(Number);

    if (data.length !== 4 && data.length !== 6) {
        return;
    }
    const hasInvalidNumber = data.some(function (number) {
        return !Number.isFinite(number);
    });

    if (hasInvalidNumber) {
        return;
    }

    const [aim, power, move, angle] = data;

    const invalidAim = aim < 0 || aim > 180;
    const invalidPower = power < 0 || power > 100;
    const invalidMove = move < 0 || move > 100;
    const invalidAngle = angle < -90 || angle > 90;

    if (invalidAim || invalidPower || invalidMove || invalidAngle) {
        return;
    }

    get('aim').value = aim;
    get('power').value = power;
    get('move').value = move;
    get('angle').value = angle;
    updateControls();

    get('serialData').textContent = 'Data: ' + data.join(',');
    get('connectionStatus').textContent = 'Arduino connected · Receiving data';

    if (data.length === 6) {
        const shootButton = data[4];
        const jumpButton = data[5];

        // Only react when a button changes from 0 to 1.
        if (shootButton === 1 && lastShootButton === 0) {
            shoot();
        }

        if (jumpButton === 1 && lastJumpButton === 0) {
            jump();
        }

        lastShootButton = shootButton;
        lastJumpButton = jumpButton;
    }
}

async function connectArduino() {
    if (serialPort) {
        if (serialReader) {
            await serialReader.cancel();
        }
        return;
    }

    if (!('serial' in navigator)) {
        get('connectionStatus').textContent = 'Use Chrome or Edge with Live Server for Arduino.';
        return;
    }

    let port = null;

    try {
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
        serialPort = port;

        get('connectBtn').textContent = 'Disconnect Arduino';
        get('connectionStatus').textContent = 'Connected · Waiting for data';

        const decoder = new TextDecoder();
        let buffer = '';
        serialReader = port.readable.getReader();

        while (true) {
            const packet = await serialReader.read();
            if (packet.done) {
                break;
            }

            buffer += decoder.decode(packet.value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop();

            lines.forEach(readArduinoLine);
        }
    } catch (error) {
        if (error.name !== 'NotFoundError') {
            get('connectionStatus').textContent = 'Connection error: ' + error.message;
        }
    } finally {
        if (serialReader) {
            serialReader.releaseLock();
            serialReader = null;
        }

        if (port) {
            try {
                await port.close();
            } catch (error) {
                // Port already closed.
            }
        }

        serialPort = null;
        get('connectBtn').textContent = 'Connect Arduino';
        if (!get('connectionStatus').textContent.startsWith('Connection error')) {
            get('connectionStatus').textContent = 'Not connected · Demo controls available';
        }
    }
}

// 8. BUTTONS AND STARTUP --------------------------------------------

setupTeamPicker('A');
setupTeamPicker('B');
updateControls();
updateScore();

get('startBtn').addEventListener('click', startMatch);
get('resetBtn').addEventListener('click', resetMatch);
get('shootBtn').addEventListener('click', shoot);
get('jumpBtn').addEventListener('click', jump);
get('connectBtn').addEventListener('click', connectArduino);
get('soundBtn').addEventListener('click', toggleSound);
get('testSoundBtn').addEventListener('click', playSiu);
get('exportBtn').addEventListener('click', downloadCSV);

get('homeLeagueBtn').addEventListener('click', function () {
    showPage('leaguePage');
});

get('matchLeagueBtn').addEventListener('click', function () {
    showPage('leaguePage');
});

get('standingsResultBtn').addEventListener('click', function () {
    showPage('leaguePage');
});

get('backToTeamsBtn').addEventListener('click', function () {
    showPage('startPage');
});

get('leagueHomeBtn').addEventListener('click', function () {
    showPage('startPage');
});

get('newGameBtn').addEventListener('click', function () {
    showPage('startPage');
});

get('clearBtn').addEventListener('click', function () {
    if (!confirm('Delete all saved match results?')) {
        return;
    }
    results = [];
    localStorage.removeItem(saveKey);
    showLeague();
});

['aim', 'power', 'move', 'angle'].forEach(function (id) {
    get(id).addEventListener('input', updateControls);
});
