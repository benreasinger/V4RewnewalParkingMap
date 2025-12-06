// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAmUZ1kWf8dR5XUFOlViGQjrp6siK2H2Zg",
  authDomain: "renewalparkingwrap.firebaseapp.com",
  databaseURL: "https://renewalparkingwrap-default-rtdb.firebaseio.com",
  projectId: "renewalparkingwrap",
  storageBucket: "renewalparkingwrap.firebasestorage.app",
  messagingSenderId: "265029019359",
  appId: "1:265029019359:web:6a7ba410eefa6470d22b6a",
  measurementId: "G-JX7H3SC1N4"
};

// Init Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Modal functions
function openWrapModal() {
  document.getElementById("WrapModal").style.display = "block";
}
function closeWrapModal() {
  document.getElementById("WrapModal").style.display = "none";
}

// Create new bag(s)
function createWrapCard() {
  const carNumber = document.getElementById("newCarNumber").value.trim();
  const childCount = parseInt(document.getElementById("newChildCount").value.trim());
  const bagCount = parseInt(document.getElementById("newBagCount").value.trim());
  const spotNum = document.getElementById("spotCount").value.trim();

  if (!carNumber || !childCount || !bagCount || !spotNum) {
    alert("Please fill out all fields.");
    return;
  }

  for (let i = 1; i <= bagCount; i++) {
    const newBag = {
      carNumber,
      childCount,
      bagIndex: i,
      bagMax: bagCount,
      spotNum,
      wrapped: false,
      workStation: null,
      status: "waiting",
      createdAt: Date.now()
    };
    database.ref("bags").push(newBag);
  }

  closeWrapModal();
  clearModalInputs();
}

function clearModalInputs() {
  document.getElementById("newCarNumber").value = "";
  document.getElementById("newChildCount").value = "";
  document.getElementById("spotCount").value = "";
  document.getElementById("newBagCount").value = "";
}

// Render bags
function renderBags(snapshot) {
  const waitingDiv = document.getElementById("waitingBags");
  const activeDiv = document.getElementById("activeBags");
  const completedDiv = document.getElementById("completedBags");

  waitingDiv.innerHTML = "";
  activeDiv.innerHTML = "";
  completedDiv.innerHTML = "";

  // Group bags by ticket + spot for combined completed card
  const grouped = {};
  snapshot.forEach(childSnap => {
    const bag = childSnap.val();
    const key = childSnap.key;
    const ticketId = bag.carNumber + "_" + bag.spotNum;
    if (!grouped[ticketId]) grouped[ticketId] = [];
    grouped[ticketId].push({ key, ...bag });
  });

  Object.values(grouped).forEach(group => {
    const allWrapped = group.every(b => b.wrapped);
    const firstBag = group[0];

    if (allWrapped) {
      // Combined card for completed ticket
      const card = document.createElement("div");
      card.classList.add("bag-card");
      card.innerHTML = `
        <div class="banner completed" style="background-color: #8e44ad;">All Completed</div>
        <h3>Ticket #${firstBag.carNumber}</h3>
        <h4>Spot #${firstBag.spotNum}</h4>
        <p>Children: ${firstBag.childCount}</p>
        <p>Workstation: ${firstBag.workStation || "Not Assigned"}</p>
      `;

      card.addEventListener("click", () => openEditModal(firstBag.key, firstBag, true));
      completedDiv.appendChild(card);
    } else {
      // Render individual bags
      group.forEach(bag => {
        const card = document.createElement("div");
        card.classList.add("bag-card");

        let statusBanner;
        if (bag.status === "waiting") statusBanner = `<div class="banner waiting">Waiting for Workstation</div>`;
        else if (bag.status === "active") statusBanner = `<div class="banner active">Workstation ${bag.workStation || ""}</div>`;
        else statusBanner = `<div class="banner completed">Completed</div>`;

        card.innerHTML = `
          ${statusBanner}
          <h3><strong>Bag ${bag.bagIndex}/${bag.bagMax}</strong> - Ticket #${bag.carNumber}</h3>
          <h4>Spot #${bag.spotNum}</h4>
          <p>Children: ${bag.childCount}</p>
          <p>Status: ${bag.wrapped ? "Wrapped" : "Not Wrapped"}</p>
        `;

        if (bag.status === "active" && !bag.wrapped) {
          const wrapBtn = document.createElement("button");
          wrapBtn.textContent = "Mark Bag Wrapped";
          wrapBtn.classList.add("wrap-btn");
          wrapBtn.onclick = (e) => {
            e.stopPropagation();
            markBagWrapped(bag.key, bag);
          };
          card.appendChild(wrapBtn);
        }

        card.addEventListener("click", () => openEditModal(bag.key, bag, false));

        if (bag.status === "waiting") waitingDiv.appendChild(card);
        else if (bag.status === "active") activeDiv.appendChild(card);
        else completedDiv.appendChild(card);
      });
    }
  });
}

// Mark individual bag wrapped
function markBagWrapped(bagId, bag) {
  if (!bag.wrapped) {
    database.ref("bags/" + bagId).update({
      wrapped: true,
      status: "completed"
    });
  } else {
    alert("This bag is already wrapped!");
  }
}

// Edit Modal
function openEditModal(bagId, bagData, combined=false) {
  const modal = document.getElementById("EditModal");
  modal.style.display = "block";
  const modalContent = modal.querySelector(".modal-content");

  document.getElementById("editBagId").value = bagId;
  document.getElementById("editCarNumber").value = bagData.carNumber;
  document.getElementById("editSpotNum").value = bagData.spotNum;
  document.getElementById("editChildCount").value = bagData.childCount;
  document.getElementById("editBagCount").value = bagData.bagMax;
  document.getElementById("editWorkStation").value = bagData.workStation || "";

  // Remove previous delete button
  const existingDeleteBtn = document.getElementById("deleteBagBtn");
  if (existingDeleteBtn) existingDeleteBtn.remove();

  // Add delete button
  const deleteBtn = document.createElement("button");
  deleteBtn.id = "deleteBagBtn";
  deleteBtn.textContent = "Delete Bag";
  deleteBtn.style.background = "#e74c3c";
  deleteBtn.style.color = "white";
  deleteBtn.style.marginTop = "10px";
  deleteBtn.onclick = () => deleteBag(bagId);
  modalContent.appendChild(deleteBtn);

  // Save button
  const saveBtn = modalContent.querySelector("button[onclick='saveBagEdits()']");

  if (bagData.status === "completed" || combined) {
    // Completed: read-only, hide save
    document.getElementById("editCarNumber").disabled = true;
    document.getElementById("editSpotNum").disabled = true;
    document.getElementById("editChildCount").disabled = true;
    document.getElementById("editBagCount").disabled = true;
    document.getElementById("editWorkStation").disabled = true;
    saveBtn.style.display = "none";
  } else {
    // Workstation editable
    document.getElementById("editCarNumber").disabled = true;
    document.getElementById("editSpotNum").disabled = true;
    document.getElementById("editChildCount").disabled = true;
    document.getElementById("editBagCount").disabled = true;
    document.getElementById("editWorkStation").disabled = false;
    saveBtn.style.display = "inline-block";
  }
}

function closeEditModal() {
  document.getElementById("EditModal").style.display = "none";
}

// Save edits (only workstation)
function saveBagEdits() {
  const bagId = document.getElementById("editBagId").value;
  const updatedWorkStation = document.getElementById("editWorkStation").value.trim();

  database.ref("bags/" + bagId).once("value").then(snapshot => {
    const bag = snapshot.val();
    let status = updatedWorkStation ? "active" : "waiting";
    if (bag.status === "completed") status = "completed";

    database.ref("bags/" + bagId).update({
      workStation: updatedWorkStation || null,
      status: status
    });
    closeEditModal();
  });
}

// Delete bag
function deleteBag(bagId) {
  if (confirm("Are you sure you want to delete this bag?")) {
    database.ref("bags/" + bagId).remove().then(() => {
      database.ref("bags").once("value").then(snapshot => renderBags(snapshot));
      closeEditModal();
    });
  }
}

// Live sync
database.ref("bags").on("value", (snapshot) => renderBags(snapshot));
