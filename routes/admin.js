/**
 * Admin Dashboard Routes
 * ----------------------
 * All routes require a valid admin Bearer token.
 */

const router = require("express").Router();
const { v4: uuidv4 }      = require("uuid");
const { readDB, writeDB } = require("../utils/db");
const { requireAdmin }    = require("../middleware/auth");

router.use(requireAdmin);

/** GET /api/admin/dashboard — high-level stats */
router.get("/dashboard", (_req, res) => {
  const db = readDB();

  const totalRevenue = db.orders
    .filter((o) => o.status !== "cancelled")
    .reduce((s, o) => s + o.total, 0);

  const ordersByStatus = db.orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  const lowStock = db.items
    .filter((i) => i.stock <= 10)
    .sort((a, b) => a.stock - b.stock)
    .map((i) => ({ id: i.id, name: i.name, stock: i.stock }));

  const topItems = [...db.items]
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 5)
    .map((i) => ({ id: i.id, name: i.name, orderCount: i.orderCount }));

  res.json({
    totalItems:      db.items.length,
    totalCategories: db.categories.length,
    totalOrders:     db.orders.length,
    totalRevenue:    +totalRevenue.toFixed(2),
    ordersByStatus,
    lowStockItems:   lowStock,
    topItems,
  });
});

/** GET /api/admin/items — all items with full detail (admin view) */
router.get("/items", (req, res) => {
  const db     = readDB();
  let   items  = [...db.items];

  if (req.query.category)
    items = items.filter((i) => i.categoryId === req.query.category);

  if (req.query.lowStock)
    items = items.filter((i) => i.stock <= parseInt(req.query.lowStock));

  res.json(items);
});

/**
 * POST /api/admin/items/bulk — bulk insert items (admin)
 * Body: { items: [ { name, price, categoryId, ... } ] }
 */
router.post("/items/bulk", (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: "items array is required" });

  const db = readDB();
  const created = [];

  for (const raw of items) {
    if (!raw.name || raw.price == null || !raw.categoryId) continue;
    const item = {
      id: `item-${uuidv4().slice(0, 8)}`,
      name:        raw.name,
      description: raw.description || "",
      price:       parseFloat(raw.price),
      categoryId:  raw.categoryId,
      sizes:       raw.sizes   || [],
      colors:      raw.colors  || [],
      stock:       raw.stock   != null ? parseInt(raw.stock) : 0,
      imageUrl:    raw.imageUrl || "",
      orderCount:  0,
      createdAt:   new Date().toISOString(),
    };
    db.items.push(item);
    created.push(item);
  }

  writeDB(db);
  res.status(201).json({ message: `${created.length} item(s) created`, items: created });
});

/** GET /api/admin/orders — quick order summary for dashboard */
router.get("/orders", (req, res) => {
  const db = readDB();
  let orders = [...db.orders].sort(
    (a, b) => new Date(b.placedAt) - new Date(a.placedAt)
  );
  if (req.query.status) orders = orders.filter((o) => o.status === req.query.status);
  res.json(orders.slice(0, parseInt(req.query.limit) || 50));
});

/**
 * POST /api/admin/password — change admin password
 * Body: { currentPassword, newPassword }
 */
router.post("/password", (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: "currentPassword and newPassword are required" });

  const db  = readDB();
  const idx = db.admins.findIndex((a) => a.id === req.admin.id);
  if (idx === -1) return res.status(404).json({ error: "Admin not found" });

  if (db.admins[idx].password !== currentPassword)
    return res.status(401).json({ error: "Current password is incorrect" });

  db.admins[idx].password = newPassword;
  writeDB(db);
  res.json({ message: "Password updated successfully" });
});

module.exports = router;
