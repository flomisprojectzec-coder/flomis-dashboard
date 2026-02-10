// ========================================
// FLOMIS LOGS - logs.js
// Event log viewer with CSV export
// ========================================

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, query, orderByChild, limitToLast } from
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
// MOCK MODE
// ========================================
const MOCK_MODE = true; // Set to false when using real Firebase logs

// ========================================
// STATE
// ========================================
let allLogs = [];
let filteredLogs = [];

// ========================================
// STATION NAMES
// ========================================
const stationNames = {
  ps01_engkabang: "PS1 Engkabang",
  ps02_resan: "PS2 Resan",
  ps03_ekdee: "PS3 Ek Dee",
  all: "All Stations"
};

// ========================================
// GENERATE MOCK LOGS (Last 24 hours)
// ========================================
function generateMockLogs() {
  const logs = [];
  const now = Date.now();
  const oneDayAgo = now - (24 * 60 * 60 * 1000);
  
  // Helper function
  function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  function addLog(timestamp, station, event, details, waterLevel, pumpCurrent, duration = "-") {
    logs.push({
      timestamp,
      station,
      event,
      details,
      waterLevel,
      pumpCurrent,
      duration
    });
  }

  // Generate 150 events over last 24 hours
  let currentTime = oneDayAgo;
  let cycleCount = 0;
  const maxCycles = 20;
  let isResting = false;

  for (let i = 0; i < 150; i++) {
    // Advance time by 5-15 minutes
    currentTime += randomBetween(5, 15) * 60 * 1000;
    if (currentTime > now) break;

    const stations = ["ps01_engkabang", "ps02_resan", "ps03_ekdee"];
    const station = stations[Math.floor(Math.random() * stations.length)];
    const waterHigh = station === "ps01_engkabang" ? 2.5 : station === "ps02_resan" ? 2.3 : 2.0;
    const waterLow = 1.7;

    // Rest period logic
    if (isResting) {
      if (cycleCount >= 5) { // After 5 rest entries, end rest
        addLog(currentTime, "all", "REST_END", "Rest period ended, resuming operations", waterLow + "m", "0A");
        isResting = false;
        cycleCount = 0;
      } else {
        cycleCount++;
        continue; // Skip during rest
      }
    }

    // Check if should start rest
    if (cycleCount >= maxCycles && Math.random() > 0.7) {
      addLog(currentTime, "all", "CYCLE_COMPLETE", `${maxCycles} cycles completed`, waterHigh + "m", "0A", "40m");
      currentTime += 1000;
      addLog(currentTime, "all", "REST_START", "1 hour rest period started", waterLow + "m", "0A");
      isResting = true;
      cycleCount = 0;
      continue;
    }

    // Regular events
    const eventType = Math.random();
    
    if (eventType < 0.4) {
      // PUMP_START
      const pump = station === "ps03_ekdee" ? ` Pump ${Math.floor(Math.random() * 3) + 1}` : "";
      const current = randomBetween(12, 25).toFixed(1);
      addLog(currentTime, station, "PUMP_START", `Pump${pump} started`, waterHigh + "m", current + "A");
      cycleCount++;
    } else if (eventType < 0.75) {
      // PUMP_STOP
      const pump = station === "ps03_ekdee" ? ` Pump ${Math.floor(Math.random() * 3) + 1}` : "";
      const duration = Math.floor(randomBetween(10, 120));
      addLog(currentTime, station, "PUMP_STOP", `Pump${pump} stopped`, waterHigh + "m", "0A", duration + "m");
    } else if (eventType < 0.95) {
      // Normal status change
      continue;
    } else {
      // TRIP (5% chance)
      const current = randomBetween(22, 30).toFixed(1);
      addLog(currentTime, station, "TRIP", `Overcurrent detected - ${current}A`, waterHigh + "m", "0A");
    }
  }

  // Sort by timestamp (newest first)
  return logs.sort((a, b) => b.timestamp - a.timestamp);
}

// ========================================
// FORMAT HELPERS
// ========================================
function formatTimestamp(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleString("en-MY", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function getEventBadgeClass(event) {
  const classes = {
    "PUMP_START": "event-start",
    "PUMP_STOP": "event-stop",
    "TRIP": "event-trip",
    "CYCLE_COMPLETE": "event-cycle",
    "REST_START": "event-rest",
    "REST_END": "event-rest"
  };
  return classes[event] || "event-stop";
}

// ========================================
// RENDER LOGS TABLE
// ========================================
function renderLogs(logs) {
  const tbody = document.getElementById("logs-table-body");
  
  if (logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 40px; color: #6b7280;">
          No logs found matching filters
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = logs.map(log => `
    <tr>
      <td>${formatTimestamp(log.timestamp)}</td>
      <td>${stationNames[log.station] || log.station.toUpperCase()}</td>
      <td>
        <span class="event-badge ${getEventBadgeClass(log.event)}">
          ${log.event.replace(/_/g, " ")}
        </span>
      </td>
      <td>${log.details}</td>
      <td>${log.waterLevel}</td>
      <td>${log.pumpCurrent}</td>
      <td>${log.duration}</td>
    </tr>
  `).join("");

  // Update count
  document.getElementById("log-count").textContent = 
    `Showing ${logs.length} of ${allLogs.length} events`;
}

// ========================================
// FILTER LOGS
// ========================================
function applyFilters() {
  const stationFilter = document.getElementById("station-filter").value;
  const eventFilter = document.getElementById("event-filter").value;

  filteredLogs = allLogs.filter(log => {
    const matchStation = stationFilter === "all" || log.station === stationFilter || log.station === "all";
    const matchEvent = eventFilter === "all" || log.event === eventFilter;
    return matchStation && matchEvent;
  });

  renderLogs(filteredLogs);
}

// ========================================
// DOWNLOAD CSV
// ========================================
function downloadCSV() {
  // CSV header
  let csv = "Timestamp,Station,Event,Details,Water Level,Pump Current,Duration\n";

  // Add rows
  filteredLogs.forEach(log => {
    const row = [
      formatTimestamp(log.timestamp),
      stationNames[log.station] || log.station.toUpperCase(),
      log.event.replace(/_/g, " "),
      `"${log.details}"`, // Quoted in case of commas
      log.waterLevel,
      log.pumpCurrent,
      log.duration
    ];
    csv += row.join(",") + "\n";
  });

  // Create download
  const blob = new Blob([csv], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `flomis-logs-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// ========================================
// LOAD LOGS
// ========================================
function loadLogs() {
  if (MOCK_MODE) {
    // Generate mock logs
    allLogs = generateMockLogs();
    filteredLogs = allLogs;
    renderLogs(filteredLogs);
  } else {
    // Load from Firebase
    const logsRef = query(ref(database, "logs"), orderByChild("timestamp"), limitToLast(500));
    
    onValue(logsRef, (snapshot) => {
      const data = snapshot.val();
      
      if (!data) {
        allLogs = [];
        filteredLogs = [];
        renderLogs([]);
        return;
      }

      // Convert Firebase object to array
      allLogs = Object.values(data).sort((a, b) => b.timestamp - a.timestamp);
      filteredLogs = allLogs;
      renderLogs(filteredLogs);
    });
  }
}

// ========================================
// EVENT LISTENERS
// ========================================
document.getElementById("station-filter").addEventListener("change", applyFilters);
document.getElementById("event-filter").addEventListener("change", applyFilters);
document.getElementById("download-csv").addEventListener("click", downloadCSV);
document.getElementById("refresh-logs").addEventListener("click", loadLogs);

// ========================================
// INIT
// ========================================
loadLogs();
