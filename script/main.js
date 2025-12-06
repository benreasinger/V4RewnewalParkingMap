function toggleDropdown() {
    document.querySelector(".dropdown").classList.toggle("show");
  }
  
  window.addEventListener("click", function (e) {
    if (!e.target.matches('.dropbtn')) {
      const dropdown = document.querySelector(".dropdown");
      if (dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
      }
    }
  });
  
  function handleJobRedirect(job) {
    switch (job) {
    case "Shopper":
        window.location.href = "pages/shopping.html";
        break;
    case "ParkingManagement":
        window.location.href = "pages/createVehicle.html";
        break;
    case "Reindeer":
        window.location.href = "pages/reindeer.html";        
        break;
    case "Administrator":
        window.location.href = "pages/login-page/login-page.html";
        break;
    case "Wrapper":
        window.location.href = "pages/wrapper.html";
    }
  }
  
function goBack() {
    window.history.back();
}

const loginForm = document.getElementById("login-form");
const loginButton = document.getElementById("login-form-submit");
const loginErrorMsg = document.getElementById("login-error-msg");
let loginattemps = 0;

loginButton?.addEventListener("click", (e) => {
    e.preventDefault();
    const password = loginForm.password.value;
    if (password === "3478") {
        loginErrorMsg.style.opacity = 0;
        window.location.replace("../admin-page.html");
        loginattemps = 0;
    } else if (loginattemps < 1) {
        loginErrorMsg.style.opacity = 1;
        loginattemps++;
        loginErrorMsg.style.opacity = 0;
    } else {
        loginErrorMsg.style.opacity = 1;
        setTimeout(() => { loginErrorMsg.style.opacity = 0; }, 2000);
    }
});

const firebaseConfig = {
    apiKey: "AIzaSyDbs6UgbaxuxKZyG3v464lkeEtMJQbZ6-4",
    authDomain: "renewalparking.firebaseapp.com",
    databaseURL: "https://renewalparking-default-rtdb.firebaseio.com",
    projectId: "renewalparking",
    storageBucket: "renewalparking.appspot.com",
    messagingSenderId: "398724226058",
    appId: "1:398724226058:web:cfb4d70283c546944d13f3",
    measurementId: "G-SGV7YXDJ8X"
};
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();
console.log("Firebase initialized successfully!");

let totalSlots = 160;
let parkingSlots = [];
let lastRemovedSlot = null;


function initializeParkingSlots() {
    parkingSlots = Array.from({ length: totalSlots }, (_, i) => ({
        "parking-number": (i + 1).toString(),
        "car-number": "",
        "language": "N/A",
        "status": "N/A"
    }));
    updateDatabase();
}

function updateDatabase() {
    firebase.database().ref('parkingSlots').set(parkingSlots)
        .then(() => console.log("Database updated successfully."))
        .catch(error => console.error("Error updating database:", error));
}

function toggleFab() {
    document.querySelector(".fab-container")?.classList.toggle("open");
}

function createVehicle() {
    const carNumber = document.getElementById("newCarNumber").value.trim();
    const language = document.getElementById("newCarLanguage").value;
    const parkingNumber = parseInt(document.getElementById("parkingNumberInput").value);

    if (!carNumber || isNaN(parkingNumber) || parkingNumber < 1 || parkingNumber > totalSlots) {
        alert("Please enter valid car details.");
        return;
    }

    const isDuplicate = parkingSlots.some(slot => slot["car-number"] === carNumber);
    if (isDuplicate) {
        alert(`Error: The car number ${carNumber} is already parked in another spot.`);
        return; 
    }

    const slot = parkingSlots.find(slot => slot["parking-number"] === parkingNumber.toString());

    if (slot && !slot["car-number"]) {
        slot["car-number"] = carNumber;
        slot.language = language;
        slot.status = "In-Car";
        slot.parkedAt = Date.now();

        updateDatabase();
        renderParkingMap();
        closeModal();
    } else {
        alert("Parking spot is already occupied or invalid.");
    }
}

if (window.location.pathname.includes("parkingmap.html")) {
    console.log("only admin priv");
    function renderParkingMap() {
      const parkingMap = document.getElementById("parkingMap");
      parkingMap.innerHTML = ""; // Clear existing map
  
      const isDisplayOnly = window.location.pathname.includes('display-only.html'); 
  
      parkingSlots.forEach(slot => {
        const slotDiv = document.createElement("div");
        slotDiv.className = `parking-slot ${slot["car-number"] ? "occupied" : "available"} ${slot.status ? `status-${slot.status.toLowerCase().replace(/ /g, '-')}` : ''}`;
        slotDiv.id = `slot-${slot["parking-number"]}`;
  
        const parkedTime = slot.parkedAt ? calculateParkedTime(slot.parkedAt) : "Just parked";
        slotDiv.innerHTML = `
            <strong>Spot ${slot["parking-number"]}</strong><br>
            Status: ${slot.status}<br>
            Car #: ${slot["car-number"]}<br>
            Language: ${slot.language}<br>
            Parked: ${parkedTime}
        `;
  
          const addButton = document.createElement("button");
          addButton.textContent = "Add Car";
          addButton.onclick = () => openModal('addCar', slot["parking-number"]);
          addButton.disabled = !!slot["car-number"];
  
          const removeButton = document.createElement("button");
          removeButton.textContent = "Remove Car";
          removeButton.onclick = () => removeCar(slot["parking-number"]);
          removeButton.disabled = !slot["car-number"];
  
          const statusButton = document.createElement("button");
          statusButton.textContent = "Change Status";
          statusButton.onclick = () => changeStatus(slot["parking-number"]);
          statusButton.disabled = !slot["car-number"];
  
          if (slot["car-number"]) {
            slotDiv.appendChild(removeButton);
            slotDiv.appendChild(statusButton);
          } else {
            slotDiv.appendChild(addButton);
          }
  
        parkingMap.appendChild(slotDiv);
      });
    }}

    function updateAdminStats() {
    const totalParked = parkingSlots.filter(slot => slot["car-number"]).length;
    const emptySpots = totalSlots - totalParked;

    document.getElementById("totalParked").textContent = totalParked;
    document.getElementById("emptySpots").textContent = emptySpots;

    const statusCounts = {};
    parkingSlots.forEach(slot => {
        if (slot["car-number"]) {
            statusCounts[slot.status] = (statusCounts[slot.status] || 0) + 1;
        }
    });

    const statusCountsDiv = document.getElementById("statusCounts");
    statusCountsDiv.innerHTML = "<h4>Status Breakdown:</h4>";
    for (let status in statusCounts) {
        statusCountsDiv.innerHTML += `<p>${status}: ${statusCounts[status]}</p>`;
    }
}

let sortMode = "default";

function renderParkingMap() {
    const parkingMap = document.getElementById("parkingMap");
    if (!parkingMap) return;

    parkingMap.innerHTML = "";

    const currentPath = window.location.pathname;
    const showRemoveButton = currentPath.endsWith("/reindeer.html");
    const showStatusButton = currentPath.endsWith("/shopping.html") || currentPath.endsWith("/wrapper.html");

    
    let visibleSlots = parkingSlots.filter(slot => slot["car-number"]);

    if (sortMode === "waited") {
        visibleSlots.sort((a, b) => {
            const aTime = Date.now() - (a.parkedAt || 0);
            const bTime = Date.now() - (b.parkedAt || 0);
            return bTime - aTime;
        });
    } else if (sortMode === "status-time") {
        const statusOrder = ["In-Car", "Fetch-to-shop", "Registration Complete","Shopping", "Wrapping", "Waiting for Reindeer"];
        visibleSlots.sort((a, b) => {
            const statusCompare = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
            if (statusCompare !== 0) return statusCompare;
            const aTime = Date.now() - (a.parkedAt || 0);
            const bTime = Date.now() - (b.parkedAt || 0);
            return bTime - aTime;
        });
    }

    visibleSlots.forEach(slot => {
        const slotDiv = document.createElement("div");
        slotDiv.className = `parking-slot ${slot.status ? `status-${slot.status.toLowerCase().replace(/ /g, '-')}` : ''}`;

        const parkedTime = slot.parkedAt ? calculateParkedTime(slot.parkedAt) : "Just parked";

        slotDiv.innerHTML = `
            <strong>Spot ${slot["parking-number"]}</strong><br>
            Status: ${slot.status}<br>
            Ticket #: ${slot["car-number"]}<br>
            Language: <strong>${slot.language}</strong><br>
            Parked: ${parkedTime}
        `;

        if (showRemoveButton) {
            const removeButton = document.createElement("button");
            removeButton.classList.add("remove-btn");
            removeButton.textContent = "Remove Car";
            removeButton.onclick = () => removeCar(slot["parking-number"]);
            slotDiv.appendChild(removeButton);
        }

        if (showStatusButton) {
            const statusButton = document.createElement("button");
            statusButton.textContent = "Change Status";
            statusButton.onclick = () => changeStatus(slot["parking-number"]);
            slotDiv.appendChild(statusButton);
        }

        parkingMap.appendChild(slotDiv);
    });
}


function setSortMode(mode) {
    sortMode = mode;
    renderParkingMap();

    const dropdownContent = document.getElementById("sortDropdownContent");
    if (dropdownContent && dropdownContent.classList.contains("show")) {
        dropdownContent.classList.remove("show");
    }
}

function toggleSortDropdown() {
    document.getElementById("sortDropdownContent").classList.toggle("show");
}


function openModal() {
    document.getElementById("vehicleModal").style.display = "block";
  }

  function closeModal() {
    document.getElementById("vehicleModal").style.display = "none";
  }

function calculateParkedTime(parkedAt) {
    const now = Date.now();
    const elapsed = now - parkedAt;
    const hours = Math.floor(elapsed / (1000 * 60 * 60));
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
}



function createVehicle() {
    const carNumber = document.getElementById("newCarNumber")?.value.trim();
    const language = document.getElementById("newCarLanguage")?.value;
    const parkingNumber = parseInt(document.getElementById("parkingNumberInput")?.value);

    if (!carNumber || isNaN(parkingNumber) || parkingNumber < 1 || parkingNumber > totalSlots) {
        alert("Please enter valid car details.");
        return;
    }

    const isDuplicate = parkingSlots.some(slot => slot["car-number"] === carNumber);
    if (isDuplicate) {
        alert(`Error: The car number ${carNumber} is already parked in another spot.`);
        return;
    }

    const slot = parkingSlots.find(slot => slot["parking-number"] === parkingNumber.toString());
    if (slot && !slot["car-number"]) {
        slot["car-number"] = carNumber;
        slot.language = language;
        slot.status = "In-Car";
        slot.parkedAt = Date.now();

        updateDatabase();
        renderParkingMap();
        document.getElementById("newCarNumber").value = "";
        document.getElementById("newCarLanguage").value = language;
        document.getElementById("parkingNumberInput").value = "";
        closeModal();
    } else {
        alert("Parking spot is already occupied or invalid.");
    }
}

function removeCar(parkingNumber) {
    const slot = parkingSlots.find(slot => slot["parking-number"] === parkingNumber);
    if (slot && slot["car-number"]) {
        lastRemovedSlot = { ...slot }; // Store a copy for undo
        const parkedDuration = calculateParkedTime(slot.parkedAt); // use your existing function

        const removedCarDetails = {
            "parking-number": slot["parking-number"],
            "car-number": slot["car-number"],
            "language": slot.language,
            "status": slot.status,
            "parkedTime": parkedDuration, // NEW FIELD!
            "removedAt": new Date().toLocaleString()
        };
        

        firebase.database().ref('removedCars').push(removedCarDetails);

        slot["car-number"] = "";
        slot.language = "N/A";
        slot.status = "N/A";

        document.getElementById("undoButton")?.removeAttribute("disabled");

        updateDatabase();
        renderParkingMap();
    }
}

function undoRemove() {
    if (lastRemovedSlot) {
        const slot = parkingSlots.find(s => s["parking-number"] === lastRemovedSlot["parking-number"]);
        if (slot) {
            slot["car-number"] = lastRemovedSlot["car-number"];
            slot.language = lastRemovedSlot.language;
            slot.status = lastRemovedSlot.status;

            lastRemovedSlot = null;

            document.getElementById("undoButton")?.setAttribute("disabled", "true");

            updateDatabase();
            renderParkingMap();
        }
    }
}


function changeStatus(parkingNumber) {
    const statuses = ["In-Car", "Fetch-to-shop", "Registration Complete", "Shopping", "Wrapping", "Waiting for Reindeer"];
    const slot = parkingSlots.find(slot => slot["parking-number"] === parkingNumber);
    if (slot && slot["car-number"]) {
        const currentIndex = statuses.indexOf(slot.status);
        const nextStatus = statuses[(currentIndex + 1) % statuses.length];
        slot.status = nextStatus;

        updateDatabase();
        renderParkingMap();
    }
}


function init() {
    const parkingSlotsRef = firebase.database().ref('parkingSlots');

    parkingSlotsRef.once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                parkingSlots = snapshot.val().map((slot, index) => ({
                    "parking-number": (index + 1).toString(),
                    ...slot
                }));
            } else {
                initializeParkingSlots();
            }
            renderParkingMap();
            updateAdminStats();

        });

    parkingSlotsRef.on('value', snapshot => {
        parkingSlots = snapshot.val() || [];
        renderParkingMap();
    });
}
const removedCarsList = document.getElementById("removedCarsList");
const totalRemovedCars = document.getElementById("totalRemovedCars");
const resetButton = document.getElementById("resetButton");
function fetchRemovedCars() {
    const removedCarsList = document.getElementById("removedCarsList");
    database.ref("removedCars").on("child_added", (snapshot) => {
        const removedCar = snapshot.val();
        console.log("Fetched removed car:", removedCar); // Debugging line
        const listItem = document.createElement("div");
        listItem.classList.add("removed-car-card");
        listItem.innerHTML = `
            <h3>Removed Car</h3>
            <p><strong>Parking Number:</strong> ${removedCar["parking-number"]}</p>
            <p><strong>Car Number:</strong> ${removedCar["car-number"]}</p>
            <p><strong>Language:</strong> ${removedCar["language"]}</p>
            <p><strong>Status:</strong> ${removedCar["status"]}</p>
            <p><strong>parkedTime: </strong> ${removedCar["parkedTime"]}</p>
            <p><strong>Removed At:</strong> ${removedCar["removedAt"]}</p>
        `;
        removedCarsList.appendChild(listItem);
        updateRemovedCarCount();
    });
}

function calculateAnalytics() {
    database.ref("removedCars").once("value", (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        let totalSeconds = 0;
        let count = 0;
        const statusMap = {};

        Object.values(data).forEach(car => {
            const parkedTimeStr = car.parkedTime; // Format like "1h 30m" or "45m"
            let seconds = 0;

            const hourMatch = parkedTimeStr.match(/(\d+)h/);
            const minMatch = parkedTimeStr.match(/(\d+)m/);

            if (hourMatch) seconds += parseInt(hourMatch[1]) * 3600;
            if (minMatch) seconds += parseInt(minMatch[1]) * 60;

            totalSeconds += seconds;
            count++;

            if (!statusMap[car.status]) {
                statusMap[car.status] = { total: 0, seconds: 0 };
            }
            statusMap[car.status].total++;
            statusMap[car.status].seconds += seconds;
        });
        const avgSeconds = count ? Math.floor(totalSeconds / count) : 0;
        const avgTimeFormatted = formatTime(avgSeconds);
        document.getElementById("analyticsTotal").textContent = count;
        document.getElementById("analyticsAvgTime").textContent = avgTimeFormatted;
        const breakdownDiv = document.getElementById("statusBreakdown");
        breakdownDiv.innerHTML = "<h3>Status Breakdown</h3>";
        for (let status in statusMap) {
            const entry = statusMap[status];
            const avg = entry.total ? Math.floor(entry.seconds / entry.total) : 0;
            breakdownDiv.innerHTML += `<p><strong>${status}</strong>: ${entry.total} cars | Avg: ${formatTime(avg)}</p>`;
        }
    });
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h > 0 ? h + "h " : ""}${m}m`;
}



function updateRemovedCarCount() {
    const totalCarsElement = document.getElementById("removedCarCount");
    database.ref("removedCars").once("value", (snapshot) => {
        const totalCount = snapshot.numChildren();
        totalCarsElement.textContent = totalCount;
    });
}

function resetRemovedCars() {
    const removedCarsList = document.getElementById("removedCarsList");
    removedCarsList.innerHTML = "";

    database.ref("removedCars").remove();
    updateRemovedCarCount();
    calculateAnalytics();
}

fetchRemovedCars();
calculateAnalytics();
init();