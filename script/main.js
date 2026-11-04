/*
 * Renewal Christmas Store Parking — Version 4.0
 */
(function () {
  "use strict";
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDbs6UgbaxuxKZyG3v464lkeEtMJQbZ6-4",
    authDomain: "renewalparking.firebaseapp.com",
    databaseURL: "https://renewalparking-default-rtdb.firebaseio.com",
    projectId: "renewalparking",
    storageBucket: "renewalparking.appspot.com",
    messagingSenderId: "398724226058",
    appId: "1:398724226058:web:cfb4d70283c546944d13f3",
    measurementId: "G-SGV7YXDJ8X",
  };

  const APP = {
    totalSpots: 160,
    defaultEventId: "christmas-store-2026",
    statuses: [
      "In-Car",
      "Fetch-to-shop",
      "Awaiting Shopper",
      "Shopping",
      "Wrapping",
      "Waiting for Reindeer",
    ],
    roles: [
      "parking",
      "registration",
      "shopper",
      "wrapper",
      "reindeer",
      "admin",
    ],
    roleLabels: {
      parking: "Parking Management",
      registration: "Registration",
      shopper: "Shopper",
      wrapper: "Wrapper",
      reindeer: "Reindeer Team",
      admin: "Administrator",
    },
    rolePages: {
      parking: "createVehicle.html",
      registration: "registration.html",
      shopper: "shopping.html",
      wrapper: "wrapper.html",
      reindeer: "reindeer.html",
      admin: "admin-page.html",
    },
    defaultShiftOptions: {
      friday_evening: {
        label: "Friday, 5:30 PM – 8:30 PM",
        dayOfWeek: 5,
        start: "17:30",
        end: "20:30",
      },
      saturday_morning: {
        label: "Saturday, 9:30 AM – 12:00 PM",
        dayOfWeek: 6,
        start: "09:30",
        end: "12:00",
      },
      saturday_midday: {
        label: "Saturday, 11:45 AM – 2:00 PM",
        dayOfWeek: 6,
        start: "11:45",
        end: "14:00",
      },
      saturday_afternoon: {
        label: "Saturday, 1:45 PM – 4:15 PM",
        dayOfWeek: 6,
        start: "13:45",
        end: "16:15",
      },
    },
  };

  const body = document.body;
  const page = body.dataset.page || "home";
  let currentRole =
    body.dataset.role || sessionStorage.getItem("renewalSelectedRole") || "";
  const rootPrefix = ["home", "roles"].includes(page) ? "" : "../";

  const state = {
    user: null,
    userRecord: null,
    eventId: null,
    vehicles: {},
    bags: {},
    deliveries: {},
    removed: {},
    activity: {},
    presence: {},
    users: {},
    allEvents: {},
    volunteerCheckins: {},
    checkInSettings: {},
    search: "",
    selectedStatuses: new Set(),
    listeners: [],
    connected: false,
    lastSavedAt: null,
    sessionId: sessionStorage.getItem("renewalSessionId") || makeId(),
    clockTimer: null,
    presenceTimer: null,
  };
  sessionStorage.setItem("renewalSessionId", state.sessionId);

  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function esc(value) {
    return String(value ?? "").replace(
      /[&<>'"]/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[char],
    );
  }

  function slug(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function normalizeCarNumber(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "-")
      .replace(/[^A-Z0-9-]/g, "");
  }

  function formatDuration(start, end = Date.now()) {
    if (!Number(start)) return "Just now";
    const mins = Math.max(0, Math.floor((end - Number(start)) / 60000));
    const hours = Math.floor(mins / 60);
    const remainder = mins % 60;
    return hours ? `${hours}h ${remainder}m` : `${remainder} min`;
  }

  function formatDate(timestamp) {
    if (!Number(timestamp)) return "—";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(Number(timestamp));
  }

  function serverTime() {
    return firebase.database.ServerValue.TIMESTAMP;
  }

  function eventPath(child = "") {
    return `events/${state.eventId}${child ? `/${child}` : ""}`;
  }

  function initFirebase() {
    if (!window.firebase) throw new Error("Firebase did not load.");
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
  }

  function injectApp(viewLabel, markup) {
    const app = document.getElementById("app");
    if (!app) throw new Error('This page is missing <main id="app">.');
    app.dataset.renderedView = viewLabel;
    app.innerHTML = markup;
  }



  function renderHome() {
    injectApp(
      "index.html / home",
      `
      <section class="hero-page">
        <div class="hero-card">
          <div class="hero-content">
            <div class="asset-slot logo-slot">
              <img class="brand-logo-image" src="assets/renewal-logo.png" alt="Renewal Neighborhood Church logo" onerror="Renewal.showAssetPlaceholder(this)">
              <div class="asset-fallback logo-fallback" hidden><span>✚</span><small>renewal-logo.png</small></div>
            </div>
            <div class="brand-name">RENEWAL</div>
            <div class="brand-sub">NEIGHBORHOOD MINISTRY</div>
            <h1 class="hero-title">CHRISTMAS STORE<br>PARKING APP</h1>
            <div class="desc_cont">
            <p class="hero-copy">Helping families.<br>Sharing the love of Jesus.</p>
            </div>
          </div>
          <div class="hero-photo" aria-label="Renewal church exterior image area">
            <img src="assets/renewal-church-home.png" alt="Renewal Neighborhood Church exterior" onerror="Renewal.showAssetPlaceholder(this)">
            <div class="asset-fallback photo-fallback" hidden><strong>Church photo</strong><small>renewal-church-home.png</small></div>
          </div>
          <button class="hero-button" type="button" onclick="location.href='pages/login.html'">Get Started <span aria-hidden="true">→</span></button>
        </div>
      </section>`,
    );
  }

  function renderRoles() {
    const roles = [
      ["parking", "Ⓟ", "Parking Management", "Add and manage parked vehicles"],
      [
        "registration",
        "✓",
        "Registration",
        "Register families and prepare them for a shopper",
      ],
      ["shopper", "🛍", "Shopper", "Move families through shopping"],
      ["wrapper", "🎁", "Wrapper", "Track gifts and wrapping bags"],
      ["reindeer", "🦌", "Reindeer Team", "Coordinate completed deliveries"],
      ["admin", "⚙", "Administrator", "System, users, and analytics"],
    ];
    const assignedRoles = roles.filter(([role]) =>
      Boolean(state.userRecord?.roles?.[role]),
    );
    // INJECTED HTML -> roles.html (body[data-page="roles"])
    injectApp(
      "roles.html / roles",
      `
      <section class="role-page"><div class="role-shell">
        <div class="role-brand">
          <div class="asset-slot role-logo-slot"><img src="assets/renewal-logo.png" alt="Renewal Neighborhood Church logo" onerror="Renewal.showAssetPlaceholder(this)"><div class="asset-fallback mini-logo-fallback" hidden>✚</div></div>
          <div><div class="brand-name">RENEWAL</div><div class="brand-sub">NEIGHBORHOOD MINISTRY</div></div>
        </div>
        <div class="page-heading" style="text-align:center"><h2>Choose Your Role</h2><p>Signed in as ${esc(state.user?.email || "")}</p></div>
        <div class="role-list">
          ${assignedRoles.length ? assignedRoles.map(([role, icon, title, copy]) => `<button class="role-card" onclick="Renewal.chooseRole('${role}')"><span class="role-icon">${icon}</span><span><strong>${title}</strong><small>${copy}</small></span><span>›</span></button>`).join("") : `<div class="empty-state role-empty"><strong>You don’t have any roles yet.</strong><br>Contact an administrator to have a role assigned, then refresh this page.</div>`}
        </div>
        <div class="role-session-actions"><button class="button ghost" type="button" onclick="location.reload()">Refresh Roles</button><button class="button secondary" type="button" onclick="Renewal.signOut()">Sign Out</button></div>
      </div></section>`,
    );
  }

  function chooseRole(role) {
    if (!APP.roles.includes(role) || !state.userRecord?.roles?.[role]) return;
    sessionStorage.setItem("renewalSelectedRole", role);
    location.href = `pages/${APP.rolePages[role]}`;
  }

  function brandBlock() {
    return `<div class="asset-slot auth-logo-slot"><img src="${rootPrefix}assets/renewal-logo-white.png" alt="Renewal Neighborhood Church logo" onerror="Renewal.showAssetPlaceholder(this)"><div class="asset-fallback auth-logo-fallback" hidden><span>✚</span><small>renewal-logo-white.png</small></div></div><div class="brand-name">RENEWAL</div><div class="brand-sub">NEIGHBORHOOD MINISTRY</div>`;
  }

  function showAssetPlaceholder(image) {
    if (!image) return;
    image.hidden = true;
    const fallback = image.nextElementSibling;
    if (fallback?.classList.contains("asset-fallback")) fallback.hidden = false;
  }


  function renderLogin(
    message = "Sign in first. Your assigned roles will appear on the next screen.",
    error = false,
  ) {
    currentRole = "";
    sessionStorage.removeItem("renewalSelectedRole");
    injectApp(
      "pages/login.html / login",
      `
      <section class="auth-page"><div class="auth-card">
        ${brandBlock()}
        <h1>Volunteer Sign In</h1>
        <p id="authMessage"${error ? ' class="alert error"' : ""}>${esc(message)}</p>
        <button class="google-button" type="button" onclick="Renewal.signInWithGoogle()"><span style="font-size:1.25rem">G</span> Continue with Google</button>
        <a class="auth-back" href="../index.html">← Back to Welcome</a>
      </div></section>`,
    );
  }

  async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await firebase.auth().signInWithPopup(provider);
    } catch (error) {
      if (
        [
          "auth/popup-blocked",
          "auth/operation-not-supported-in-this-environment",
        ].includes(error.code)
      ) {
        await firebase.auth().signInWithRedirect(provider);
      } else if (error.code !== "auth/popup-closed-by-user") {
        renderLogin(error.message || "Google sign-in failed.", true);
      }
    }
  }

  function currentShiftOptions() {
    const configured = state.checkInSettings?.timeSlots;
    return configured && Object.keys(configured).length
      ? configured
      : APP.defaultShiftOptions;
  }

  function shiftEndTimestamp(shift) {
    const now = new Date();
    const target = new Date(now);
    const dayOffset = (Number(shift.dayOfWeek) - now.getDay() + 7) % 7;
    target.setDate(now.getDate() + dayOffset);
    const [hours, minutes] = String(shift.end || "23:59")
      .split(":")
      .map(Number);
    target.setHours(hours || 0, minutes || 0, 0, 0);
    return target.getTime();
  }

  function renderVolunteerCheckinPage(successMessage = "") {
    const shifts = currentShiftOptions();
    const roleChoices = APP.roles.filter((role) => role !== "admin");
    injectApp(
      "pages/checkin.html / volunteer kiosk",
      `
      <section class="checkin-page">
        <div class="checkin-card">
          <div class="role-brand checkin-brand">
            <div class="asset-slot role-logo-slot"><img src="../assets/renewal-logo.png" alt="Renewal Neighborhood Church logo" onerror="Renewal.showAssetPlaceholder(this)"><div class="asset-fallback mini-logo-fallback" hidden>✚</div></div>
            <div><div class="brand-name">RENEWAL</div><div class="brand-sub">CHRISTMAS STORE</div></div>
          </div>
          <div class="page-heading"><h1>Volunteer Check-In</h1><p>This kiosk records attendance only. It cannot open parking, family, or administrator data.</p></div>
          ${successMessage ? `<div class="alert success">${esc(successMessage)}</div>` : ""}
          <form onsubmit="Renewal.submitVolunteerCheckin(event)">
            <div class="form-grid two">
              <div class="field"><label for="checkinFirstName">First name</label><input class="input" id="checkinFirstName" name="firstName" maxlength="50" autocomplete="given-name" required></div>
              <div class="field"><label for="checkinLastName">Last name</label><input class="input" id="checkinLastName" name="lastName" maxlength="50" autocomplete="family-name" required></div>
              <div class="field"><label for="checkinRole">Role</label><select class="select" id="checkinRole" name="role" required><option value="">Choose a role</option>${roleChoices.map((role) => `<option value="${esc(role)}">${esc(APP.roleLabels[role])}</option>`).join("")}</select></div>
              <div class="field"><label for="checkinShift">Time slot</label><select class="select" id="checkinShift" name="timeSlotId" required><option value="">Choose a time slot</option>${Object.entries(shifts).map(([id, shift]) => `<option value="${esc(id)}">${esc(shift.label)}</option>`).join("")}</select></div>
            </div>
            <button class="button success full checkin-submit" type="submit">Check In</button>
          </form>
          <p class="checkin-privacy">When a shift ends, shoppers automatically leave the available list. An administrator can also check volunteers out manually.</p>
        </div>
      </section>`,
    );
  }

  async function submitVolunteerCheckin(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const firstName = String(form.get("firstName") || "").trim();
    const lastName = String(form.get("lastName") || "").trim();
    const role = String(form.get("role") || "");
    const timeSlotId = String(form.get("timeSlotId") || "");
    const shift = currentShiftOptions()[timeSlotId];
    if (!firstName || !lastName || !shift || !APP.roles.includes(role) || role === "admin") {
      return alert("Complete every check-in field.");
    }
    const user = firebase.auth().currentUser;
    if (!user?.isAnonymous) {
      return alert("The check-in kiosk session expired. Return to the Google sign-in screen and reopen it from the administrator dashboard.");
    }
    const checkinRef = firebase.database().ref(`${eventPath("volunteerCheckins")}`).push();
    await write(
      checkinRef.set({
        firstName,
        lastName,
        displayName: `${firstName} ${lastName}`,
        role,
        timeSlotId,
        timeSlotLabel: shift.label,
        status: role === "shopper" ? "available" : "checked-in",
        checkedInAt: serverTime(),
        shiftEndAt: shiftEndTimestamp(shift),
        createdByAnonymousUid: user.uid,
      }),
    );
    renderVolunteerCheckinPage(`${firstName} ${lastName} is checked in for ${shift.label}.`);
  }

  async function launchVolunteerCheckin() {
    if (currentRole !== "admin") return;
    if (!confirm("Open volunteer check-in mode? This signs the administrator out so the kiosk cannot return to the dashboard.")) return;
    sessionStorage.setItem("renewalCheckinEntry", "ready");
    sessionStorage.removeItem("renewalSelectedRole");
    await firebase.auth().signOut();
    location.replace(pageFile("checkin.html"));
  }

  async function initializeVolunteerCheckin() {
    const admitted = sessionStorage.getItem("renewalCheckinEntry") === "ready";
    sessionStorage.removeItem("renewalCheckinEntry");
    if (!admitted) {
      location.replace("login.html");
      return;
    }
    if (firebase.auth().currentUser) await firebase.auth().signOut();
    await firebase.auth().signInAnonymously();
    const eventSnapshot = await firebase.database().ref("config/activeEventId").once("value");
    state.eventId = eventSnapshot.val() || APP.defaultEventId;
    const settingsSnapshot = await firebase.database().ref(`${eventPath("checkinSettings")}`).once("value");
    state.checkInSettings = settingsSnapshot.val() || {};
    renderVolunteerCheckinPage();
  }

  async function ensureUserProfile(user) {
    const ref = firebase.database().ref(`users/${user.uid}`);
    const snapshot = await ref.once("value");
    const existing = snapshot.val() || {};
    const profile = {
      uid: user.uid,
      email: user.email || "",
      displayName: user.displayName || user.email || "Volunteer",
      photoURL: user.photoURL || "",
      lastLoginAt: serverTime(),
    };
    if (!snapshot.exists()) profile.createdAt = serverTime();
    await ref.update(profile);
    return { ...existing, ...profile, roles: existing.roles || {} };
  }

  function hasRole(record, role) {
    return Boolean(record?.roles?.admin || record?.roles?.[role]);
  }

  function hasAnyRole(record) {
    return APP.roles.some((role) => Boolean(record?.roles?.[role]));
  }

  async function authorize(user, role, isLoginPage = false) {
    state.user = user;
    state.userRecord = await ensureUserProfile(user);
    const permitted = role
      ? hasRole(state.userRecord, role)
      : hasAnyRole(state.userRecord);
    if (!permitted) {
      const message = `Signed in as ${user.email}, but this account does not have ${APP.roleLabels[role] || "app"} access yet. Ask an administrator to enable it, then try again.`;
      if (isLoginPage) renderLogin(message, true);
      else renderAccessDenied(message);
      return false;
    }
    return true;
  }

  function renderAccessDenied(message) {
    injectApp(
      "access denied",
      `
      <section class="auth-page">
        <div class="auth-card">
          ${brandBlock()}
          <h1>Access not enabled</h1>
          <p class="alert error">${esc(message)}</p>
          <a class="auth-back" href="${rootPrefix}roles.html">← Choose another role</a>
          <br>
          <button class="button ghost" style="margin-top:20px" onclick="Renewal.signOut()">Sign out</button>
        </div>
      </section>`,
    );
  }

  function roleHome(role = currentRole) {
    return `${rootPrefix}pages/${APP.rolePages[role] || "help.html"}`.replace(
      "pages/pages/",
      "pages/",
    );
  }

  function pageFile(file) {
    return `${rootPrefix}pages/${file}`.replace("pages/pages/", "pages/");
  }

  function navigationItems(active) {
    if (currentRole === "admin") {
      return [
        ["map", "⌖", "Map", pageFile("map.html")],
        ["list", "☷", "List", pageFile("admin-page.html")],
        ["stats", "▮", "Stats", pageFile("analytics.html")],
        ["history", "▱", "Removed", pageFile("removedCar.html")],
      ];
    }
    return [
      ["map", "⌖", "Map", pageFile("map.html")],
      ["list", "☷", "List", roleHome()],
      ["roles", "♙", "Roles", `${rootPrefix}roles.html`],
      ["help", "?", "Help", pageFile("help.html")],
    ];
  }

  function renderAppShell(title, pageContent, active = "list") {
    const userLabel = state.user?.email || "Signed in user";
    injectApp(
      `${page} / signed-in shell`,
      `
      <header class="app-header">
        <button class="icon-button" aria-label="Open menu" onclick="Renewal.toggleDrawer(true)">☰</button>
        <h1>${esc(title)}</h1>
        <div class="sync-pill" id="syncPill" data-state="connecting" title="Firebase connection"><span class="sync-dot"></span><span id="syncText">Connecting</span></div>
      </header>
      <div class="drawer-backdrop" id="drawerBackdrop" onclick="Renewal.closeDrawerFromBackdrop(event)"><nav class="drawer" aria-label="Main menu">
        <div class="drawer-brand">RENEWAL</div>
        <a href="${roleHome()}">☷ &nbsp; My workspace</a>
        ${currentRole === "wrapper" ? `<a href="${pageFile("giftWrap.html")}">🎁 &nbsp; Gift wrap tracker</a>` : ""}
        ${currentRole === "admin" ? `<a href="${pageFile("admin-page.html")}">▮ &nbsp; Administrator dashboard</a><a href="${pageFile("analytics.html")}">◫ &nbsp; Analytics</a><a href="${pageFile("parkingmap.html")}">Ⓟ &nbsp; All parking spots</a>` : ""}
        <a href="${pageFile("map.html")}">⌖ &nbsp; Parking lot map</a>
        <a href="${pageFile("help.html")}">? &nbsp; Help and app guide</a>
        <a href="${rootPrefix}roles.html">♙ &nbsp; Change role</a>
        <button onclick="Renewal.signOut()">↪ &nbsp; Sign out</button>
        <div class="drawer-user">${esc(userLabel)}<br><strong>${esc(APP.roleLabels[currentRole] || "Volunteer")}</strong></div>
      </nav></div>
      <main class="page-shell">${pageContent}</main>
      <nav class="bottom-nav" aria-label="Bottom navigation">
        ${navigationItems(active)
        .map(
          ([key, icon, label, href]) => `
          <a class="${key === active ? "active" : ""}" href="${href}">
            <span>${icon}</span>
            <span>${label}</span>
          </a>`,
        )
        .join("")}
      </nav>`,
    );
    updateSyncPill();
  }

  function toggleDrawer(open) {
    document.getElementById("drawerBackdrop")?.classList.toggle("open", open);
  }

  function closeDrawerFromBackdrop(event) {
    if (event.target?.id === "drawerBackdrop") toggleDrawer(false);
  }

  function updateSyncPill(temporaryState) {
    const pill = document.getElementById("syncPill");
    const text = document.getElementById("syncText");
    if (!pill || !text) return;
    const displayState =
      temporaryState || (state.connected ? "online" : "offline");
    pill.dataset.state = displayState;
    if (displayState === "saving") text.textContent = "Saving…";
    else if (displayState === "offline") text.textContent = "Offline";
    else if (state.lastSavedAt)
      text.textContent = `Saved ${new Date(state.lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    else text.textContent = "Connected";
  }

  async function write(promise) {
    updateSyncPill("saving");
    try {
      const result = await promise;
      state.lastSavedAt = Date.now();
      updateSyncPill();
      return result;
    } catch (error) {
      updateSyncPill();
      alert(error.message || "The change could not be saved.");
      throw error;
    }
  }


  function watchConnection() {
    firebase
      .database()
      .ref(".info/connected")
      .on("value", (snapshot) => {
        state.connected = snapshot.val() === true;
        updateSyncPill();
        if (state.connected && state.eventId) startPresence();
      });
  }

  function startPresence() {
    if (!state.user || !state.eventId) return;
    clearInterval(state.presenceTimer);
    const path = `presence/${state.eventId}/${state.user.uid}/${state.sessionId}`;
    const ref = firebase.database().ref(path);
    const data = {
      online: true,
      uid: state.user.uid,
      email: state.user.email || "",
      displayName: state.user.displayName || "Volunteer",
      role: currentRole || "viewer",
      page,
      connectedAt: serverTime(),
      lastSeen: serverTime(),
    };
    ref.onDisconnect().update({ online: false, lastSeen: serverTime() });
    ref.update(data);
    const historyRef = firebase
      .database()
      .ref(`${eventPath("connections")}/${state.user.uid}/${state.sessionId}`);
    historyRef.update({ ...data, firstConnectedAt: serverTime() });
    state.presenceTimer = setInterval(() => {
      ref.update({ online: true, lastSeen: serverTime(), page });
      historyRef.update({
        lastSeen: serverTime(),
        page,
        role: currentRole || "viewer",
      });
    }, 30000);
  }

  function clearEventListeners() {
    state.listeners.forEach(({ ref, eventName, callback }) =>
      ref.off(eventName, callback),
    );
    state.listeners = [];
  }

  function listen(ref, eventName, callback) {
    ref.on(eventName, callback);
    state.listeners.push({ ref, eventName, callback });
  }

  function watchActiveEvent(onReady) {
    firebase
      .database()
      .ref("config/activeEventId")
      .on("value", (snapshot) => {
        const nextEvent = snapshot.val() || APP.defaultEventId;
        if (nextEvent === state.eventId) return;
        clearEventListeners();
        state.eventId = nextEvent;
        state.vehicles = {};
        state.bags = {};
        state.deliveries = {};
        state.removed = {};
        state.activity = {};
        state.presence = {};
        state.volunteerCheckins = {};
        state.checkInSettings = {};
        startPresence();
        onReady();
      });
  }

  function listenCore(callback) {
    const mappings = [
      ["vehicles", "vehicles"],
      ["bags", "bags"],
      ["deliveries", "deliveries"],
      ["removed", "removed"],
      ["activity", "activity"],
      ["volunteerCheckins", "volunteerCheckins"],
      ["checkinSettings", "checkInSettings"],
    ];
    mappings.forEach(([child, key]) => {
      const ref = firebase.database().ref(eventPath(child));
      const handler = (snapshot) => {
        state[key] = snapshot.val() || {};
        callback(key);
      };
      listen(ref, "value", handler);
    });
  }


  function statusOptions(selected = "") {
    return APP.statuses
      .map(
        (status) =>
          `<option value="${esc(status)}"${status === selected ? " selected" : ""}>${esc(status)}</option>`,
      )
      .join("");
  }

  function filterToolbar(extra = "") {
    return `<div class="toolbar">
      <label class="search-wrap"><span>⌕</span><input class="input" id="vehicleSearch" type="search" placeholder="Search by car # or spot #" value="${esc(state.search)}" oninput="Renewal.setSearch(this.value)"></label>
      <details class="filter-menu"><summary class="button ghost">Statuses ▾</summary><div class="filter-popover">
        ${APP.statuses.map((status) => `<label class="filter-option"><input type="checkbox" value="${esc(status)}" ${state.selectedStatuses.has(status) ? "checked" : ""} onchange="Renewal.toggleStatusFilter(this.value,this.checked)"><span>${esc(status)}</span></label>`).join("")}
        <button class="button secondary small full" type="button" onclick="Renewal.clearStatusFilters()">Show all statuses</button>
      </div></details>${extra}
    </div>`;
  }

  function setSearch(value) {
    state.search = String(value || "")
      .trim()
      .toLowerCase();
    if (page === "spots") renderSpots();
    else renderVehicleGrid();
  }

  function toggleStatusFilter(status, checked) {
    if (checked) state.selectedStatuses.add(status);
    else state.selectedStatuses.delete(status);
    if (page === "spots") renderSpots();
    else renderVehicleGrid();
  }

  function clearStatusFilters() {
    state.selectedStatuses.clear();
    document.querySelectorAll(".filter-option input").forEach((input) => {
      input.checked = false;
    });
    if (page === "spots") renderSpots();
    else renderVehicleGrid();
  }

  function roleVisible(vehicle) {
    if (currentRole === "registration")
      return ["In-Car", "Fetch-to-shop", "Awaiting Shopper"].includes(
        vehicle.status,
      );
    if (currentRole === "shopper")
      return ["Awaiting Shopper", "Shopping"].includes(vehicle.status);
    if (currentRole === "wrapper")
      return ["Shopping", "Wrapping"].includes(vehicle.status);
    if (currentRole === "reindeer")
      return vehicle.status === "Waiting for Reindeer";
    return true;
  }

  function filteredVehicles() {
    return Object.entries(state.vehicles)
      .map(([id, vehicle]) => ({ id, ...vehicle }))
      .filter(roleVisible)
      .filter(
        (vehicle) =>
          !state.selectedStatuses.size ||
          state.selectedStatuses.has(vehicle.status),
      )
      .filter((vehicle) => {
        if (!state.search) return true;
        return (
          String(vehicle.carNumber || "")
            .toLowerCase()
            .includes(state.search) ||
          String(vehicle.parkingSpot || "")
            .toLowerCase()
            .includes(state.search)
        );
      })
      .sort((a, b) => Number(a.parkingSpot) - Number(b.parkingSpot));
  }

  function vehicleCard(vehicle) {
    // INJECTED HTML -> repeating vehicle card on all vehicle/spots pages.
    return `<button type="button" class="vehicle-card status-${slug(vehicle.status)}" onclick="Renewal.openVehicle('${esc(vehicle.id)}')">
      <div class="card-top"><div><div class="spot-number">Spot #${esc(vehicle.parkingSpot)}</div><div class="car-number">${esc(vehicle.carNumber)}</div></div><span class="language-tag">${esc(vehicle.language || "N/A")}</span></div>
      <div class="card-bottom"><span class="status-label">${esc(vehicle.status)}</span><span class="wait-time">${formatDuration(vehicle.parkedAt)}</span></div>
      ${vehicle.status === "Shopping" && vehicle.assignedShopperName ? `<div class="wait-time" style="margin-top:9px">Shopper: ${esc(vehicle.assignedShopperName)}</div>` : ""}
      ${vehicle.status === "Wrapping" ? `<div class="wait-time" style="margin-top:9px">${vehicle.bagCount ? `${esc(vehicle.completedBagCount || 0)}/${esc(vehicle.bagCount)} bags complete` : "Waiting for bag number"}</div>` : ""}
    </button>`;
  }

  function renderVehiclePage() {
    const title = APP.roleLabels[currentRole];
    const descriptions = {
      parking: "Add vehicles and send arrived families to the next stage.",
      registration:
        "Fetch families, complete registration, and place them in the shopper queue.",
      shopper:
        "Check shoppers in, assign a waiting ticket, and track active shopping.",
      wrapper: "Choose gift wrap or send no-wrap gifts directly to Reindeer.",
      reindeer:
        "Vehicles appear after every bag is complete or gift wrapping is marked unnecessary.",
    };
    const extra =
      currentRole === "parking"
        ? `<button class="button" onclick="Renewal.openAddVehicle()">＋ Add Vehicle</button>`
        : currentRole === "wrapper"
          ? `<a class="button" href="${pageFile("giftWrap.html")}" style="text-decoration:none">Gift Wrap Tracker</a>`
          : "";

    const deliveryUndo =
      currentRole === "reindeer" ? `<div id="deliveryUndo"></div>` : "";

    renderAppShell(
      title,
      `
      <div class="page-heading">
        <h2>${esc(title)}</h2>
        <p>${esc(descriptions[currentRole])}</p>
      </div>
      ${deliveryUndo}
      ${currentRole === "shopper" ? `<section class="panel shopper-roster-panel"><div class="panel-heading"><div><h3>Shopper Availability</h3><p>Volunteers checked in through the kiosk appear here until their shift ends or an administrator checks them out.</p></div></div><div id="shopperRoster" class="shopper-roster"></div></section>` : ""}
      ${filterToolbar(extra)}
      <div class="card-grid" id="vehicleGrid"></div>
      <div id="modalRoot"></div>
    `,
      "list",
    );

    renderVehicleGrid();
    renderDeliveryUndo();
    renderShopperRoster();
  }

  function renderVehicleGrid() {
    const grid = document.getElementById("vehicleGrid");
    if (!grid) return;
    const vehicles = filteredVehicles();
    grid.innerHTML = vehicles.length
      ? vehicles.map(vehicleCard).join("")
      : `<div class="empty-state"><strong>No matching vehicles</strong><br>Try another search or status filter.</div>`;
  }

  function openAddVehicle() {
    document.getElementById("modalRoot").innerHTML = modal(
      `Add Vehicle`,
      `
      <form onsubmit="Renewal.createVehicle(event)">
        <div class="form-grid two">
          <div class="field">
            <label for="addSpot">Parking Spot #</label>
            <input class="input" id="addSpot" name="parkingSpot" type="number" min="1" max="${APP.totalSpots}" required>
          </div>
          <div class="field">
            <label for="addCar">Car / Ticket Number</label>
            <input class="input" id="addCar" name="carNumber" maxlength="20" required>
          </div>
          <div class="field">
            <label for="addLanguage">Language</label>
            <select class="select" id="addLanguage" name="language">
              <option>English</option>
              <option>Spanish</option>
              <option>Other</option>
            </select>
          </div>
          <div class="field">
            <label>Status</label>
            <input class="input" value="In-Car" disabled>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="button secondary" onclick="Renewal.closeModal()">Cancel</button>
          <button class="button" type="submit">Add Vehicle</button>
        </div>
      </form>`,
    );
    openModalElement();
  }

  function modal(title, content) {
    return `
      <div class="modal" id="appModal" role="dialog" aria-modal="true">
        <div class="modal-card">
          <div class="modal-head">
            <h2>${esc(title)}</h2>
            <button class="icon-button" aria-label="Close" onclick="Renewal.closeModal()">×</button>
          </div>
          ${content}
        </div>
      </div>`;
  }

  function openModalElement() {
    requestAnimationFrame(() =>
      document.getElementById("appModal")?.classList.add("open"),
    );
  }

  function closeModal() {
    document.getElementById("appModal")?.classList.remove("open");
    setTimeout(() => {
      const root = document.getElementById("modalRoot");
      if (root) root.innerHTML = "";
    }, 120);
  }

  async function createVehicle(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parkingSpot = String(Number(form.get("parkingSpot")));
    const carNumber = normalizeCarNumber(form.get("carNumber"));
    const language = String(form.get("language") || "English");
    if (
      !carNumber ||
      Number(parkingSpot) < 1 ||
      Number(parkingSpot) > APP.totalSpots
    )
      return alert("Enter a valid parking spot and car number.");
    const duplicate = Object.values(state.vehicles).some(
      (vehicle) => normalizeCarNumber(vehicle.carNumber) === carNumber,
    );
    const occupied = Object.values(state.vehicles).some(
      (vehicle) => String(vehicle.parkingSpot) === parkingSpot,
    );
    if (duplicate)
      return alert(`${carNumber} is already active in the parking app.`);
    if (occupied)
      return alert(`Parking spot ${parkingSpot} is already occupied.`);
    const vehicleRef = firebase.database().ref(eventPath("vehicles")).push();
    const activityRef = firebase.database().ref(eventPath("activity")).push();
    const vehicle = {
      carNumber,
      parkingSpot,
      language,
      status: "In-Car",
      parkedAt: serverTime(),
      statusChangedAt: serverTime(),
      notes: "",
      createdBy: state.user.uid,
      createdByName: state.user.displayName || state.user.email || "Parking",
    };
    const updates = {};
    updates[`${eventPath("vehicles")}/${vehicleRef.key}`] = vehicle;
    updates[`${eventPath("spotIndex")}/${parkingSpot}`] = vehicleRef.key;
    updates[`${eventPath("carIndex")}/${carNumber}`] = vehicleRef.key;
    updates[
      `${eventPath("statusHistory")}/${vehicleRef.key}/${activityRef.key}`
    ] = { status: "In-Car", at: serverTime(), by: state.user.uid };
    updates[`${eventPath("activity")}/${activityRef.key}`] = activity(
      "Vehicle added",
      vehicle,
      "In-Car",
    );
    await write(firebase.database().ref().update(updates));
    closeModal();
  }

  function activeShopperEntries() {
    return Object.entries(state.volunteerCheckins)
      .map(([uid, item]) => ({ uid, ...item }))
      .filter(
        (item) =>
          item.role === "shopper" &&
          item.status !== "checked-out" &&
          (!Number(item.shiftEndAt) || Number(item.shiftEndAt) > Date.now()),
      )
      .sort((a, b) =>
        String(a.displayName || a.email).localeCompare(
          String(b.displayName || b.email),
        ),
      );
  }

  function renderShopperRoster() {
    const roster = document.getElementById("shopperRoster");
    if (!roster) return;
    const shoppers = activeShopperEntries();
    roster.innerHTML = shoppers.length
      ? shoppers
        .map((shopper) => {
          const status = shopper.status || "available";
          return `<div class="shopper-chip shopper-${esc(status)}"><strong>${esc(shopper.displayName || shopper.email || "Shopper")}</strong><span>${esc(status.replace("-", " "))}</span>${shopper.currentCarNumber ? `<small>Ticket ${esc(shopper.currentCarNumber)}</small>` : `<small>${esc(shopper.timeSlotLabel || "Checked in")}</small>`}</div>`;
        })
        .join("")
      : `<div class="empty-state compact">No shoppers are checked in.</div>`;
  }

  function openShopperAssignment(vehicleId) {
    const vehicle = state.vehicles[vehicleId];
    if (!vehicle || !["Awaiting Shopper", "Shopping"].includes(vehicle.status))
      return;
    const reassigning = vehicle.status === "Shopping";
    const available = activeShopperEntries().filter(
      (shopper) => shopper.status === "available",
    );
    document.getElementById("modalRoot").innerHTML = modal(
      reassigning ? "Reassign Shopper" : "Assign a Shopper",
      `
      <div class="alert">Ticket <strong>${esc(vehicle.carNumber)}</strong> · Spot ${esc(vehicle.parkingSpot)}</div>
      ${reassigning && vehicle.assignedShopperName ? `<p>Currently assigned to <strong>${esc(vehicle.assignedShopperName)}</strong>.</p>` : ""}
      ${available.length ? `<form onsubmit="Renewal.assignShopper(event,'${esc(vehicleId)}')"><div class="field"><label>Available shopper</label><select class="select" name="shopperUid" required><option value="">Select a shopper</option>${available.map((shopper) => `<option value="${esc(shopper.uid)}">${esc(shopper.displayName || shopper.email)}</option>`).join("")}</select></div><div class="modal-actions"><button type="button" class="button secondary" onclick="Renewal.closeModal()">Cancel</button><button class="button success" type="submit">${reassigning ? "Reassign" : "Assign &amp; Start"}</button></div></form>` : `<div class="empty-state compact">No available shoppers. Have volunteers use the check-in kiosk or ask an administrator to confirm the roster.</div><button class="button secondary full" onclick="Renewal.closeModal()">Close</button>`}
    `,
    );
    openModalElement();
  }

  async function assignShopper(event, vehicleId) {
    event.preventDefault();
    const vehicle = state.vehicles[vehicleId];
    const shopperUid = String(
      new FormData(event.currentTarget).get("shopperUid") || "",
    );
    const shopper = state.volunteerCheckins[shopperUid];
    if (!vehicle || !["Awaiting Shopper", "Shopping"].includes(vehicle.status))
      return alert("This ticket can no longer be assigned from this screen.");
    if (!shopper || shopper.status !== "available")
      return alert(
        "That shopper is no longer available. Choose another shopper.",
      );
    const historyRef = firebase
      .database()
      .ref(`${eventPath("statusHistory")}/${vehicleId}`)
      .push();
    const activityRef = firebase.database().ref(eventPath("activity")).push();
    const updates = {};
    updates[`${eventPath("vehicles")}/${vehicleId}/status`] = "Shopping";
    if (vehicle.status !== "Shopping")
      updates[`${eventPath("vehicles")}/${vehicleId}/statusChangedAt`] =
        serverTime();
    updates[`${eventPath("vehicles")}/${vehicleId}/assignedShopperUid`] =
      shopperUid;
    updates[`${eventPath("vehicles")}/${vehicleId}/assignedShopperName`] =
      shopper.displayName || shopper.email || "Shopper";
    updates[`${eventPath("vehicles")}/${vehicleId}/shopperAssignedAt`] =
      serverTime();
    updates[`${eventPath("volunteerCheckins")}/${shopperUid}/status`] = "busy";
    updates[
      `${eventPath("volunteerCheckins")}/${shopperUid}/currentVehicleId`
    ] = vehicleId;
    updates[
      `${eventPath("volunteerCheckins")}/${shopperUid}/currentCarNumber`
    ] = vehicle.carNumber;
    updates[`${eventPath("volunteerCheckins")}/${shopperUid}/lastSeen`] =
      serverTime();
    if (
      vehicle.assignedShopperUid &&
      vehicle.assignedShopperUid !== shopperUid
    ) {
      updates[
        `${eventPath("volunteerCheckins")}/${vehicle.assignedShopperUid}/status`
      ] = "available";
      updates[
        `${eventPath("volunteerCheckins")}/${vehicle.assignedShopperUid}/currentVehicleId`
      ] = null;
      updates[
        `${eventPath("volunteerCheckins")}/${vehicle.assignedShopperUid}/currentCarNumber`
      ] = null;
    }
    if (vehicle.status !== "Shopping")
      updates[`${eventPath("statusHistory")}/${vehicleId}/${historyRef.key}`] =
      {
        from: vehicle.status,
        status: "Shopping",
        at: serverTime(),
        by: state.user.uid,
        shopperUid,
      };
    updates[`${eventPath("activity")}/${activityRef.key}`] = activity(
      `${vehicle.status === "Shopping" ? "Reassigned" : "Assigned"} ${shopper.displayName || shopper.email || "shopper"}${vehicle.status === "Shopping" ? "" : " and started Shopping"}`,
      { id: vehicleId, ...vehicle },
      "Shopping",
    );
    await write(firebase.database().ref().update(updates));
    closeModal();
  }

  async function skipGiftWrap(id) {
    const vehicle = state.vehicles[id];
    if (currentRole !== "wrapper" || !vehicle || vehicle.status !== "Shopping")
      return;
    if (
      !confirm(
        `Send ${vehicle.carNumber} directly to Reindeer with no gift wrapping?`,
      )
    )
      return;
    const historyRef = firebase
      .database()
      .ref(`${eventPath("statusHistory")}/${id}`)
      .push();
    const activityRef = firebase.database().ref(eventPath("activity")).push();
    const updates = {};
    updates[`${eventPath("vehicles")}/${id}/status`] = "Waiting for Reindeer";
    updates[`${eventPath("vehicles")}/${id}/statusChangedAt`] = serverTime();
    updates[`${eventPath("vehicles")}/${id}/wrapPreference`] = "not-needed";
    updates[`${eventPath("vehicles")}/${id}/noWrapAt`] = serverTime();
    updates[`${eventPath("vehicles")}/${id}/noWrapBy`] = state.user.uid;
    updates[`${eventPath("statusHistory")}/${id}/${historyRef.key}`] = {
      from: vehicle.status,
      status: "Waiting for Reindeer",
      at: serverTime(),
      by: state.user.uid,
      reason: "No gift wrap needed",
    };
    updates[`${eventPath("activity")}/${activityRef.key}`] = activity(
      "No gift wrap needed; sent to Reindeer",
      { id, ...vehicle },
      "Waiting for Reindeer",
    );
    if (vehicle.assignedShopperUid) {
      updates[
        `${eventPath("volunteerCheckins")}/${vehicle.assignedShopperUid}/status`
      ] = "available";
      updates[
        `${eventPath("volunteerCheckins")}/${vehicle.assignedShopperUid}/currentVehicleId`
      ] = null;
      updates[
        `${eventPath("volunteerCheckins")}/${vehicle.assignedShopperUid}/currentCarNumber`
      ] = null;
    }
    await write(firebase.database().ref().update(updates));
    closeModal();
  }

  function nextAction(vehicle) {
    const transitions = {
      registration: {
        "In-Car": ["Fetch-to-shop", "Fetch for Registration"],
        "Fetch-to-shop": ["Awaiting Shopper", "Registration Complete"],
      },
    };
    return transitions[currentRole]?.[vehicle.status] || null;
  }

  function openVehicle(id) {
    const vehicle = state.vehicles[id];
    if (!vehicle) return;
    const isAdmin = currentRole === "admin";
    const next = nextAction(vehicle);
    const reindeerAction =
      currentRole === "reindeer" && vehicle.status === "Waiting for Reindeer";
    const wrapBlocked =
      currentRole === "wrapper" && vehicle.status === "Wrapping";
    const shopperAssignment =
      currentRole === "shopper" && vehicle.status === "Awaiting Shopper";
    const shopperReassignment =
      currentRole === "shopper" && vehicle.status === "Shopping";
    const wrapDecision =
      currentRole === "wrapper" && vehicle.status === "Shopping";
    const immutable = isAdmin ? "" : "disabled";

    document.getElementById("modalRoot").innerHTML = modal(
      "Vehicle Details",
      `
      ${wrapBlocked
        ? `
        <div class="alert">
          This vehicle advances automatically when all
          ${esc(vehicle.bagCount || "required")} bags are completed in the Gift Wrap Tracker.
        </div>`
        : ""
      }

      <form onsubmit="Renewal.saveVehicle(event,'${esc(id)}')">
        <div class="form-grid two">
          <div class="field">
            <label>Parking Spot #</label>
            <input class="input" name="parkingSpot" type="number" min="1" max="${APP.totalSpots}"
              value="${esc(vehicle.parkingSpot)}" ${immutable}>
          </div>
          <div class="field">
            <label>Car / Ticket Number</label>
            <input class="input" name="carNumber" value="${esc(vehicle.carNumber)}" ${immutable}>
          </div>
          <div class="field">
            <label>Language</label>
            <select class="select" name="language" ${immutable}>
              ${["English", "Spanish", "Other"]
        .map(
          (item) => `
                <option${item === vehicle.language ? " selected" : ""}>${item}</option>
              `,
        )
        .join("")}
            </select>
          </div>
          <div class="field">
            <label>Status</label>
            ${isAdmin
        ? `<select class="select" name="status">${statusOptions(vehicle.status)}</select>`
        : `<input class="input" value="${esc(vehicle.status)}" disabled>`
      }
          </div>
        </div>

        <div class="field" style="margin-top:12px">
          <label>Team Notes</label>
          <textarea class="textarea" name="notes" placeholder="Optional note for other teams" ${currentRole === "reindeer" ? "disabled" : ""}>${esc(vehicle.notes || "")}</textarea>
        </div>

        <div class="field" style="margin-top:12px">
          <small>Arrived ${formatDate(vehicle.parkedAt)} · Waiting ${formatDuration(vehicle.parkedAt)}</small>
        </div>

        <div class="modal-actions">
          <button type="button" class="button secondary" onclick="Renewal.closeModal()">Cancel</button>
          ${currentRole === "reindeer" ? "" : `<button class="button" type="submit">Save Changes</button>`}
        </div>
      </form>

      ${next
        ? `
        <button class="button success full" style="margin-top:10px"
          onclick="Renewal.advanceVehicle('${esc(id)}','${esc(next[0])}')">
          ${esc(next[1])}
        </button>`
        : ""
      }

      ${shopperAssignment
        ? `
        <button class="button success full" style="margin-top:10px"
          onclick="Renewal.openShopperAssignment('${esc(id)}')">
          Assign Shopper &amp; Start Shopping
        </button>`
        : ""
      }

      ${shopperReassignment
        ? `
        <button class="button ghost full" style="margin-top:10px"
          onclick="Renewal.openShopperAssignment('${esc(id)}')">
          Reassign Shopper
        </button>`
        : ""
      }

      ${wrapDecision
        ? `
        <div class="wrap-decision">
          <button class="button success full" onclick="Renewal.advanceVehicle('${esc(id)}','Wrapping')">Send to Gift Wrap</button>
          <button class="button secondary full" onclick="Renewal.skipGiftWrap('${esc(id)}')">No Gift Wrap Needed</button>
        </div>`
        : ""
      }

      ${reindeerAction
        ? `
        <button class="button success full" style="margin-top:10px"
          onclick="Renewal.markDelivered('${esc(id)}')">
          Mark as Delivered
        </button>`
        : ""
      }

      ${isAdmin
        ? `
        <div class="danger-zone">
          <button class="button danger full" onclick="Renewal.adminRemoveVehicle('${esc(id)}')">
            Remove Vehicle from Active Event
          </button>
        </div>`
        : ""
      }
    `,
    );
    openModalElement();
  }

  async function saveVehicle(event, id) {
    event.preventDefault();
    const vehicle = state.vehicles[id];
    if (!vehicle) return;
    const form = new FormData(event.currentTarget);
    if (currentRole !== "admin") {
      await write(
        firebase
          .database()
          .ref(`${eventPath("vehicles")}/${id}/notes`)
          .set(String(form.get("notes") || "").trim()),
      );
      closeModal();
      return;
    }
    const parkingSpot = String(Number(form.get("parkingSpot")));
    const carNumber = normalizeCarNumber(form.get("carNumber"));
    const status = String(form.get("status"));
    const occupied = Object.entries(state.vehicles).some(
      ([otherId, item]) =>
        otherId !== id && String(item.parkingSpot) === parkingSpot,
    );
    const duplicate = Object.entries(state.vehicles).some(
      ([otherId, item]) =>
        otherId !== id && normalizeCarNumber(item.carNumber) === carNumber,
    );
    if (occupied || duplicate)
      return alert(
        occupied
          ? `Spot ${parkingSpot} is occupied.`
          : `${carNumber} is already active.`,
      );
    const updates = {};
    updates[`${eventPath("vehicles")}/${id}/parkingSpot`] = parkingSpot;
    updates[`${eventPath("vehicles")}/${id}/carNumber`] = carNumber;
    updates[`${eventPath("vehicles")}/${id}/language`] = String(
      form.get("language"),
    );
    updates[`${eventPath("vehicles")}/${id}/notes`] = String(
      form.get("notes") || "",
    ).trim();
    if (parkingSpot !== String(vehicle.parkingSpot)) {
      updates[`${eventPath("spotIndex")}/${vehicle.parkingSpot}`] = null;
      updates[`${eventPath("spotIndex")}/${parkingSpot}`] = id;
    }
    if (carNumber !== vehicle.carNumber) {
      updates[`${eventPath("carIndex")}/${vehicle.carNumber}`] = null;
      updates[`${eventPath("carIndex")}/${carNumber}`] = id;
    }
    await write(firebase.database().ref().update(updates));
    if (status !== vehicle.status)
      await setVehicleStatus(id, status, "Administrator corrected status");
    closeModal();
  }

  function activity(action, vehicle, status = vehicle.status) {
    return {
      action,
      vehicleId: vehicle.id || "",
      carNumber: vehicle.carNumber,
      parkingSpot: vehicle.parkingSpot,
      status,
      at: serverTime(),
      by: state.user.uid,
      byName:
        state.user.displayName ||
        state.user.email ||
        APP.roleLabels[currentRole],
    };
  }

  async function setVehicleStatus(
    id,
    status,
    actionText,
    bagsVerified = false,
  ) {
    const vehicle = state.vehicles[id];
    if (!vehicle || !APP.statuses.includes(status)) return;
    if (
      status === "Waiting for Reindeer" &&
      currentRole !== "admin" &&
      !bagsVerified
    ) {
      const bags = Object.values(state.bags).filter(
        (bag) => bag.vehicleId === id,
      );
      if (
        !vehicle.bagCount ||
        bags.length !== Number(vehicle.bagCount) ||
        !bags.every((bag) => bag.status === "completed")
      ) {
        alert(
          "This vehicle cannot move to Waiting for Reindeer until every bag is completed in the Gift Wrap Tracker.",
        );
        return;
      }
    }
    const historyRef = firebase
      .database()
      .ref(`${eventPath("statusHistory")}/${id}`)
      .push();
    const activityRef = firebase.database().ref(eventPath("activity")).push();
    const updates = {};
    updates[`${eventPath("vehicles")}/${id}/status`] = status;
    updates[`${eventPath("vehicles")}/${id}/statusChangedAt`] = serverTime();
    if (status === "Wrapping") {
      updates[`${eventPath("vehicles")}/${id}/wrapStartedAt`] = serverTime();
      updates[`${eventPath("vehicles")}/${id}/wrapPreference`] = "wrap";
    }
    updates[`${eventPath("statusHistory")}/${id}/${historyRef.key}`] = {
      from: vehicle.status,
      status,
      at: serverTime(),
      by: state.user.uid,
    };
    updates[`${eventPath("activity")}/${activityRef.key}`] = activity(
      actionText || `Moved to ${status}`,
      { id, ...vehicle },
      status,
    );
    if (
      vehicle.status === "Shopping" &&
      status !== "Shopping" &&
      vehicle.assignedShopperUid
    ) {
      updates[
        `${eventPath("volunteerCheckins")}/${vehicle.assignedShopperUid}/status`
      ] = "available";
      updates[
        `${eventPath("volunteerCheckins")}/${vehicle.assignedShopperUid}/currentVehicleId`
      ] = null;
      updates[
        `${eventPath("volunteerCheckins")}/${vehicle.assignedShopperUid}/currentCarNumber`
      ] = null;
      updates[
        `${eventPath("volunteerCheckins")}/${vehicle.assignedShopperUid}/lastSeen`
      ] = serverTime();
    }
    await write(firebase.database().ref().update(updates));
  }

  async function advanceVehicle(id, status) {
    await setVehicleStatus(
      id,
      status,
      `Moved from ${state.vehicles[id]?.status} to ${status}`,
    );
    closeModal();
  }

  async function markDelivered(id) {
    const vehicle = state.vehicles[id];
    if (!vehicle || vehicle.status !== "Waiting for Reindeer")
      return alert("Only vehicles waiting for Reindeer can be delivered.");
    if (
      !confirm(
        `Mark ${vehicle.carNumber} in spot ${vehicle.parkingSpot} as delivered?`,
      )
    )
      return;
    const deliveryRef = firebase.database().ref(eventPath("deliveries")).push();
    const activityRef = firebase.database().ref(eventPath("activity")).push();
    const delivered = {
      ...vehicle,
      vehicleId: id,
      deliveredAt: serverTime(),
      deliveredBy: state.user.uid,
      deliveredByName: state.user.displayName || state.user.email || "Reindeer",
    };
    const updates = {};
    updates[`${eventPath("deliveries")}/${deliveryRef.key}`] = delivered;
    updates[`${eventPath("vehicles")}/${id}`] = null;
    updates[`${eventPath("spotIndex")}/${vehicle.parkingSpot}`] = null;
    updates[`${eventPath("carIndex")}/${vehicle.carNumber}`] = null;
    updates[`${eventPath("activity")}/${activityRef.key}`] = activity(
      "Marked as delivered",
      { id, ...vehicle },
      "Delivered",
    );
    await write(firebase.database().ref().update(updates));
    localStorage.setItem(
      `renewalLastDelivery:${state.eventId}`,
      deliveryRef.key,
    );
    closeModal();
    renderDeliveryUndo();
  }

  function renderDeliveryUndo() {
    const container = document.getElementById("deliveryUndo");
    if (!container || !state.eventId) return;
    const id = localStorage.getItem(`renewalLastDelivery:${state.eventId}`);
    const delivery = id && state.deliveries[id];
    container.innerHTML = delivery
      ? `<div class="alert success">Last delivery: <strong>${esc(delivery.carNumber)}</strong> from spot ${esc(delivery.parkingSpot)}. <button class="button ghost small" onclick="Renewal.undoDelivery('${esc(id)}')">Undo delivery</button></div>`
      : "";
  }

  async function undoDelivery(deliveryId) {
    const delivery = state.deliveries[deliveryId];
    if (!delivery)
      return alert("That delivery is no longer available to undo.");
    const occupied = Object.values(state.vehicles).some(
      (vehicle) => String(vehicle.parkingSpot) === String(delivery.parkingSpot),
    );
    if (occupied)
      return alert(
        `Spot ${delivery.parkingSpot} is occupied, so this delivery cannot be restored.`,
      );
    if (!confirm(`Restore ${delivery.carNumber} to active vehicles?`)) return;
    const { vehicleId, deliveredAt, deliveredBy, deliveredByName, ...vehicle } =
      delivery;
    const activityRef = firebase.database().ref(eventPath("activity")).push();
    const updates = {};
    updates[`${eventPath("vehicles")}/${vehicleId}`] = vehicle;
    updates[`${eventPath("deliveries")}/${deliveryId}`] = null;
    updates[`${eventPath("spotIndex")}/${vehicle.parkingSpot}`] = vehicleId;
    updates[`${eventPath("carIndex")}/${vehicle.carNumber}`] = vehicleId;
    updates[`${eventPath("activity")}/${activityRef.key}`] = activity(
      "Delivery undone",
      { id: vehicleId, ...vehicle },
    );
    await write(firebase.database().ref().update(updates));
    localStorage.removeItem(`renewalLastDelivery:${state.eventId}`);
    renderDeliveryUndo();
  }

  async function adminRemoveVehicle(id) {
    const vehicle = state.vehicles[id];
    if (!vehicle || currentRole !== "admin") return;
    if (
      !confirm(
        `ADMIN REMOVE: Remove ${vehicle.carNumber} from the active event? This is separate from delivery.`,
      )
    )
      return;
    const removalRef = firebase.database().ref(eventPath("removed")).push();
    const activityRef = firebase.database().ref(eventPath("activity")).push();
    const removed = {
      ...vehicle,
      vehicleId: id,
      removedAt: serverTime(),
      removedBy: state.user.uid,
      removedByName:
        state.user.displayName || state.user.email || "Administrator",
    };
    const updates = {};
    updates[`${eventPath("removed")}/${removalRef.key}`] = removed;
    updates[`${eventPath("vehicles")}/${id}`] = null;
    updates[`${eventPath("spotIndex")}/${vehicle.parkingSpot}`] = null;
    updates[`${eventPath("carIndex")}/${vehicle.carNumber}`] = null;
    updates[`${eventPath("activity")}/${activityRef.key}`] = activity(
      "Administrator removed vehicle",
      { id, ...vehicle },
    );
    await write(firebase.database().ref().update(updates));
    closeModal();
  }

  async function restoreRemoval(removalId) {
    const removed = state.removed[removalId];
    if (!removed || currentRole !== "admin") return;
    const occupied = Object.values(state.vehicles).some(
      (vehicle) => String(vehicle.parkingSpot) === String(removed.parkingSpot),
    );
    if (occupied)
      return alert(
        `Spot ${removed.parkingSpot} is occupied. Change that vehicle first.`,
      );
    const { vehicleId, removedAt, removedBy, removedByName, ...vehicle } =
      removed;
    const activityRef = firebase.database().ref(eventPath("activity")).push();
    const updates = {};
    updates[`${eventPath("vehicles")}/${vehicleId}`] = vehicle;
    updates[`${eventPath("removed")}/${removalId}`] = null;
    updates[`${eventPath("spotIndex")}/${vehicle.parkingSpot}`] = vehicleId;
    updates[`${eventPath("carIndex")}/${vehicle.carNumber}`] = vehicleId;
    updates[`${eventPath("activity")}/${activityRef.key}`] = activity(
      "Administrator removal undone",
      { id: vehicleId, ...vehicle },
    );
    await write(firebase.database().ref().update(updates));
  }


  function renderGiftWrapPage() {
    renderAppShell(
      "Gift Wrap Tracker",
      `
      <div class="page-heading">
        <a class="back-link prominent-back" href="${pageFile("wrapper.html")}">← Back to Wrapper List</a>
        <h2>Gift Wrap Tracker</h2>
        <p>Vehicles enter here automatically when Wrapper changes them to Wrapping.</p>
      </div>

      <div class="metrics-grid wrap-metrics" id="wrapMetrics"></div>

      <section class="wrap-setup">
        <h3>Waiting for bag number</h3>
        <div class="card-grid" id="wrapSetupList"></div>
      </section>

      <div class="wrap-columns">
        <section class="wrap-column">
          <h3>Waiting <span id="waitingCount">0</span></h3>
          <div class="bag-list" id="waitingBags"></div>
        </section>
        <section class="wrap-column">
          <h3>In Progress <span id="activeCount">0</span></h3>
          <div class="bag-list" id="activeBags"></div>
        </section>
        <section class="wrap-column">
          <h3>Completed Vehicles <span id="completedCount">0</span></h3>
          <div class="bag-list" id="completedBags"></div>
        </section>
      </div>

      <details class="panel archive-panel">
        <summary>Archived Completed Gifts <span id="archivedCount">0</span></summary>
        <div class="bag-list" id="archivedBags"></div>
      </details>

      <div id="modalRoot"></div>
    `,
      "list",
    );
    renderWrapData();
  }

  function renderWrapData() {
    const setup = document.getElementById("wrapSetupList");
    if (!setup) return;
    const waitingSetup = Object.entries(state.vehicles)
      .map(([id, vehicle]) => ({ id, ...vehicle }))
      .filter(
        (vehicle) => vehicle.status === "Wrapping" && !Number(vehicle.bagCount),
      );
    setup.innerHTML = waitingSetup.length
      ? waitingSetup.map(vehicleCard).join("")
      : `<div class="empty-state">No vehicles are waiting for a bag number.</div>`;
    const bags = Object.entries(state.bags).map(([id, bag]) => ({
      id,
      ...bag,
    }));
    ["waiting", "active"].forEach((status) => {
      const items = bags
        .filter((bag) => bag.status === status && !bag.archived)
        .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
      const target = document.getElementById(`${status}Bags`);
      const count = document.getElementById(`${status}Count`);
      if (count) count.textContent = items.length;
      if (target)
        target.innerHTML = items.length
          ? items.map(bagCard).join("")
          : `<div class="empty-state" style="padding:18px 8px">Empty</div>`;
    });
    const completed = bags.filter(
      (bag) => bag.status === "completed" && !bag.archived,
    );
    const completedGroups = groupBagsByVehicle(completed);
    const completedCards = completedGroups.flatMap((group) => {
      const allVehicleBags = bags.filter(
        (bag) => bag.vehicleId === group.vehicleId && !bag.archived,
      );
      const fullyComplete =
        allVehicleBags.length === group.bags.length &&
        allVehicleBags.every((bag) => bag.status === "completed");
      return fullyComplete
        ? [completedVehicleCard(group)]
        : group.bags.map(bagCard);
    });
    const completedTarget = document.getElementById("completedBags");
    const completedCount = document.getElementById("completedCount");
    if (completedCount) completedCount.textContent = completedCards.length;
    if (completedTarget)
      completedTarget.innerHTML = completedCards.length
        ? completedCards.join("")
        : `<div class="empty-state" style="padding:18px 8px">Empty</div>`;

    const archivedGroups = groupBagsByVehicle(
      bags.filter((bag) => bag.archived),
    );
    const archivedTarget = document.getElementById("archivedBags");
    const archivedCount = document.getElementById("archivedCount");
    if (archivedCount) archivedCount.textContent = archivedGroups.length;
    if (archivedTarget)
      archivedTarget.innerHTML = archivedGroups.length
        ? archivedGroups
          .map((group) => completedVehicleCard(group, true))
          .join("")
        : `<div class="empty-state compact">No archived gifts.</div>`;

    const finishedBags = bags.filter(
      (bag) => bag.status === "completed" && Number(bag.completedAt),
    );
    const bagDurations = finishedBags
      .map((bag) => Number(bag.completedAt) - Number(bag.assignedAt))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const avgBag = bagDurations.length
      ? bagDurations.reduce((sum, value) => sum + value, 0) /
      bagDurations.length
      : 0;
    const metrics = document.getElementById("wrapMetrics");
    if (metrics)
      metrics.innerHTML =
        metric("Completed Bags", finishedBags.length) +
        metric(
          "Average Bag Time",
          avgBag ? formatDuration(Date.now() - avgBag) : "—",
        ) +
        metric(
          "Active Bags",
          bags.filter((bag) => bag.status === "active").length,
        ) +
        metric("Archived Vehicles", archivedGroups.length);
  }

  function groupBagsByVehicle(bags) {
    const groups = new Map();
    bags.forEach((bag) => {
      const key = bag.vehicleId || `unknown-${bag.carNumber}`;
      if (!groups.has(key))
        groups.set(key, {
          vehicleId: bag.vehicleId || "",
          carNumber: bag.carNumber,
          parkingSpot: bag.parkingSpot,
          bags: [],
        });
      groups.get(key).bags.push(bag);
    });
    return [...groups.values()].sort(
      (a, b) =>
        Math.max(
          ...b.bags.map((item) =>
            Number(item.completedAt || item.archivedAt || 0),
          ),
        ) -
        Math.max(
          ...a.bags.map((item) =>
            Number(item.completedAt || item.archivedAt || 0),
          ),
        ),
    );
  }

  function completedVehicleCard(group, archived = false) {
    const bagTimes = group.bags
      .map((bag) => Number(bag.completedAt) - Number(bag.assignedAt))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const average = bagTimes.length
      ? bagTimes.reduce((sum, value) => sum + value, 0) / bagTimes.length
      : 0;
    return `<article class="bag-card completed-summary"><div class="bag-banner completed">${archived ? "Archived" : "All Bags Completed"}</div><strong>Ticket ${esc(group.carNumber)}</strong><div>Spot ${esc(group.parkingSpot)} · ${group.bags.length} bag${group.bags.length === 1 ? "" : "s"}</div><small>Average bag time ${average ? formatDuration(Date.now() - average) : "—"}</small>${archived ? "" : `<button class="button ghost small full" onclick="Renewal.archiveCompletedWrap('${esc(group.vehicleId)}')">Archive Completed Gifts</button>`}</article>`;
  }

  function bagCard(bag) {
    // INJECTED HTML -> repeating bag card on pages/giftWrap.html.
    return `<button type="button" class="bag-card" style="text-align:left;width:100%" onclick="Renewal.openBag('${esc(bag.id)}')"><div class="bag-banner ${esc(bag.status)}">${bag.status === "waiting" ? "Waiting for workstation" : bag.status === "active" ? `Workstation ${esc(bag.workStation || "")}` : "Completed"}</div><strong>Bag ${esc(bag.bagIndex)}/${esc(bag.bagMax)}</strong><div>Ticket ${esc(bag.carNumber)} · Spot ${esc(bag.parkingSpot)}</div></button>`;
  }

  function openWrapSetup(vehicleId) {
    const vehicle = state.vehicles[vehicleId];
    if (!vehicle) return;
    // INJECTED HTML -> Add Bag Number modal on pages/giftWrap.html.
    document.getElementById("modalRoot").innerHTML = modal(
      "Add Bag Number",
      `
      <div class="alert">
        Ticket <strong>${esc(vehicle.carNumber)}</strong> · Spot ${esc(vehicle.parkingSpot)}<br>
        This creates one tracker card per bag.
      </div>
      <form onsubmit="Renewal.createBags(event,'${esc(vehicleId)}')">
        <div class="field">
          <label>Total number of bags</label>
          <input class="input" type="number" name="bagCount" min="1" max="25" required autofocus>
        </div>
        <div class="modal-actions">
          <button type="button" class="button secondary" onclick="Renewal.closeModal()">Cancel</button>
          <button class="button" type="submit">Create Bag Trackers</button>
        </div>
      </form>`,
    );
    openModalElement();
  }

  async function createBags(event, vehicleId) {
    event.preventDefault();
    const vehicle = state.vehicles[vehicleId];
    const count = Number(new FormData(event.currentTarget).get("bagCount"));
    if (!vehicle || vehicle.status !== "Wrapping" || vehicle.bagCount)
      return alert(
        "Bag trackers were already created or this vehicle is no longer wrapping.",
      );
    if (!Number.isInteger(count) || count < 1 || count > 25)
      return alert("Enter between 1 and 25 bags.");
    const updates = {};
    updates[`${eventPath("vehicles")}/${vehicleId}/bagCount`] = count;
    updates[`${eventPath("vehicles")}/${vehicleId}/completedBagCount`] = 0;
    for (let index = 1; index <= count; index += 1) {
      const ref = firebase.database().ref(eventPath("bags")).push();
      updates[`${eventPath("bags")}/${ref.key}`] = {
        vehicleId,
        carNumber: vehicle.carNumber,
        parkingSpot: vehicle.parkingSpot,
        bagIndex: index,
        bagMax: count,
        status: "waiting",
        wrapped: false,
        workStation: "",
        createdAt: serverTime(),
      };
    }
    const activityRef = firebase.database().ref(eventPath("activity")).push();
    updates[`${eventPath("activity")}/${activityRef.key}`] = activity(
      `Created ${count} bag trackers`,
      { id: vehicleId, ...vehicle },
    );
    await write(firebase.database().ref().update(updates));
    closeModal();
  }

  function openBag(id) {
    const bag = state.bags[id];
    if (!bag) return;
    document.getElementById("modalRoot").innerHTML = modal(
      `Bag ${bag.bagIndex} of ${bag.bagMax}`,
      `<div class="alert">Ticket <strong>${esc(bag.carNumber)}</strong> · Spot ${esc(bag.parkingSpot)}</div><form onsubmit="Renewal.saveBag(event,'${esc(id)}')"><div class="field"><label>Workstation #</label><input class="input" name="workStation" value="${esc(bag.workStation || "")}" ${bag.status === "completed" ? "disabled" : ""} placeholder="Assign a table or station"></div><div class="field" style="margin-top:12px"><label>Status</label><input class="input" value="${esc(bag.status)}" disabled></div>${bag.status !== "completed" ? `<div class="modal-actions"><button type="button" class="button secondary" onclick="Renewal.closeModal()">Cancel</button><button class="button" type="submit">Save Assignment</button></div></form><button class="button success full" style="margin-top:10px" onclick="Renewal.completeBag('${esc(id)}')" ${bag.workStation ? "" : "disabled"}>Mark Bag Wrapped</button>` : `</form><button class="button secondary full" onclick="Renewal.closeModal()">Close</button>`}`,
    );
    openModalElement();
  }

  async function saveBag(event, id) {
    event.preventDefault();
    const bag = state.bags[id];
    if (!bag || bag.status === "completed") return;
    const workStation = String(
      new FormData(event.currentTarget).get("workStation") || "",
    ).trim();
    const updates = { workStation, status: workStation ? "active" : "waiting" };
    if (workStation && !bag.assignedAt) updates.assignedAt = serverTime();
    await write(
      firebase
        .database()
        .ref(`${eventPath("bags")}/${id}`)
        .update(updates),
    );
    closeModal();
  }

  async function completeBag(id) {
    const bag = state.bags[id];
    if (!bag || bag.status === "completed") return;
    if (!bag.workStation)
      return alert("Assign this bag to a workstation before completing it.");
    await write(
      firebase
        .database()
        .ref(`${eventPath("bags")}/${id}`)
        .update({
          status: "completed",
          wrapped: true,
          completedAt: serverTime(),
          completedBy: state.user.uid,
        }),
    );
    closeModal();
    setTimeout(() => checkWrapCompletion(bag.vehicleId), 100);
  }

  async function checkWrapCompletion(vehicleId) {
    const snapshot = await firebase
      .database()
      .ref(eventPath("bags"))
      .orderByChild("vehicleId")
      .equalTo(vehicleId)
      .once("value");
    const bags = Object.values(snapshot.val() || {});
    const vehicleSnap = await firebase
      .database()
      .ref(`${eventPath("vehicles")}/${vehicleId}`)
      .once("value");
    const vehicle = vehicleSnap.val();
    if (!vehicle) return;
    const completed = bags.filter((bag) => bag.status === "completed").length;
    await firebase
      .database()
      .ref(`${eventPath("vehicles")}/${vehicleId}/completedBagCount`)
      .set(completed);
    if (
      Number(vehicle.bagCount) > 0 &&
      bags.length === Number(vehicle.bagCount) &&
      completed === bags.length &&
      vehicle.status === "Wrapping"
    ) {
      await setVehicleStatus(
        vehicleId,
        "Waiting for Reindeer",
        "All bags completed; ready for Reindeer",
        true,
      );
    }
  }

  async function archiveCompletedWrap(vehicleId) {
    const bags = Object.entries(state.bags).filter(
      ([, bag]) =>
        bag.vehicleId === vehicleId &&
        bag.status === "completed" &&
        !bag.archived,
    );
    if (!bags.length) return;
    if (
      !confirm(
        `Archive the completed gift-wrap card for ticket ${bags[0][1].carNumber}?`,
      )
    )
      return;
    const updates = {};
    bags.forEach(([bagId]) => {
      updates[`${eventPath("bags")}/${bagId}/archived`] = true;
      updates[`${eventPath("bags")}/${bagId}/archivedAt`] = serverTime();
      updates[`${eventPath("bags")}/${bagId}/archivedBy`] = state.user.uid;
    });
    await write(firebase.database().ref().update(updates));
  }

  function renderAdminPage() {
    renderAppShell(
      "Administrator",
      `
      <div class="page-heading">
        <h2>Live Operations Dashboard</h2>
        <p>Active event: <strong id="eventName">${esc(state.eventId || APP.defaultEventId)}</strong></p>
      </div>

      <div class="toolbar">
        <button class="button" onclick="Renewal.createFreshEvent()">＋ Start Fresh Event</button>
        <a class="button ghost" href="${pageFile("parkingmap.html")}" style="text-decoration:none">View All 160 Spots</a>
        <a class="button ghost" href="${pageFile("analytics.html")}" style="text-decoration:none">Open Analytics</a>
        <button class="button ghost" onclick="Renewal.openInstances()">Connected Instances</button>
        <button class="button success" onclick="Renewal.launchVolunteerCheckin()">Volunteer Check-In Kiosk</button>
        <button class="button ghost" onclick="Renewal.openShiftSettings()">Edit Check-In Times</button>
      </div>

      <div class="metrics-grid" id="metrics"></div>

      <div class="dashboard-grid">
        <section class="panel">
          <h3>Status Breakdown</h3>
          <div id="statusBreakdown"></div>
        </section>
        <section class="panel">
          <div class="panel-heading"><h3>Synchronization</h3><button class="button ghost small" onclick="Renewal.openInstances()">View All</button></div>
          <div id="syncSummary"></div>
          <div class="device-list" id="deviceList"></div>
        </section>
        <section class="panel">
          <h3>Recent Activity</h3>
          <div class="activity-list" id="activityList"></div>
        </section>
        <section class="panel">
          <h3>User Access</h3>
          <p style="color:var(--muted);font-size:.82rem">
            Google users appear here after signing in once. Check the roles they may access.
          </p>
          <div class="user-admin-list" id="userList"></div>
        </section>
        <section class="panel wide">
          <div class="panel-heading"><div><h3>Volunteer Check-Ins</h3><p>Shopper availability expires automatically at the end of the selected shift.</p></div><button class="button ghost small" onclick="Renewal.openShiftSettings()">Edit Times</button></div>
          <div class="volunteer-admin-list" id="volunteerCheckinList"></div>
        </section>
        <section class="panel wide">
          <div class="panel-heading"><div><h3>Previous Events</h3><p>Open an event for its users, workflow totals, timing, and gift-wrap analytics.</p></div></div>
          <div class="event-list" id="eventList"></div>
        </section>
      </div>

      <div id="modalRoot"></div>
    `,
      "list",
    );
    renderAdminData();
  }

  function averageDuration(items, endField) {
    const durations = items
      .map((item) => Number(item[endField]) - Number(item.parkedAt))
      .filter((value) => Number.isFinite(value) && value >= 0);
    return durations.length
      ? durations.reduce((sum, value) => sum + value, 0) / durations.length
      : 0;
  }

  function renderAnalyticsPage() {
    // INJECTED HTML -> pages/analytics.html.
    renderAppShell(
      "Analytics",
      `
      <div class="page-heading analytics-heading">
        <a class="back-link" href="${pageFile("admin-page.html")}">← Dashboard</a>
        <h2>Event Analytics</h2>
        <p>Live timing and throughput for the active Christmas Store event.</p>
      </div>

      <section class="panel analytics-panel">
        <h3>Parking &amp; Family Workflow</h3>
        <div class="metrics-grid analytics-metrics" id="analyticsMetrics"></div>
      </section>

      <section class="panel analytics-panel">
        <h3>Average Time by Current Status</h3>
        <div class="analytics-status-list" id="analyticsStatusList"></div>
      </section>

      <section class="panel analytics-panel">
        <h3>Today’s Overview</h3>
        <div class="today-grid" id="todayOverview"></div>
      </section>

      <section class="panel analytics-panel">
        <h3>Gift Wrap Bags</h3>
        <div class="metrics-grid analytics-metrics" id="giftWrapMetrics"></div>
        <div class="analytics-status-list" id="giftWrapDetails"></div>
      </section>
    `,
      "stats",
    );
    renderAnalyticsData();
  }

  function renderAnalyticsData() {
    const metrics = document.getElementById("analyticsMetrics");
    if (!metrics) return;
    const vehicles = Object.values(state.vehicles);
    const delivered = Object.values(state.deliveries);
    const removed = Object.values(state.removed);
    const finished = [
      ...delivered.map((item) => ({ ...item, finishedAt: item.deliveredAt })),
      ...removed.map((item) => ({ ...item, finishedAt: item.removedAt })),
    ];
    const avgTotal = averageDuration(finished, "finishedAt");
    metrics.innerHTML =
      metric(
        "Average Parked Time (All)",
        avgTotal ? formatDuration(Date.now() - avgTotal) : "—",
      ) +
      metric("Total Delivered", delivered.length) +
      metric("Currently Parked", vehicles.length) +
      metric("Empty Spots", APP.totalSpots - vehicles.length);

    document.getElementById("analyticsStatusList").innerHTML = APP.statuses
      .map((status) => {
        const matching = vehicles.filter(
          (vehicle) =>
            vehicle.status === status && Number(vehicle.statusChangedAt),
        );
        const average = matching.length
          ? matching.reduce(
            (sum, vehicle) =>
              sum + (Date.now() - Number(vehicle.statusChangedAt)),
            0,
          ) / matching.length
          : 0;
        return `<div class="analytics-status-row status-${slug(status)}"><span><i aria-hidden="true"></i>${esc(status)}</span><strong>${matching.length ? formatDuration(Date.now() - average) : "—"}</strong></div>`;
      })
      .join("");

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const activityToday = Object.values(state.activity).filter(
      (item) => Number(item.at) >= todayStart.getTime(),
    );
    const added = activityToday.filter(
      (item) => item.action === "Vehicle added",
    ).length;
    const deliveredToday = delivered.filter(
      (item) => Number(item.deliveredAt) >= todayStart.getTime(),
    ).length;
    const hours = activityToday.reduce((counts, item) => {
      const hour = new Date(Number(item.at)).getHours();
      counts[hour] = (counts[hour] || 0) + 1;
      return counts;
    }, {});
    const peakHour = Object.keys(hours).sort((a, b) => hours[b] - hours[a])[0];
    const peakLabel =
      peakHour === undefined
        ? "—"
        : new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(
          new Date(todayStart.getTime() + Number(peakHour) * 3600000),
        );
    document.getElementById("todayOverview").innerHTML =
      metric("Added", added) +
      metric("Delivered", deliveredToday) +
      metric("Peak Time", peakLabel);
    const bags = Object.values(state.bags);
    const completedBags = bags.filter(
      (bag) => bag.status === "completed" && Number(bag.completedAt),
    );
    const bagDurations = completedBags
      .map((bag) => Number(bag.completedAt) - Number(bag.assignedAt))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const avgBag = bagDurations.length
      ? bagDurations.reduce((sum, value) => sum + value, 0) /
      bagDurations.length
      : 0;
    const groups = groupBagsByVehicle(completedBags).filter(
      (group) => group.bags.length === Number(group.bags[0]?.bagMax || 0),
    );
    const wrapTotals = groups
      .map((group) => {
        const vehicle =
          state.vehicles[group.vehicleId] ||
          delivered.find((item) => item.vehicleId === group.vehicleId) ||
          removed.find((item) => item.vehicleId === group.vehicleId) ||
          {};
        if (!Number(vehicle.wrapStartedAt)) return Number.NaN;
        const end = Math.max(
          ...group.bags.map((bag) => Number(bag.completedAt || 0)),
        );
        return end - Number(vehicle.wrapStartedAt);
      })
      .filter((value) => Number.isFinite(value) && value >= 0);
    const avgWrap = wrapTotals.length
      ? wrapTotals.reduce((sum, value) => sum + value, 0) / wrapTotals.length
      : 0;
    const wrapMetrics = document.getElementById("giftWrapMetrics");
    if (wrapMetrics)
      wrapMetrics.innerHTML =
        metric("Completed Bags", completedBags.length) +
        metric(
          "Avg. Bag Time",
          avgBag ? formatDuration(Date.now() - avgBag) : "—",
        ) +
        metric("Completed Vehicles", groups.length) +
        metric(
          "Avg. Total Wrap",
          avgWrap ? formatDuration(Date.now() - avgWrap) : "—",
        );
    const wrapDetails = document.getElementById("giftWrapDetails");
    if (wrapDetails)
      wrapDetails.innerHTML = `<div class="analytics-status-row"><span>Waiting for workstation</span><strong>${bags.filter((bag) => bag.status === "waiting").length}</strong></div><div class="analytics-status-row"><span>At workstation</span><strong>${bags.filter((bag) => bag.status === "active").length}</strong></div><div class="analytics-status-row"><span>Archived completed vehicles</span><strong>${groupBagsByVehicle(bags.filter((bag) => bag.archived)).length}</strong></div>`;
  }

  function renderAdminData() {
    const metrics = document.getElementById("metrics");
    if (!metrics) return;
    const vehicles = Object.values(state.vehicles);
    const delivered = Object.values(state.deliveries);
    const removed = Object.values(state.removed);
    const durations = [
      ...delivered.map(
        (item) => Number(item.deliveredAt) - Number(item.parkedAt),
      ),
      ...removed.map((item) => Number(item.removedAt) - Number(item.parkedAt)),
    ].filter(Number.isFinite);
    const avg = durations.length
      ? durations.reduce((sum, value) => sum + value, 0) / durations.length
      : 0;
    metrics.innerHTML =
      metric("Total Parked", vehicles.length) +
      metric("Empty Spots", APP.totalSpots - vehicles.length) +
      metric("Delivered", delivered.length) +
      metric("Avg. Total Time", avg ? formatDuration(Date.now() - avg) : "—");
    const max = Math.max(
      1,
      ...APP.statuses.map(
        (status) =>
          vehicles.filter((vehicle) => vehicle.status === status).length,
      ),
    );
    document.getElementById("statusBreakdown").innerHTML = APP.statuses
      .map((status) => {
        const count = vehicles.filter(
          (vehicle) => vehicle.status === status,
        ).length;
        return `<div class="status-row"><span>${esc(status)}</span><div class="bar-track"><div class="bar-fill status-${slug(status)}" style="width:${(count / max) * 100}%;background:var(--status-color)"></div></div><strong>${count}</strong></div>`;
      })
      .join("");
    const activities = Object.values(state.activity)
      .sort((a, b) => Number(b.at) - Number(a.at))
      .slice(0, 8);
    document.getElementById("activityList").innerHTML = activities.length
      ? activities
        .map(
          (item) =>
            `<div class="activity-item"><strong>${esc(item.action)}</strong><span>Spot ${esc(item.parkingSpot)} · ${esc(item.carNumber)}</span><small>${formatDate(item.at)} by ${esc(item.byName || "Volunteer")}</small></div>`,
        )
        .join("")
      : `<div class="empty-state" style="padding:18px">No activity yet.</div>`;
    renderPresence();
    renderUsers();
    renderVolunteerCheckins();
    renderEventList();
  }

  function metric(label, value) {
    return `<div class="metric"><span class="metric-label">${esc(label)}</span><strong class="metric-value">${esc(value)}</strong></div>`;
  }

  function renderVolunteerCheckins() {
    const list = document.getElementById("volunteerCheckinList");
    if (!list) return;
    const checkins = Object.entries(state.volunteerCheckins)
      .map(([id, item]) => ({ id, ...item }))
      .sort((a, b) => Number(b.checkedInAt || 0) - Number(a.checkedInAt || 0));
    list.innerHTML = checkins.length
      ? checkins
        .map((item) => {
          const ended = Number(item.shiftEndAt) && Number(item.shiftEndAt) <= Date.now();
          const displayStatus = ended && item.status !== "checked-out" ? "shift ended" : String(item.status || "checked-in").replace("-", " ");
          return `<article class="volunteer-row"><div><strong>${esc(item.displayName || "Volunteer")}</strong><small>${esc(APP.roleLabels[item.role] || item.role || "Volunteer")} · ${esc(item.timeSlotLabel || "No time slot")}</small></div><span class="volunteer-status shopper-${esc(slug(displayStatus))}">${esc(displayStatus)}</span><div class="event-actions">${item.status === "checked-out" ? "" : `<button class="button danger small" onclick="Renewal.updateVolunteerCheckinStatus('${esc(item.id)}','checked-out')">Check Out</button>`}</div></article>`;
        })
        .join("")
      : `<div class="empty-state compact">No volunteers have used the check-in kiosk for this event.</div>`;
  }

  function openShiftSettings() {
    const shifts = currentShiftOptions();
    const dayOptions = [
      [5, "Friday"],
      [6, "Saturday"],
    ];
    document.getElementById("modalRoot").innerHTML = modal(
      "Volunteer Check-In Times",
      `<p class="modal-copy">These options appear on the kiosk. Shopper availability automatically ends at the configured end time.</p><form onsubmit="Renewal.saveShiftSettings(event)"><div class="shift-editor">${Object.entries(shifts)
        .map(
          ([id, shift]) => `<fieldset class="shift-row"><legend>${esc(shift.label)}</legend><input type="hidden" name="shiftId" value="${esc(id)}"><div class="form-grid two"><div class="field"><label>Display label</label><input class="input" name="label_${esc(id)}" value="${esc(shift.label)}" maxlength="80" required></div><div class="field"><label>Day</label><select class="select" name="day_${esc(id)}">${dayOptions.map(([day, label]) => `<option value="${day}"${Number(shift.dayOfWeek) === day ? " selected" : ""}>${label}</option>`).join("")}</select></div><div class="field"><label>Start</label><input class="input" type="time" name="start_${esc(id)}" value="${esc(shift.start)}" required></div><div class="field"><label>End</label><input class="input" type="time" name="end_${esc(id)}" value="${esc(shift.end)}" required></div></div></fieldset>`,
        )
        .join("")}</div><div class="modal-actions"><button type="button" class="button secondary" onclick="Renewal.closeModal()">Cancel</button><button class="button" type="submit">Save Times</button></div></form>`,
    );
    openModalElement();
  }

  async function saveShiftSettings(event) {
    event.preventDefault();
    if (currentRole !== "admin") return;
    const form = new FormData(event.currentTarget);
    const shifts = {};
    form.getAll("shiftId").forEach((id) => {
      shifts[id] = {
        label: String(form.get(`label_${id}`) || "").trim(),
        dayOfWeek: Number(form.get(`day_${id}`)),
        start: String(form.get(`start_${id}`) || ""),
        end: String(form.get(`end_${id}`) || ""),
      };
    });
    if (Object.values(shifts).some((shift) => !shift.label || !shift.start || !shift.end || shift.start >= shift.end)) {
      return alert("Each shift needs a label and an end time later than its start time.");
    }
    await write(firebase.database().ref(`${eventPath("checkinSettings")}/timeSlots`).set(shifts));
    closeModal();
  }

  async function updateVolunteerCheckinStatus(id, status) {
    if (currentRole !== "admin" || status !== "checked-out") return;
    const item = state.volunteerCheckins[id];
    if (!item) return;
    if (item.status === "busy" && status === "checked-out" && !confirm(`${item.displayName || "This shopper"} is assigned to ticket ${item.currentCarNumber || "unknown"}. Check them out anyway?`)) return;
    await write(
      firebase.database().ref(`${eventPath("volunteerCheckins")}/${id}`).update({
        status,
        checkedOutAt: status === "checked-out" ? serverTime() : null,
        currentVehicleId: status === "checked-out" ? null : item.currentVehicleId || null,
        currentCarNumber: status === "checked-out" ? null : item.currentCarNumber || null,
      }),
    );
  }

  function renderPresence() {
    const sessions = [];
    Object.values(state.presence || {}).forEach((userSessions) =>
      Object.values(userSessions || {}).forEach((item) => sessions.push(item)),
    );
    sessions.sort(
      (a, b) =>
        Number(b.online) - Number(a.online) ||
        Number(b.lastSeen) - Number(a.lastSeen),
    );
    const online = sessions.filter(
      (item) => item.online && Date.now() - Number(item.lastSeen || 0) < 90000,
    );
    const summary = document.getElementById("syncSummary");
    const list = document.getElementById("deviceList");
    if (summary)
      summary.innerHTML = `<div class="alert ${online.length ? "success" : "error"}"><strong>${online.length} device${online.length === 1 ? "" : "s"} online</strong><br>All active browser instances report here.</div>`;
    if (list)
      list.innerHTML =
        sessions
          .slice(0, 4)
          .map(
            (item) =>
              `<div class="device-item"><strong>${item.online ? "● Online" : "○ Offline"} · ${esc(APP.roleLabels[item.role] || item.role || "Viewer")}</strong><span>${esc(item.displayName || item.email || "Unknown device")}</span><small>${esc(item.page || "page")} · Last seen ${formatDate(item.lastSeen)}</small></div>`,
          )
          .join("") ||
        `<div class="empty-state" style="padding:18px">No devices have connected.</div>`;
  }

  function presenceSessions() {
    const sessions = [];
    Object.entries(state.presence || {}).forEach(([uid, userSessions]) =>
      Object.entries(userSessions || {}).forEach(([sessionId, item]) =>
        sessions.push({ uid, sessionId, ...item }),
      ),
    );
    return sessions.sort(
      (a, b) =>
        Number(b.online) - Number(a.online) ||
        Number(b.lastSeen) - Number(a.lastSeen),
    );
  }

  function openInstances() {
    const sessions = presenceSessions();
    const byUser = new Map();
    sessions.forEach((item) => {
      if (!byUser.has(item.uid)) byUser.set(item.uid, []);
      byUser.get(item.uid).push(item);
    });
    document.getElementById("modalRoot").innerHTML = modal(
      "Connected Instances",
      `
      <div class="modal-toolbar"><p>${byUser.size} user${byUser.size === 1 ? "" : "s"} · ${sessions.length} browser instance${sessions.length === 1 ? "" : "s"}</p><button class="button danger small" onclick="Renewal.resetInstanceTracker()">Clear Outdated Instances</button></div>
      <div class="instance-user-list">${byUser.size
        ? [...byUser.entries()]
          .map(
            ([uid, items]) =>
              `<section class="instance-user"><h3>${esc(items[0].displayName || items[0].email || state.users[uid]?.displayName || "Unknown user")}</h3><small>${esc(items[0].email || state.users[uid]?.email || uid)}</small>${items
                .map((item) => {
                  const live =
                    item.online &&
                    Date.now() - Number(item.lastSeen || 0) < 90000;
                  return `<div class="device-item"><strong>${live ? "● Online" : "○ Outdated"} · ${esc(APP.roleLabels[item.role] || item.role || "Viewer")}</strong><span>${esc(item.page || "page")}</span><small>Connected ${formatDate(item.connectedAt)} · Last seen ${formatDate(item.lastSeen)}</small></div>`;
                })
                .join("")}</section>`,
          )
          .join("")
        : `<div class="empty-state compact">No tracked instances.</div>`
      }</div>
      <button class="button secondary full" onclick="Renewal.closeModal()">Close</button>
    `,
    );
    openModalElement();
  }

  async function resetInstanceTracker() {
    const stale = presenceSessions().filter(
      (item) =>
        !item.online || Date.now() - Number(item.lastSeen || 0) >= 90000,
    );
    if (!stale.length)
      return alert("There are no outdated instances to clear.");
    if (
      !confirm(
        `Remove ${stale.length} outdated instance connection${stale.length === 1 ? "" : "s"}? Active devices will remain.`,
      )
    )
      return;
    const updates = {};
    stale.forEach((item) => {
      updates[`presence/${state.eventId}/${item.uid}/${item.sessionId}`] = null;
    });
    await write(firebase.database().ref().update(updates));
    closeModal();
  }

  function eventSummary(eventId, eventData) {
    const vehicles = Object.values(eventData.vehicles || {});
    const deliveries = Object.values(eventData.deliveries || {});
    const removed = Object.values(eventData.removed || {});
    const bags = Object.values(eventData.bags || {});
    const volunteerCheckins = Object.values(eventData.volunteerCheckins || {});
    const completedBags = bags.filter((bag) => bag.status === "completed");
    const bagDurations = completedBags
      .map((bag) => Number(bag.completedAt) - Number(bag.assignedAt))
      .filter((value) => Number.isFinite(value) && value >= 0);
    const totalDurations = [
      ...deliveries.map(
        (item) => Number(item.deliveredAt) - Number(item.parkedAt),
      ),
      ...removed.map((item) => Number(item.removedAt) - Number(item.parkedAt)),
    ].filter((value) => Number.isFinite(value) && value >= 0);
    const connections = [];
    Object.values(eventData.connections || {}).forEach((items) =>
      Object.values(items || {}).forEach((item) => connections.push(item)),
    );
    return {
      eventId,
      name: eventData.meta?.name || eventId,
      createdAt: eventData.meta?.createdAt,
      vehicles: vehicles.length,
      delivered: deliveries.length,
      removed: removed.length,
      completedBags: completedBags.length,
      avgBag: bagDurations.length
        ? bagDurations.reduce((sum, value) => sum + value, 0) /
        bagDurations.length
        : 0,
      avgTotal: totalDurations.length
        ? totalDurations.reduce((sum, value) => sum + value, 0) /
        totalDurations.length
        : 0,
      connections,
      uniqueUsers: new Set(connections.map((item) => item.uid).filter(Boolean))
        .size,
      volunteerCheckins,
      eventData,
    };
  }

  function renderEventList() {
    const list = document.getElementById("eventList");
    if (!list) return;
    const events = Object.entries(state.allEvents)
      .filter(([eventId]) => eventId !== state.eventId)
      .map(([eventId, data]) => eventSummary(eventId, data))
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    list.innerHTML = events.length
      ? events
        .map(
          (item) =>
            `<article class="event-row"><div><strong>${esc(item.name)}</strong><small>${formatDate(item.createdAt)} · ${item.delivered} delivered · ${item.uniqueUsers} connected users</small></div><div class="event-actions"><button class="button ghost small" onclick="Renewal.openEventDetails('${esc(item.eventId)}')">View Stats</button><button class="button danger small" onclick="Renewal.deleteEvent('${esc(item.eventId)}')">Delete</button></div></article>`,
        )
        .join("")
      : `<div class="empty-state compact">Previous events will appear here after a new event is started.</div>`;
  }

  function openEventDetails(eventId) {
    const data = state.allEvents[eventId];
    if (!data) return;
    const item = eventSummary(eventId, data);
    const statusCounts = APP.statuses.map((status) => ({
      status,
      count: Object.values(data.vehicles || {}).filter(
        (vehicle) => vehicle.status === status,
      ).length,
    }));
    const people = [
      ...new Map(
        item.connections.map((connection) => [
          connection.uid || connection.email,
          connection,
        ]),
      ).values(),
    ];
    document.getElementById("modalRoot").innerHTML = modal(
      item.name,
      `
      <div class="metrics-grid">${metric("Delivered", item.delivered)}${metric("Still Active", item.vehicles)}${metric("Avg. Total Time", item.avgTotal ? formatDuration(Date.now() - item.avgTotal) : "—")}${metric("Connected Users", item.uniqueUsers)}</div>
      <section class="modal-section"><h3>Workflow Statuses</h3><div class="analytics-status-list">${statusCounts.map((row) => `<div class="analytics-status-row status-${slug(row.status)}"><span><i></i>${esc(row.status)}</span><strong>${row.count}</strong></div>`).join("")}</div></section>
      <section class="modal-section"><h3>Gift Wrap</h3><div class="metrics-grid">${metric("Completed Bags", item.completedBags)}${metric("Avg. Bag Time", item.avgBag ? formatDuration(Date.now() - item.avgBag) : "—")}${metric("Archived Vehicles", groupBagsByVehicle(Object.values(data.bags || {}).filter((bag) => bag.archived)).length)}${metric("Admin Removed", item.removed)}</div></section>
      <section class="modal-section"><h3>People Connected</h3><div class="device-list">${people.length ? people.map((person) => `<div class="device-item"><strong>${esc(person.displayName || person.email || "Volunteer")}</strong><span>${esc(APP.roleLabels[person.role] || person.role || "Viewer")}</span><small>Last seen ${formatDate(person.lastSeen)}</small></div>`).join("") : `<div class="empty-state compact">No connection history was recorded for this event.</div>`}</div></section>
      <section class="modal-section"><h3>Volunteer Check-Ins (${item.volunteerCheckins.length})</h3><div class="device-list">${item.volunteerCheckins.length ? item.volunteerCheckins.map((person) => `<div class="device-item"><strong>${esc(person.displayName || "Volunteer")}</strong><span>${esc(APP.roleLabels[person.role] || person.role || "Volunteer")} · ${esc(person.timeSlotLabel || "No time slot")}</span><small>${esc(String(person.status || "checked-in").replace("-", " "))}</small></div>`).join("") : `<div class="empty-state compact">No volunteer check-ins were recorded.</div>`}</div></section>
      <button class="button secondary full" onclick="Renewal.closeModal()">Close</button>
    `,
    );
    openModalElement();
  }

  async function deleteEvent(eventId) {
    if (currentRole !== "admin" || eventId === state.eventId)
      return alert(
        "The active event cannot be deleted. Start or switch to another event first.",
      );
    const name = state.allEvents[eventId]?.meta?.name || eventId;
    if (
      !confirm(
        `Permanently delete ${name} and all of its vehicles, bags, analytics, and connection history? This cannot be undone.`,
      )
    )
      return;
    const updates = {};
    updates[`events/${eventId}`] = null;
    updates[`presence/${eventId}`] = null;
    await write(firebase.database().ref().update(updates));
  }

  function renderUsers() {
    const list = document.getElementById("userList");
    if (!list) return;
    const users = Object.entries(state.users).sort(([, a], [, b]) =>
      String(a.displayName || a.email).localeCompare(
        String(b.displayName || b.email),
      ),
    );
    list.innerHTML = users.length
      ? users
        .map(
          ([uid, user]) =>
            `<div class="user-row"><strong>${esc(user.displayName || "User")}</strong><br><small>${esc(user.email || uid)}</small><div class="role-checks">${APP.roles.map((role) => `<label><input type="checkbox" ${user.roles?.[role] ? "checked" : ""} onchange="Renewal.updateUserRole('${esc(uid)}','${role}',this.checked)">${esc(APP.roleLabels[role])}</label>`).join("")}</div></div>`,
        )
        .join("")
      : `<div class="empty-state" style="padding:18px">Users appear after their first Google sign-in.</div>`;
  }

  async function updateUserRole(uid, role, enabled) {
    if (currentRole !== "admin" || !APP.roles.includes(role)) return;
    if (uid === state.user.uid && role === "admin" && !enabled) {
      renderUsers();
      return alert(
        "You cannot remove your own administrator access while signed in.",
      );
    }
    await write(
      firebase
        .database()
        .ref(`users/${uid}/roles/${role}`)
        .set(enabled ? true : null),
    );
  }

  async function createFreshEvent() {
    if (currentRole !== "admin") return;
    const label = prompt(
      "Name the new event (example: Christmas Store 2027 or Training Night):",
    );
    if (!label) return;
    const id = slug(label);
    if (!id) return alert("Enter a valid event name.");
    const exists = await firebase
      .database()
      .ref(`events/${id}/meta`)
      .once("value");
    if (
      exists.exists() &&
      !confirm(
        "That event already exists. Switch to it without erasing its data?",
      )
    )
      return;
    if (!exists.exists()) {
      await write(
        firebase.database().ref(`events/${id}/meta`).set({
          name: label.trim(),
          createdAt: serverTime(),
          createdBy: state.user.uid,
          totalSpots: APP.totalSpots,
        }),
      );
    }
    await write(firebase.database().ref("config/activeEventId").set(id));
    alert(
      `${label.trim()} is now active. Every connected device will switch automatically.`,
    );
  }

  function listenAdminExtras() {
    const presenceRef = firebase.database().ref(`presence/${state.eventId}`);
    const presenceHandler = (snapshot) => {
      state.presence = snapshot.val() || {};
      renderAdminData();
    };
    listen(presenceRef, "value", presenceHandler);
    const usersRef = firebase.database().ref("users");
    const usersHandler = (snapshot) => {
      state.users = snapshot.val() || {};
      renderAdminData();
    };
    listen(usersRef, "value", usersHandler);
    const eventsRef = firebase.database().ref("events");
    const eventsHandler = (snapshot) => {
      state.allEvents = snapshot.val() || {};
      renderAdminData();
    };
    listen(eventsRef, "value", eventsHandler);
  }


  function renderSpotsPage() {
    renderAppShell(
      "All Parking Spots",
      `
      <div class="page-heading">
        <h2>All ${APP.totalSpots} Parking Spots</h2>
        <p>Administrators can open occupied spots to correct any vehicle field.</p>
      </div>
      ${filterToolbar()}
      <div class="spot-grid" id="spotGrid"></div>
      <div id="modalRoot"></div>
    `,
      "spots",
    );
    renderSpots();
  }

  function renderSpots() {
    const grid = document.getElementById("spotGrid");
    if (!grid) return;
    const bySpot = new Map(
      Object.entries(state.vehicles).map(([id, vehicle]) => [
        String(vehicle.parkingSpot),
        { id, ...vehicle },
      ]),
    );
    grid.innerHTML = Array.from({ length: APP.totalSpots }, (_, index) => {
      const spot = String(index + 1);
      const vehicle = bySpot.get(spot);
      const hidden = vehicle
        ? (state.search &&
          !String(vehicle.carNumber).toLowerCase().includes(state.search) &&
          !spot.includes(state.search)) ||
        (state.selectedStatuses.size &&
          !state.selectedStatuses.has(vehicle.status))
        : Boolean(
          (state.search && !spot.includes(state.search)) ||
          state.selectedStatuses.size,
        );
      if (hidden) return "";
      return vehicle
        ? `<button class="spot-tile occupied status-${slug(vehicle.status)}" onclick="Renewal.openVehicle('${esc(vehicle.id)}')"><strong>${spot}</strong><small>${esc(vehicle.carNumber)}</small><br><small>${esc(vehicle.status)}</small></button>`
        : `<div class="spot-tile"><strong>${spot}</strong><small>Empty</small></div>`;
    }).join("");
  }

  function renderHistoryPage() {
    renderAppShell(
      "Vehicle History",
      `
      <div class="page-heading">
        <h2>Delivered and Removed</h2>
        <p>Deliveries and administrator removals are kept separate. Restoring a removal also updates every statistic.</p>
      </div>

      <div class="metrics-grid">
        <div class="metric">
          <span class="metric-label">Delivered</span>
          <strong class="metric-value" id="deliveredMetric">0</strong>
        </div>
        <div class="metric">
          <span class="metric-label">Admin Removed</span>
          <strong class="metric-value" id="removedMetric">0</strong>
        </div>
      </div>

      <div class="dashboard-grid">
        <section class="panel">
          <h3>Delivered</h3>
          <div class="log-list" id="deliveryLog"></div>
        </section>
        <section class="panel">
          <h3>Administrator Removed</h3>
          <div class="log-list" id="removedLog"></div>
        </section>
      </div>
    `,
      "history",
    );
    renderHistoryData();
  }

  function renderHistoryData() {
    const deliveryLog = document.getElementById("deliveryLog");
    if (!deliveryLog) return;
    const deliveries = Object.entries(state.deliveries).sort(
      ([, a], [, b]) => Number(b.deliveredAt) - Number(a.deliveredAt),
    );
    const removed = Object.entries(state.removed).sort(
      ([, a], [, b]) => Number(b.removedAt) - Number(a.removedAt),
    );
    document.getElementById("deliveredMetric").textContent = deliveries.length;
    document.getElementById("removedMetric").textContent = removed.length;
    deliveryLog.innerHTML = deliveries.length
      ? deliveries
        .map(
          ([id, item]) =>
            `<div class="log-item"><strong>Spot ${esc(item.parkingSpot)} · ${esc(item.carNumber)}</strong><span>Delivered ${formatDate(item.deliveredAt)}</span><small>Total time ${formatDuration(item.parkedAt, item.deliveredAt)}</small><button class="button ghost small" onclick="Renewal.undoDelivery('${esc(id)}')">Undo Delivery</button></div>`,
        )
        .join("")
      : `<div class="empty-state" style="padding:18px">No deliveries yet.</div>`;
    document.getElementById("removedLog").innerHTML = removed.length
      ? removed
        .map(
          ([id, item]) =>
            `<div class="log-item"><strong>Spot ${esc(item.parkingSpot)} · ${esc(item.carNumber)}</strong><span>Removed ${formatDate(item.removedAt)}</span><small>${esc(item.removedByName || "Administrator")}</small><button class="button ghost small" onclick="Renewal.restoreRemoval('${esc(id)}')">Undo Removal</button></div>`,
        )
        .join("")
      : `<div class="empty-state" style="padding:18px">No administrator removals.</div>`;
  }


  function renderMapPage() {
    renderAppShell(
      "Parking Lot Map",
      `
      <div class="page-heading">
        <h2>Parking Lot Map</h2>
        <p>Use this map to direct volunteers and families to the correct area.</p>
      </div>
      <div class="map-frame">
        <img class="map-image" id="parkingLotMap" src="../assets/parking-lot-map.png"
          alt="Renewal parking lot map" onerror="Renewal.showMapPlaceholder()">
        
      </div>
    `,
      "map",
    );
  }

  function showMapPlaceholder() {
    const image = document.getElementById("parkingLotMap");
    const placeholder = document.getElementById("mapPlaceholder");
    if (image) image.hidden = true;
    if (placeholder) placeholder.hidden = false;
  }

  function renderHelpPage() {
    renderAppShell(
      "Help",
      `
      <div class="Help_Container">
        <div class="page-heading"><h2>Welcome to the help page!</h2><p>A quick guide to statuses, roles, and getting support.</p></div>

        <h2><u>General Help:</u></h2>
        <div class="glass-card status-key-card">
          <b>Status Color Key:</b>
          <div class="box status-in-car">1. In-Car</div>
          <div class="box status-fetch-to-shop">2. Fetch-to-shop</div>
          <div class="box status-awaiting-shopper">3. Awaiting Shopper (Registration Complete)</div>
          <div class="box status-shopping">4. Shopping</div>
          <div class="box status-wrapping">5. Wrapping</div>
          <div class="box status-waiting-for-reindeer">6. Waiting for Reindeer</div>
        </div>

        <h2><u>Jobs and their roles:</u></h2>
        <div class="help-role-grid">
          <div class="glass-card"><b>🚗 Parking Management</b><p><b>For all parking lot attendants.</b> Add new vehicles, assign the correct parking spot and preferred language, update details when needed, and keep parking records accurate throughout the event.</p></div>
          <div class="glass-card"><b>✅ Registration</b><p><b>For Registration Assistants.</b> Fetch families who are waiting in their cars, complete registration, and mark the ticket as Awaiting Shopper so the shopping lead knows it is ready.</p></div>
          <div class="glass-card"><b>🛒 Shopper</b><p><b>For Shopping Gate Keepers and Shoppers.</b> Check shoppers in, assign an available shopper to a ticket, and move the family into Shopping. Check out at the end of a shift so the availability list stays accurate.</p></div>
          <div class="glass-card"><b>🎁 Wrapping Team</b><p><b>For Wrapping Gate Keepers and Wrapping Assistants.</b> Choose whether gifts need wrapping, assign bags to workstations, and mark each bag complete before the ticket moves to Reindeer.</p></div>
          <div class="glass-card"><b>🦌 Reindeer (Delivery Team)</b><p><b>For Reindeer volunteers in the wrapping area.</b> Confirm completed gifts are delivered to the correct vehicle. This finishes the ticket and removes the car from the active list.</p></div>
        </div>

        <h2><u>Unsure where to go?</u></h2>
        <div class="glass-card">
          <p>If you’re unsure of your assigned role for the day, check with a team lead or supervisor before beginning. Each role has specific responsibilities that contribute to the overall success of the operation.</p>
          <p>Clear communication and role awareness reduce confusion and help us provide a smooth, positive experience for everyone involved.</p>
          <p><b>Remember:</b> we’re all part of one team. Don’t hesitate to ask questions or confirm your assignment before jumping in.</p>
          <p id="phoneNum"><b>Need app help?</b><br>Text or call <a href="tel:3178208750"><u>317-820-8750</u></a> or email <a href="mailto:reasingerben@gmail.com">reasingerben@gmail.com</a>.</p>
        </div>
      </div>
    `,
      "help",
    );
  }



  function onCoreUpdate(key) {
    if (page === "vehicles") {
      renderVehicleGrid();
      renderShopperRoster();
      if (key === "deliveries") renderDeliveryUndo();
    } else if (page === "gift-wrap") renderWrapData();
    else if (page === "admin") renderAdminData();
    else if (page === "analytics") renderAnalyticsData();
    else if (page === "spots") renderSpots();
    else if (page === "history") renderHistoryData();
  }

  function setupProtectedPage() {
    watchConnection();
    watchActiveEvent(() => {
      if (page === "vehicles") renderVehiclePage();
      else if (page === "gift-wrap") renderGiftWrapPage();
      else if (page === "admin") renderAdminPage();
      else if (page === "analytics") renderAnalyticsPage();
      else if (page === "spots") renderSpotsPage();
      else if (page === "history") renderHistoryPage();
      else if (page === "map") renderMapPage();
      else if (page === "help") renderHelpPage();
      listenCore(onCoreUpdate);
      if (page === "admin") listenAdminExtras();
      clearInterval(state.clockTimer);
      state.clockTimer = setInterval(() => {
        if (page === "vehicles") renderVehicleGrid();
        if (page === "admin") renderAdminData();
        if (page === "analytics") renderAnalyticsData();
      }, 60000);
    });
  }

  async function signOut() {
    if (window.firebase?.auth) await firebase.auth().signOut();
    sessionStorage.removeItem("renewalSelectedRole");
    location.href = `${rootPrefix}pages/login.html`.replace(
      "pages/pages/",
      "pages/",
    );
  }

  async function start() {
    if (page === "home") return renderHome();
    initFirebase();
    if (page === "checkin") {
      await initializeVolunteerCheckin();
      return;
    }
    if (page === "login") {
      renderLogin();
      firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) return;
        if (user.isAnonymous) {
          await firebase.auth().signOut();
          return;
        }
        state.user = user;
        state.userRecord = await ensureUserProfile(user);
        location.replace("../roles.html");
      });
      return;
    }
    if (page === "roles") {
      injectApp(
        "roles.html / loading",
        `<section class="boot-screen boot-screen-light"><div class="boot-spinner" aria-hidden="true"></div><p class="boot-label">Loading your assigned roles…</p></section>`,
      );
      firebase.auth().onAuthStateChanged(async (user) => {
        if (!user || user.isAnonymous) {
          location.replace("pages/login.html");
          return;
        }
        state.user = user;
        state.userRecord = await ensureUserProfile(user);
        firebase.database().ref(`users/${user.uid}`).on("value", (snapshot) => {
          state.userRecord = snapshot.val() || state.userRecord;
          renderRoles();
        });
      });
      return;
    }

    // INJECTED HTML -> temporary loading state on any protected page.
    injectApp(
      "protected page / loading",
      `
      <section class="auth-page">
        <div class="auth-card">
          ${brandBlock()}
          <p>Loading your workspace…</p>
        </div>
      </section>`,
    );

    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user || user.isAnonymous) {
        location.replace(
          `${rootPrefix}pages/login.html`.replace(
            "pages/pages/",
            "pages/",
          ),
        );
        return;
      }
      const ok = await authorize(user, currentRole || null, false);
      if (ok) {
        if (!currentRole)
          currentRole =
            APP.roles.find((role) => state.userRecord.roles?.[role]) || "";
        setupProtectedPage();
      }
    });
  }


  window.Renewal = {
    chooseRole,
    signInWithGoogle,
    signOut,
    toggleDrawer,
    closeDrawerFromBackdrop,
    setSearch,
    toggleStatusFilter,
    clearStatusFilters,
    openAddVehicle,
    createVehicle,
    openVehicle,
    saveVehicle,
    advanceVehicle,
    markDelivered,
    undoDelivery,
    adminRemoveVehicle,
    restoreRemoval,
    closeModal,
    openWrapSetup,
    createBags,
    openBag,
    saveBag,
    completeBag,
    archiveCompletedWrap,
    updateUserRole,
    createFreshEvent,
    openShopperAssignment,
    assignShopper,
    skipGiftWrap,
    openInstances,
    resetInstanceTracker,
    openEventDetails,
    deleteEvent,
    launchVolunteerCheckin,
    submitVolunteerCheckin,
    openShiftSettings,
    saveShiftSettings,
    updateVolunteerCheckinStatus,
    showMapPlaceholder,
    showAssetPlaceholder,
  };

  const originalOpenVehicle = openVehicle;
  window.Renewal.openVehicle = function (id) {
    if (
      page === "gift-wrap" &&
      state.vehicles[id]?.status === "Wrapping" &&
      !state.vehicles[id]?.bagCount
    )
      return openWrapSetup(id);
    return originalOpenVehicle(id);
  };

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
  start().catch((error) => {
    console.error(error);
    injectApp(
      "startup error",
      `
      <section class="auth-page">
        <div class="auth-card">
          ${brandBlock()}
          <h1>Unable to start the app</h1>
          <p class="alert error">${esc(error.message)}</p>
        </div>
      </section>`,
    );
  });
})();
