// ========================================
// FLOMIS DASHBOARD - app.js
// Firebase v10 (Modular)
// With REALISTIC STAGGERED PUMP CYCLING
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
const CYCLE_DURATION = 2 * 60 * 1000;  // 2 minutes per pump switch
const MAX_CYCLES = 20;         // 20 start/stop cycles total
const REST_DURATION = 60 * 60 * 1000;  // 1 hour rest

// ========================================
// GLOBAL CYCLE STATE
// ========================================
const globalCycle = {
  cycleCount: 0,
  cyclePattern: 0,  // 0, 1, 2 (repeating pattern)
  lastSwitchTime: Date.now(),
  isResting: false,
  restStartTime: null
};

// ========================================
// PUMP CYCLE STATE TRACKING
// ========================================
const pumpState = {
  ps01_engkabang: {
    activePump: 1,  // PS1 has 1 pump (always pump 1)
    highWaterLevel: 2.5,
    lowWaterLevel: 1.7
  },
  ps02_resan: {
    activePump: 1,  // PS2 has 1 pump (always pump 1)
    highWaterLevel: 2.3,
    lowWaterLevel: 1.7
  },
  ps03_ekdee: {
    activePump: 1,  // PS3 has 3 pumps, start with pump 1
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
// GLOBAL CYCLE LOGIC
// ========================================
function updateGlobalCycle() {
  const now = Date.now();
  const timeSinceSwitch = now - globalCycle.lastSwitchTime;

  // Check if in rest period
  if (globalCycle.isResting) {
    const restTime = now - globalCycle.restStartTime;
    if (restTime >= REST_DURATION) {
      // Rest complete, reset everything
      globalCycle.isResting = false;
      globalCycle.cycleCount = 0;
      globalCycle.cyclePattern = 0;
      globalCycle.lastSwitchTime = now;
      // Reset all pumps to pump 1
      pumpState.ps03_ekdee.activePump = 1;
    }
    return; // Stay in rest mode
  }

  // Check if it's time to switch (2 minutes elapsed)
  if (timeSinceSwitch >= CYCLE_DURATION) {
    globalCycle.cycleCount++;
    
    // Check if reached 20 cycles
    if (globalCycle.cycleCount >= MAX_CYCLES) {
      globalCycle.isResting = true;
      globalCycle.restStartTime = now;
      return;
    }

    // Advance pattern: 0 → 1 → 2 → 0 (repeating)
    globalCycle.cyclePattern = (globalCycle.cyclePattern + 1) % 3;
    
    // Rotate PS3 pump on each switch
    pumpState.ps03_ekdee.activePump = (pumpState.ps03_ekdee.activePump % 3) + 1;
    
    globalCycle.lastSwitchTime = now;
  }
}

// ========================================
// DETERMINE IF STATION SHOULD RUN
// ========================================
function shouldStationRun(stationId) {
  if (globalCycle.isResting) return false;
  
  // Pattern 0: Ek Dee + Resan only
  // Pattern 1: All 3 stations
  // Pattern 2: Ek Dee only
  
  switch (globalCycle.cyclePattern) {
    case 0: // Ek Dee + Resan
      return stationId === "ps03_ekdee" || stationId === "ps02_resan";
    case 1: // All stations
      return true;
    case 2: // Ek Dee only
      return stationId === "ps03_ekdee";
    default:
      return false;
  }
}

// ========================================
// MOCK DATA GENERATOR
// ========================================
function generateMockStation(id, name) {
  const isPS3 = id === "ps03_ekdee";
  const state = pumpState[id];
  const now = new Date().toISOString();

  // Update global cycle
  updateGlobalCycle();

  // Determine if this station should be running
  const shouldRun = shouldStationRun(id);
  
  // Determine water level (HIGH during cycles, LOW during rest)
  const waterLevel = globalCycle.isResting ? state.lowWaterLevel : state.highWaterLevel;

  const status = shouldRun ? "RUNNING" : "STOPPED";

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
    // PS3 has 3 pumps - only active pump runs (if station should run)
    telemetry.pump_1_current = { 
      value: (state.activePump === 1 && shouldRun) ? random(15, 25) : 0, 
      unit: "A" 
    };
    telemetry.pump_2_current = { 
      value: (state.activePump === 2 && shouldRun) ? random(15, 25) : 0, 
      unit: "A" 
    };
    telemetry.pump_3_current = { 
      value: (state.activePump === 3 && shouldRun) ? random(15, 25) : 0, 
      unit: "A" 
    };
  } else {
    // PS1 and PS2 have 1 pump
    telemetry.pump_current = { 
      value: shouldRun ? random(12, 22) : 0, 
      unit: "A" 
    };
  }

  return {
    name,
    telemetry,
    runtime: {
      last_start_time: shouldRun ? new Date(globalCycle.lastSwitchTime).toISOString() : null,
      last_stop_time: !shouldRun && globalCycle.isResting ? new Date(globalCycle.restStartTime).toISOString() : null
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
