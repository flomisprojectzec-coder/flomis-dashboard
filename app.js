// ========================================
// FLOMIS DASHBOARD - app.js
// Firebase v10 (Modular)
// Updated for PS3 with 3 pumps
// ========================================

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue } from
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ========================================
// FIREBASE CONFIG (REPLACE WITH YOUR OWN)
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

      // Fixed display order
      const order = [
        "ps01_engkabang",
        "ps02_resan",
        "ps03_ekdee"
      ];

      order.forEach((id) => {
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
