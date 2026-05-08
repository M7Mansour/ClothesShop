const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "super-secret-clothes-shop-key-change-in-prod";

/**
 * Generate a signed JWT for an admin session.
 * @param {object} payload – data to embed (id, username)
 * @returns {string} signed token
 */
function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "8h" });
}

/**
 * Express middleware – protects admin-only routes.
 * Expects:  Authorization: Bearer <token>
 */
function requireAdmin(req, res, next) {
  const header = req.headers["authorization"] || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    req.admin = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Middleware – attaches a customer session ID from the
 * X-Session-Id header (or rejects with 400 if missing).
 */
function requireSession(req, res, next) {
  const sessionId = req.headers["x-session-id"];
  if (!sessionId) return res.status(400).json({ error: "X-Session-Id header required" });
  req.sessionId = sessionId;
  next();
}

module.exports = { signToken, requireAdmin, requireSession };
