const fs   = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "../data/db.json");

/** Read the entire database */
function readDB() {
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

/** Write the entire database */
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

module.exports = { readDB, writeDB };
