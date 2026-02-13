// ========================================
// FLOMIS LOGS - logs.js
// Reads real event logs from Firebase
// Written by app.js simulation + PS3 ESP32
// ========================================

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getDatabase, ref, onValue, query, orderByChild, limitToLast
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
// STATE
// ========================================
let allLogs = [];
let filteredLogs = [];

// ========================================
// STATION DISPLAY NAMES
// ========================================
const stationNames = {
  ps01_engkabang: "PS1 Engkabang",
  ps02_resan:     "PS2 Resan",
  ps03_ekdee:     "PS3 Ek Dee",
  all:            "All Stations",
  system:         "System"
};

// ========================================
// FORMAT TIMESTAMP
// ========================================
function formatTimestamp(timestamp) {
  const d = new Date(Number(timestamp));
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleString("en-MY", {
    year:   "numeric",
    month:  "2-digit",
    day:    "2-digit",
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

// ========================================
// EVENT BADGE CSS CLASS
// ========================================
function getEventBadgeClass(event) {
  if (event === "PUMP_START")  return "event-start";
  if (event === "PUMP_STOP")   return "event-stop";
  if (event === "TRIP")        return "event-trip";
  return "event-stop";
}

// ========================================
// RENDER LOGS TABLE
// ========================================
function renderLogs(logs) {
  const tbody = document.getElementById("logs-table-body");
  const countEl = document.getElementById("log-count");

  if (logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="no-logs">
          No logs found. Logs appear automatically when pumps
          start or stop.
        </td>
      </tr>`;
    countEl.textContent = "No events recorded yet";
    return;
  }

  tbody.innerHTML = logs.map(log => `
    <tr>
      <td>${formatTimestamp(log.timestamp)}</td>
      <td>${stationNames[log.station] || log.station}</td>
      <td>
        <span class="event-badge ${getEventBadgeClass(log.event)}">
          ${log.event.replace(/_/g, " ")}
        </span>
      </td>
      <td>${log.details || "-"}</td>
      <td>${log.waterLevel || "-"}</td>
      <td>${log.pumpCurrent || "-"}</td>
      <td>${log.duration || "-"}</td>
    </tr>`).join("");

  countEl.textContent =
    `Showing ${logs.length} of ${allLogs.length} events`;
}

// ========================================
// APPLY FILTERS
// ========================================
function applyFilters() {
  const stationFilter =
    document.getElementById("station-filter").value;
  const eventFilter =
    document.getElementById("event-filter").value;

  filteredLogs = allLogs.filter(log => {
    const matchStation =
      stationFilter === "all" ||
      log.station === stationFilter ||
      log.station === "all";
    const matchEvent =
      eventFilter === "all" ||
      log.event === eventFilter;
    return matchStation && matchEvent;
  });

  renderLogs(filteredLogs);
}

// ========================================
// DOWNLOAD CSV
// ========================================
function downloadCSV() {
  if (filteredLogs.length === 0) {
    alert("No logs to download.");
    return;
  }

  let csv =
    "Timestamp,Station,Event,Details,Water Level," +
    "Pump Current,Duration\n";

  filteredLogs.forEach(log => {
    const row = [
      formatTimestamp(log.timestamp),
      stationNames[log.station] || log.station,
      log.event.replace(/_/g, " "),
      `"${(log.details || "").replace(/"/g, "'")}"`,
      log.waterLevel  || "-",
      log.pumpCurrent || "-",
      log.duration    || "-"
    ];
    csv += row.join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = window.URL.createObjectURL(blob);
  const a    = document.createElement("a");
  const date = new Date().toISOString().split("T")[0];
  a.href     = url;
  a.download = `flomis-logs-${date}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// ========================================
// LOAD LOGS FROM FIREBASE (Real)
// ========================================
function loadLogs() {
  const countEl = document.getElementById("log-count");
  countEl.textContent = "Loading logs from Firebase...";

  // Read last 500 logs ordered by timestamp
  const logsRef = query(
    ref(database, "logs"),
    orderByChild("timestamp"),
    limitToLast(500)
  );

  onValue(logsRef, (snapshot) => {
    const data = snapshot.val();

    if (!data) {
      allLogs = [];
      filteredLogs = [];
      renderLogs([]);
      return;
    }

    // Convert object to array, sort newest first
    allLogs = Object.values(data)
      .filter(log => log.timestamp) // skip entries without timestamp
      .sort((a, b) => b.timestamp - a.timestamp);

    filteredLogs = allLogs;
    renderLogs(filteredLogs);
  }, (error) => {
    console.error("Firebase logs error:", error);
    document.getElementById("log-count").textContent =
      "Error loading logs: " + error.message;
  });
}

// ========================================
// EVENT LISTENERS
// ========================================
document.getElementById("station-filter")
  .addEventListener("change", applyFilters);

document.getElementById("event-filter")
  .addEventListener("change", applyFilters);

document.getElementById("download-csv")
  .addEventListener("click", downloadCSV);

document.getElementById("refresh-logs")
  .addEventListener("click", loadLogs);

// ========================================
// INIT
// ========================================
loadLogs();
