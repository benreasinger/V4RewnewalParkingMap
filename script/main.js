/* Renewal Christmas Store Parking — Version 4.0
 * One shared script for every page. Firebase Realtime Database is the source of truth.
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
    measurementId: "G-SGV7YXDJ8X"
  };

  const APP = {
    totalSpots: 160,
    defaultEventId: "christmas-store-2026",
    statuses: ["In-Car", "Fetch-to-shop", "Shopping", "Wrapping", "Waiting for Reindeer"],
    roles: ["parking", "shopper", "wrapper", "reindeer", "admin"],
    roleLabels: {
      parking: "Parking Management",
      shopper: "Shopper",
      wrapper: "Wrapper",
      reindeer: "Reindeer Team",
      admin: "Administrator"
    },
    rolePages: {
      parking: "createVehicle.html",
      shopper: "shopping.html",
      wrapper: "wrapper.html",
      reindeer: "reindeer.html",
      admin: "admin-page.html"
    }
  };

  const body = document.body;
  const page = body.dataset.page || "home";
  let currentRole = body.dataset.role || sessionStorage.getItem("renewalSelectedRole") || "";
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
    search: "",
    selectedStatuses: new Set(),
    listeners: [],
    connected: false,
    lastSavedAt: null,
    sessionId: sessionStorage.getItem("renewalSessionId") || makeId(),
    clockTimer: null,
    presenceTimer: null
  };
  sessionStorage.setItem("renewalSessionId", state.sessionId);

  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>'"]/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[char]));
  }

  function slug(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function normalizeCarNumber(value) {
    return String(value || "").trim().toUpperCase().replace(/\s+/g, "-").replace(/[^A-Z0-9-]/g, "");
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
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(Number(timestamp));
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

  function renderHome() {
    document.getElementById("app").innerHTML = `
      <section class="hero-page">
        <div class="hero-card">
          <div class="hero-content">
            <div class="asset-slot logo-slot">
              <img class="brand-logo-image" src="assets/renewal-logo.png" alt="Renewal Neighborhood Church logo" onerror="Renewal.showAssetPlaceholder(this)">
              <div class="asset-fallback logo-fallback" hidden><span>✚</span><small>renewal-logo.png</small></div>
            </div>
            <div class="brand-name">RENEWAL</div>
            <div class="brand-sub">NEIGHBORHOOD CHURCH</div>
            <h1 class="hero-title">CHRISTMAS STORE<br>PARKING APP</h1>
            <p class="hero-copy">Helping families.<br>Sharing the love of Jesus.</p>
          </div>
          <div class="hero-photo" aria-label="Renewal church exterior image area">
            <img src="assets/renewal-church-home.png" alt="Renewal Neighborhood Church exterior" onerror="Renewal.showAssetPlaceholder(this)">
            <div class="asset-fallback photo-fallback" hidden><strong>Church photo</strong><small>renewal-church-home.png</small></div>
          </div>
          <button class="hero-button" type="button" onclick="location.href='roles.html'">Get Started <span aria-hidden="true">→</span></button>
        </div>
      </section>`;
  }

  function renderRoles() {
    const roles = [
      ["shopper", "🛍", "Shopper", "Move families through shopping"],
      ["parking", "Ⓟ", "Parking Management", "Add and manage parked vehicles"],
      ["reindeer", "🦌", "Reindeer Team", "Coordinate completed deliveries"],
      ["wrapper", "🎁", "Wrapper", "Track gifts and wrapping bags"],
      ["admin", "⚙", "Administrator", "System, users, and analytics"]
    ];
    document.getElementById("app").innerHTML = `
      <section class="role-page"><div class="role-shell">
        <div class="role-brand">
          <div class="asset-slot role-logo-slot"><img src="assets/renewal-logo.png" alt="Renewal Neighborhood Church logo" onerror="Renewal.showAssetPlaceholder(this)"><div class="asset-fallback mini-logo-fallback" hidden>✚</div></div>
          <div><div class="brand-name">RENEWAL</div><div class="brand-sub">NEIGHBORHOOD CHURCH</div></div>
        </div>
        <div class="page-heading" style="text-align:center"><h2>Choose Your Role</h2><p>You will sign in with Google next.</p></div>
        <div class="role-list">
          ${roles.map(([role, icon, title, copy]) => `<button class="role-card" onclick="Renewal.chooseRole('${role}')"><span class="role-icon">${icon}</span><span><strong>${title}</strong><small>${copy}</small></span><span>›</span></button>`).join("")}
        </div>
      </div></section>`;
  }

  function chooseRole(role) {
    if (!APP.roles.includes(role)) return;
    sessionStorage.setItem("renewalSelectedRole", role);
    location.href = `pages/login.html?role=${encodeURIComponent(role)}`;
  }

  function brandBlock() {
    return `<div class="asset-slot auth-logo-slot"><img src="${rootPrefix}assets/renewal-logo-white.png" alt="Renewal Neighborhood Church logo" onerror="Renewal.showAssetPlaceholder(this)"><div class="asset-fallback auth-logo-fallback" hidden><span>✚</span><small>renewal-logo-white.png</small></div></div><div class="brand-name">RENEWAL</div><div class="brand-sub">NEIGHBORHOOD CHURCH</div>`;
  }

  function showAssetPlaceholder(image) {
    if (!image) return;
    image.hidden = true;
    const fallback = image.nextElementSibling;
    if (fallback?.classList.contains("asset-fallback")) fallback.hidden = false;
  }

  function renderLogin(message = "Sign in to continue to your selected workspace.", error = false) {
    const params = new URLSearchParams(location.search);
    const requested = params.get("role");
    if (APP.roles.includes(requested)) {
      currentRole = requested;
      sessionStorage.setItem("renewalSelectedRole", requested);
    }
    document.getElementById("app").innerHTML = `
      <section class="auth-page"><div class="auth-card">
        ${brandBlock()}
        <h1>${esc(APP.roleLabels[currentRole] || "Volunteer")} Sign In</h1>
        <p id="authMessage"${error ? ' class="alert error"' : ""}>${esc(message)}</p>
        <button class="google-button" type="button" onclick="Renewal.signInWithGoogle()"><span style="font-size:1.25rem">G</span> Continue with Google</button>
        <a class="auth-back" href="../roles.html">← Back to Roles</a>
      </div></section>`;
  }

  async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await firebase.auth().signInWithPopup(provider);
    } catch (error) {
      if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(error.code)) {
        await firebase.auth().signInWithRedirect(provider);
      } else if (error.code !== "auth/popup-closed-by-user") {
        renderLogin(error.message || "Google sign-in failed.", true);
      }
    }
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
      lastLoginAt: serverTime()
    };
    if (!snapshot.exists()) profile.createdAt = serverTime();
    await ref.update(profile);
    return { ...existing, ...profile, roles: existing.roles || {} };
  }

  function hasRole(record, role) {
    return Boolean(record?.roles?.admin || record?.roles?.[role]);
  }

  function hasAnyRole(record) {
    return APP.roles.some(role => Boolean(record?.roles?.[role]));
  }

  async function authorize(user, role, isLoginPage = false) {
    state.user = user;
    state.userRecord = await ensureUserProfile(user);
    const permitted = role ? hasRole(state.userRecord, role) : hasAnyRole(state.userRecord);
    if (!permitted) {
      const message = `Signed in as ${user.email}, but this account does not have ${APP.roleLabels[role] || "app"} access yet. Ask an administrator to enable it, then try again.`;
      if (isLoginPage) renderLogin(message, true);
      else renderAccessDenied(message);
      return false;
    }
    return true;
  }

  function renderAccessDenied(message) {
    document.getElementById("app").innerHTML = `<section class="auth-page"><div class="auth-card">${brandBlock()}<h1>Access not enabled</h1><p class="alert error">${esc(message)}</p><a class="auth-back" href="${rootPrefix}roles.html">← Choose another role</a><br><button class="button ghost" style="margin-top:20px" onclick="Renewal.signOut()">Sign out</button></div></section>`;
  }

  function roleHome(role = currentRole) {
    return `${rootPrefix}pages/${APP.rolePages[role] || "help.html"}`.replace("pages/pages/", "pages/");
  }

  function pageFile(file) {
    return `${rootPrefix}pages/${file}`.replace("pages/pages/", "pages/");
  }

  function navItems(active) {
    if (currentRole === "admin") {
      return [
        ["map", "⌖", "Map", pageFile("map.html")],
        ["list", "☷", "List", pageFile("admin-page.html")],
        ["stats", "▮", "Stats", pageFile("analytics.html")],
        ["history", "▱", "Removed", pageFile("removedCar.html")]
      ];
    }
    return [
      ["map", "⌖", "Map", pageFile("map.html")],
      ["list", "☷", "List", roleHome()],
      ["roles", "♙", "Roles", `${rootPrefix}roles.html`],
      ["help", "?", "Help", pageFile("help.html")]
    ];
  }

  function chrome(title, content, active = "list") {
    const userLabel = state.user?.email || "Signed in user";
    document.getElementById("app").innerHTML = `
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
      <main class="page-shell">${content}</main>
      <nav class="bottom-nav" aria-label="Bottom navigation">${navItems(active).map(([key, icon, label, href]) => `<a class="${key === active ? "active" : ""}" href="${href}"><span>${icon}</span><span>${label}</span></a>`).join("")}</nav>`;
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
    const displayState = temporaryState || (state.connected ? "online" : "offline");
    pill.dataset.state = displayState;
    if (displayState === "saving") text.textContent = "Saving…";
    else if (displayState === "offline") text.textContent = "Offline";
    else if (state.lastSavedAt) text.textContent = `Saved ${new Date(state.lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
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
    firebase.database().ref(".info/connected").on("value", snapshot => {
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
      lastSeen: serverTime()
    };
    ref.onDisconnect().update({ online: false, lastSeen: serverTime() });
    ref.update(data);
    state.presenceTimer = setInterval(() => ref.update({ online: true, lastSeen: serverTime(), page }), 30000);
  }

  function clearEventListeners() {
    state.listeners.forEach(({ ref, eventName, callback }) => ref.off(eventName, callback));
    state.listeners = [];
  }

  function listen(ref, eventName, callback) {
    ref.on(eventName, callback);
    state.listeners.push({ ref, eventName, callback });
  }

  function watchActiveEvent(onReady) {
    firebase.database().ref("config/activeEventId").on("value", snapshot => {
      const nextEvent = snapshot.val() || APP.defaultEventId;
      if (nextEvent === state.eventId) return;
      clearEventListeners();
      state.eventId = nextEvent;
      state.vehicles = {};
      state.bags = {};
      state.deliveries = {};
      state.removed = {};
      state.activity = {};
      startPresence();
      onReady();
    });
  }

  function listenCore(callback) {
    const mappings = [
      ["vehicles", "vehicles"], ["bags", "bags"], ["deliveries", "deliveries"],
      ["removed", "removed"], ["activity", "activity"]
    ];
    mappings.forEach(([child, key]) => {
      const ref = firebase.database().ref(eventPath(child));
      const handler = snapshot => { state[key] = snapshot.val() || {}; callback(key); };
      listen(ref, "value", handler);
    });
  }

  function statusOptions(selected = "") {
    return APP.statuses.map(status => `<option value="${esc(status)}"${status === selected ? " selected" : ""}>${esc(status)}</option>`).join("");
  }

  function filterToolbar(extra = "") {
    return `<div class="toolbar">
      <label class="search-wrap"><span>⌕</span><input class="input" id="vehicleSearch" type="search" placeholder="Search by car # or spot #" value="${esc(state.search)}" oninput="Renewal.setSearch(this.value)"></label>
      <details class="filter-menu"><summary class="button ghost">Statuses ▾</summary><div class="filter-popover">
        ${APP.statuses.map(status => `<label class="filter-option"><input type="checkbox" value="${esc(status)}" ${state.selectedStatuses.has(status) ? "checked" : ""} onchange="Renewal.toggleStatusFilter(this.value,this.checked)"><span>${esc(status)}</span></label>`).join("")}
        <button class="button secondary small full" type="button" onclick="Renewal.clearStatusFilters()">Show all statuses</button>
      </div></details>${extra}
    </div>`;
  }

  function setSearch(value) {
    state.search = String(value || "").trim().toLowerCase();
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
    document.querySelectorAll(".filter-option input").forEach(input => { input.checked = false; });
    if (page === "spots") renderSpots();
    else renderVehicleGrid();
  }

  function roleVisible(vehicle) {
    if (currentRole === "shopper") return ["In-Car", "Fetch-to-shop", "Shopping"].includes(vehicle.status);
    if (currentRole === "wrapper") return ["Shopping", "Wrapping"].includes(vehicle.status);
    if (currentRole === "reindeer") return vehicle.status === "Waiting for Reindeer";
    return true;
  }

  function filteredVehicles() {
    return Object.entries(state.vehicles)
      .map(([id, vehicle]) => ({ id, ...vehicle }))
      .filter(roleVisible)
      .filter(vehicle => !state.selectedStatuses.size || state.selectedStatuses.has(vehicle.status))
      .filter(vehicle => {
        if (!state.search) return true;
        return String(vehicle.carNumber || "").toLowerCase().includes(state.search) || String(vehicle.parkingSpot || "").toLowerCase().includes(state.search);
      })
      .sort((a, b) => Number(a.parkingSpot) - Number(b.parkingSpot));
  }

  function vehicleCard(vehicle) {
    return `<button type="button" class="vehicle-card status-${slug(vehicle.status)}" onclick="Renewal.openVehicle('${esc(vehicle.id)}')">
      <div class="card-top"><div><div class="spot-number">Spot #${esc(vehicle.parkingSpot)}</div><div class="car-number">${esc(vehicle.carNumber)}</div></div><span class="language-tag">${esc(vehicle.language || "N/A")}</span></div>
      <div class="card-bottom"><span class="status-label">${esc(vehicle.status)}</span><span class="wait-time">${formatDuration(vehicle.parkedAt)}</span></div>
      ${vehicle.status === "Wrapping" ? `<div class="wait-time" style="margin-top:9px">${vehicle.bagCount ? `${esc(vehicle.completedBagCount || 0)}/${esc(vehicle.bagCount)} bags complete` : "Waiting for bag number"}</div>` : ""}
    </button>`;
  }

  function renderVehiclePage() {
    const title = APP.roleLabels[currentRole];
    const descriptions = {
      parking: "Add vehicles and send arrived families to the next stage.",
      shopper: "Open a card to advance the family through shopping.",
      wrapper: "Send shopping-complete families into the wrapping tracker.",
      reindeer: "Only vehicles with every bag completed appear here."
    };
    const extra = currentRole === "parking" ? `<button class="button" onclick="Renewal.openAddVehicle()">＋ Add Vehicle</button>` : currentRole === "wrapper" ? `<a class="button" href="${pageFile("giftWrap.html")}" style="text-decoration:none">Gift Wrap Tracker</a>` : "";
    const undo = currentRole === "reindeer" ? `<div id="deliveryUndo"></div>` : "";
    chrome(title, `<div class="page-heading"><h2>${esc(title)}</h2><p>${esc(descriptions[currentRole])}</p></div>${undo}${filterToolbar(extra)}<div class="card-grid" id="vehicleGrid"></div><div id="modalRoot"></div>`, "list");
    renderVehicleGrid();
    renderDeliveryUndo();
  }

  function renderVehicleGrid() {
    const grid = document.getElementById("vehicleGrid");
    if (!grid) return;
    const vehicles = filteredVehicles();
    grid.innerHTML = vehicles.length ? vehicles.map(vehicleCard).join("") : `<div class="empty-state"><strong>No matching vehicles</strong><br>Try another search or status filter.</div>`;
  }

  function openAddVehicle() {
    document.getElementById("modalRoot").innerHTML = modal(`Add Vehicle`, `
      <form onsubmit="Renewal.createVehicle(event)"><div class="form-grid two">
        <div class="field"><label for="addSpot">Parking Spot #</label><input class="input" id="addSpot" name="parkingSpot" type="number" min="1" max="${APP.totalSpots}" required></div>
        <div class="field"><label for="addCar">Car / Ticket Number</label><input class="input" id="addCar" name="carNumber" maxlength="20" required></div>
        <div class="field"><label for="addLanguage">Language</label><select class="select" id="addLanguage" name="language"><option>English</option><option>Spanish</option><option>Other</option></select></div>
        <div class="field"><label>Status</label><input class="input" value="In-Car" disabled></div>
      </div><div class="modal-actions"><button type="button" class="button secondary" onclick="Renewal.closeModal()">Cancel</button><button class="button" type="submit">Add Vehicle</button></div></form>`);
    openModalElement();
  }

  function modal(title, content) {
    return `<div class="modal" id="appModal" role="dialog" aria-modal="true"><div class="modal-card"><div class="modal-head"><h2>${esc(title)}</h2><button class="icon-button" aria-label="Close" onclick="Renewal.closeModal()">×</button></div>${content}</div></div>`;
  }

  function openModalElement() {
    requestAnimationFrame(() => document.getElementById("appModal")?.classList.add("open"));
  }

  function closeModal() {
    document.getElementById("appModal")?.classList.remove("open");
    setTimeout(() => { const root = document.getElementById("modalRoot"); if (root) root.innerHTML = ""; }, 120);
  }

  async function createVehicle(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parkingSpot = String(Number(form.get("parkingSpot")));
    const carNumber = normalizeCarNumber(form.get("carNumber"));
    const language = String(form.get("language") || "English");
    if (!carNumber || Number(parkingSpot) < 1 || Number(parkingSpot) > APP.totalSpots) return alert("Enter a valid parking spot and car number.");
    const duplicate = Object.values(state.vehicles).some(vehicle => normalizeCarNumber(vehicle.carNumber) === carNumber);
    const occupied = Object.values(state.vehicles).some(vehicle => String(vehicle.parkingSpot) === parkingSpot);
    if (duplicate) return alert(`${carNumber} is already active in the parking app.`);
    if (occupied) return alert(`Parking spot ${parkingSpot} is already occupied.`);
    const vehicleRef = firebase.database().ref(eventPath("vehicles")).push();
    const activityRef = firebase.database().ref(eventPath("activity")).push();
    const vehicle = {
      carNumber, parkingSpot, language, status: "In-Car", parkedAt: serverTime(), statusChangedAt: serverTime(),
      notes: "", createdBy: state.user.uid, createdByName: state.user.displayName || state.user.email || "Parking"
    };
    const updates = {};
    updates[`${eventPath("vehicles")}/${vehicleRef.key}`] = vehicle;
    updates[`${eventPath("spotIndex")}/${parkingSpot}`] = vehicleRef.key;
    updates[`${eventPath("carIndex")}/${carNumber}`] = vehicleRef.key;
    updates[`${eventPath("statusHistory")}/${vehicleRef.key}/${activityRef.key}`] = { status: "In-Car", at: serverTime(), by: state.user.uid };
    updates[`${eventPath("activity")}/${activityRef.key}`] = activity("Vehicle added", vehicle, "In-Car");
    await write(firebase.database().ref().update(updates));
    closeModal();
  }

  function nextAction(vehicle) {
    const transitions = {
      parking: { "In-Car": ["Fetch-to-shop", "Send to Fetch-to-shop"] },
      shopper: { "Fetch-to-shop": ["Shopping", "Start Shopping"] },
      wrapper: { "Shopping": ["Wrapping", "Send to Wrapping"] }
    };
    return transitions[currentRole]?.[vehicle.status] || null;
  }

  function openVehicle(id) {
    const vehicle = state.vehicles[id];
    if (!vehicle) return;
    const isAdmin = currentRole === "admin";
    const next = nextAction(vehicle);
    const reindeerAction = currentRole === "reindeer" && vehicle.status === "Waiting for Reindeer";
    const wrapBlocked = currentRole === "wrapper" && vehicle.status === "Wrapping";
    const immutable = isAdmin ? "" : "disabled";
    document.getElementById("modalRoot").innerHTML = modal(`Vehicle Details`, `
      ${wrapBlocked ? `<div class="alert">This vehicle advances automatically when all ${esc(vehicle.bagCount || "required")} bags are completed in the Gift Wrap Tracker.</div>` : ""}
      <form onsubmit="Renewal.saveVehicle(event,'${esc(id)}')"><div class="form-grid two">
        <div class="field"><label>Parking Spot #</label><input class="input" name="parkingSpot" type="number" min="1" max="${APP.totalSpots}" value="${esc(vehicle.parkingSpot)}" ${immutable}></div>
        <div class="field"><label>Car / Ticket Number</label><input class="input" name="carNumber" value="${esc(vehicle.carNumber)}" ${immutable}></div>
        <div class="field"><label>Language</label><select class="select" name="language" ${immutable}>${["English", "Spanish", "Other"].map(item => `<option${item === vehicle.language ? " selected" : ""}>${item}</option>`).join("")}</select></div>
        <div class="field"><label>Status</label>${isAdmin ? `<select class="select" name="status">${statusOptions(vehicle.status)}</select>` : `<input class="input" value="${esc(vehicle.status)}" disabled>`}</div>
      </div>
      <div class="field" style="margin-top:12px"><label>Team Notes</label><textarea class="textarea" name="notes" placeholder="Optional note for other teams">${esc(vehicle.notes || "")}</textarea></div>
      <div class="field" style="margin-top:12px"><small>Arrived ${formatDate(vehicle.parkedAt)} · Waiting ${formatDuration(vehicle.parkedAt)}</small></div>
      <div class="modal-actions"><button type="button" class="button secondary" onclick="Renewal.closeModal()">Cancel</button><button class="button" type="submit">Save Changes</button></div>
      </form>
      ${next ? `<button class="button success full" style="margin-top:10px" onclick="Renewal.advanceVehicle('${esc(id)}','${esc(next[0])}')">${esc(next[1])}</button>` : ""}
      ${reindeerAction ? `<button class="button success full" style="margin-top:10px" onclick="Renewal.markDelivered('${esc(id)}')">Mark as Delivered</button>` : ""}
      ${isAdmin ? `<div class="danger-zone"><button class="button danger full" onclick="Renewal.adminRemoveVehicle('${esc(id)}')">Remove Vehicle from Active Event</button></div>` : ""}`);
    openModalElement();
  }

  async function saveVehicle(event, id) {
    event.preventDefault();
    const vehicle = state.vehicles[id];
    if (!vehicle) return;
    const form = new FormData(event.currentTarget);
    if (currentRole !== "admin") {
      await write(firebase.database().ref(`${eventPath("vehicles")}/${id}/notes`).set(String(form.get("notes") || "").trim()));
      closeModal();
      return;
    }
    const parkingSpot = String(Number(form.get("parkingSpot")));
    const carNumber = normalizeCarNumber(form.get("carNumber"));
    const status = String(form.get("status"));
    const occupied = Object.entries(state.vehicles).some(([otherId, item]) => otherId !== id && String(item.parkingSpot) === parkingSpot);
    const duplicate = Object.entries(state.vehicles).some(([otherId, item]) => otherId !== id && normalizeCarNumber(item.carNumber) === carNumber);
    if (occupied || duplicate) return alert(occupied ? `Spot ${parkingSpot} is occupied.` : `${carNumber} is already active.`);
    const updates = {};
    updates[`${eventPath("vehicles")}/${id}/parkingSpot`] = parkingSpot;
    updates[`${eventPath("vehicles")}/${id}/carNumber`] = carNumber;
    updates[`${eventPath("vehicles")}/${id}/language`] = String(form.get("language"));
    updates[`${eventPath("vehicles")}/${id}/notes`] = String(form.get("notes") || "").trim();
    if (parkingSpot !== String(vehicle.parkingSpot)) {
      updates[`${eventPath("spotIndex")}/${vehicle.parkingSpot}`] = null;
      updates[`${eventPath("spotIndex")}/${parkingSpot}`] = id;
    }
    if (carNumber !== vehicle.carNumber) {
      updates[`${eventPath("carIndex")}/${vehicle.carNumber}`] = null;
      updates[`${eventPath("carIndex")}/${carNumber}`] = id;
    }
    await write(firebase.database().ref().update(updates));
    if (status !== vehicle.status) await setVehicleStatus(id, status, "Administrator corrected status");
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
      byName: state.user.displayName || state.user.email || APP.roleLabels[currentRole]
    };
  }

  async function setVehicleStatus(id, status, actionText, bagsVerified = false) {
    const vehicle = state.vehicles[id];
    if (!vehicle || !APP.statuses.includes(status)) return;
    if (status === "Waiting for Reindeer" && currentRole !== "admin" && !bagsVerified) {
      const bags = Object.values(state.bags).filter(bag => bag.vehicleId === id);
      if (!vehicle.bagCount || bags.length !== Number(vehicle.bagCount) || !bags.every(bag => bag.status === "completed")) {
        alert("This vehicle cannot move to Waiting for Reindeer until every bag is completed in the Gift Wrap Tracker.");
        return;
      }
    }
    const historyRef = firebase.database().ref(`${eventPath("statusHistory")}/${id}`).push();
    const activityRef = firebase.database().ref(eventPath("activity")).push();
    const updates = {};
    updates[`${eventPath("vehicles")}/${id}/status`] = status;
    updates[`${eventPath("vehicles")}/${id}/statusChangedAt`] = serverTime();
    updates[`${eventPath("statusHistory")}/${id}/${historyRef.key}`] = { from: vehicle.status, status, at: serverTime(), by: state.user.uid };
    updates[`${eventPath("activity")}/${activityRef.key}`] = activity(actionText || `Moved to ${status}`, { id, ...vehicle }, status);
    await write(firebase.database().ref().update(updates));
  }

  async function advanceVehicle(id, status) {
    await setVehicleStatus(id, status, `Moved from ${state.vehicles[id]?.status} to ${status}`);
    closeModal();
  }

  async function markDelivered(id) {
    const vehicle = state.vehicles[id];
    if (!vehicle || vehicle.status !== "Waiting for Reindeer") return alert("Only vehicles waiting for Reindeer can be delivered.");
    if (!confirm(`Mark ${vehicle.carNumber} in spot ${vehicle.parkingSpot} as delivered?`)) return;
    const deliveryRef = firebase.database().ref(eventPath("deliveries")).push();
    const activityRef = firebase.database().ref(eventPath("activity")).push();
    const delivered = { ...vehicle, vehicleId: id, deliveredAt: serverTime(), deliveredBy: state.user.uid, deliveredByName: state.user.displayName || state.user.email || "Reindeer" };
    const updates = {};
    updates[`${eventPath("deliveries")}/${deliveryRef.key}`] = delivered;
    updates[`${eventPath("vehicles")}/${id}`] = null;
    updates[`${eventPath("spotIndex")}/${vehicle.parkingSpot}`] = null;
    updates[`${eventPath("carIndex")}/${vehicle.carNumber}`] = null;
    updates[`${eventPath("activity")}/${activityRef.key}`] = activity("Marked as delivered", { id, ...vehicle }, "Delivered");
    await write(firebase.database().ref().update(updates));
    localStorage.setItem(`renewalLastDelivery:${state.eventId}`, deliveryRef.key);
    closeModal();
    renderDeliveryUndo();
  }

  function renderDeliveryUndo() {
    const container = document.getElementById("deliveryUndo");
    if (!container || !state.eventId) return;
    const id = localStorage.getItem(`renewalLastDelivery:${state.eventId}`);
    const delivery = id && state.deliveries[id];
    container.innerHTML = delivery ? `<div class="alert success">Last delivery: <strong>${esc(delivery.carNumber)}</strong> from spot ${esc(delivery.parkingSpot)}. <button class="button ghost small" onclick="Renewal.undoDelivery('${esc(id)}')">Undo delivery</button></div>` : "";
  }

  async function undoDelivery(deliveryId) {
    const delivery = state.deliveries[deliveryId];
    if (!delivery) return alert("That delivery is no longer available to undo.");
    const occupied = Object.values(state.vehicles).some(vehicle => String(vehicle.parkingSpot) === String(delivery.parkingSpot));
    if (occupied) return alert(`Spot ${delivery.parkingSpot} is occupied, so this delivery cannot be restored.`);
    if (!confirm(`Restore ${delivery.carNumber} to active vehicles?`)) return;
    const { vehicleId, deliveredAt, deliveredBy, deliveredByName, ...vehicle } = delivery;
    const activityRef = firebase.database().ref(eventPath("activity")).push();
    const updates = {};
    updates[`${eventPath("vehicles")}/${vehicleId}`] = vehicle;
    updates[`${eventPath("deliveries")}/${deliveryId}`] = null;
    updates[`${eventPath("spotIndex")}/${vehicle.parkingSpot}`] = vehicleId;
    updates[`${eventPath("carIndex")}/${vehicle.carNumber}`] = vehicleId;
    updates[`${eventPath("activity")}/${activityRef.key}`] = activity("Delivery undone", { id: vehicleId, ...vehicle });
    await write(firebase.database().ref().update(updates));
    localStorage.removeItem(`renewalLastDelivery:${state.eventId}`);
    renderDeliveryUndo();
  }

  async function adminRemoveVehicle(id) {
    const vehicle = state.vehicles[id];
    if (!vehicle || currentRole !== "admin") return;
    if (!confirm(`ADMIN REMOVE: Remove ${vehicle.carNumber} from the active event? This is separate from delivery.`)) return;
    const removalRef = firebase.database().ref(eventPath("removed")).push();
    const activityRef = firebase.database().ref(eventPath("activity")).push();
    const removed = { ...vehicle, vehicleId: id, removedAt: serverTime(), removedBy: state.user.uid, removedByName: state.user.displayName || state.user.email || "Administrator" };
    const updates = {};
    updates[`${eventPath("removed")}/${removalRef.key}`] = removed;
    updates[`${eventPath("vehicles")}/${id}`] = null;
    updates[`${eventPath("spotIndex")}/${vehicle.parkingSpot}`] = null;
    updates[`${eventPath("carIndex")}/${vehicle.carNumber}`] = null;
    updates[`${eventPath("activity")}/${activityRef.key}`] = activity("Administrator removed vehicle", { id, ...vehicle });
    await write(firebase.database().ref().update(updates));
    closeModal();
  }

  async function restoreRemoval(removalId) {
    const removed = state.removed[removalId];
    if (!removed || currentRole !== "admin") return;
    const occupied = Object.values(state.vehicles).some(vehicle => String(vehicle.parkingSpot) === String(removed.parkingSpot));
    if (occupied) return alert(`Spot ${removed.parkingSpot} is occupied. Change that vehicle first.`);
    const { vehicleId, removedAt, removedBy, removedByName, ...vehicle } = removed;
    const activityRef = firebase.database().ref(eventPath("activity")).push();
    const updates = {};
    updates[`${eventPath("vehicles")}/${vehicleId}`] = vehicle;
    updates[`${eventPath("removed")}/${removalId}`] = null;
    updates[`${eventPath("spotIndex")}/${vehicle.parkingSpot}`] = vehicleId;
    updates[`${eventPath("carIndex")}/${vehicle.carNumber}`] = vehicleId;
    updates[`${eventPath("activity")}/${activityRef.key}`] = activity("Administrator removal undone", { id: vehicleId, ...vehicle });
    await write(firebase.database().ref().update(updates));
  }

  function renderGiftWrapPage() {
    chrome("Gift Wrap Tracker", `<div class="page-heading"><h2>Gift Wrap Tracker</h2><p>Vehicles enter here automatically when Wrapper changes them to Wrapping.</p></div><section class="wrap-setup"><h3>Waiting for bag number</h3><div class="card-grid" id="wrapSetupList"></div></section><div class="wrap-columns"><section class="wrap-column"><h3>Waiting <span id="waitingCount">0</span></h3><div class="bag-list" id="waitingBags"></div></section><section class="wrap-column"><h3>In Progress <span id="activeCount">0</span></h3><div class="bag-list" id="activeBags"></div></section><section class="wrap-column"><h3>Completed <span id="completedCount">0</span></h3><div class="bag-list" id="completedBags"></div></section></div><div id="modalRoot"></div>`, "list");
    renderWrapData();
  }

  function renderWrapData() {
    const setup = document.getElementById("wrapSetupList");
    if (!setup) return;
    const waitingSetup = Object.entries(state.vehicles).map(([id, vehicle]) => ({ id, ...vehicle })).filter(vehicle => vehicle.status === "Wrapping" && !Number(vehicle.bagCount));
    setup.innerHTML = waitingSetup.length ? waitingSetup.map(vehicleCard).join("") : `<div class="empty-state">No vehicles are waiting for a bag number.</div>`;
    const bags = Object.entries(state.bags).map(([id, bag]) => ({ id, ...bag }));
    ["waiting", "active", "completed"].forEach(status => {
      const items = bags.filter(bag => bag.status === status).sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
      const target = document.getElementById(`${status}Bags`);
      const count = document.getElementById(`${status}Count`);
      if (count) count.textContent = items.length;
      if (target) target.innerHTML = items.length ? items.map(bagCard).join("") : `<div class="empty-state" style="padding:18px 8px">Empty</div>`;
    });
  }

  function bagCard(bag) {
    return `<button type="button" class="bag-card" style="text-align:left;width:100%" onclick="Renewal.openBag('${esc(bag.id)}')"><div class="bag-banner ${esc(bag.status)}">${bag.status === "waiting" ? "Waiting for workstation" : bag.status === "active" ? `Workstation ${esc(bag.workStation || "")}` : "Completed"}</div><strong>Bag ${esc(bag.bagIndex)}/${esc(bag.bagMax)}</strong><div>Ticket ${esc(bag.carNumber)} · Spot ${esc(bag.parkingSpot)}</div></button>`;
  }

  function openWrapSetup(vehicleId) {
    const vehicle = state.vehicles[vehicleId];
    if (!vehicle) return;
    document.getElementById("modalRoot").innerHTML = modal("Add Bag Number", `<div class="alert">Ticket <strong>${esc(vehicle.carNumber)}</strong> · Spot ${esc(vehicle.parkingSpot)}<br>This creates one tracker card per bag.</div><form onsubmit="Renewal.createBags(event,'${esc(vehicleId)}')"><div class="field"><label>Total number of bags</label><input class="input" type="number" name="bagCount" min="1" max="25" required autofocus></div><div class="modal-actions"><button type="button" class="button secondary" onclick="Renewal.closeModal()">Cancel</button><button class="button" type="submit">Create Bag Trackers</button></div></form>`);
    openModalElement();
  }

  async function createBags(event, vehicleId) {
    event.preventDefault();
    const vehicle = state.vehicles[vehicleId];
    const count = Number(new FormData(event.currentTarget).get("bagCount"));
    if (!vehicle || vehicle.status !== "Wrapping" || vehicle.bagCount) return alert("Bag trackers were already created or this vehicle is no longer wrapping.");
    if (!Number.isInteger(count) || count < 1 || count > 25) return alert("Enter between 1 and 25 bags.");
    const updates = {};
    updates[`${eventPath("vehicles")}/${vehicleId}/bagCount`] = count;
    updates[`${eventPath("vehicles")}/${vehicleId}/completedBagCount`] = 0;
    for (let index = 1; index <= count; index += 1) {
      const ref = firebase.database().ref(eventPath("bags")).push();
      updates[`${eventPath("bags")}/${ref.key}`] = { vehicleId, carNumber: vehicle.carNumber, parkingSpot: vehicle.parkingSpot, bagIndex: index, bagMax: count, status: "waiting", wrapped: false, workStation: "", createdAt: serverTime() };
    }
    const activityRef = firebase.database().ref(eventPath("activity")).push();
    updates[`${eventPath("activity")}/${activityRef.key}`] = activity(`Created ${count} bag trackers`, { id: vehicleId, ...vehicle });
    await write(firebase.database().ref().update(updates));
    closeModal();
  }

  function openBag(id) {
    const bag = state.bags[id];
    if (!bag) return;
    document.getElementById("modalRoot").innerHTML = modal(`Bag ${bag.bagIndex} of ${bag.bagMax}`, `<div class="alert">Ticket <strong>${esc(bag.carNumber)}</strong> · Spot ${esc(bag.parkingSpot)}</div><form onsubmit="Renewal.saveBag(event,'${esc(id)}')"><div class="field"><label>Workstation #</label><input class="input" name="workStation" value="${esc(bag.workStation || "")}" ${bag.status === "completed" ? "disabled" : ""} placeholder="Assign a table or station"></div><div class="field" style="margin-top:12px"><label>Status</label><input class="input" value="${esc(bag.status)}" disabled></div>${bag.status !== "completed" ? `<div class="modal-actions"><button type="button" class="button secondary" onclick="Renewal.closeModal()">Cancel</button><button class="button" type="submit">Save Assignment</button></div></form><button class="button success full" style="margin-top:10px" onclick="Renewal.completeBag('${esc(id)}')" ${bag.workStation ? "" : "disabled"}>Mark Bag Wrapped</button>` : `</form><button class="button secondary full" onclick="Renewal.closeModal()">Close</button>`}`);
    openModalElement();
  }

  async function saveBag(event, id) {
    event.preventDefault();
    const bag = state.bags[id];
    if (!bag || bag.status === "completed") return;
    const workStation = String(new FormData(event.currentTarget).get("workStation") || "").trim();
    await write(firebase.database().ref(`${eventPath("bags")}/${id}`).update({ workStation, status: workStation ? "active" : "waiting" }));
    closeModal();
  }

  async function completeBag(id) {
    const bag = state.bags[id];
    if (!bag || bag.status === "completed") return;
    if (!bag.workStation) return alert("Assign this bag to a workstation before completing it.");
    await write(firebase.database().ref(`${eventPath("bags")}/${id}`).update({ status: "completed", wrapped: true, completedAt: serverTime(), completedBy: state.user.uid }));
    closeModal();
    setTimeout(() => checkWrapCompletion(bag.vehicleId), 100);
  }

  async function checkWrapCompletion(vehicleId) {
    const snapshot = await firebase.database().ref(eventPath("bags")).orderByChild("vehicleId").equalTo(vehicleId).once("value");
    const bags = Object.values(snapshot.val() || {});
    const vehicleSnap = await firebase.database().ref(`${eventPath("vehicles")}/${vehicleId}`).once("value");
    const vehicle = vehicleSnap.val();
    if (!vehicle) return;
    const completed = bags.filter(bag => bag.status === "completed").length;
    await firebase.database().ref(`${eventPath("vehicles")}/${vehicleId}/completedBagCount`).set(completed);
    if (Number(vehicle.bagCount) > 0 && bags.length === Number(vehicle.bagCount) && completed === bags.length && vehicle.status === "Wrapping") {
      await setVehicleStatus(vehicleId, "Waiting for Reindeer", "All bags completed; ready for Reindeer", true);
    }
  }

  function renderAdminPage() {
    chrome("Administrator", `<div class="page-heading"><h2>Live Operations Dashboard</h2><p>Active event: <strong id="eventName">${esc(state.eventId || APP.defaultEventId)}</strong></p></div><div class="toolbar"><button class="button" onclick="Renewal.createFreshEvent()">＋ Start Fresh Event</button><a class="button ghost" href="${pageFile("parkingmap.html")}" style="text-decoration:none">View All 160 Spots</a><a class="button ghost" href="${pageFile("analytics.html")}" style="text-decoration:none">Open Analytics</a></div><div class="metrics-grid" id="metrics"></div><div class="dashboard-grid"><section class="panel"><h3>Status Breakdown</h3><div id="statusBreakdown"></div></section><section class="panel"><h3>Synchronization</h3><div id="syncSummary"></div><div class="device-list" id="deviceList"></div></section><section class="panel"><h3>Recent Activity</h3><div class="activity-list" id="activityList"></div></section><section class="panel"><h3>User Access</h3><p style="color:var(--muted);font-size:.82rem">Google users appear here after signing in once. Check the roles they may access.</p><div class="user-admin-list" id="userList"></div></section></div><div id="modalRoot"></div>`, "list");
    renderAdminData();
  }

  function averageDuration(items, endField) {
    const durations = items.map(item => Number(item[endField]) - Number(item.parkedAt)).filter(value => Number.isFinite(value) && value >= 0);
    return durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0;
  }

  function renderAnalyticsPage() {
    chrome("Analytics", `<div class="page-heading analytics-heading"><a class="back-link" href="${pageFile("admin-page.html")}">← Dashboard</a><h2>Event Analytics</h2><p>Live timing and throughput for the active Christmas Store event.</p></div><div class="metrics-grid analytics-metrics" id="analyticsMetrics"></div><section class="panel analytics-panel"><h3>Average Time by Current Status</h3><div class="analytics-status-list" id="analyticsStatusList"></div></section><section class="panel analytics-panel"><h3>Today’s Overview</h3><div class="today-grid" id="todayOverview"></div></section>`, "stats");
    renderAnalyticsData();
  }

  function renderAnalyticsData() {
    const metrics = document.getElementById("analyticsMetrics");
    if (!metrics) return;
    const vehicles = Object.values(state.vehicles);
    const delivered = Object.values(state.deliveries);
    const removed = Object.values(state.removed);
    const finished = [...delivered.map(item => ({ ...item, finishedAt: item.deliveredAt })), ...removed.map(item => ({ ...item, finishedAt: item.removedAt }))];
    const avgTotal = averageDuration(finished, "finishedAt");
    metrics.innerHTML = metric("Average Parked Time (All)", avgTotal ? formatDuration(Date.now() - avgTotal) : "—") + metric("Total Delivered", delivered.length) + metric("Currently Parked", vehicles.length) + metric("Empty Spots", APP.totalSpots - vehicles.length);

    document.getElementById("analyticsStatusList").innerHTML = APP.statuses.map(status => {
      const matching = vehicles.filter(vehicle => vehicle.status === status && Number(vehicle.statusChangedAt));
      const average = matching.length ? matching.reduce((sum, vehicle) => sum + (Date.now() - Number(vehicle.statusChangedAt)), 0) / matching.length : 0;
      return `<div class="analytics-status-row status-${slug(status)}"><span><i aria-hidden="true"></i>${esc(status)}</span><strong>${matching.length ? formatDuration(Date.now() - average) : "—"}</strong></div>`;
    }).join("");

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const activityToday = Object.values(state.activity).filter(item => Number(item.at) >= todayStart.getTime());
    const added = activityToday.filter(item => item.action === "Vehicle added").length;
    const deliveredToday = delivered.filter(item => Number(item.deliveredAt) >= todayStart.getTime()).length;
    const hours = activityToday.reduce((counts, item) => {
      const hour = new Date(Number(item.at)).getHours();
      counts[hour] = (counts[hour] || 0) + 1;
      return counts;
    }, {});
    const peakHour = Object.keys(hours).sort((a, b) => hours[b] - hours[a])[0];
    const peakLabel = peakHour === undefined ? "—" : new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(new Date(todayStart.getTime() + Number(peakHour) * 3600000));
    document.getElementById("todayOverview").innerHTML = metric("Added", added) + metric("Delivered", deliveredToday) + metric("Peak Time", peakLabel);
  }

  function renderAdminData() {
    const metrics = document.getElementById("metrics");
    if (!metrics) return;
    const vehicles = Object.values(state.vehicles);
    const delivered = Object.values(state.deliveries);
    const removed = Object.values(state.removed);
    const durations = [...delivered.map(item => Number(item.deliveredAt) - Number(item.parkedAt)), ...removed.map(item => Number(item.removedAt) - Number(item.parkedAt))].filter(Number.isFinite);
    const avg = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0;
    metrics.innerHTML = metric("Total Parked", vehicles.length) + metric("Empty Spots", APP.totalSpots - vehicles.length) + metric("Delivered", delivered.length) + metric("Avg. Total Time", avg ? formatDuration(Date.now() - avg) : "—");
    const max = Math.max(1, ...APP.statuses.map(status => vehicles.filter(vehicle => vehicle.status === status).length));
    document.getElementById("statusBreakdown").innerHTML = APP.statuses.map(status => {
      const count = vehicles.filter(vehicle => vehicle.status === status).length;
      return `<div class="status-row"><span>${esc(status)}</span><div class="bar-track"><div class="bar-fill status-${slug(status)}" style="width:${(count / max) * 100}%;background:var(--status-color)"></div></div><strong>${count}</strong></div>`;
    }).join("");
    const activities = Object.values(state.activity).sort((a, b) => Number(b.at) - Number(a.at)).slice(0, 8);
    document.getElementById("activityList").innerHTML = activities.length ? activities.map(item => `<div class="activity-item"><strong>${esc(item.action)}</strong><span>Spot ${esc(item.parkingSpot)} · ${esc(item.carNumber)}</span><small>${formatDate(item.at)} by ${esc(item.byName || "Volunteer")}</small></div>`).join("") : `<div class="empty-state" style="padding:18px">No activity yet.</div>`;
    renderPresence();
    renderUsers();
  }

  function metric(label, value) {
    return `<div class="metric"><span class="metric-label">${esc(label)}</span><strong class="metric-value">${esc(value)}</strong></div>`;
  }

  function renderPresence() {
    const sessions = [];
    Object.values(state.presence || {}).forEach(userSessions => Object.values(userSessions || {}).forEach(item => sessions.push(item)));
    sessions.sort((a, b) => Number(b.online) - Number(a.online) || Number(b.lastSeen) - Number(a.lastSeen));
    const online = sessions.filter(item => item.online && Date.now() - Number(item.lastSeen || 0) < 90000);
    const summary = document.getElementById("syncSummary");
    const list = document.getElementById("deviceList");
    if (summary) summary.innerHTML = `<div class="alert ${online.length ? "success" : "error"}"><strong>${online.length} device${online.length === 1 ? "" : "s"} online</strong><br>All active browser instances report here.</div>`;
    if (list) list.innerHTML = sessions.slice(0, 10).map(item => `<div class="device-item"><strong>${item.online ? "● Online" : "○ Offline"} · ${esc(APP.roleLabels[item.role] || item.role || "Viewer")}</strong><span>${esc(item.displayName || item.email || "Unknown device")}</span><small>${esc(item.page || "page")} · Last seen ${formatDate(item.lastSeen)}</small></div>`).join("") || `<div class="empty-state" style="padding:18px">No devices have connected.</div>`;
  }

  function renderUsers() {
    const list = document.getElementById("userList");
    if (!list) return;
    const users = Object.entries(state.users).sort(([, a], [, b]) => String(a.displayName || a.email).localeCompare(String(b.displayName || b.email)));
    list.innerHTML = users.length ? users.map(([uid, user]) => `<div class="user-row"><strong>${esc(user.displayName || "User")}</strong><br><small>${esc(user.email || uid)}</small><div class="role-checks">${APP.roles.map(role => `<label><input type="checkbox" ${user.roles?.[role] ? "checked" : ""} onchange="Renewal.updateUserRole('${esc(uid)}','${role}',this.checked)">${esc(APP.roleLabels[role])}</label>`).join("")}</div></div>`).join("") : `<div class="empty-state" style="padding:18px">Users appear after their first Google sign-in.</div>`;
  }

  async function updateUserRole(uid, role, enabled) {
    if (currentRole !== "admin" || !APP.roles.includes(role)) return;
    if (uid === state.user.uid && role === "admin" && !enabled) {
      renderUsers();
      return alert("You cannot remove your own administrator access while signed in.");
    }
    await write(firebase.database().ref(`users/${uid}/roles/${role}`).set(enabled ? true : null));
  }

  async function createFreshEvent() {
    if (currentRole !== "admin") return;
    const label = prompt("Name the new event (example: Christmas Store 2027 or Training Night):");
    if (!label) return;
    const id = slug(label);
    if (!id) return alert("Enter a valid event name.");
    const exists = await firebase.database().ref(`events/${id}/meta`).once("value");
    if (exists.exists() && !confirm("That event already exists. Switch to it without erasing its data?")) return;
    if (!exists.exists()) {
      await write(firebase.database().ref(`events/${id}/meta`).set({ name: label.trim(), createdAt: serverTime(), createdBy: state.user.uid, totalSpots: APP.totalSpots }));
    }
    await write(firebase.database().ref("config/activeEventId").set(id));
    alert(`${label.trim()} is now active. Every connected device will switch automatically.`);
  }

  function listenAdminExtras() {
    const presenceRef = firebase.database().ref(`presence/${state.eventId}`);
    const presenceHandler = snapshot => { state.presence = snapshot.val() || {}; renderAdminData(); };
    listen(presenceRef, "value", presenceHandler);
    const usersRef = firebase.database().ref("users");
    const usersHandler = snapshot => { state.users = snapshot.val() || {}; renderAdminData(); };
    listen(usersRef, "value", usersHandler);
  }

  function renderSpotsPage() {
    chrome("All Parking Spots", `<div class="page-heading"><h2>All ${APP.totalSpots} Parking Spots</h2><p>Administrators can open occupied spots to correct any vehicle field.</p></div>${filterToolbar()}<div class="spot-grid" id="spotGrid"></div><div id="modalRoot"></div>`, "spots");
    renderSpots();
  }

  function renderSpots() {
    const grid = document.getElementById("spotGrid");
    if (!grid) return;
    const bySpot = new Map(Object.entries(state.vehicles).map(([id, vehicle]) => [String(vehicle.parkingSpot), { id, ...vehicle }]));
    grid.innerHTML = Array.from({ length: APP.totalSpots }, (_, index) => {
      const spot = String(index + 1);
      const vehicle = bySpot.get(spot);
      const hidden = vehicle
        ? ((state.search && !String(vehicle.carNumber).toLowerCase().includes(state.search) && !spot.includes(state.search)) || (state.selectedStatuses.size && !state.selectedStatuses.has(vehicle.status)))
        : Boolean((state.search && !spot.includes(state.search)) || state.selectedStatuses.size);
      if (hidden) return "";
      return vehicle ? `<button class="spot-tile occupied status-${slug(vehicle.status)}" onclick="Renewal.openVehicle('${esc(vehicle.id)}')"><strong>${spot}</strong><small>${esc(vehicle.carNumber)}</small><br><small>${esc(vehicle.status)}</small></button>` : `<div class="spot-tile"><strong>${spot}</strong><small>Empty</small></div>`;
    }).join("");
  }

  function renderHistoryPage() {
    chrome("Vehicle History", `<div class="page-heading"><h2>Delivered and Removed</h2><p>Deliveries and administrator removals are kept separate. Restoring a removal also updates every statistic.</p></div><div class="metrics-grid"><div class="metric"><span class="metric-label">Delivered</span><strong class="metric-value" id="deliveredMetric">0</strong></div><div class="metric"><span class="metric-label">Admin Removed</span><strong class="metric-value" id="removedMetric">0</strong></div></div><div class="dashboard-grid"><section class="panel"><h3>Delivered</h3><div class="log-list" id="deliveryLog"></div></section><section class="panel"><h3>Administrator Removed</h3><div class="log-list" id="removedLog"></div></section></div>`, "history");
    renderHistoryData();
  }

  function renderHistoryData() {
    const deliveryLog = document.getElementById("deliveryLog");
    if (!deliveryLog) return;
    const deliveries = Object.entries(state.deliveries).sort(([, a], [, b]) => Number(b.deliveredAt) - Number(a.deliveredAt));
    const removed = Object.entries(state.removed).sort(([, a], [, b]) => Number(b.removedAt) - Number(a.removedAt));
    document.getElementById("deliveredMetric").textContent = deliveries.length;
    document.getElementById("removedMetric").textContent = removed.length;
    deliveryLog.innerHTML = deliveries.length ? deliveries.map(([id, item]) => `<div class="log-item"><strong>Spot ${esc(item.parkingSpot)} · ${esc(item.carNumber)}</strong><span>Delivered ${formatDate(item.deliveredAt)}</span><small>Total time ${formatDuration(item.parkedAt, item.deliveredAt)}</small><button class="button ghost small" onclick="Renewal.undoDelivery('${esc(id)}')">Undo Delivery</button></div>`).join("") : `<div class="empty-state" style="padding:18px">No deliveries yet.</div>`;
    document.getElementById("removedLog").innerHTML = removed.length ? removed.map(([id, item]) => `<div class="log-item"><strong>Spot ${esc(item.parkingSpot)} · ${esc(item.carNumber)}</strong><span>Removed ${formatDate(item.removedAt)}</span><small>${esc(item.removedByName || "Administrator")}</small><button class="button ghost small" onclick="Renewal.restoreRemoval('${esc(id)}')">Undo Removal</button></div>`).join("") : `<div class="empty-state" style="padding:18px">No administrator removals.</div>`;
  }

  function renderMapPage() {
    chrome("Parking Lot Map", `<div class="page-heading"><h2>Parking Lot Map</h2><p>Use this map to direct volunteers and families to the correct area.</p></div><div class="map-frame"><img class="map-image" id="parkingLotMap" src="../assets/parking-lot-map.png" alt="Renewal parking lot map" onerror="Renewal.showMapPlaceholder()"></div>`, "map");
  }

  function showMapPlaceholder() {
    const image = document.getElementById("parkingLotMap");
    const placeholder = document.getElementById("mapPlaceholder");
    if (image) image.hidden = true;
    if (placeholder) placeholder.hidden = false;
  }

  function renderHelpPage() {
    chrome("Settings", `<div class="settings-layout"><div class="settings-menu" aria-label="Settings and help options"><details class="settings-item"><summary><span class="settings-icon">?</span><strong>Help Center</strong><span>›</span></summary><p>Ask the event administrator for help with access, a missing vehicle, or an unexpected status.</p></details><details class="settings-item"><summary><span class="settings-icon">▢</span><strong>App Guide</strong><span>›</span></summary><div class="guide-copy"><p><b>Parking:</b> Add a vehicle, then send it to Fetch-to-shop.</p><p><b>Shopper:</b> Open the card and start Shopping.</p><p><b>Wrapper:</b> Send the family to Wrapping, enter the bag count, and complete every bag.</p><p><b>Reindeer:</b> Mark ready vehicles as Delivered.</p></div></details><details class="settings-item"><summary><span class="settings-icon">✉</span><strong>Contact Support</strong><span>›</span></summary><p>Replace this text with the name, email address, or phone number for your event support contact.</p></details><details class="settings-item"><summary><span class="settings-icon">i</span><strong>About the App</strong><span>›</span></summary><p>Renewal Neighborhood Church Christmas Store Parking App · Version 4.0.</p></details><button class="settings-item sign-out-item" onclick="Renewal.signOut()"><span class="settings-icon">↪</span><strong>Sign Out</strong><span>›</span></button></div><div class="settings-art asset-slot"><img src="../assets/settings-floral-decoration.png" alt="Decorative floral artwork" onerror="Renewal.showAssetPlaceholder(this)"><div class="asset-fallback floral-fallback" hidden><span>❧</span><small>settings-floral-decoration.png</small></div></div><footer class="settings-footer"><strong>Renewal Neighborhood Church</strong><br>Christmas Store Parking App<br>Version 4.0.0</footer></div>`, "help");
  }

  function onCoreUpdate(key) {
    if (page === "vehicles") {
      renderVehicleGrid();
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
    location.href = `${rootPrefix}roles.html`;
  }

  async function start() {
    if (page === "home") return renderHome();
    if (page === "roles") return renderRoles();
    initFirebase();
    if (page === "login") {
      renderLogin();
      firebase.auth().onAuthStateChanged(async user => {
        if (!user) return;
        const ok = await authorize(user, currentRole, true);
        if (ok) location.replace(APP.rolePages[currentRole] || "help.html");
      });
      return;
    }
    document.getElementById("app").innerHTML = `<section class="auth-page"><div class="auth-card">${brandBlock()}<p>Loading your workspace…</p></div></section>`;
    firebase.auth().onAuthStateChanged(async user => {
      if (!user) {
        const roleParam = currentRole ? `?role=${encodeURIComponent(currentRole)}` : "";
        location.replace(`${rootPrefix}pages/login.html${roleParam}`.replace("pages/pages/", "pages/"));
        return;
      }
      const ok = await authorize(user, currentRole || null, false);
      if (ok) {
        if (!currentRole) currentRole = APP.roles.find(role => state.userRecord.roles?.[role]) || "";
        setupProtectedPage();
      }
    });
  }

  window.Renewal = {
    chooseRole, signInWithGoogle, signOut, toggleDrawer, closeDrawerFromBackdrop,
    setSearch, toggleStatusFilter, clearStatusFilters, openAddVehicle, createVehicle,
    openVehicle, saveVehicle, advanceVehicle, markDelivered, undoDelivery,
    adminRemoveVehicle, restoreRemoval, closeModal, openWrapSetup, createBags,
    openBag, saveBag, completeBag, updateUserRole, createFreshEvent, showMapPlaceholder,
    showAssetPlaceholder
  };

  // Gift Wrap setup cards use the vehicle renderer but open the bag-count modal.
  const originalOpenVehicle = openVehicle;
  window.Renewal.openVehicle = function (id) {
    if (page === "gift-wrap" && state.vehicles[id]?.status === "Wrapping" && !state.vehicles[id]?.bagCount) return openWrapSetup(id);
    return originalOpenVehicle(id);
  };

  document.addEventListener("keydown", event => { if (event.key === "Escape") closeModal(); });
  start().catch(error => {
    console.error(error);
    document.getElementById("app").innerHTML = `<section class="auth-page"><div class="auth-card">${brandBlock()}<h1>Unable to start the app</h1><p class="alert error">${esc(error.message)}</p></div></section>`;
  });
})();
