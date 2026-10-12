const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "energy.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sugar_per_100ml REAL NOT NULL DEFAULT 0,
  caffeine_per_100ml REAL NOT NULL DEFAULT 0,
  size_ml REAL NOT NULL DEFAULT 0,
  builtin INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS drinks (
  idx INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sugar_per_100ml REAL NOT NULL DEFAULT 0,
  caffeine_per_100ml REAL NOT NULL DEFAULT 0,
  size_ml REAL NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  day TEXT NOT NULL,
  justified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
`);

// seed built-in presets on first run
const presetCount = db.prepare("SELECT COUNT(*) c FROM presets").get().c;
if (presetCount === 0) {
  const seed = db.prepare(
    "INSERT INTO presets (name, sugar_per_100ml, caffeine_per_100ml, size_ml, builtin) VALUES (?,?,?,?,1)"
  );
  const insertMany = db.transaction((rows) => {
    for (const r of rows) seed.run(r.name, r.sugar, r.caffeine, r.size);
  });
  insertMany([
    { name: "Tiger", sugar: 11, caffeine: 30, size: 250 },
    { name: "Monster", sugar: 11, caffeine: 32, size: 500 },
    { name: "Monster Zero", sugar: 0, caffeine: 32, size: 500 },
    { name: "Redbull", sugar: 11, caffeine: 32, size: 250 },
    { name: "Unnamed 250", sugar: 0, caffeine: 0, size: 250 },
    { name: "Unnamed 500", sugar: 0, caffeine: 0, size: 500 },
  ]);
}

function todayStr() {
  // server local TZ, date only (YYYY-MM-DD)
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- Presets ----------
app.get("/api/presets", (req, res) => {
  const rows = db.prepare("SELECT * FROM presets ORDER BY builtin DESC, id ASC").all();
  res.json(rows);
});

app.post("/api/presets", (req, res) => {
  const { name, sugar_per_100ml, caffeine_per_100ml, size_ml } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const info = db
    .prepare(
      "INSERT INTO presets (name, sugar_per_100ml, caffeine_per_100ml, size_ml, builtin) VALUES (?,?,?,?,0)"
    )
    .run(name, sugar_per_100ml || 0, caffeine_per_100ml || 0, size_ml || 0);
  res.json(db.prepare("SELECT * FROM presets WHERE id=?").get(info.lastInsertRowid));
});

app.put("/api/presets/:id", (req, res) => {
  const { name, sugar_per_100ml, caffeine_per_100ml, size_ml } = req.body;
  const existing = db.prepare("SELECT * FROM presets WHERE id=?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "not found" });
  db.prepare(
    "UPDATE presets SET name=?, sugar_per_100ml=?, caffeine_per_100ml=?, size_ml=? WHERE id=?"
  ).run(
    name ?? existing.name,
    sugar_per_100ml ?? existing.sugar_per_100ml,
    caffeine_per_100ml ?? existing.caffeine_per_100ml,
    size_ml ?? existing.size_ml,
    req.params.id
  );
  res.json(db.prepare("SELECT * FROM presets WHERE id=?").get(req.params.id));
});

app.delete("/api/presets/:id", (req, res) => {
  db.prepare("DELETE FROM presets WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

// ---------- Drinks ----------
app.get("/api/drinks", (req, res) => {
  const { from, to } = req.query;
  let rows;
  if (from && to) {
    rows = db
      .prepare("SELECT * FROM drinks WHERE day >= ? AND day <= ? ORDER BY idx DESC")
      .all(from, to);
  } else {
    rows = db.prepare("SELECT * FROM drinks ORDER BY idx DESC").all();
  }
  res.json(rows);
});

app.post("/api/drinks", (req, res) => {
  const {
    name,
    sugar_per_100ml,
    caffeine_per_100ml,
    size_ml,
    price,
    justified,
  } = req.body;
  if (!name || !size_ml) return res.status(400).json({ error: "name and size_ml required" });

  const info = db
    .prepare(
      `INSERT INTO drinks (name, sugar_per_100ml, caffeine_per_100ml, size_ml, price, day, justified, created_at)
       VALUES (?,?,?,?,?,?,?,?)`
    )
    .run(
      name,
      sugar_per_100ml || 0,
      caffeine_per_100ml || 0,
      size_ml,
      price === undefined || price === null ? 0 : price,
      todayStr(),
      justified ? 1 : 0,
      new Date().toISOString()
    );
  res.json(db.prepare("SELECT * FROM drinks WHERE idx=?").get(info.lastInsertRowid));
});

app.put("/api/drinks/:idx", (req, res) => {
  const existing = db.prepare("SELECT * FROM drinks WHERE idx=?").get(req.params.idx);
  if (!existing) return res.status(404).json({ error: "not found" });
  const {
    name,
    sugar_per_100ml,
    caffeine_per_100ml,
    size_ml,
    price,
    day,
    justified,
  } = req.body;
  db.prepare(
    `UPDATE drinks SET name=?, sugar_per_100ml=?, caffeine_per_100ml=?, size_ml=?, price=?, day=?, justified=? WHERE idx=?`
  ).run(
    name ?? existing.name,
    sugar_per_100ml ?? existing.sugar_per_100ml,
    caffeine_per_100ml ?? existing.caffeine_per_100ml,
    size_ml ?? existing.size_ml,
    price === undefined ? existing.price : price,
    day ?? existing.day,
    justified === undefined ? existing.justified : justified ? 1 : 0,
    req.params.idx
  );
  res.json(db.prepare("SELECT * FROM drinks WHERE idx=?").get(req.params.idx));
});

app.delete("/api/drinks/:idx", (req, res) => {
  db.prepare("DELETE FROM drinks WHERE idx=?").run(req.params.idx);
  res.json({ ok: true });
});

app.get("/api/stats", (req, res) => {
  const { from, to } = req.query;
  let rows;
  if (from && to) {
    rows = db.prepare("SELECT * FROM drinks WHERE day >= ? AND day <= ?").all(from, to);
  } else {
    rows = db.prepare("SELECT * FROM drinks").all();
  }
  let caffeine = 0,
    sugar = 0,
    price = 0;
  for (const r of rows) {
    caffeine += (r.caffeine_per_100ml * r.size_ml) / 100;
    sugar += (r.sugar_per_100ml * r.size_ml) / 100;
    price += r.price;
  }
  res.json({
    count: rows.length,
    caffeine_mg: Math.round(caffeine * 100) / 100,
    sugar_g: Math.round(sugar * 100) / 100,
    price: Math.round(price * 100) / 100,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`energy-tracker listening on :${PORT}`));
