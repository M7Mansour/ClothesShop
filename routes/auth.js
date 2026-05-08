const router    = require("express").Router();
const { readDB }    = require("../utils/db");
const { signToken } = require("../middleware/auth");

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Returns: { token, admin: { id, username, name } }
 */
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: "username and password are required" });

  const db    = readDB();
  const admin = db.admins.find(
    (a) => a.username === username && a.password === password
  );

  if (!admin) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ id: admin.id, username: admin.username });
  res.json({
    message: "Login successful",
    token,
    admin: { id: admin.id, username: admin.username, name: admin.name },
  });
});

/**
 * POST /api/auth/logout
 * Client-side token deletion; server confirms.
 */
router.post("/logout", (_req, res) => {
  res.json({ message: "Logged out successfully. Please discard your token." });
});

module.exports = router;
