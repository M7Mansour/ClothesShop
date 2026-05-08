/**
 * Orders Routes
 * -------------
 * Customers place orders from their cart (X-Session-Id).
 * Admin can list/view/update all orders (Bearer token).
 */

const router  = require("express").Router();
const { v4: uuidv4 }      = require("uuid");
const { readDB, writeDB } = require("../utils/db");
const { requireSession, requireAdmin } = require("../middleware/auth");

// ── Customer ──────────────────────────────────────────────────────────────────

/**
 * POST /api/orders — place an order from the current cart
 * Headers: X-Session-Id
 * Body: { customerName, email, shippingAddress: { line1, city, country, zip } }
 */
router.post("/", requireSession, (req, res) => {
  const { customerName, email, shippingAddress } = req.body;

  if (!customerName || !email || !shippingAddress)
    return res.status(400).json({ error: "customerName, email, and shippingAddress are required" });

  const { line1, city, country, zip } = shippingAddress;
  if (!line1 || !city || !country || !zip)
    return res.status(400).json({ error: "shippingAddress must include line1, city, country, and zip" });

  const db   = readDB();
  const cart = db.carts[req.sessionId];

  if (!cart || cart.items.length === 0)
    return res.status(400).json({ error: "Cart is empty. Add items before placing an order." });

  // Stock validation + deduction
  for (const line of cart.items) {
    const item = db.items.find((i) => i.id === line.itemId);
    if (!item) return res.status(400).json({ error: `Item ${line.itemId} no longer exists` });
    if (item.stock < line.quantity)
      return res.status(409).json({ error: `Insufficient stock for "${item.name}"` });
  }

  // Deduct stock and increment orderCount
  for (const line of cart.items) {
    const item = db.items.find((i) => i.id === line.itemId);
    item.stock      -= line.quantity;
    item.orderCount += line.quantity;
  }

  const subtotal = cart.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping  = subtotal >= 100 ? 0 : 7.99;      // free shipping over $100
  const tax       = +(subtotal * 0.08).toFixed(2);   // 8% tax
  const total     = +(subtotal + shipping + tax).toFixed(2);

  const order = {
    id:          `order-${uuidv4().slice(0, 8)}`,
    sessionId:   req.sessionId,
    customerName,
    email,
    shippingAddress,
    items:       [...cart.items],
    subtotal:    +subtotal.toFixed(2),
    shipping,
    tax,
    total,
    status:      "confirmed",   // confirmed → processing → shipped → delivered
    placedAt:    new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
  };

  db.orders.push(order);
  // Clear cart after order
  db.carts[req.sessionId] = { items: [], updatedAt: new Date().toISOString() };
  writeDB(db);

  res.status(201).json({
    message:  "🎉 Order placed successfully! Your payment will be processed at delivery.",
    orderId:  order.id,
    status:   order.status,
    total:    order.total,
    shipping: order.shipping === 0 ? "Free" : `$${order.shipping}`,
    estimatedDelivery: "3–5 business days",
    order,
  });
});

/**
 * GET /api/orders/track/:orderId — customer order tracking (no auth)
 * Customers only see safe fields.
 */
router.get("/track/:orderId", (req, res) => {
  const db    = readDB();
  const order = db.orders.find((o) => o.id === req.params.orderId);
  if (!order) return res.status(404).json({ error: "Order not found" });

  res.json({
    orderId:           order.id,
    status:            order.status,
    placedAt:          order.placedAt,
    estimatedDelivery: "3–5 business days",
    items:             order.items,
    total:             order.total,
  });
});

// ── Admin ─────────────────────────────────────────────────────────────────────

/** GET /api/orders — list all orders (admin) */
router.get("/", requireAdmin, (req, res) => {
  const db = readDB();
  let orders = [...db.orders];

  // Filter by status
  if (req.query.status) orders = orders.filter((o) => o.status === req.query.status);

  // Sort newest first
  orders.sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));

  // Pagination
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const total = orders.length;

  res.json({
    orders: orders.slice((page - 1) * limit, page * limit),
    total, page, limit,
  });
});

/** GET /api/orders/:id — order detail (admin) */
router.get("/:id", requireAdmin, (req, res) => {
  const db    = readDB();
  const order = db.orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
});

/**
 * PATCH /api/orders/:id/status — update order status (admin)
 * Body: { status: "confirmed"|"processing"|"shipped"|"delivered"|"cancelled" }
 */
router.patch("/:id/status", requireAdmin, (req, res) => {
  const VALID = ["confirmed","processing","shipped","delivered","cancelled"];
  const { status } = req.body;

  if (!VALID.includes(status))
    return res.status(400).json({ error: `status must be one of: ${VALID.join(", ")}` });

  const db  = readDB();
  const idx = db.orders.findIndex((o) => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Order not found" });

  db.orders[idx].status    = status;
  db.orders[idx].updatedAt = new Date().toISOString();
  writeDB(db);

  res.json({ message: `Order status updated to "${status}"`, order: db.orders[idx] });
});

module.exports = router;
