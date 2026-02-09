# FLOMIS Dashboard - Deployment Guide

## 📦 What's Inside

```
flomis-dashboard/
├── index.html    → Main page (industrial SCADA theme)
├── style.css     → Professional styling
├── app.js        → Firebase real-time connection
└── README.md     → This file
```

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Get Firebase Config

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your **flomis-didsibu** project
3. Click ⚙️ Settings → **Project settings**
4. Scroll to "Your apps" → Click **</>** (Web)
5. Register app: `FLOMIS Dashboard`
6. **Copy the firebaseConfig object**

It looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "flomis-didsibu.firebaseapp.com",
  databaseURL: "https://flomis-didsibu-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "flomis-didsibu",
  storageBucket: "flomis-didsibu.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### Step 2: Update app.js

Open `app.js` and **replace lines 13-21** with YOUR config.

### Step 3: Test Locally

1. Open `index.html` in Chrome/Firefox
2. Open DevTools (F12) → Console
3. You should see 3 pump station cards
4. No red errors in console

---

## 🧪 Test Firebase Connection

### Add test data manually:

1. Firebase Console → Realtime Database
2. Navigate to: `pump_stations/ps01_engkabang/telemetry`
3. Set these values:
   - `status` → `"RUNNING"`
   - `pump_current/value` → `15.8`
   - `water_level/value` → `2.3`
   - `last_updated` → `"2026-02-09T14:30:00"`

**Dashboard should update instantly!** 🎉

---

## 🎯 Features Included

✅ **Real-time updates** → Firebase changes appear instantly  
✅ **Status color coding** → Green (running), Gray (stopped), Red (tripped)  
✅ **Stale data warning** → Yellow alert if no update > 5 minutes  
✅ **Trip detection** → Red banner when pump trips  
✅ **Runtime tracking** → Start/stop times  
✅ **Industrial SCADA theme** → Professional dark header  

---

## ⚠️ Troubleshooting

### "No pump stations found"
- Verify Firebase structure matches your JSON import
- Check database URL includes correct region: `asia-southeast1`

### Cards show but no data
- Open Console (F12) → Look for Firebase errors
- Verify config is correct (all fields filled)

### "Permission denied"
- Set database rules to **test mode** (temporarily):

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

⚠️ Remember to secure this before production!

### Module import errors
- Verify `<script type="module">` is set in index.html
- Must use Chrome/Firefox (not IE)
- If testing locally, use Live Server (not file://)

---

## 📱 Next Steps

### Immediate:
- [ ] Replace Firebase config
- [ ] Test with live Firebase data
- [ ] Verify all 3 stations render

### Deploy:
- [ ] GitHub Pages (recommended)
- [ ] Firebase Hosting
- [ ] Netlify

### Hardware:
- [ ] Connect ESP32
- [ ] Test live telemetry
- [ ] Verify auto-refresh

### Future enhancements:
- [ ] Logs viewer
- [ ] Historical charts
- [ ] Email/SMS alerts
- [ ] Export reports (PDF)

---

## 🔒 Security (Before Production)

1. **Update Database Rules:**

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

2. **Enable Firebase Authentication**
3. **Add environment variables** for sensitive config
4. **Use HTTPS only** (GitHub Pages does this automatically)

---

## 📞 Support

If stuck:
1. Check Firebase Console → Database tab
2. Verify data structure matches schema
3. Check browser Console (F12) for errors
4. Verify Firebase config is complete

---

**Built with ☕ by Eizec Electrical DID Sibu**
