// ========================================
// FLOMIS DASHBOARD - app.js
// Firebase v10 (Modular)
// With REALISTIC PUMP CYCLING DEMO
// ========================================

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue } from
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ========================================
// FIREBASE CONFIG
// ========================================
const firebaseConfig = {
  apiKey: "AIzaSyDgrCOFGgdIq4xfcOFdW55AOFHJd3zGcOw",
  authDomain: "flomis-didsibu.firebaseapp.com",
  databaseURL: "https://flomis-didsibu-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "flomis-didsibu",
  storageBucket: "flomis-didsibu.firebasestorage.app",
  messagingSenderId: "158183788445",
  appId: "1:158183788445:web:160f29edea46c8546f6974"
};

// ========================================
// INIT FIREBASE
// ========================================
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// ========================================
// MOCK MODE CONFIG
// ========================================
const MOCK_MODE = true;        // 🔴 SET false when hardware is live
const MOCK_INTERVAL = 5000;    // ms (5 seconds - for display update)
const CYCLE_DURATION = 2 * 60 * 1000;  // 2 minutes per pump
const MAX_CYCLES = 20;         // 20 start/stop cycles
const REST_DURATION = 60 * 60 * 1000;  // 1 hour rest

// ========================================
// PUMP CYCLE STATE TRACKING
// ========================================
const pumpState = {
  ps01_engkabang: {
    cycleCount: 0,
    activePump: 1,  // PS1 has 1 pump (always pump 1)
    lastSwitchTime: Date.now(),
    isResting: false,
    restStartTime: null,
    highWaterLevel: 2.5,
    lowWaterLevel: 1.7
  },
  ps02_resan: {
    cycleCount: 0,
    activePump: 1,  // PS2 has 1 pump (always pump 1)
    lastSwitchTime: Date.now(),
    isResting: false,
    restStartTime: null,
    highWaterLevel: 2.3,
    lowWaterLevel: 1.7
  },
  ps03_ekdee: {
    cycleCount: 0,
    activePump: 1,  // PS3 has 3 pumps, start with pump 1
    lastSwitchTime: Date.now(),
    isResting: false,
    restStartTime: null,
    highWaterLevel: 2.0,
    lowWaterLevel: 1.7
  }
};

// ========================================
// HELPERS
// ========================================
function formatTime(value) {
  if (!value) return "N/A";
  const d = new Date(value);
  return d.toLocaleString("en-MY", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function getStatusClass(status) {
  if (status === "RUNNING") return "status-running";
  if (status === "TRIPPED") return "status-tripped";
  return "status-stopped";
}

function random(min, max, decimals = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

// ========================================
// PUMP CYCLE LOGIC
// ========================================
function updatePumpCycle(stationId) {
  const state = pumpState[stationId];
  const now = Date.now();
  const timeSinceSwitch = now - state.lastSwitchTime;

  // Check if in rest period
  if (state.isResting) {
    const restTime = now - state.restStartTime;
    if (restTime >= REST_DURATION) {
      // Rest complete, reset cycle
      state.isResting = false;
      state.cycleCount = 0;
      state.activePump = 1;
      state.lastSwitchTime = now;
    }
    return; // Stay in rest mode
  }

  // Check if it's time to switch pumps (2 minutes elapsed)
  if (timeSinceSwitch >= CYCLE_DURATION) {
    state.cycleCount++;
    
    // Check if reached 20 cycles
    if (state.cycleCount >= MAX_CYCLES) {
      state.isResting = true;
      state.restStartTime = now;
      state.activePump = 0; // No pump running
      return;
    }

    // Alternate pump for PS3 (has 3 pumps)
    if (stationId === "ps03_ekdee") {
      state.activePump = (state.activePump % 3) + 1; // Cycle 1→2→3→1
    }
    // PS1 and PS2 always use pump 1
    
    state.lastSwitchTime = now;
  }
}

// ========================================
// MOCK DATA GENERATOR
// ========================================
function generateMockStation(id, name) {
  const isPS3 = id === "ps03_ekdee";
  const state = pumpState[id];
  const now = new Date().toISOString();

  // Update cycle logic
  updatePumpCycle(id);

  // Determine water level (HIGH during cycles, LOW during rest)
  const waterLevel = state.isResting ? state.lowWaterLevel : state.highWaterLevel;

  // Determine if pump is running
  const isPumpRunning = !state.isResting;
  const status = isPumpRunning ? "RUNNING" : "STOPPED";

  let telemetry = {
    status: status,
    water_level: {
      value: waterLevel,
      unit: "m"
    },
    trip_status: false,
    trip_reason: "",
    last_updated: now
  };

  if (isPS3) {
    // PS3 has 3 pumps - only active pump runs
    telemetry.pump_1_current = { 
      value: (state.activePump === 1 && isPumpRunning) ? random(15, 25) : 0, 
      unit: "A" 
    };
    telemetry.pump_2_current = { 
      value: (state.activePump === 2 && isPumpRunning) ? random(15, 25) : 0, 
      unit: "A" 
    };
    telemetry.pump_3_current = { 
      value: (state.activePump === 3 && isPumpRunning) ? random(15, 25) : 0, 
      unit: "A" 
    };
  } else {
    // PS1 and PS2 have 1 pump
    telemetry.pump_current = { 
      value: isPumpRunning ? random(12, 22) : 0, 
      unit: "A" 
    };
  }

  return {
    name,
    telemetry,
    runtime: {
      last_start_time: isPumpRunning ? new Date(state.lastSwitchTime).toISOString() : null,
      last_stop_time: !isPumpRunning && state.isResting ? new Date(state.restStartTime).toISOString() : null
    }
  };
}

// ========================================
// CREATE STATION CARD
// ========================================
function createStationCard(id, station) {
  const telemetry = station.telemetry || {};
  const runtime = station.runtime || {};
  const status = telemetry.status || "UNKNOWN";

  // ---- Stale data detection ----
  let staleWarning = "";
  if (telemetry.last_updated) {
    const ageMs =
      Date.now() - new Date(telemetry.last_updated).getTime();

    if (ageMs > 5 * 60 * 1000) { // 5 minutes
      staleWarning = `
        <div class="stale-warning">
          ⚠️ Data may be stale (no update > 5 min)
        </div>
      `;
    }
  }

  const card = document.createElement("div");
  card.className = "station-card";

  // ---- Cycle info badge (DEMO ONLY) ----
  const state = pumpState[id];
  let cycleInfo = "";
  if (MOCK_MODE) {
    if (state.isResting) {
      const restRemaining = Math.ceil((REST_DURATION - (Date.now() - state.restStartTime)) / 1000 / 60);
      cycleInfo = `
        <div style="background:#fef3c7; padding:6px; margin-bottom:10px; border-radius:4px; font-size:12px; text-align:center;">
          🛑 Resting - ${restRemaining} min remaining
        </div>
      `;
    } else {
      const switchRemaining = Math.ceil((CYCLE_DURATION - (Date.now() - state.lastSwitchTime)) / 1000);
      cycleInfo = `
        <div style="background:#dbeafe; padding:6px; margin-bottom:10px; border-radius:4px; font-size:12px; text-align:center;">
          Cycle ${state.cycleCount + 1}/${MAX_CYCLES} • Switch in ${switchRemaining}s
          ${id === "ps03_ekdee" ? ` • Active: Pump ${state.activePump}` : ''}
        </div>
      `;
    }
  }

  // ---- Check if this is PS3 (multiple pumps) ----
  const isPS3 = id === "ps03_ekdee";

  // Build telemetry grid based on station type
  let telemetryHTML = "";
  
  if (isPS3) {
    // PS3 has 3 separate pump currents
    telemetryHTML = `
      <div class="telemetry-grid">
        <div class="telemetry-item">
          <div class="telemetry-label">Pump 1 Current</div>
          <div class="telemetry-value">
            ${telemetry.pump_1_current?.value ?? 0}
            <span class="telemetry-unit">
              ${telemetry.pump_1_current?.unit ?? "A"}
            </span>
          </div>
        </div>

        <div class="telemetry-item">
          <div class="telemetry-label">Pump 2 Current</div>
          <div class="telemetry-value">
            ${telemetry.pump_2_current?.value ?? 0}
            <span class="telemetry-unit">
              ${telemetry.pump_2_current?.unit ?? "A"}
            </span>
          </div>
        </div>

        <div class="telemetry-item">
          <div class="telemetry-label">Pump 3 Current</div>
          <div class="telemetry-value">
            ${telemetry.pump_3_current?.value ?? 0}
            <span class="telemetry-unit">
              ${telemetry.pump_3_current?.unit ?? "A"}
            </span>
          </div>
        </div>

        <div class="telemetry-item">
          <div class="telemetry-label">Water Level</div>
          <div class="telemetry-value">
            ${telemetry.water_level?.value ?? 0}
            <span class="telemetry-unit">
              ${telemetry.water_level?.unit ?? "m"}
            </span>
          </div>
        </div>
      </div>
    `;
  } else {
    // PS1 and PS2 have single pump current
    telemetryHTML = `
      <div class="telemetry-grid">
        <div class="telemetry-item">
          <div class="telemetry-label">Pump Current</div>
          <div class="telemetry-value">
            ${telemetry.pump_current?.value ?? 0}
            <span class="telemetry-unit">
              ${telemetry.pump_current?.unit ?? "A"}
            </span>
          </div>
        </div>

        <div class="telemetry-item">
          <div class="telemetry-label">Water Level</div>
          <div class="telemetry-value">
            ${telemetry.water_level?.value ?? 0}
            <span class="telemetry-unit">
              ${telemetry.water_level?.unit ?? "m"}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="station-header">
      <div class="station-name">${station.name}</div>
      <span class="status-badge ${getStatusClass(status)}">
        ${status}
      </span>
    </div>

    ${cycleInfo}
    ${staleWarning}

    ${telemetryHTML}

    <div class="runtime-section">
      <div class="runtime-item">
        <strong>Last Start:</strong>
        ${formatTime(runtime.last_start_time)}
      </div>
      <div class="runtime-item">
        <strong>Last Stop:</strong>
        ${formatTime(runtime.last_stop_time)}
      </div>
      <div class="runtime-item">
        <strong>Last Updated:</strong>
        ${formatTime(telemetry.last_updated)}
      </div>
    </div>

    ${
      telemetry.trip_status
        ? `
      <div class="trip-alert">
        ⚠️ <strong>TRIP DETECTED</strong><br/>
        ${telemetry.trip_reason || "Unknown reason"}
      </div>`
        : ""
    }
  `;

  return card;
}

// ========================================
// LOAD DATA FROM FIREBASE
// ========================================
function loadPumpStations() {
  const container = document.getElementById("stations-container");

  // ================= MOCK MODE =================
  if (MOCK_MODE) {
    const mockStations = {
      ps01_engkabang: generateMockStation(
        "ps01_engkabang",
        "Pump Station No.1 Sungai Engkabang"
      ),
      ps02_resan: generateMockStation(
        "ps02_resan",
        "Pump Station No.2 Sungai Resan"
      ),
      ps03_ekdee: generateMockStation(
        "ps03_ekdee",
        "Pump Station No.3 Sungai Ek Dee"
      )
    };

    function renderMock() {
      container.innerHTML = "";
      ["ps01_engkabang", "ps02_resan", "ps03_ekdee"].forEach(id => {
        // Regenerate data each time
        mockStations[id] = generateMockStation(
          id,
          mockStations[id].name
        );
        container.appendChild(createStationCard(id, mockStations[id]));
      });
    }

    renderMock();
    setInterval(renderMock, MOCK_INTERVAL);
    return;
  }

  // ================= LIVE FIREBASE MODE =================
  container.innerHTML =
    '<div class="loading">Loading pump stations...</div>';

  const stationsRef = ref(database, "pump_stations/pump_stations");

  onValue(
    stationsRef,
    (snapshot) => {
      const data = snapshot.val();
      container.innerHTML = "";

      if (!data) {
        container.innerHTML =
          '<div class="error">No pump stations found.</div>';
        return;
      }

      ["ps01_engkabang", "ps02_resan", "ps03_ekdee"].forEach((id) => {
        if (data[id]) {
          container.appendChild(createStationCard(id, data[id]));
        }
      });
    },
    (error) => {
      console.error(error);
      container.innerHTML =
        `<div class="error">Firebase error: ${error.message}</div>`;
    }
  );
}

// ========================================
// START APP
// ========================================
loadPumpStations();
