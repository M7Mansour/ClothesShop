/**
 * Cart Routes
 * -----------
 * Carts are keyed by a client-supplied session ID (X-Session-Id header).
 * No auth required — anyone with a session ID can use their cart.
 *
 * Cart entry shape:
 *   { itemId, name, price, imageUrl, size, color, quantity }
 */

const router  = require("express").Router();
const { readDB, writeDB } = require("../utils/db");
const { requireSession }  = require("../middleware/auth");

router.use(requireSession); // all cart routes need X-Session-Id

// Helper — get or create a cart
function getCart(db, sessionId) {
  if (!db.carts[sessionId]) db.carts[sessionId] = { items: [], updatedAt: null };
  return db.carts[sessionId];
}

/** GET /api/cart — view current cart */
router.get("/", (req, res) => {
  const db   = readDB();
  const cart = getCart(db, req.sessionId);

  const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  res.json({ sessionId: req.sessionId, items: cart.items, subtotal: +subtotal.toFixed(2) });
});

/**
 * POST /api/cart — add item to cart
 * Body: { itemId, quantity, size?, color? }
 */
router.post("/", (req, res) => {
  const { itemId, quantity = 1, size, color } = req.body;
  if (!itemId) return res.status(400).json({ error: "itemId is required" });

  const db   = readDB();
  const item = db.items.find((i) => i.id === itemId);
  if (!item) return res.status(404).json({ error: "Item not found" });

  const qty = parseInt(quantity);
  if (qty < 1) return res.status(400).json({ error: "quantity must be >= 1" });
  if (item.stock < qty) return res.status(409).json({ error: "Not enough stock" });

  const cart  = getCart(db, req.sessionId);
  // Check if same item+size+color already in cart
  const existing = cart.items.find(
    (e) => e.itemId === itemId && e.size === (size || null) && e.color === (color || null)
  );

  if (existing) {
    existing.quantity += qty;
  } else {
    cart.items.push({
      itemId,
      name:     item.name,
      price:    item.price,
      imageUrl: item.imageUrl,
      size:     size  || null,
      color:    color || null,
      quantity: qty,
    });
  }

  cart.updatedAt = new Date().toISOString();
  writeDB(db);

  const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  res.status(201).json({ message: "Item added to cart", items: cart.items, subtotal: +subtotal.toFixed(2) });
});

/**
 * PUT /api/cart/:itemId — update quantity of a line item
 * Body: { quantity, size?, color? }
 */
router.put("/:itemId", (req, res) => {
  const { quantity, size, color } = req.body;
  if (quantity == null) return res.status(400).json({ error: "quantity is required" });

  const db   = readDB();
  const cart = getCart(db, req.sessionId);
  const idx  = cart.items.findIndex(
    (e) => e.itemId === req.params.itemId &&
           e.size  === (size  || null) &&
           e.color === (color || null)
  );

  if (idx === -1) return res.status(404).json({ error: "Item not in cart" });

  const qty = parseInt(quantity);
  if (qty < 1) {
    cart.items.splice(idx, 1); // treat qty 0 as remove
  } else {
    const stock = db.items.find((i) => i.id === req.params.itemId)?.stock ?? Infinity;
    if (qty > stock) return res.status(409).json({ error: "Not enough stock" });
    cart.items[idx].quantity = qty;
  }

  cart.updatedAt = new Date().toISOString();
  writeDB(db);

  const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  res.json({ items: cart.items, subtotal: +subtotal.toFixed(2) });
});

/**
 * DELETE /api/cart/:itemId — remove a specific line item
 * Query: size?, color?
 */
router.delete("/:itemId", (req, res) => {
  const { size, color } = req.query;
  const db   = readDB();
  const cart = getCart(db, req.sessionId);
  const before = cart.items.length;

  cart.items = cart.items.filter(
    (e) => !(e.itemId === req.params.itemId &&
             e.size  === (size  || null) &&
             e.color === (color || null))
  );

  if (cart.items.length === before)
    return res.status(404).json({ error: "Item not found in cart" });

  cart.updatedAt = new Date().toISOString();
  writeDB(db);
  res.json({ message: "Item removed from cart", items: cart.items });
});

/** DELETE /api/cart — clear entire cart */
router.delete("/", (req, res) => {
  const db = readDB();
  db.carts[req.sessionId] = { items: [], updatedAt: new Date().toISOString() };
  writeDB(db);
  res.json({ message: "Cart cleared" });
});

module.exports = router;
