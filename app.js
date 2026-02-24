(function () {
  "use strict";

  // ─── State ───────────────────────────────────────────────────────
  const state = {
    // Raw data from Excel
    participants: [],   // ["Matt", "Joe", ...]
    conferences: [],    // ["Big Ten", "ACC", ...]
    teams: {},          // { "Big Ten": ["Ohio State", "Michigan", ...], ... }

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

  // ─── Excel Parsing ───────────────────────────────────────────────
  function parseExcel(data) {
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    if (json.length < 2) {
      alert("Excel file must have a header row and at least one data row.");
      return false;
    }

    // First row = headers; first column = participant names
    const headers = json[0];
    // Detect layout: check if first column header looks like a name label
    // We assume column 0 has participant names, columns 1+ are conferences
    const confHeaders = headers.slice(1).map((h) => String(h).trim()).filter(Boolean);
    const participants = [];
    const teams = {};

    confHeaders.forEach((c) => {
      teams[c] = [];
    });

    for (let r = 1; r < json.length; r++) {
      const row = json[r];
      const name = String(row[0] || "").trim();
      if (!name) continue;
      participants.push(name);

      for (let c = 0; c < confHeaders.length; c++) {
        const val = String(row[c + 1] || "").trim();
        if (val && !teams[confHeaders[c]].includes(val)) {
          teams[confHeaders[c]].push(val);
        }
      }
    }

    if (participants.length === 0) {
      alert("No participants found in the first column.");
      return false;
    }

    if (confHeaders.length === 0) {
      alert("No conferences found in the header row.");
      return false;
    }

    state.participants = participants;
    state.conferences = confHeaders;
    state.teams = teams;

    return true;
  }

  function showPreview() {
    $("file-preview").classList.remove("hidden");
    $("preview-info").innerHTML =
      `<p><strong>${state.participants.length}</strong> participants &bull; ` +
      `<strong>${state.conferences.length}</strong> conferences</p>`;

    $("setup-options").classList.remove("hidden");

    const pList = $("participant-list");
    pList.innerHTML = state.participants.map((p) => `<li>${p}</li>`).join("");

    const cList = $("conference-list");
    cList.innerHTML = state.conferences
      .map((c) => `<li>${c} (${state.teams[c].length} teams)</li>`)
      .join("");
  }

  // ─── File Upload ─────────────────────────────────────────────────
  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const data = new Uint8Array(e.target.result);
      if (parseExcel(data)) {
        showPreview();
      }
    };
    reader.readAsArrayBuffer(file);
  }

  $("file-input").addEventListener("change", (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
  });

  const uploadArea = $("upload-area");
  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("dragover");
  });
  uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("dragover");
  });
  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
  });

  // ─── Start Draft (Randomize) ────────────────────────────────────
  $("start-draft-btn").addEventListener("click", () => {
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

    $("file-input").value = "";
    $("file-preview").classList.add("hidden");
    $("setup-options").classList.add("hidden");
    $("upload-area").classList.remove("hidden");

    showScreen("setup");
  });
})();
