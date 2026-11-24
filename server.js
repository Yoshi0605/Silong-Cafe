require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const menu = require("./menu");

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "silong123";
const DB_NAME = process.env.DB_NAME || "silong_cafe";
const DB_HOST = process.env.DB_HOST || "localhost";
const sslEnabled =
  String(process.env.DB_SSL || "false").toLowerCase() === "true" ||
  (DB_HOST !== "localhost" && DB_HOST !== "127.0.0.1");
const sslRejectUnauthorized =
  String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "true").toLowerCase() !==
  "false";
const conn = {
  host: DB_HOST,
  port: +process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  ...(sslEnabled
    ? {
        ssl: {
          rejectUnauthorized: sslRejectUnauthorized,
          ...(process.env.DB_SSL_CA
            ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, "\n") }
            : {}),
        },
      }
    : {}),
};
let pool;
let initPromise;

async function initDb() {
  const skipInit =
    String(process.env.DB_SKIP_INIT || "false").toLowerCase() === "true" ||
    process.env.NODE_ENV === "production" ||
    !!process.env.VERCEL;

  if (skipInit) {
    pool = mysql.createPool({
      ...conn,
      database: DB_NAME,
      timezone: "Z",
      connectionLimit: 10,
    });
    return;
  }

  if (process.env.DB_CREATE_DATABASE === "true") {
    const boot = await mysql.createConnection(conn);
    await boot.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4`,
    );
    await boot.end();
  }
  pool = mysql.createPool({
    ...conn,
    database: DB_NAME,
    timezone: "Z",
    connectionLimit: 10,
  });
  const ddl = fs
    .readFileSync(path.join(__dirname, "schema.sql"), "utf8")
    .replace(/^--.*$/gm, "");
  for (const stmt of ddl
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean))
    await pool.query(stmt);

  const [columns] = await pool.query(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders'",
    [DB_NAME],
  );
  const names = new Set(columns.map((c) => c.COLUMN_NAME));
  if (!names.has("payment_method"))
    await pool.query(
      "ALTER TABLE orders MODIFY COLUMN payment_method ENUM('Cash','E-Wallet','Bank Transfer') NOT NULL DEFAULT 'Cash'",
    );
  if (!names.has("payment_provider"))
    await pool.query(
      "ALTER TABLE orders ADD COLUMN payment_provider VARCHAR(30) NULL AFTER payment_method",
    );

  const [indexes] = await pool.query(
    "SHOW INDEX FROM orders WHERE Key_name = 'uq_reference_number'",
  );
  if (!indexes.length)
    await pool.query(
      "ALTER TABLE orders ADD UNIQUE KEY uq_reference_number (reference_number)",
    );
}

function ensureDb() {
  if (!initPromise) initPromise = initDb();
  return initPromise;
}

const items = new Map(
  menu.categories.flatMap((c) => c.items).map((i) => [i.n, i]),
);
const addons = new Map(menu.addons.map((a) => [a.name, a.price]));
const STATUSES = ["new", "preparing", "ready", "done", "cancelled"];
const TYPES = ["Dine-in", "Takeout", "Pickup"];
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
const clean = (s, n) =>
  String(s || "")
    .trim()
    .slice(0, n);
const wrap = (fn) => async (req, res) => {
  try {
    await ensureDb();
    await fn(req, res);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
};

const app = express();
app.use(express.json({ limit: "50kb" }));

function signAdminToken() {
  const payload = `admin:${Date.now()}`;
  const signature = crypto
    .createHmac("sha256", ADMIN_PASSWORD)
    .update(payload)
    .digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

function verifyAdminToken(token) {
  try {
    const [payloadB64, signature] = token.split(".");
    const payload = Buffer.from(payloadB64, "base64url").toString("utf8");
    const expected = crypto
      .createHmac("sha256", ADMIN_PASSWORD)
      .update(payload)
      .digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
      return false;
    const created = Number(payload.split(":")[1]);
    return (
      payload.startsWith("admin:") && Date.now() - created < 8 * 60 * 60 * 1000
    );
  } catch (_) {
    return false;
  }
}

function auth(req, res, next) {
  const cookie = (req.headers.cookie || "").match(
    /(?:^|;\s*)silong_admin=([^;]+)/,
  );
  if (cookie && verifyAdminToken(decodeURIComponent(cookie[1]))) return next();
  if (req.accepts(["html", "json"]) === "html") {
    return res.status(401).send("Login required");
  }
  return res.status(401).json({ error: "Login required" });
}

app.post("/api/admin/login", (req, res) => {
  const password = String(req.body?.password || "");
  if (password !== ADMIN_PASSWORD)
    return res.status(401).json({ error: "Incorrect admin password." });

  const secure = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
  res.setHeader(
    "Set-Cookie",
    `silong_admin=${signAdminToken()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure ? "; Secure" : ""}`,
  );
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  const secure = process.env.NODE_ENV === "production" || !!process.env.VERCEL;
  res.setHeader(
    "Set-Cookie",
    `silong_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure ? "; Secure" : ""}`,
  );
  res.json({ ok: true });
});

app.get("/api/cloudinary/config", (_, res) => {
  res.json({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || "",
  });
});

const orderLimits = new Map();
function orderRateLimit(req, res, next) {
  const ip = (
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress ||
    "unknown"
  )
    .split(",")[0]
    .trim();
  const now = Date.now();
  const windowStart = now - 10 * 60 * 1000;
  const recent = (orderLimits.get(ip) || []).filter(
    (time) => time > windowStart,
  );
  if (recent.length >= 3)
    return res
      .status(429)
      .json({
        error: "Too many orders. Please wait 10 minutes and try again.",
      });
  recent.push(now);
  orderLimits.set(ip, recent);
  next();
}

/* ---- public (customer) ---- */
app.get("/api/menu", (_, res) => res.json(menu));

app.post(
  "/api/orders",
  orderRateLimit,
  wrap(async (req, res) => {
    const b = req.body || {},
      customer = clean(b.customer, 60);
    if (!customer)
      return res.status(400).json({ error: "Please enter your name." });
    if (!TYPES.includes(b.type))
      return res
        .status(400)
        .json({ error: "Choose dine-in, takeout, or pickup." });
    const PAYMENT_TYPES = ["Cash", "E-Wallet", "Bank Transfer"];
    const PROVIDER_RULES = {
      GCash: /^\d{13}$/,
      Maya: /^[A-Za-z0-9]{12,16}$/,
      SeaBank: /^[A-Za-z0-9]{10,20}$/,
      GrabPay: /^[A-Za-z0-9]{10,20}$/,
      BDO: /^[A-Za-z0-9]{10,18}$/,
      BPI: /^[A-Za-z0-9]{10,18}$/,
      UnionBank: /^[A-Za-z0-9]{10,18}$/,
      Metrobank: /^[A-Za-z0-9]{10,18}$/,
      GoTyme: /^[A-Za-z0-9]{10,18}$/,
    };
    if (!PAYMENT_TYPES.includes(b.paymentMethod))
      return res.status(400).json({ error: "Choose a payment method." });
    const paymentProvider = clean(b.paymentProvider, 30);
    const referenceNumber = clean(b.referenceNumber, 100)
      .replace(/\s/g, "")
      .toUpperCase();
    const receiptUrl = clean(b.receiptUrl, 1024);
    if (b.paymentMethod !== "Cash") {
      const allowedProviders =
        b.paymentMethod === "E-Wallet"
          ? ["GCash", "Maya", "SeaBank", "GrabPay"]
          : ["BDO", "BPI", "UnionBank", "Metrobank", "GoTyme"];
      if (!allowedProviders.includes(paymentProvider))
        return res
          .status(400)
          .json({ error: "Please select a valid payment provider." });
      if (
        !referenceNumber ||
        !PROVIDER_RULES[paymentProvider].test(referenceNumber)
      )
        return res
          .status(400)
          .json({
            error: `Invalid ${paymentProvider} reference number format.`,
          });
      if (!receiptUrl)
        return res
          .status(400)
          .json({ error: "A payment receipt photo is required." });
      const [[existing]] = await pool.query(
        "SELECT id FROM orders WHERE reference_number = ? LIMIT 1",
        [referenceNumber],
      );
      if (existing)
        return res
          .status(409)
          .json({ error: "This reference number has already been used." });
    }
    const lines = [];
    let total = 0;
    for (const l of b.items) {
      // prices always come from the menu, never from the browser
      const it = items.get(l.name),
        opt = it && it.p.find((o) => o[0] === l.variant),
        qty = Math.floor(Number(l.qty));
      if (!opt || !(qty >= 1 && qty <= 20))
        return res
          .status(400)
          .json({ error: "An item in your order is no longer available." });
      const ad = (Array.isArray(l.addons) ? l.addons : []).filter((a) =>
        addons.has(a),
      );
      const unit = opt[1] + ad.reduce((s, a) => s + addons.get(a), 0);
      total += unit * qty;
      lines.push([it.n, opt[0], ad.join(", "), qty, unit]);
    }
    const day = today(),
      now = new Date(),
      c = await pool.getConnection();
    try {
      await c.beginTransaction();
      await c.query(
        "INSERT INTO daily_counters (order_date, n) VALUES (?, 1) ON DUPLICATE KEY UPDATE n = n + 1",
        [day],
      );
      const [[{ n }]] = await c.query(
        "SELECT n FROM daily_counters WHERE order_date = ?",
        [day],
      );
      const orderNo = String(n).padStart(3, "0");
      const [r] = await c.query(
        "INSERT INTO orders (order_no, order_date, customer, phone, type, table_no, notes, payment_method, payment_provider, receipt_url, reference_number, total, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          orderNo,
          day,
          customer,
          clean(b.phone, 20),
          b.type,
          clean(b.table, 10),
          clean(b.notes, 200),
          b.paymentMethod,
          b.paymentMethod === "Cash" ? null : paymentProvider,
          b.paymentMethod === "Cash" ? null : receiptUrl,
          b.paymentMethod === "Cash" ? null : referenceNumber,
          total,
          now,
          now,
        ],
      );
      await c.query(
        "INSERT INTO order_items (order_id, name, variant, addons, qty, unit_price) VALUES ?",
        [lines.map((l) => [r.insertId, ...l])],
      );
      await c.commit();
      res.status(201).json({ id: r.insertId, order_no: orderNo, total });
    } catch (e) {
      await c.rollback();
      if (e.code === "ER_DUP_ENTRY") {
        res
          .status(409)
          .json({ error: "This reference number has already been used." });
        return;
      }
      throw e;
    } finally {
      c.release();
    }
  }),
);

app.get(
  "/api/orders/:id",
  wrap(async (req, res) => {
    const [[o]] = await pool.query(
      "SELECT id, order_no, status, total, customer FROM orders WHERE id = ?",
      [+req.params.id || 0],
    );
    o ? res.json(o) : res.status(404).json({ error: "Not found" });
  }),
);

/* ---- kitchen (password protected) ---- */
app.get(
  "/api/admin/orders",
  auth,
  wrap(async (_, res) => {
    const [orders] = await pool.query(
      "SELECT * FROM orders WHERE order_date = ? OR status IN ('new','preparing','ready') ORDER BY id DESC",
      [today()],
    );
    const byId = new Map(
      orders.map((o) => [
        o.id,
        { ...o, created_at: o.created_at.toISOString(), items: [] },
      ]),
    );
    if (orders.length) {
      const [rows] = await pool.query(
        "SELECT order_id, name, variant, addons, qty, unit_price FROM order_items WHERE order_id IN (?) ORDER BY id",
        [orders.map((o) => o.id)],
      );
      rows.forEach((r) => byId.get(r.order_id).items.push(r));
    }
    res.json([...byId.values()]);
  }),
);
app.patch(
  "/api/admin/orders/:id",
  auth,
  wrap(async (req, res) => {
    if (!STATUSES.includes(req.body.status))
      return res.status(400).json({ error: "Bad status" });
    const [r] = await pool.query(
      "UPDATE orders SET status = ?, updated_at = ? WHERE id = ?",
      [req.body.status, new Date(), +req.params.id || 0],
    );
    res.json({ ok: r.affectedRows === 1 });
  }),
);
app.get(
  "/api/admin/sales",
  auth,
  wrap(async (req, res) => {
    const requested = String(req.query.date || "");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today();
    const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from || ""))
      ? String(req.query.from)
      : date;
    const to = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to || ""))
      ? String(req.query.to)
      : date;

    const [[summary]] = await pool.query(
      `SELECT
        COALESCE(SUM(status = 'done'), 0) AS order_count,
        COALESCE(SUM(CASE WHEN status = 'done' THEN total ELSE 0 END), 0) AS sales,
        COALESCE(SUM(CASE WHEN status = 'done' AND payment_method = 'Cash' THEN total ELSE 0 END), 0) AS cash_sales,
        COALESCE(SUM(CASE WHEN status = 'done' AND payment_method = 'E-Wallet' THEN total ELSE 0 END), 0) AS ewallet_sales,
        COALESCE(SUM(CASE WHEN status = 'done' AND payment_method = 'Bank Transfer' THEN total ELSE 0 END), 0) AS bank_sales,
        COALESCE(SUM(status = 'done' AND payment_method = 'Cash'), 0) AS cash_orders,
        COALESCE(SUM(status = 'done' AND payment_method = 'E-Wallet'), 0) AS ewallet_orders,
        COALESCE(SUM(status = 'done' AND payment_method = 'Bank Transfer'), 0) AS bank_orders
       FROM orders WHERE order_date BETWEEN ? AND ?`,
      [from, to],
    );

    const [orderRows] = await pool.query(
      `SELECT id, order_no, customer, phone, type, table_no, notes,
              payment_method, payment_provider, receipt_url, reference_number, total,
              created_at, status
       FROM orders WHERE order_date BETWEEN ? AND ? AND status = 'done'
       ORDER BY created_at ASC, id ASC`,
      [from, to],
    );

    const [topRows] = await pool.query(
      `SELECT oi.name, SUM(oi.qty) AS quantity
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.order_date BETWEEN ? AND ? AND o.status = 'done'
       GROUP BY oi.name ORDER BY quantity DESC LIMIT 5`,
      [from, to],
    );

    res.json({
      date,
      orderCount: Number(summary.order_count),
      sales: Number(summary.sales),
      cashSales: Number(summary.cash_sales),
      ewalletSales: Number(summary.ewallet_sales),
      bankSales: Number(summary.bank_sales),
      cashOrders: Number(summary.cash_orders),
      ewalletOrders: Number(summary.ewallet_orders),
      bankOrders: Number(summary.bank_orders),
      topSellers: topRows,
      orders: orderRows,
      receipts: orderRows
        .filter((o) => o.receipt_url)
        .map((o) => ({
          orderNo: o.order_no,
          referenceNumber: o.reference_number,
          total: o.total,
          receiptUrl: o.receipt_url,
        })),
    });
  }),
);
app.get("/admin", (_, res) => res.redirect("/kitchen"));
app.get("/kitchen", auth, (_, res) =>
  res.sendFile(path.join(__dirname, "views", "kitchen.html")),
);
app.get("/healthz", (_, res) => res.send("ok"));
app.use(express.static(path.join(__dirname, "public")));

if (require.main === module) {
  ensureDb()
    .then(() =>
      app.listen(PORT, () => {
        console.log(`\nSilong Café is running`);
        console.log(`  Customers: http://localhost:${PORT}/`);
        console.log(
          `  Kitchen:   http://localhost:${PORT}/kitchen  (password: ADMIN_PASSWORD)\n`,
        );
      }),
    )
    .catch((e) => {
      console.error(`\nCould not connect to MySQL (${e.code || e.message}).`);
      console.error(
        "Check DB_HOST / DB_USER / DB_PASSWORD / DB_SSL in your .env.\n",
      );
      process.exit(1);
    });
}

module.exports = app;
