(function () {
  "use strict";

  // ─── State ───────────────────────────────────────────────────────
  const state = {
    participants: [],
    conferences: [],
    teams: {},

    // Randomized order
    pickOrder: [],      // indices into participants
    confOrder: [],      // indices into conferences

    // Draft tracking
    currentConfIdx: 0,  // index into confOrder
    currentPickIdx: 0,  // index within current conference rotation
    picks: {},          // { "Big Ten": [ {person, team}, ... ], ... }
    takenTeams: {},     // { "Big Ten": Set(["Ohio State"]), ... }
  };

  // ─── DOM refs ────────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  const screens = {
    setup: $("setup-screen"),
    random: $("random-screen"),
    draft: $("draft-screen"),
    transition: $("transition-screen"),
    results: $("results-screen"),
  };

  // ─── Conference & Team Data (from CFSTT.xlsx) ────────────────────
  const CONFERENCE_DATA = {
    "Big Ten": [
      "Ohio State Buckeyes", "Penn State Nittany Lions", "Oregon Ducks", "Michigan Wolverines",
      "USC Trojans", "Washington Huskies", "Iowa Hawkeyes", "Wisconsin Badgers",
      "UCLA Bruins", "Nebraska Cornhuskers", "Illinois Fighting Illini", "Indiana Hoosiers",
      "Maryland Terrapins", "Michigan State Spartans", "Minnesota Golden Gophers",
      "Northwestern Wildcats", "Purdue Boilermakers", "Rutgers Scarlet Knights"
    ],
    "MAC": [
      "Miami (OH) RedHawks", "Toledo Rockets", "Bowling Green Falcons", "Ohio Bobcats",
      "Northern Illinois Huskies", "Central Michigan Chippewas", "Buffalo Bulls",
      "Western Michigan Broncos", "Ball State Cardinals", "Eastern Michigan Eagles",
      "Akron Zips", "Kent State Golden Flashes", "Massachusetts Minutemen"
    ],
    "ACC": [
      "Florida State Seminoles", "Clemson Tigers", "Louisville Cardinals", "Miami Hurricanes",
      "SMU Mustangs", "NC State Wolfpack", "North Carolina Tar Heels",
      "California Golden Bears", "Virginia Tech Hokies", "Duke Blue Devils",
      "Boston College Eagles", "Georgia Tech Yellow Jackets", "Pittsburgh Panthers",
      "Stanford Cardinal", "Syracuse Orange", "Virginia Cavaliers", "Wake Forest Demon Deacons"
    ],
    "Conference USA": [
      "Liberty Flames", "Jacksonville State Gamecocks", "Middle Tennessee Blue Raiders",
      "Western Kentucky Hilltoppers", "UTEP Miners", "Louisiana Tech Bulldogs",
      "New Mexico State Aggies", "Sam Houston Bearkats", "Kennesaw State Owls",
      "Florida International Panthers", "Delaware Blue Hens", "Missouri State Bears"
    ],
    "SEC": [
      "Georgia Bulldogs", "Texas Longhorns", "Alabama Crimson Tide", "Oklahoma Sooners",
      "Tennessee Volunteers", "Missouri Tigers", "LSU Tigers", "Texas A&M Aggies",
      "Ole Miss Rebels", "Auburn Tigers", "Arkansas Razorbacks", "Florida Gators",
      "Kentucky Wildcats", "Mississippi State Bulldogs", "South Carolina Gamecocks",
      "Vanderbilt Commodores"
    ],
    "Mountain West": [
      "Boise State Broncos", "Fresno State Bulldogs", "San Diego State Aztecs",
      "San Jos\u00e9 State Spartans", "UNLV Rebels", "Air Force Falcons",
      "Wyoming Cowboys", "Utah State Aggies", "Colorado State Rams",
      "Hawai\u2018i Rainbow Warriors", "Nevada Wolf Pack", "New Mexico Lobos"
    ],
    "Big 12": [
      "Kansas Jayhawks", "Kansas State Wildcats", "Arizona Wildcats",
      "Oklahoma State Cowboys", "Utah Utes", "Texas Tech Red Raiders",
      "TCU Horned Frogs", "UCF Knights", "West Virginia Mountaineers",
      "Colorado Buffaloes", "Arizona State Sun Devils", "BYU Cougars",
      "Baylor Bears", "Cincinnati Bearcats", "Houston Cougars", "Iowa State Cyclones"
    ],
    "American": [
      "UTSA Roadrunners", "Memphis Tigers", "Tulane Green Wave",
      "Florida Atlantic Owls", "South Florida Bulls", "East Carolina Pirates",
      "Rice Owls", "UAB Blazers", "Tulsa Golden Hurricane", "North Texas Mean Green",
      "Army Black Knights", "Charlotte 49ers", "Navy Midshipmen", "Temple Owls"
    ],
    "Sun Belt": [
      "James Madison Dukes", "App State Mountaineers", "Troy Trojans",
      "Texas State Bobcats", "South Alabama Jaguars", "Marshall Thundering Herd",
      "Georgia State Panthers", "Coastal Carolina Chanticleers",
      "Louisiana Ragin' Cajuns", "Georgia Southern Eagles", "Old Dominion Monarchs",
      "Southern Miss Golden Eagles", "Arkansas State Red Wolves", "UL Monroe Warhawks"
    ],
    "Playoffs": [
      "Pick #1", "Pick #2", "Pick #3", "Pick #4", "Pick #5",
      "Pick #6", "Pick #7", "Pick #8", "Pick #9", "Pick #10"
    ],
  };

  const CONFERENCE_ORDER = [
    "Big Ten", "MAC", "ACC", "Conference USA", "SEC",
    "Mountain West", "Big 12", "American", "Sun Belt", "Playoffs"
  ];

  // ─── Team Abbreviations ──────────────────────────────────────────
  const TEAM_ABBREV = {
    // Big Ten
    "Ohio State Buckeyes": "OSU", "Penn State Nittany Lions": "PSU",
    "Oregon Ducks": "ORE", "Michigan Wolverines": "MICH",
    "USC Trojans": "USC", "Washington Huskies": "WASH",
    "Iowa Hawkeyes": "IOWA", "Wisconsin Badgers": "WIS",
    "UCLA Bruins": "UCLA", "Nebraska Cornhuskers": "NEB",
    "Illinois Fighting Illini": "ILL", "Indiana Hoosiers": "IND",
    "Maryland Terrapins": "MD", "Michigan State Spartans": "MSU",
    "Minnesota Golden Gophers": "MINN", "Northwestern Wildcats": "NW",
    "Purdue Boilermakers": "PUR", "Rutgers Scarlet Knights": "RUT",
    // MAC
    "Miami (OH) RedHawks": "M-OH", "Toledo Rockets": "TOL",
    "Bowling Green Falcons": "BGSU", "Ohio Bobcats": "OHIO",
    "Northern Illinois Huskies": "NIU", "Central Michigan Chippewas": "CMU",
    "Buffalo Bulls": "BUFF", "Western Michigan Broncos": "WMU",
    "Ball State Cardinals": "BALL", "Eastern Michigan Eagles": "EMU",
    "Akron Zips": "AKR", "Kent State Golden Flashes": "KENT",
    "Massachusetts Minutemen": "MASS",
    // ACC
    "Florida State Seminoles": "FSU", "Clemson Tigers": "CLEM",
    "Louisville Cardinals": "LOU", "Miami Hurricanes": "MIA",
    "SMU Mustangs": "SMU", "NC State Wolfpack": "NCST",
    "North Carolina Tar Heels": "UNC", "California Golden Bears": "CAL",
    "Virginia Tech Hokies": "VT", "Duke Blue Devils": "DUKE",
    "Boston College Eagles": "BC", "Georgia Tech Yellow Jackets": "GT",
    "Pittsburgh Panthers": "PITT", "Stanford Cardinal": "STAN",
    "Syracuse Orange": "SYR", "Virginia Cavaliers": "UVA",
    "Wake Forest Demon Deacons": "WAKE",
    // Conference USA
    "Liberty Flames": "LIB", "Jacksonville State Gamecocks": "JVST",
    "Middle Tennessee Blue Raiders": "MTSU", "Western Kentucky Hilltoppers": "WKU",
    "UTEP Miners": "UTEP", "Louisiana Tech Bulldogs": "LATU",
    "New Mexico State Aggies": "NMSU", "Sam Houston Bearkats": "SHSU",
    "Kennesaw State Owls": "KNSU", "Florida International Panthers": "FIU",
    "Delaware Blue Hens": "DEL", "Missouri State Bears": "MOST",
    // SEC
    "Georgia Bulldogs": "UGA", "Texas Longhorns": "TEX",
    "Alabama Crimson Tide": "BAMA", "Oklahoma Sooners": "OU",
    "Tennessee Volunteers": "TENN", "Missouri Tigers": "MIZZ",
    "LSU Tigers": "LSU", "Texas A&M Aggies": "TAMU",
    "Ole Miss Rebels": "MISS", "Auburn Tigers": "AUB",
    "Arkansas Razorbacks": "ARK", "Florida Gators": "UF",
    "Kentucky Wildcats": "UK", "Mississippi State Bulldogs": "MSST",
    "South Carolina Gamecocks": "SCAR", "Vanderbilt Commodores": "VAND",
    // Mountain West
    "Boise State Broncos": "BSU", "Fresno State Bulldogs": "FRES",
    "San Diego State Aztecs": "SDSU", "San Jos\u00e9 State Spartans": "SJSU",
    "UNLV Rebels": "UNLV", "Air Force Falcons": "AFA",
    "Wyoming Cowboys": "WYO", "Utah State Aggies": "USU",
    "Colorado State Rams": "CSU", "Hawai\u2018i Rainbow Warriors": "HAW",
    "Nevada Wolf Pack": "NEV", "New Mexico Lobos": "UNM",
    // Big 12
    "Kansas Jayhawks": "KU", "Kansas State Wildcats": "KSU",
    "Arizona Wildcats": "ARIZ", "Oklahoma State Cowboys": "OKST",
    "Utah Utes": "UTAH", "Texas Tech Red Raiders": "TTU",
    "TCU Horned Frogs": "TCU", "UCF Knights": "UCF",
    "West Virginia Mountaineers": "WVU", "Colorado Buffaloes": "COLO",
    "Arizona State Sun Devils": "ASU", "BYU Cougars": "BYU",
    "Baylor Bears": "BAY", "Cincinnati Bearcats": "CIN",
    "Houston Cougars": "HOU", "Iowa State Cyclones": "ISU",
    // American
    "UTSA Roadrunners": "UTSA", "Memphis Tigers": "MEM",
    "Tulane Green Wave": "TUL", "Florida Atlantic Owls": "FAU",
    "South Florida Bulls": "USF", "East Carolina Pirates": "ECU",
    "Rice Owls": "RICE", "UAB Blazers": "UAB",
    "Tulsa Golden Hurricane": "TLSA", "North Texas Mean Green": "UNT",
    "Army Black Knights": "ARMY", "Charlotte 49ers": "CHAR",
    "Navy Midshipmen": "NAVY", "Temple Owls": "TEM",
    // Sun Belt
    "James Madison Dukes": "JMU", "App State Mountaineers": "APP",
    "Troy Trojans": "TROY", "Texas State Bobcats": "TXST",
    "South Alabama Jaguars": "USA", "Marshall Thundering Herd": "MRSH",
    "Georgia State Panthers": "GAST", "Coastal Carolina Chanticleers": "CCU",
    "Louisiana Ragin' Cajuns": "ULL", "Georgia Southern Eagles": "GASO",
    "Old Dominion Monarchs": "ODU", "Southern Miss Golden Eagles": "SMIS",
    "Arkansas State Red Wolves": "ARST", "UL Monroe Warhawks": "ULM",
    // Playoffs
    "Pick #1": "#1", "Pick #2": "#2", "Pick #3": "#3", "Pick #4": "#4",
    "Pick #5": "#5", "Pick #6": "#6", "Pick #7": "#7", "Pick #8": "#8",
    "Pick #9": "#9", "Pick #10": "#10",
  };

  function abbrev(teamName) {
    return TEAM_ABBREV[teamName] || teamName;
  }

  // ─── Draft Board Rendering ─────────────────────────────────────
  function renderDraftBoard() {
    const board = $("draft-board");
    // Conference column headers (only conferences drafted so far + current)
    const visibleConfs = [];
    for (let i = 0; i <= state.currentConfIdx && i < state.confOrder.length; i++) {
      visibleConfs.push(state.confOrder[i]);
    }

    // Short conference labels
    const confLabel = {
      "Big Ten": "B1G", "MAC": "MAC", "ACC": "ACC",
      "Conference USA": "CUSA", "SEC": "SEC", "Mountain West": "MWC",
      "Big 12": "B12", "American": "AAC", "Sun Belt": "SBC", "Playoffs": "PLY"
    };

    let html = '<table class="board-table"><thead><tr><th class="board-name-col"></th>';
    visibleConfs.forEach((ci) => {
      const conf = state.conferences[ci];
      const isCurrent = ci === state.confOrder[state.currentConfIdx];
      html += `<th class="${isCurrent ? "board-active-conf" : ""}">${confLabel[conf] || conf}</th>`;
    });
    html += "</tr></thead><tbody>";

    state.pickOrder.forEach((pi) => {
      const person = state.participants[pi];
      html += `<tr><td class="board-name-col">${person}</td>`;
      visibleConfs.forEach((ci) => {
        const conf = state.conferences[ci];
        const pick = state.picks[conf].find((p) => p.person === person);
        const isCurrent = ci === state.confOrder[state.currentConfIdx];
        const cellClass = pick ? "board-filled" : (isCurrent ? "board-pending" : "");
        const title = pick ? pick.team : "";
        const display = pick ? abbrev(pick.team) : "";
        html += `<td class="${cellClass}" title="${title}">${display}</td>`;
      });
      html += "</tr>";
    });

    html += "</tbody></table>";
    board.innerHTML = html;
  }

  // ─── Helpers ─────────────────────────────────────────────────────
  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
    window.scrollTo(0, 0);
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /**
   * For conference at position `confPos` (0-based), the pick order rotates
   * so that the person at position `confPos % numPeople` picks first.
   */
  function getRotatedOrder(confPos) {
    const n = state.pickOrder.length;
    const offset = confPos % n;
    return [...state.pickOrder.slice(offset), ...state.pickOrder.slice(0, offset)];
  }

  // ─── Read Names from Form ─────────────────────────────────────────
  function readNamesFromForm() {
    const inputs = document.querySelectorAll(".name-input");
    const errorEl = $("name-error");
    const names = [];

    inputs.forEach((input) => input.classList.remove("error"));
    errorEl.classList.add("hidden");

    let hasEmpty = false;
    inputs.forEach((input) => {
      const val = input.value.trim();
      if (!val) {
        input.classList.add("error");
        hasEmpty = true;
      }
      names.push(val);
    });

    if (hasEmpty) {
      errorEl.textContent = "All 10 participant names are required.";
      errorEl.classList.remove("hidden");
      return null;
    }

    const unique = new Set(names.map((n) => n.toLowerCase()));
    if (unique.size !== names.length) {
      errorEl.textContent = "Each participant must have a unique name.";
      errorEl.classList.remove("hidden");
      return null;
    }

    return names;
  }

  // ─── Start Draft (Randomize) ────────────────────────────────────
  $("start-draft-btn").addEventListener("click", () => {
    const names = readNamesFromForm();
    if (!names) return;

    // Load participants and hardcoded conference data
    state.participants = names;
    state.conferences = CONFERENCE_ORDER;
    state.teams = {};
    CONFERENCE_ORDER.forEach((c) => {
      state.teams[c] = [...CONFERENCE_DATA[c]];
    });

    // Randomize person order
    const peopleIndices = state.participants.map((_, i) => i);
    state.pickOrder = shuffle(peopleIndices);

    // Randomize conference order, but Big Ten is always first
    const b1gIdx = state.conferences.indexOf("Big Ten");
    const otherConfIndices = state.conferences
      .map((_, i) => i)
      .filter((i) => i !== b1gIdx);
    state.confOrder = [b1gIdx, ...shuffle(otherConfIndices)];

    // Initialize picks and taken tracking
    state.conferences.forEach((c) => {
      state.picks[c] = [];
      state.takenTeams[c] = new Set();
    });

    state.currentConfIdx = 0;
    state.currentPickIdx = 0;

    // Show randomization
    const pList = $("random-people-list");
    pList.innerHTML = state.pickOrder
      .map((i) => `<li>${state.participants[i]}</li>`)
      .join("");

    const cList = $("random-conf-list");
    cList.innerHTML = state.confOrder
      .map((i) => `<li>${state.conferences[i]}</li>`)
      .join("");

    showScreen("random");
  });

  // ─── Begin Draft ─────────────────────────────────────────────────
  $("begin-draft-btn").addEventListener("click", () => {
    renderDraft();
    showScreen("draft");
  });

  // ─── Simulate Draft ────────────────────────────────────────────
  $("simulate-draft-btn").addEventListener("click", () => {
    // Auto-pick randomly for every conference and every person
    state.confOrder.forEach((ci, confPos) => {
      const conf = state.conferences[ci];
      const rotated = getRotatedOrder(confPos);
      const available = [...state.teams[conf]];

      rotated.forEach((pi) => {
        const person = state.participants[pi];
        const idx = Math.floor(Math.random() * available.length);
        const team = available.splice(idx, 1)[0];
        state.picks[conf].push({ person, team });
        state.takenTeams[conf].add(team);
      });
    });

    state.currentConfIdx = state.confOrder.length;
    state.currentPickIdx = 0;

    showResults();
    showScreen("results");
  });

  // ─── Draft Rendering ────────────────────────────────────────────
  function renderDraft() {
    const confIdx = state.confOrder[state.currentConfIdx];
    const confName = state.conferences[confIdx];
    const rotated = getRotatedOrder(state.currentConfIdx);
    const pickerIdx = rotated[state.currentPickIdx];
    const pickerName = state.participants[pickerIdx];

    // Header
    $("draft-conference-name").textContent = confName;
    const totalConfs = state.confOrder.length;
    $("draft-progress-text").textContent =
      `Conference ${state.currentConfIdx + 1} of ${totalConfs}`;
    $("progress-fill").style.width =
      `${((state.currentConfIdx * state.participants.length + state.currentPickIdx) /
        (totalConfs * state.participants.length)) * 100}%`;

    // Pick info
    $("current-picker-name").textContent = pickerName;
    $("pick-number").textContent = `#${state.currentPickIdx + 1}`;
    $("pick-total").textContent = state.participants.length;

    // Teams grid
    const teams = state.teams[confName];
    const taken = state.takenTeams[confName];
    const grid = $("teams-grid");
    grid.innerHTML = teams
      .map((t) => {
        const isTaken = taken.has(t);
        return `<div class="team-card${isTaken ? " taken" : ""}" data-team="${t}">${t}</div>`;
      })
      .join("");

    // Click handlers
    grid.querySelectorAll(".team-card:not(.taken)").forEach((card) => {
      card.addEventListener("click", () => {
        confirmPick(pickerName, card.dataset.team, confName);
      });
    });

    // Sidebar: picks for this conference
    renderConferencePicks(confName, rotated);

    // Draft board at top
    renderDraftBoard();
  }

  function renderConferencePicks(confName, rotated) {
    const list = $("conference-picks");
    list.innerHTML = rotated
      .map((pIdx, i) => {
        const person = state.participants[pIdx];
        const pick = state.picks[confName].find((p) => p.person === person);
        if (pick) {
          return `<li><span class="pick-person">${person}</span><span class="pick-team">${pick.team}</span></li>`;
        } else if (i === state.currentPickIdx) {
          return `<li><span class="pick-person">${person}</span><span class="pick-pending">Picking...</span></li>`;
        } else {
          return `<li><span class="pick-person">${person}</span><span class="pick-pending">-</span></li>`;
        }
      })
      .join("");
  }

  // ─── Confirm Pick Modal ──────────────────────────────────────────
  function confirmPick(person, team, conference) {
    $("confirm-title").textContent = "Confirm Pick";
    $("confirm-message").innerHTML =
      `<strong>${person}</strong> selects <strong>${team}</strong> from the <strong>${conference}</strong>?`;

    const modal = $("confirm-modal");
    modal.classList.remove("hidden");

    const okBtn = $("confirm-ok");
    const cancelBtn = $("confirm-cancel");

    function cleanup() {
      modal.classList.add("hidden");
      okBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
    }

    function onConfirm() {
      cleanup();
      makePick(person, team, conference);
    }

    function onCancel() {
      cleanup();
    }

    okBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
  }

  function makePick(person, team, conference) {
    state.picks[conference].push({ person, team });
    state.takenTeams[conference].add(team);

    state.currentPickIdx++;

    if (state.currentPickIdx >= state.participants.length) {
      // Conference is done
      showTransition(conference);
    } else {
      renderDraft();
    }
  }

  // ─── Conference Transition ───────────────────────────────────────
  function showTransition(conference) {
    $("transition-complete-text").textContent = `${conference} Complete!`;

    const picksDiv = $("transition-picks");
    picksDiv.innerHTML = state.picks[conference]
      .map(
        (p) =>
          `<div class="pick-row"><span class="name">${p.person}</span><span class="team">${p.team}</span></div>`
      )
      .join("");

    state.currentConfIdx++;
    state.currentPickIdx = 0;

    if (state.currentConfIdx >= state.confOrder.length) {
      // Draft complete
      $("transition-next-text").textContent = "Draft Complete!";
      $("next-conference-btn").textContent = "View Results";
      $("next-conference-btn").onclick = () => {
        showResults();
        showScreen("results");
      };
    } else {
      const nextConf = state.conferences[state.confOrder[state.currentConfIdx]];
      $("transition-next-text").textContent = `Next Up: ${nextConf}`;
      $("next-conference-btn").textContent = "Start Next Conference";
      $("next-conference-btn").onclick = () => {
        renderDraft();
        showScreen("draft");
      };
    }

    showScreen("transition");
  }

  // ─── Results ─────────────────────────────────────────────────────
  function showResults() {
    const container = $("results-table-container");

    // Build table: rows = participants in pick order, cols = conferences in conf order
    let html = '<table class="results-table"><thead><tr><th>Pick #</th><th>Participant</th>';
    state.confOrder.forEach((ci) => {
      html += `<th>${state.conferences[ci]}</th>`;
    });
    html += "</tr></thead><tbody>";

    state.pickOrder.forEach((pi, rank) => {
      const person = state.participants[pi];
      html += `<tr><td>${rank + 1}</td><td>${person}</td>`;
      state.confOrder.forEach((ci) => {
        const conf = state.conferences[ci];
        const pick = state.picks[conf].find((p) => p.person === person);
        html += `<td>${pick ? pick.team : "-"}</td>`;
      });
      html += "</tr>";
    });

    html += "</tbody></table>";
    container.innerHTML = html;
  }

  // ─── Export ──────────────────────────────────────────────────────
  $("export-btn").addEventListener("click", () => {
    const rows = [];
    const header = ["Pick #", "Participant"];
    state.confOrder.forEach((ci) => header.push(state.conferences[ci]));
    rows.push(header);

    state.pickOrder.forEach((pi, rank) => {
      const person = state.participants[pi];
      const row = [rank + 1, person];
      state.confOrder.forEach((ci) => {
        const conf = state.conferences[ci];
        const pick = state.picks[conf].find((p) => p.person === person);
        row.push(pick ? pick.team : "");
      });
      rows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Draft Results");
    XLSX.utils.book_append_sheet(wb, buildPickOrderSheet(), "Pick Details");
    XLSX.writeFile(wb, "draft_results.xlsx");
  });

  function buildPickOrderSheet() {
    const rows = [["Conference", "Pick #", "Participant", "Team"]];
    state.confOrder.forEach((ci, confPos) => {
      const conf = state.conferences[ci];
      const rotated = getRotatedOrder(confPos);
      rotated.forEach((pi, pickIdx) => {
        const person = state.participants[pi];
        const pick = state.picks[conf].find((p) => p.person === person);
        rows.push([conf, pickIdx + 1, person, pick ? pick.team : ""]);
      });
    });
    return XLSX.utils.aoa_to_sheet(rows);
  }

  // ─── New Draft ───────────────────────────────────────────────────
  $("new-draft-btn").addEventListener("click", () => {
    state.participants = [];
    state.conferences = [];
    state.teams = {};
    state.pickOrder = [];
    state.confOrder = [];
    state.currentConfIdx = 0;
    state.currentPickIdx = 0;
    state.picks = {};
    state.takenTeams = {};

    document.querySelectorAll(".name-input").forEach((input) => {
      input.classList.remove("error");
    });
    $("name-error").classList.add("hidden");

    showScreen("setup");
  });
})();
