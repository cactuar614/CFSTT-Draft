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
    "B1G": ["OSU", "PSU", "Oregon", "Iowa", "SCUM", "USC", "Illinois", "Indiana", "Nebraska", "Washington"],
    "MAC": ["Akron", "Toledo", "Buffalo", "Miami", "BGSU", "OU", "NIU", "Central Mich", "Eastern Mich", "Western Mich"],
    "ACC": ["Duke", "Pitt", "Clemson", "THE U", "SMU", "Louisville", "Georgia Tech", "FSU", "UNC", "Virginia Tech"],
    "Conference USA": ["Sam Houston", "Mid TN", "New Mexico State", "Liberty", "Western Kentucky", "LT", "Jack St", "UTEP", "Delaware", "FIU"],
    "SEC": ["10RC", "Texas AM", "South Carolina", "Oklahoma", "LSU", "UGA", "Texas", "Alabama", "Florida", "Ole Miss"],
    "Mountain West": ["Air Force", "Colorado State", "San Diego State", "Hawaii", "Utah State", "Boise State", "Wyoming", "UNLV", "San Jose State", "Fresno State"],
    "Big 12": ["Texas Tech", "Iowa State", "Baylor", "Colorado", "TCU", "Kansas", "ASU", "Utah", "KSU", "BYU"],
    "American": ["UTSA", "Navy", "Army", "North Texas", "Eastern Carolina", "Rice", "UAB", "Tulane", "Memphis", "South Florida"],
    "Sun Belt": ["South Alabama", "Texas State", "Georgia Southern", "Troy", "ODU", "Southern Miss", "Appalachian State", "Coastal Carolina", "James Madison", "Louisiana"],
    "Playoffs": ["Pick #1", "Pick #2", "Pick #3", "Pick #4", "Pick #5", "Pick #6", "Pick #7", "Pick #8", "Pick #9", "Pick #10"],
  };

  const CONFERENCE_ORDER = [
    "B1G", "MAC", "ACC", "Conference USA", "SEC",
    "Mountain West", "Big 12", "American", "Sun Belt", "Playoffs"
  ];

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

    // Randomize conference order
    const confIndices = state.conferences.map((_, i) => i);
    state.confOrder = shuffle(confIndices);

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
