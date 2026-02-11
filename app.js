// ========================================
// FLOMIS DASHBOARD - app.js
// Industrial Realistic Simulation Engine
// ========================================

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, push, set } from
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
// SIMULATION MODE
// ========================================
const SIMULATION_MODE = true; // Set false when ESP32 connected
const UPDATE_INTERVAL = 5000; // 5 seconds
const PHYSICS_TICK = 10000;   // 10 seconds (water level updates)

// ========================================
// STATION STATE (Dynamic Real-Time)
// ========================================
const stationState = {
  ps01_engkabang: {
    name: "Pump Station No.1 Sungai Engkabang",
    waterLevel: 2.2,          // Current level (m)
    highThreshold: 2.5,       // Start pump at this level
    lowThreshold: 1.7,        // Stop pump at this level
    pumpRunning: false,
    pumpCurrent: 0,
    lastStartTime: null,
    lastStopTime: null,
    dutyPump: 1               // Always 1 for single-pump stations
  },
  ps02_resan: {
    name: "Pump Station No.2 Sungai Resan",
    waterLevel: 2.0,
    highThreshold: 2.3,
    lowThreshold: 1.7,
    pumpRunning: false,
    pumpCurrent: 0,
    lastStartTime: null,
    lastStopTime: null,
    dutyPump: 1
  },
  ps03_ekdee: {
    name: "Pump Station No.3 Sungai Ek Dee",
    waterLevel: 1.9,
    highThreshold: 2.0,
    lowThreshold: 1.7,
    pumpRunning: false,
    activePump: 0,            // 0=none, 1/2/3=active pump
    dutyPump: 1,              // Next pump to start (rotates)
    pump1Current: 0,
    pump2Current: 0,
    pump3Current: 0,
    lastStartTime: null,
    lastStopTime: null
  }
};

// ========================================
// PHYSICS CONSTANTS
// ========================================
const WATER_RISE_RATE = 0.05;   // m per tick (simulates rainfall)
const PUMP_RATE = 0.08;          // m per tick (pump drainage)

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
// EVENT LOGGER (Writes to Firebase)
// ========================================
function writeLog(stationId, event, details, waterLevel, pumpCurrent) {
  if (!SIMULATION_MODE) return; // Only log in simulation
  
  const logEntry = {
    timestamp: Date.now(),
    station: stationId,
    event: event,
    details: details,
    waterLevel: waterLevel.toFixed(1) + "m",
    pumpCurrent: pumpCurrent.toFixed(1) + "A",
    duration: "-"
  };

  // Write to Firebase logs
  const logsRef = ref(database, "logs");
  push(logsRef, logEntry);
  
  console.log(`[LOG] ${stationId}: ${event} - ${details}`);
}

// ========================================
// WATER PHYSICS ENGINE
// ========================================
function updateWaterPhysics() {
  Object.keys(stationState).forEach(stationId => {
    const state = stationState[stationId];
    
    if (stationId === "ps03_ekdee") {
      // PS3 logic
      if (state.activePump > 0) {
        // Pump is running - water decreases
        state.waterLevel -= PUMP_RATE;
      } else {
        // No pump - water rises
        state.waterLevel += WATER_RISE_RATE;
      }
    } else {
      // PS1 & PS2 logic
      if (state.pumpRunning) {
        state.waterLevel -= PUMP_RATE;
      } else {
        state.waterLevel += WATER_RISE_RATE;
      }
    }

    // Keep water level in realistic bounds
    state.waterLevel = Math.max(1.5, Math.min(3.0, state.waterLevel));
  });
}

// ========================================
// PUMP CONTROL LOGIC (Float Switch)
// ========================================
function updatePumpLogic() {
  Object.keys(stationState).forEach(stationId => {
    const state = stationState[stationId];
    const now = new Date().toISOString();

    if (stationId === "ps03_ekdee") {
      // ========== PS3: 3 PUMPS ==========
      
      // Check if should START pump
      if (state.activePump === 0 && state.waterLevel >= state.highThreshold) {
        // Start duty pump
        state.activePump = state.dutyPump;
        state.lastStartTime = now;
        
        // Set current for active pump
        const current = random(15, 25);
        if (state.activePump === 1) state.pump1Current = current;
        if (state.activePump === 2) state.pump2Current = current;
        if (state.activePump === 3) state.pump3Current = current;

        // Write log
        writeLog(
          stationId,
          "PUMP_START",
          `Pump ${state.activePump} started`,
          state.waterLevel,
          current
        );
      }
      
      // Check if should STOP pump
      else if (state.activePump > 0 && state.waterLevel <= state.lowThreshold) {
        const stoppingPump = state.activePump;
        
        // Write log BEFORE stopping
        writeLog(
          stationId,
          "PUMP_STOP",
          `Pump ${stoppingPump} stopped`,
          state.waterLevel,
          0
        );

        // Stop pump
        state.activePump = 0;
        state.pump1Current = 0;
        state.pump2Current = 0;
        state.pump3Current = 0;
        state.lastStopTime = now;

        // Rotate duty pump for next start (1→2→3→1)
        state.dutyPump = (state.dutyPump % 3) + 1;
      }

    } else {
      // ========== PS1 & PS2: SINGLE PUMP ==========
      
      // Check if should START
      if (!state.pumpRunning && state.waterLevel >= state.highThreshold) {
        state.pumpRunning = true;
        state.pumpCurrent = random(12, 22);
        state.lastStartTime = now;

        writeLog(
          stationId,
          "PUMP_START",
          "Pump started",
          state.waterLevel,
          state.pumpCurrent
        );
      }
      
      // Check if should STOP
      else if (state.pumpRunning && state.waterLevel <= state.lowThreshold) {
        writeLog(
          stationId,
          "PUMP_STOP",
          "Pump stopped",
          state.waterLevel,
          0
        );

        state.pumpRunning = false;
        state.pumpCurrent = 0;
        state.lastStopTime = now;
      }
    }
  });
}

// ========================================
// GENERATE TELEMETRY FROM STATE
// ========================================
function generateTelemetryFromState(stationId) {
  const state = stationState[stationId];
  const isPS3 = stationId === "ps03_ekdee";

  let status = "STOPPED";
  if (isPS3) {
    status = state.activePump > 0 ? "RUNNING" : "STOPPED";
  } else {
    status = state.pumpRunning ? "RUNNING" : "STOPPED";
  }

  let telemetry = {
    status: status,
    water_level: {
      value: parseFloat(state.waterLevel.toFixed(1)),
      unit: "m"
    },
    trip_status: false,
    trip_reason: "",
    last_updated: new Date().toISOString()
  };

  if (isPS3) {
    telemetry.pump_1_current = { value: state.pump1Current, unit: "A" };
    telemetry.pump_2_current = { value: state.pump2Current, unit: "A" };
    telemetry.pump_3_current = { value: state.pump3Current, unit: "A" };
  } else {
    telemetry.pump_current = { value: state.pumpCurrent, unit: "A" };
  }

  return {
    name: state.name,
    telemetry: telemetry,
    runtime: {
      last_start_time: state.lastStartTime,
      last_stop_time: state.lastStopTime
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

  // Stale data detection
  let staleWarning = "";
  if (telemetry.last_updated) {
    const ageMs = Date.now() - new Date(telemetry.last_updated).getTime();
    if (ageMs > 5 * 60 * 1000) {
      staleWarning = `
        <div class="stale-warning">
          ⚠️ Data may be stale (no update > 5 min)
        </div>
      `;
    }
  }

  const card = document.createElement("div");
  card.className = "station-card";

  const isPS3 = id === "ps03_ekdee";

  let telemetryHTML = "";
  
  if (isPS3) {
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
// RENDER DASHBOARD
// ========================================
function renderDashboard() {
  const container = document.getElementById("stations-container");
  container.innerHTML = "";

  ["ps01_engkabang", "ps02_resan", "ps03_ekdee"].forEach(id => {
    const stationData = generateTelemetryFromState(id);
    container.appendChild(createStationCard(id, stationData));
  });
}

// ========================================
// SIMULATION ENGINE
// ========================================
function startSimulation() {
  // Physics tick (water movement)
  setInterval(() => {
    updateWaterPhysics();
  }, PHYSICS_TICK);

  // Control logic tick (pump decisions)
  setInterval(() => {
    updatePumpLogic();
  }, PHYSICS_TICK);

  // Display update tick
  setInterval(() => {
    renderDashboard();
  }, UPDATE_INTERVAL);

  // Initial render
  renderDashboard();
}

// ========================================
// LOAD FROM FIREBASE (Real Mode)
// ========================================
function loadFromFirebase() {
  const container = document.getElementById("stations-container");
  container.innerHTML = '<div class="loading">Loading pump stations...</div>';

  const stationsRef = ref(database, "pump_stations/pump_stations");

  onValue(stationsRef, (snapshot) => {
    const data = snapshot.val();
    container.innerHTML = "";

    if (!data) {
      container.innerHTML = '<div class="error">No pump stations found.</div>';
      return;
    }

    ["ps01_engkabang", "ps02_resan", "ps03_ekdee"].forEach((id) => {
      if (data[id]) {
        container.appendChild(createStationCard(id, data[id]));
      }
    });
  }, (error) => {
    console.error(error);
    container.innerHTML = `<div class="error">Firebase error: ${error.message}</div>`;
  });
}

// ========================================
// START APP
// ========================================
if (SIMULATION_MODE) {
  console.log("🔧 SIMULATION MODE - Running physics engine");
  startSimulation();
} else {
  console.log("📡 LIVE MODE - Reading from Firebase");
  loadFromFirebase();
}
