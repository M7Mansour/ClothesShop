const router  = require("express").Router();
const { v4: uuidv4 } = require("uuid");
const { readDB, writeDB } = require("../utils/db");
const { requireAdmin }    = require("../middleware/auth");

/** GET /api/categories — list all categories */
router.get("/", (_req, res) => {
  const db = readDB();
  res.json(db.categories);
});

/** GET /api/categories/:id — single category with its items */
router.get("/:id", (req, res) => {
  const db       = readDB();
  const category = db.categories.find((c) => c.id === req.params.id);
  if (!category) return res.status(404).json({ error: "Category not found" });

  const items = db.items.filter((i) => i.categoryId === category.id);
  res.json({ ...category, items });
});

/** POST /api/categories — create category (admin) */
router.post("/", requireAdmin, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });

  const db  = readDB();
  const slug = name.toLowerCase().replace(/\s+/g, "-");

  if (db.categories.find((c) => c.slug === slug))
    return res.status(409).json({ error: "Category already exists" });

  const category = { id: `cat-${uuidv4().slice(0, 8)}`, name, slug, description: description || "" };
  db.categories.push(category);
  writeDB(db);
  res.status(201).json(category);
});

/** PUT /api/categories/:id — update category (admin) */
router.put("/:id", requireAdmin, (req, res) => {
  const db  = readDB();
  const idx = db.categories.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Category not found" });

  const { name, description } = req.body;
  if (name) {
    db.categories[idx].name = name;
    db.categories[idx].slug = name.toLowerCase().replace(/\s+/g, "-");
  }
  if (description !== undefined) db.categories[idx].description = description;

  writeDB(db);
  res.json(db.categories[idx]);
});

/** DELETE /api/categories/:id — remove category (admin) */
router.delete("/:id", requireAdmin, (req, res) => {
  const db  = readDB();
  const idx = db.categories.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Category not found" });

  // Prevent deleting if items exist under it
  const hasItems = db.items.some((i) => i.categoryId === req.params.id);
  if (hasItems)
    return res.status(409).json({ error: "Cannot delete category with existing items. Reassign or remove items first." });

  db.categories.splice(idx, 1);
  writeDB(db);
  res.json({ message: "Category deleted" });
});

module.exports = router;
