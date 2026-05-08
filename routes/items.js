const router  = require("express").Router();
const { v4: uuidv4 }      = require("uuid");
const { readDB, writeDB } = require("../utils/db");
const { requireAdmin }    = require("../middleware/auth");

// ── Public Routes ─────────────────────────────────────────────────────────────

/**
 * GET /api/items
 * Query params: category, search, sort (price_asc|price_desc|newest|popular), page, limit
 */
router.get("/", (req, res) => {
  const db = readDB();
  let items = [...db.items];

  // Filter by category slug or id
  if (req.query.category) {
    const cat = db.categories.find(
      (c) => c.slug === req.query.category || c.id === req.query.category
    );
    if (cat) items = items.filter((i) => i.categoryId === cat.id);
    else return res.json({ items: [], total: 0 });
  }

  // Search by name / description
  if (req.query.search) {
    const q = req.query.search.toLowerCase();
    items = items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q)
    );
  }

  // Sort
  switch (req.query.sort) {
    case "price_asc":  items.sort((a, b) => a.price - b.price);           break;
    case "price_desc": items.sort((a, b) => b.price - a.price);           break;
    case "newest":     items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
    case "popular":    items.sort((a, b) => b.orderCount - a.orderCount); break;
    default:           items.sort((a, b) => b.orderCount - a.orderCount); // default: popular
  }

  // Pagination
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const total = items.length;
  items = items.slice((page - 1) * limit, page * limit);

  res.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
});

/** GET /api/items/popular — top N most-ordered items */
router.get("/popular", (req, res) => {
  const db    = readDB();
  const limit = Math.min(20, parseInt(req.query.limit) || 8);
  const items = [...db.items]
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, limit);
  res.json(items);
});

/** GET /api/items/:id — single item detail */
router.get("/:id", (req, res) => {
  const db   = readDB();
  const item = db.items.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Item not found" });

  const category = db.categories.find((c) => c.id === item.categoryId);
  res.json({ ...item, category });
});

// ── Admin Routes ──────────────────────────────────────────────────────────────

/**
 * POST /api/items — create item (admin)
 * Body: { name, description, price, categoryId, sizes[], colors[], stock, imageUrl }
 */
router.post("/", requireAdmin, (req, res) => {
  const { name, description, price, categoryId, sizes, colors, stock, imageUrl } = req.body;

  if (!name || price == null || !categoryId)
    return res.status(400).json({ error: "name, price, and categoryId are required" });

  const db = readDB();
  if (!db.categories.find((c) => c.id === categoryId))
    return res.status(400).json({ error: "categoryId does not exist" });

  const item = {
    id: `item-${uuidv4().slice(0, 8)}`,
    name,
    description: description || "",
    price: parseFloat(price),
    categoryId,
    sizes:      sizes   || [],
    colors:     colors  || [],
    stock:      stock   != null ? parseInt(stock) : 0,
    imageUrl:   imageUrl || "",
    orderCount: 0,
    createdAt:  new Date().toISOString(),
  };

  db.items.push(item);
  writeDB(db);
  res.status(201).json(item);
});

/**
 * PUT /api/items/:id — update item (admin)
 * Body: any subset of item fields
 */
router.put("/:id", requireAdmin, (req, res) => {
  const db  = readDB();
  const idx = db.items.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Item not found" });

  const allowed = ["name","description","price","categoryId","sizes","colors","stock","imageUrl"];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      db.items[idx][key] = key === "price"  ? parseFloat(req.body[key])
                         : key === "stock"  ? parseInt(req.body[key])
                         : req.body[key];
    }
  }

  writeDB(db);
  res.json(db.items[idx]);
});

/**
 * PATCH /api/items/:id/stock — quick stock adjustment (admin)
 * Body: { stock }
 */
router.patch("/:id/stock", requireAdmin, (req, res) => {
  const { stock } = req.body;
  if (stock == null) return res.status(400).json({ error: "stock value required" });

  const db  = readDB();
  const idx = db.items.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Item not found" });

  db.items[idx].stock = parseInt(stock);
  writeDB(db);
  res.json({ id: req.params.id, stock: db.items[idx].stock });
});

/** DELETE /api/items/:id — remove item (admin) */
router.delete("/:id", requireAdmin, (req, res) => {
  const db  = readDB();
  const idx = db.items.findIndex((i) => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Item not found" });

  db.items.splice(idx, 1);
  writeDB(db);
  res.json({ message: "Item deleted" });
});

module.exports = router;
