# 🛍️ Clothes Shop API

A fully-featured REST API backend for a clothes shopping website built with **Node.js** and **Express.js**. Uses a flat JSON file as the database — no external DB needed.

---

## 📦 Setup

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start          # production
npm run dev        # development (auto-reload with nodemon)
```

Server runs at **http://localhost:3001**

---

## 🔑 Authentication

Two auth mechanisms are used:

| Mechanism | Used For | How |
|-----------|----------|-----|
| `Bearer <JWT>` | Admin routes | `Authorization: Bearer <token>` header |
| `X-Session-Id` | Customer cart & orders | `X-Session-Id: <any-uuid>` header |

**Default admin credentials:**
- Username: `admin`
- Password: `admin123`

> ⚠️ Change the default password via `POST /api/admin/password` before deploying.

---

## 📡 API Endpoints

### 🔐 Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | None | Admin login → returns JWT |
| POST | `/api/auth/logout` | None | Client-side logout confirmation |

---

### 📂 Categories
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/categories` | None | List all categories |
| GET | `/api/categories/:id` | None | Category detail + its items |
| POST | `/api/categories` | Admin | Create a new category |
| PUT | `/api/categories/:id` | Admin | Update a category |
| DELETE | `/api/categories/:id` | Admin | Delete category (fails if items exist) |

---

### 👕 Items
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/items` | None | List items (filterable + paginated) |
| GET | `/api/items/popular` | None | Top N most-ordered items |
| GET | `/api/items/:id` | None | Single item detail |
| POST | `/api/items` | Admin | Create an item |
| PUT | `/api/items/:id` | Admin | Update an item |
| PATCH | `/api/items/:id/stock` | Admin | Quick stock adjustment |
| DELETE | `/api/items/:id` | Admin | Delete an item |

**GET /api/items query params:**
- `category` – category slug or ID
- `search` – search in name/description
- `sort` – `price_asc`, `price_desc`, `newest`, `popular`
- `page` – page number (default: 1)
- `limit` – items per page (default: 20, max: 50)

---

### 🛒 Cart
All cart routes require **`X-Session-Id`** header.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/cart` | Session | View current cart + subtotal |
| POST | `/api/cart` | Session | Add item to cart |
| PUT | `/api/cart/:itemId` | Session | Update item quantity |
| DELETE | `/api/cart/:itemId` | Session | Remove a single item |
| DELETE | `/api/cart` | Session | Clear entire cart |

**POST /api/cart body:**
```json
{
  "itemId": "item-001",
  "quantity": 2,
  "size": "M",
  "color": "White"
}
```

---

### 📦 Orders
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/orders` | Session | Place order from cart |
| GET | `/api/orders/track/:orderId` | None | Customer order tracking |
| GET | `/api/orders` | Admin | List all orders |
| GET | `/api/orders/:id` | Admin | Order detail |
| PATCH | `/api/orders/:id/status` | Admin | Update order status |

**POST /api/orders body:**
```json
{
  "customerName": "Jane Doe",
  "email": "jane@example.com",
  "shippingAddress": {
    "line1": "123 Main St",
    "city": "Amsterdam",
    "country": "Netherlands",
    "zip": "1011AB"
  }
}
```

**Order statuses:** `confirmed` → `processing` → `shipped` → `delivered` | `cancelled`

> ⚠️ No real payment is processed. A confirmation message is returned.

---

### 🛠️ Admin Dashboard
All routes require **`Bearer <JWT>`** header.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/dashboard` | Admin | Stats: revenue, orders, low stock, top items |
| GET | `/api/admin/items` | Admin | All items (filterable) |
| POST | `/api/admin/items/bulk` | Admin | Bulk insert items |
| GET | `/api/admin/orders` | Admin | Recent orders |
| POST | `/api/admin/password` | Admin | Change admin password |

---

## 🗂️ Project Structure

```
clothes-shop/
├── server.js              # Express app entry point
├── package.json
├── data/
│   └── db.json            # JSON "database" (auto-updated)
├── middleware/
│   └── auth.js            # JWT + session middleware
├── routes/
│   ├── auth.js            # Login / logout
│   ├── categories.js      # Category CRUD
│   ├── items.js           # Item CRUD + search
│   ├── cart.js            # Shopping cart
│   ├── orders.js          # Order placement & tracking
│   └── admin.js           # Admin dashboard
└── utils/
    └── db.js              # JSON file read/write helpers
```

---

## 💡 Example Flow

```bash
# 1. Admin logs in
POST /api/auth/login  { username: "admin", password: "admin123" }
# → { token: "eyJ..." }

# 2. Admin adds an item
POST /api/items  (with Authorization: Bearer eyJ...)
{ "name": "Blue T-Shirt", "price": 29.99, "categoryId": "cat-001", ... }

# 3. Customer browses
GET /api/items?category=shirts&sort=popular

# 4. Customer adds to cart (using a generated session UUID)
POST /api/cart  (with X-Session-Id: my-session-123)
{ "itemId": "item-001", "quantity": 1, "size": "M" }

# 5. Customer places order
POST /api/orders  (with X-Session-Id: my-session-123)
{ "customerName": "...", "email": "...", "shippingAddress": { ... } }
# → { "message": "🎉 Order placed successfully!", "orderId": "order-abc123" }

# 6. Customer tracks order
GET /api/orders/track/order-abc123

# 7. Admin updates status
PATCH /api/orders/order-abc123/status  { "status": "shipped" }
```
