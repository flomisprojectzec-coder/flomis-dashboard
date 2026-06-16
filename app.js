// ========================================
// FLOMIS DASHBOARD - app.js
// MIXED MODE:
//   PS1 Engkabang → Physics Simulation
//   PS2 Resan     → Physics Simulation
//   PS3 Ek Dee    → Real ESP32 via Firebase
// ========================================

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, push } from
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ========================================
// FIREBASE CONFIG
// ========================================
const firebaseConfig = {
  apiKey: "AIzaSyDgrCOFGgdIq4xfcOFdW55AOFHJd3zGcOw",
  authDomain: "flomis-didsibu.firebaseapp.com",
  databaseURL:
    "https://flomis-didsibu-default-rtdb.asia-southeast1.firebasedatabase.app",
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
// MODE CONFIG
// ========================================
const SIMULATE_PS1 = true;  // PS1 = Physics Simulation
const SIMULATE_PS2 = true;  // PS2 = Physics Simulation
const SIMULATE_PS3 = false; // PS3 = Real ESP32 Hardware

const UPDATE_INTERVAL = 5000;  // Dashboard refresh (5 sec)
const PHYSICS_TICK    = 10000; // Water physics update (10 sec)

// ========================================
// SIMULATION STATE (PS1 & PS2 only)
// ========================================
const simulationState = {
  ps01_engkabang: {
    name: "Pump Station No.1 Sungai Engkabang",
    waterLevel: 2.2,
    highThreshold: 2.5,  // Pump starts at 2.5m
    lowThreshold: 1.7,   // Pump stops at 1.7m
    pumpRunning: false,
    pumpCurrent: 0,
    lastStartTime: null,
    lastStopTime: null
  },
  ps02_resan: {
    name: "Pump Station No.2 Sungai Resan",
    waterLevel: 2.0,
    highThreshold: 2.3,  // Pump starts at 2.3m
    lowThreshold: 1.7,   // Pump stops at 1.7m
    pumpRunning: false,
    pumpCurrent: 0,
    lastStartTime: null,
    lastStopTime: null
  }
};

// ========================================
// PS3 REAL DATA CACHE
// ========================================
let ps03RealData = null;
let ps03PreviousStatus = "STOPPED";

// FIX: Runtime stored OUTSIDE onValue listener
// so it persists across every 5-second Firebase update
let ps03Runtime = {
  last_start_time: null,
  last_stop_time: null
};

// ========================================
// PHYSICS CONSTANTS
// ========================================
const WATER_RISE_RATE = 0.05; // m per tick (simulates rainfall)
const PUMP_DRAIN_RATE = 0.08; // m per tick (pump draining)

// ========================================
// HELPER: Format timestamp safely
// Handles: ISO string, Unix ms, ESP32 millis
// ========================================
function formatTime(value) {
  if (!value) return "N/A";

  const asNumber = Number(value);

  // Unix timestamp in milliseconds (> year 2000)
  if (!isNaN(asNumber) && asNumber > 946684800000) {
    const d = new Date(asNumber);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleString("en-MY", {
      dateStyle: "short",
      timeStyle: "short"
    });
  }

  // Small number = ESP32 uptime millis, not real time
  if (!isNaN(asNumber) && asNumber < 946684800000) {
    return "N/A";
  }

  // ISO string (from simulation)
  const d = new Date(value);
  if (isNaN(d.getTime())) return "N/A";

  return d.toLocaleString("en-MY", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

// ========================================
// HELPER: Status badge CSS class
// ========================================
function getStatusClass(status) {
  if (status === "RUNNING") return "status-running";
  if (status === "TRIPPED") return "status-tripped";
  return "status-stopped";
}

// ========================================
// HELPER: Random number with decimals
// ========================================
function random(min, max, decimals = 1) {
  return parseFloat(
    (Math.random() * (max - min) + min).toFixed(decimals)
  );
}

// ========================================
// EVENT LOGGER → Writes to Firebase logs/
// ========================================
function writeLog(stationId, event, details, waterLevel, pumpCurrent) {
  const logEntry = {
    timestamp: Date.now(),
    station: stationId,
    event: event,
    details: details,
    waterLevel: parseFloat(waterLevel).toFixed(1) + "m",
    pumpCurrent: parseFloat(pumpCurrent).toFixed(1) + "A",
    duration: "-"
  };

  push(ref(database, "logs"), logEntry);
  console.log(`[LOG] ${stationId}: ${event} - ${details}`);
}

// ========================================
// SIMULATION PHYSICS ENGINE (PS1 & PS2)
// ========================================
function updateSimulationPhysics() {
  Object.keys(simulationState).forEach(id => {
    const s = simulationState[id];
    if (s.pumpRunning) {
      s.waterLevel -= PUMP_DRAIN_RATE;
    } else {
      s.waterLevel += WATER_RISE_RATE;
    }
    // Clamp to realistic bounds
    s.waterLevel = Math.max(1.5, Math.min(3.0, s.waterLevel));
  });
}

// ========================================
// SIMULATION CONTROL LOGIC (Float Switch)
// ========================================
function updateSimulationLogic() {
  Object.keys(simulationState).forEach(id => {
    const s = simulationState[id];
    const now = new Date().toISOString();

    // Start pump when water reaches HIGH threshold
    if (!s.pumpRunning && s.waterLevel >= s.highThreshold) {
      s.pumpRunning = true;
      s.pumpCurrent = random(12, 22);
      s.lastStartTime = now;
      writeLog(id, "PUMP_START", "Pump started",
        s.waterLevel, s.pumpCurrent);
    }
    // Stop pump when water drops to LOW threshold
    else if (s.pumpRunning && s.waterLevel <= s.lowThreshold) {
      writeLog(id, "PUMP_STOP", "Pump stopped", s.waterLevel, 0);
      s.pumpRunning = false;
      s.pumpCurrent = 0;
      s.lastStopTime = now;
    }
  });
}

// ========================================
// GENERATE CARD DATA (Simulation)
// ========================================
function generateSimulationTelemetry(stationId) {
  const s = simulationState[stationId];
  return {
    name: s.name,
    telemetry: {
      status: s.pumpRunning ? "RUNNING" : "STOPPED",
      water_level: {
        value: parseFloat(s.waterLevel.toFixed(1)),
        unit: "m"
      },
      pump_current: { value: s.pumpCurrent, unit: "A" },
      trip_status: false,
      trip_reason: "",
      last_updated: new Date().toISOString()
    },
    runtime: {
      last_start_time: s.lastStartTime,
      last_stop_time: s.lastStopTime
    }
  };
}

// ========================================
// LISTEN TO PS3 REAL DATA FROM FIREBASE
// FIX: Runtime stored in ps03Runtime object
//      (outside listener so it persists)
// ========================================
function listenToPS3RealData() {
  const ps03Ref = ref(
    database,
    "pump_stations/pump_stations/ps03_ekdee"
  );

  onValue(ps03Ref, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    const currentStatus = data.telemetry?.status || "STOPPED";
    const now = new Date().toISOString();

    // Detect status transition
    if (currentStatus !== ps03PreviousStatus) {
      console.log(
        `[PS3] Status: ${ps03PreviousStatus} → ${currentStatus}`
      );

      if (currentStatus === "RUNNING") {
        // Record start time
        ps03Runtime.last_start_time = now;

        // Detect which pump has highest current
        const p1 = data.telemetry?.pump_1_current?.value || 0;
        const p2 = data.telemetry?.pump_2_current?.value || 0;
        const p3 = data.telemetry?.pump_3_current?.value || 0;

        let activePump = "Pump";
        if (p1 >= p2 && p1 >= p3)      activePump = "Pump 1";
        else if (p2 >= p1 && p2 >= p3) activePump = "Pump 2";
        else                            activePump = "Pump 3";

        const maxCurrent = Math.max(p1, p2, p3);
        const wl = data.telemetry?.water_level?.value || 0;

        writeLog("ps03_ekdee", "PUMP_START",
          `${activePump} started`, wl, maxCurrent);
      }
      else if (currentStatus === "STOPPED") {
        // Record stop time
        ps03Runtime.last_stop_time = now;

        const wl = data.telemetry?.water_level?.value || 0;
        writeLog("ps03_ekdee", "PUMP_STOP",
          "Pump stopped", wl, 0);
      }

      ps03PreviousStatus = currentStatus;
    }

    // Merge persistent runtime into Firebase data
    data.runtime = {
      last_start_time: ps03Runtime.last_start_time,
      last_stop_time: ps03Runtime.last_stop_time
    };

    ps03RealData = data;
  });
}

// ========================================
// BUILD STATION CARD HTML
// ========================================
function createStationCard(id, station) {
  const telemetry = station.telemetry || {};
  const runtime   = station.runtime   || {};
  const status    = telemetry.status  || "UNKNOWN";

  // Stale data warning (handles both ISO and Unix ms)
  let staleWarning = "";
  if (telemetry.last_updated) {
    const asNum = Number(telemetry.last_updated);
    const isReal = isNaN(asNum) || asNum > 946684800000;
    if (isReal) {
      const ts = isNaN(asNum)
        ? new Date(telemetry.last_updated).getTime()
        : asNum;
      if (Date.now() - ts > 5 * 60 * 1000) {
        staleWarning = `
          <div class="stale-warning">
            ⚠️ Data may be stale (no update > 5 min)
          </div>`;
      }
    }
  }

  const card = document.createElement("div");
  card.className = "station-card";

  const isPS3 = id === "ps03_ekdee";
  let telemetryHTML = "";

  if (isPS3) {
    // PS3 has 3 pump current readings
    telemetryHTML = `
      <div class="telemetry-grid">
        <div class="telemetry-item">
          <div class="telemetry-label">Pump 1 Current</div>
          <div class="telemetry-value">
            ${(telemetry.pump_1_current?.value ?? 0).toFixed(1)}
            <span class="telemetry-unit">A</span>
          </div>
        </div>
        <div class="telemetry-item">
          <div class="telemetry-label">Pump 2 Current</div>
          <div class="telemetry-value">
            ${(telemetry.pump_2_current?.value ?? 0).toFixed(1)}
            <span class="telemetry-unit">A</span>
          </div>
        </div>
        <div class="telemetry-item">
          <div class="telemetry-label">Pump 3 Current</div>
          <div class="telemetry-value">
            ${(telemetry.pump_3_current?.value ?? 0).toFixed(1)}
            <span class="telemetry-unit">A</span>
          </div>
        </div>
        <div class="telemetry-item">
          <div class="telemetry-label">Water Level</div>
          <div class="telemetry-value">
            ${(telemetry.water_level?.value ?? 0).toFixed(2)}
            <span class="telemetry-unit">m</span>
          </div>
        </div>
      </div>`;
  } else {
    // PS1 & PS2 have single pump current
    telemetryHTML = `
      <div class="telemetry-grid">
        <div class="telemetry-item">
          <div class="telemetry-label">Pump Current</div>
          <div class="telemetry-value">
            ${(telemetry.pump_current?.value ?? 0).toFixed(1)}
            <span class="telemetry-unit">A</span>
          </div>
        </div>
        <div class="telemetry-item">
          <div class="telemetry-label">Water Level</div>
          <div class="telemetry-value">
            ${(telemetry.water_level?.value ?? 0).toFixed(1)}
            <span class="telemetry-unit">m</span>
          </div>
        </div>
      </div>`;
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
    ${telemetry.trip_status ? `
      <div class="trip-alert">
        ⚠️ <strong>TRIP DETECTED</strong><br/>
        ${telemetry.trip_reason || "Unknown reason"}
      </div>` : ""}`;

  return card;
}

// ========================================
// RENDER ALL STATION CARDS
// ========================================
function renderDashboard() {
  const container = document.getElementById("stations-container");
  container.innerHTML = "";

  // PS1 - Simulation
  if (SIMULATE_PS1) {
    container.appendChild(
      createStationCard(
        "ps01_engkabang",
        generateSimulationTelemetry("ps01_engkabang")
      )
    );
  }

  // PS2 - Simulation
  if (SIMULATE_PS2) {
    container.appendChild(
      createStationCard(
        "ps02_resan",
        generateSimulationTelemetry("ps02_resan")
      )
    );
  }

  // PS3 - Real ESP32
  if (!SIMULATE_PS3) {
    if (ps03RealData) {
      container.appendChild(
        createStationCard("ps03_ekdee", ps03RealData)
      );
    } else {
      // Waiting for ESP32 to connect
      const placeholder = document.createElement("div");
      placeholder.className = "station-card";
      placeholder.innerHTML = `
        <div class="station-header">
          <div class="station-name">
            Pump Station No.3 Sungai Ek Dee
          </div>
          <span class="status-badge status-stopped">
            CONNECTING
          </span>
        </div>
        <div class="loading" style="padding:20px;text-align:center;">
          Waiting for ESP32 connection...
        </div>`;
      container.appendChild(placeholder);
    }
  }
}

// ========================================
// START SIMULATION TICKS (PS1 & PS2)
// ========================================
function startSimulation() {
  // Water physics tick
  setInterval(updateSimulationPhysics, PHYSICS_TICK);
  // Pump control logic tick
  setInterval(updateSimulationLogic,   PHYSICS_TICK);
  // Dashboard display refresh
  setInterval(renderDashboard,         UPDATE_INTERVAL);
  // First render immediately
  renderDashboard();
}

// ========================================
// BOOTSTRAP
// ========================================
console.log("FLOMIS MIXED MODE ACTIVE");
console.log("  PS1 Engkabang → Simulation");
console.log("  PS2 Resan     → Simulation");
console.log("  PS3 Ek Dee    → Real ESP32");

startSimulation();      // Start PS1 & PS2 simulation
listenToPS3RealData();  // Listen for PS3 ESP32 data
