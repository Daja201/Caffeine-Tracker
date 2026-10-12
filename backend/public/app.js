const API = "/api";

let presets = [];
let drinks = [];
let selectedPreset = null;

const presetRow = document.getElementById("presetRow");
const list = document.getElementById("list");
const statLine = document.getElementById("statLine");
const rangeSelect = document.getElementById("rangeSelect");

function pad(n) { return String(n).padStart(2, "0"); }
function dateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

function rangeDates(key) {
  const now = new Date();
  const to = dateStr(now);
  let from;
  if (key === "today") {
    from = to;
  } else if (key === "week") {
    const d = new Date(now); d.setDate(d.getDate() - 7);
    from = dateStr(d);
  } else if (key === "month") {
    const d = new Date(now); d.setMonth(d.getMonth() - 1);
    from = dateStr(d);
  } else if (key === "year") {
    const d = new Date(now); d.setFullYear(d.getFullYear() - 1);
    from = dateStr(d);
  } else {
    return null;
  }
  return { from, to };
}

async function loadPresets() {
  presets = await (await fetch(`${API}/presets`)).json();
  renderPresets();
}

function renderPresets() {
  presetRow.innerHTML = "";
  presets.forEach(p => {
    const el = document.createElement("div");
    el.className = "preset" + (selectedPreset && selectedPreset.id === p.id ? " active" : "");
    el.textContent = p.name;
    el.addEventListener("click", () => applyPreset(p));
    el.addEventListener("contextmenu", (e) => { e.preventDefault(); openPresetEdit(p); });
    let pressTimer;
    el.addEventListener("touchstart", () => { pressTimer = setTimeout(() => openPresetEdit(p), 600); });
    el.addEventListener("touchend", () => clearTimeout(pressTimer));
    presetRow.appendChild(el);
  });
  const addBtn = document.createElement("div");
  addBtn.className = "presetAddBtn";
  addBtn.textContent = "+ preset";
  addBtn.addEventListener("click", () => openPresetEdit(null));
  presetRow.appendChild(addBtn);
}

function applyPreset(p) {
  selectedPreset = p;
  document.getElementById("f_name").value = p.name;
  document.getElementById("f_sugar").value = p.sugar_per_100ml;
  document.getElementById("f_caffeine").value = p.caffeine_per_100ml;
  document.getElementById("f_size").value = p.size_ml;
  // price intentionally left for user to always fill in
  renderPresets();
}

// ---------- preset edit dialog ----------
const presetEditOverlay = document.getElementById("presetEditOverlay");
let editingPresetId = null;

function openPresetEdit(p) {
  editingPresetId = p ? p.id : null;
  document.getElementById("p_name").value = p ? p.name : "";
  document.getElementById("p_sugar").value = p ? p.sugar_per_100ml : "";
  document.getElementById("p_caffeine").value = p ? p.caffeine_per_100ml : "";
  document.getElementById("p_size").value = p ? p.size_ml : "";
  document.getElementById("p_delete").style.display = p ? "block" : "none";
  presetEditOverlay.classList.remove("hidden");
}

document.getElementById("p_cancel").addEventListener("click", () => presetEditOverlay.classList.add("hidden"));

document.getElementById("p_save").addEventListener("click", async () => {
  const body = {
    name: document.getElementById("p_name").value,
    sugar_per_100ml: parseFloat(document.getElementById("p_sugar").value) || 0,
    caffeine_per_100ml: parseFloat(document.getElementById("p_caffeine").value) || 0,
    size_ml: parseFloat(document.getElementById("p_size").value) || 0,
  };
  if (!body.name) return;
  if (editingPresetId) {
    await fetch(`${API}/presets/${editingPresetId}`, { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) });
  } else {
    await fetch(`${API}/presets`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) });
  }
  presetEditOverlay.classList.add("hidden");
  await loadPresets();
});

document.getElementById("p_delete").addEventListener("click", async () => {
  if (!editingPresetId) return;
  await fetch(`${API}/presets/${editingPresetId}`, { method: "DELETE" });
  presetEditOverlay.classList.add("hidden");
  await loadPresets();
});

// ---------- add form ----------
document.getElementById("addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = {
    name: document.getElementById("f_name").value,
    sugar_per_100ml: parseFloat(document.getElementById("f_sugar").value) || 0,
    caffeine_per_100ml: parseFloat(document.getElementById("f_caffeine").value) || 0,
    size_ml: parseFloat(document.getElementById("f_size").value) || 0,
    price: parseFloat(document.getElementById("f_price").value) || 0,
    justified: document.getElementById("f_justified").checked,
  };
  if (!body.name || !body.size_ml) return;
  await fetch(`${API}/drinks`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) });
  document.getElementById("addForm").reset();
  selectedPreset = null;
  renderPresets();
  await refresh();
});

// ---------- list ----------
async function loadDrinks() {
  const r = rangeDates(rangeSelect.value);
  const url = r ? `${API}/drinks?from=${r.from}&to=${r.to}` : `${API}/drinks`;
  drinks = await (await fetch(url)).json();
  renderList();
}

function renderList() {
  list.innerHTML = "";
  drinks.forEach(d => {
    const caffeine = (d.caffeine_per_100ml * d.size_ml / 100).toFixed(0);
    const sugar = (d.sugar_per_100ml * d.size_ml / 100).toFixed(0);
    const el = document.createElement("div");
    el.className = "entry";
    el.innerHTML = `
      <div class="left">
        <div class="idx">#${d.idx} · ${d.day}</div>
        <div>${d.name} · ${d.size_ml}ml</div>
        <div class="j">${d.justified ? "justified" : "not justified"}</div>
      </div>
      <div class="right">
        <div>${caffeine}<span class="unit">mg</span> · ${sugar}<span class="unit">g</span></div>
        <div>${d.price}<span class="unit">price</span></div>
      </div>
    `;
    el.addEventListener("click", () => openEdit(d));
    list.appendChild(el);
  });
}

async function loadStats() {
  const r = rangeDates(rangeSelect.value);
  const url = r ? `${API}/stats?from=${r.from}&to=${r.to}` : `${API}/stats`;
  const s = await (await fetch(url)).json();
  statLine.innerHTML = `${s.caffeine_mg}<span class="unit">mg caffeine</span> · ${s.sugar_g}<span class="unit">g sugar</span> · ${s.price}<span class="unit">price</span>`;
}

rangeSelect.addEventListener("change", refresh);

async function refresh() {
  await Promise.all([loadDrinks(), loadStats()]);
}

// ---------- edit entry dialog ----------
const editOverlay = document.getElementById("editOverlay");
const confirmOverlay = document.getElementById("confirmOverlay");
let editingIdx = null;

function openEdit(d) {
  editingIdx = d.idx;
  document.getElementById("e_name").value = d.name;
  document.getElementById("e_sugar").value = d.sugar_per_100ml;
  document.getElementById("e_caffeine").value = d.caffeine_per_100ml;
  document.getElementById("e_size").value = d.size_ml;
  document.getElementById("e_price").value = d.price;
  document.getElementById("e_day").value = d.day;
  document.getElementById("e_justified").checked = !!d.justified;
  editOverlay.classList.remove("hidden");
}

document.getElementById("e_cancel").addEventListener("click", () => editOverlay.classList.add("hidden"));

document.getElementById("e_save").addEventListener("click", async () => {
  const body = {
    name: document.getElementById("e_name").value,
    sugar_per_100ml: parseFloat(document.getElementById("e_sugar").value) || 0,
    caffeine_per_100ml: parseFloat(document.getElementById("e_caffeine").value) || 0,
    size_ml: parseFloat(document.getElementById("e_size").value) || 0,
    price: parseFloat(document.getElementById("e_price").value) || 0,
    day: document.getElementById("e_day").value,
    justified: document.getElementById("e_justified").checked,
  };
  await fetch(`${API}/drinks/${editingIdx}`, { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify(body) });
  editOverlay.classList.add("hidden");
  await refresh();
});

document.getElementById("e_delete").addEventListener("click", () => {
  confirmOverlay.classList.remove("hidden");
});

document.getElementById("c_no").addEventListener("click", () => confirmOverlay.classList.add("hidden"));

document.getElementById("c_yes").addEventListener("click", async () => {
  await fetch(`${API}/drinks/${editingIdx}`, { method: "DELETE" });
  confirmOverlay.classList.add("hidden");
  editOverlay.classList.add("hidden");
  await refresh();
});

// ---------- init ----------
(async function init() {
  await loadPresets();
  await refresh();
})();
