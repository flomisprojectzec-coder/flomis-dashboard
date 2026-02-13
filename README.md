# FLOMIS Dashboard
**Flood Mitigation Pump House Information System**  
DID Sibu — Sarawak, Malaysia

---

## 📦 Files in This Package

```
flomis-dashboard/
├── index.html                  → Main dashboard page
├── style.css                   → Industrial SCADA styling
├── app.js                      → Dashboard logic (Mixed Mode)
├── logs.html                   → Event log viewer page
├── logs.js                     → Logs logic + CSV export
├── flomis-firebase-structure.json → Firebase initial data
├── FLOMIS_PS3_EkDee.ino        → ESP32 Arduino firmware
└── README.md                   → This file
```

---

## 🏗️ System Architecture

```
PS1 Sungai Engkabang  →  Physics Simulation  →  Dashboard
PS2 Sungai Resan      →  Physics Simulation  →  Dashboard
PS3 Sungai Ek Dee     →  ESP32 → Firebase    →  Dashboard
                                                    ↓
                                              logs.html
                                                    ↓
                                            CSV Download
```

---

## 🚀 Deployment Guide

### Step 1: Setup Firebase

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Open project: **flomis-didsibu**
3. Go to **Realtime Database** → **Import JSON**
4. Upload `flomis-firebase-structure.json`
5. Verify database rules (for testing):

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

---

### Step 2: Deploy to GitHub Pages

1. Go to your repo: `flomisprojectzec-coder/flomis-dashboard`
2. Upload all files (replace existing ones)
3. Settings → Pages → Deploy from `main` branch, `/` root
4. Wait 60 seconds → Visit:
   `https://flomisprojectzec-coder.github.io/flomis-dashboard/`

**Files to upload:**
- Replace: `index.html`, `app.js`, `style.css`
- Add new: `logs.html`, `logs.js`

---

### Step 3: Flash ESP32 (PS3 only)

**Required Libraries** (Arduino IDE → Library Manager):
- `Firebase ESP Client` by Mobizt
- `NTPClient` by Fabrice Weinberg
- `ArduinoJson` by Benoit Blanchon

**Before flashing, edit `FLOMIS_PS3_EkDee.ino`:**
```cpp
#define WIFI_SSID       "YOUR_WIFI_NAME"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"
```

---

## 🔌 Hardware Wiring (PS3 Ek Dee)

### AJ-SR04M Water Level Sensor
```
Arduino  →  AJ-SR04M TRIG  (Arduino controls trigger)
ESP32    →  AJ-SR04M ECHO  (via voltage divider!)
AJ-SR04M ECHO → 10kΩ → ESP32 GPIO18
                  |
                 20kΩ
                  |
                 GND
```
⚠️ Voltage divider is REQUIRED. ECHO is 5V, ESP32 is 3.3V!

### ACS712 30A Current Sensors
```
ACS712 #1 OUT → ESP32 GPIO34  (Pump 1)
ACS712 #2 OUT → ESP32 GPIO35  (Pump 2)
ACS712 #3 OUT → ESP32 GPIO32  (Pump 3)
All ACS712 VCC → 5V
All ACS712 GND → GND (shared with ESP32 GND)
```

### Common Ground (CRITICAL!)
```
Arduino GND ──────── ESP32 GND
```
Without this: random readings, unstable behavior!

---

## 📐 Calibration Steps

### 1. ACS712 Current Offset Calibration

The ACS712 output is ~2.5V when no current flows, but
the exact value varies per unit.

```
Step 1: Turn OFF all 3 pumps
Step 2: Open Serial Monitor (115200 baud)
Step 3: Uncomment line in readCurrent():
        Serial.print("  Raw V: ");
        Serial.println(voltage, 4);
Step 4: Note voltage for each sensor
        (should be near 2.47 - 2.53V)
Step 5: Set in firmware:
        float PUMP1_OFFSET = 2.483; // your actual value
        float PUMP2_OFFSET = 2.497; // your actual value
        float PUMP3_OFFSET = 2.501; // your actual value
Step 6: Re-comment the Serial.print line
Step 7: Re-flash ESP32
Step 8: Verify: All pumps OFF shows 0.0A ✅
```

### 2. Water Level Calibration

```
Step 1: Empty your prototype pond completely
Step 2: Check Serial Monitor: "Water Level: X.XX m"
Step 3: Set DISTANCE_EMPTY = (distance in cm when pond empty)
        float DISTANCE_EMPTY = 25.0; // your actual distance
Step 4: Re-flash ESP32
Step 5: Verify: Empty = 0.0m, Full = expected level ✅
```

---

## 🎯 Features

| Feature | Status |
|---------|--------|
| Real-time dashboard | ✅ |
| PS1 & PS2 physics simulation | ✅ |
| PS3 real ESP32 hardware | ✅ |
| Status color coding | ✅ |
| Stale data warning | ✅ |
| Trip detection & alert | ✅ |
| Event log viewer | ✅ |
| Filter by station / event | ✅ |
| CSV download | ✅ |
| Mobile responsive | ✅ |
| Auto pump start/stop detection | ✅ |
| Last start/stop time tracking | ✅ |

---

## 🧪 Testing Procedure

### Dashboard Test
1. Open dashboard → PS1 & PS2 should show RUNNING/STOPPED
2. Water levels should change gradually
3. Click **View Logs** → should see pump events

### ESP32 Test
1. Power ESP32 → open Serial Monitor (115200)
2. Confirm WiFi connects
3. Confirm NTP syncs
4. Confirm Firebase updates every 5 seconds
5. PS3 card shows "CONNECTING" → should become live

### Full System Test
```
1. Power everything ON
2. PS3 shows: STOPPED, 0.0A, water ~0.0m
3. Slowly pour water into pond
4. Watch Serial: water level rises
5. Arduino hits HIGH threshold → starts pump
6. Serial shows: Pump X: 15.2A [RUNNING]
7. Dashboard: PS3 = RUNNING ✅
8. Logs: PUMP_START recorded ✅
9. Water drains → Arduino stops pump
10. Dashboard: PS3 = STOPPED ✅
11. Logs: PUMP_STOP recorded ✅
12. Download CSV → verify data ✅
```

---

## ⚙️ Switching to Full Live Mode

When ESP32 units are ready for PS1 and PS2:

Edit `app.js` lines 32-34:
```javascript
const SIMULATE_PS1 = false;  // PS1 → Real ESP32
const SIMULATE_PS2 = false;  // PS2 → Real ESP32
const SIMULATE_PS3 = false;  // PS3 → Already Real
```

---

## 🔒 Security (Before Production)

Update Firebase Database Rules:
```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

Then enable Firebase Authentication.

---

## 🛠️ Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| PS3 shows "CONNECTING" | ESP32 not connected | Check WiFi, flash ESP32 |
| Current reads 0.8A when off | Wrong offset | Calibrate PUMP_OFFSET |
| Water level stuck at 0 | Bad echo reading | Check voltage divider |
| "Permission denied" | Firebase rules | Set rules to test mode |
| Logs page empty | No events yet | Wait for first pump cycle |
| Invalid Date shown | ESP32 NTP failed | Check internet connection |

---

## 📞 Contact

**Built by Eizec Electrical — DID Sibu, Sarawak**  
FLOMIS v1.0 — February 2026
