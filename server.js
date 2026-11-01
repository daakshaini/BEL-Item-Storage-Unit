
require("dotenv").config();

const path = require("node:path");
const crypto = require("node:crypto");
const fs = require("node:fs");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const { DatabaseSync } = require("node:sqlite");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;
const sessionSecret = process.env.SESSION_SECRET;

if (!adminUsername || !adminPassword || !sessionSecret) {
  throw new Error(
    "ADMIN_USERNAME, ADMIN_PASSWORD and SESSION_SECRET must be set in the .env file."
  );
}

if (sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 characters.");
}

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(
  path.join(dataDir, "item-storage-unit.db")
);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
`);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user'
    CHECK(role IN ('user','admin')),
  blocked INTEGER NOT NULL DEFAULT 0
    CHECK(blocked IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  part_number TEXT NOT NULL
    CHECK(length(part_number)=10 AND part_number NOT GLOB '*[^0-9]*'),
  item_name TEXT NOT NULL,
  item_price REAL NOT NULL DEFAULT 0 CHECK(item_price >= 0),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_part ON items(part_number);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id INTEGER,
  part_number TEXT NOT NULL,
  item_name TEXT NOT NULL,
  action TEXT NOT NULL
    CHECK(action IN ('Added','Removed','Created','Deleted')),
  quantity INTEGER NOT NULL,
  net_quantity INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_user
ON transactions(user_id, id DESC);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  item_name TEXT,
  part_number TEXT,
  quantity INTEGER,
  net_quantity INTEGER,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  event TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_username TEXT NOT NULL,
  action TEXT NOT NULL,
  target_label TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expires INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires
ON sessions(expires);
`);

if (!db.prepare("SELECT id FROM users WHERE username=?").get(adminUsername)) {
  db.prepare(
    "INSERT INTO users(username,password_hash,role) VALUES(?,?,'admin')"
  ).run(adminUsername, bcrypt.hashSync(adminPassword, 12));
}

class SQLiteSessionStore extends session.Store {
  constructor(database) {
    super();

    this.database = database;

    this.read = database.prepare(
      "SELECT sess,expires FROM sessions WHERE sid=?"
    );

    this.write = database.prepare(`
      INSERT INTO sessions(sid,sess,expires)
      VALUES(?,?,?)
      ON CONFLICT(sid)
      DO UPDATE SET sess=excluded.sess,expires=excluded.expires
    `);

    this.remove = database.prepare(
      "DELETE FROM sessions WHERE sid=?"
    );

    this.updateExpiry = database.prepare(
      "UPDATE sessions SET expires=? WHERE sid=?"
    );

    this.removeExpired = database.prepare(
      "DELETE FROM sessions WHERE expires<=?"
    );
  }

  expiry(sessionData) {
    const expires = sessionData?.cookie?.expires
      ? new Date(sessionData.cookie.expires).getTime()
      : 0;

    return Number.isFinite(expires) && expires > 0
      ? expires
      : Date.now() + Number(
          sessionData?.cookie?.maxAge || 8 * 60 * 60 * 1000
        );
  }

  get(sid, callback) {
    try {
      const row = this.read.get(sid);

      if (!row) {
        return callback(null, null);
      }

      if (row.expires <= Date.now()) {
        this.remove.run(sid);
        return callback(null, null);
      }

      callback(null, JSON.parse(row.sess));
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sessionData, callback = () => {}) {
    try {
      const expires = this.expiry(sessionData);

      this.write.run(
        sid,
        JSON.stringify(sessionData),
        expires
      );

      this.removeExpired.run(Date.now());

      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid, sessionData, callback = () => {}) {
    try {
      this.updateExpiry.run(
        this.expiry(sessionData),
        sid
      );

      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  destroy(sid, callback = () => {}) {
    try {
      this.remove.run(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
}

app.disable("x-powered-by");

app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(express.json({
  limit: "100kb"
}));

app.use(express.urlencoded({
  extended: false
}));

app.use(session({
  store: new SQLiteSessionStore(db),
  name: "bel.sid",
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 8 * 60 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, "public")));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many requests. Please try again after 15 minutes."
  }
});

app.use(
  ["/api/login", "/api/signup"],
  loginLimiter
);

const q = (sql) => db.prepare(sql);

function withTransaction(callback) {
  db.exec("BEGIN IMMEDIATE");

  try {
    const result = callback();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {}

    throw error;
  }
}

const logAuth = q(`
  INSERT INTO auth_logs(username,event,details)
  VALUES(?,?,?)
`);

function writeActivity(
  user,
  action,
  item,
  quantity,
  netQuantity,
  details = null
) {
  q(`
    INSERT INTO activity_logs(
      user_id,
      username,
      action,
      item_name,
      part_number,
      quantity,
      net_quantity,
      details
    )
    VALUES(?,?,?,?,?,?,?,?)
  `).run(
    user.id,
    user.username,
    action,
    item?.item_name || null,
    item?.part_number || null,
    quantity ?? null,
    netQuantity ?? null,
    details
  );
}

function writeTransaction(
  user,
  item,
  action,
  quantity,
  netQuantity
) {
  q(`
    INSERT INTO transactions(
      user_id,
      item_id,
      part_number,
      item_name,
      action,
      quantity,
      net_quantity
    )
    VALUES(?,?,?,?,?,?,?)
  `).run(
    user.id,
    item.id || null,
    item.part_number,
    item.item_name,
    action,
    quantity,
    netQuantity
  );

  writeActivity(
    user,
    action.toLowerCase(),
    item,
    quantity,
    netQuantity
  );
}

function captcha(req, res) {
  const a = crypto.randomInt(2, 10);
  const b = crypto.randomInt(1, 10);
  const op = Math.random() < 0.5 ? "+" : "-";

  const answer = op === "+"
    ? a + b
    : a - b;

  const token = crypto.randomBytes(24).toString("hex");

  req.session.captcha = {
    token,
    answer: String(answer),
    expiresAt: Date.now() + 5 * 60 * 1000
  };

  res.json({
    question: `${a} ${op} ${b} = ?`,
    token
  });
}

app.get("/api/captcha", captcha);

function verifyCaptcha(req, res) {
  const saved = req.session.captcha;

  const supplied = String(
    req.body.captchaAnswer ?? ""
  ).trim();

  const token = String(
    req.body.captchaToken ?? ""
  );

  req.session.captcha = null;

  const tokenBuffer = Buffer.from(token);
  const savedTokenBuffer = Buffer.from(
    saved?.token || ""
  );

  const tokenMatches =
    tokenBuffer.length === savedTokenBuffer.length &&
    tokenBuffer.length > 0 &&
    crypto.timingSafeEqual(
      tokenBuffer,
      savedTokenBuffer
    );

  if (
    !saved ||
    saved.expiresAt < Date.now() ||
    !tokenMatches ||
    supplied !== saved.answer
  ) {
    res.status(400).json({
      error: "Incorrect or expired CAPTCHA. Please try again."
    });

    return false;
  }

  return true;
}

function passwordIsValid(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function regenerateSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) {
        return reject(err);
      }

      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role
      };

      req.session.save((saveErr) => {
        if (saveErr) {
          reject(saveErr);
        } else {
          resolve();
        }
      });
    });
  });
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      error: "Please log in to continue."
    });
  }

  const user = q(`
    SELECT id,username,role,blocked
    FROM users
    WHERE id=?
  `).get(req.session.user.id);

  if (!user || user.blocked) {
    req.session.destroy(() => {});

    return res.status(401).json({
      error: "Your account is unavailable. Contact the administrator."
    });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  req.currentUser = user;

  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () =>
    req.currentUser.role === "admin"
      ? next()
      : res.status(403).json({
          error: "Administrator access required."
        })
  );
}

function validId(value) {
  const id = Number(value);

  return Number.isSafeInteger(id) && id > 0
    ? id
    : null;
}

// Current user information

app.get("/api/me", (req, res) => {
  if (!req.session.user) {
    return res.json({
      user: null
    });
  }

  const user = q(`
    SELECT id,username,role
    FROM users
    WHERE id=? AND blocked=0
  `).get(req.session.user.id);

  if (!user) {
    return res.json({
      user: null
    });
  }

  res.json({
    user
  });
});

// User registration

app.post("/api/signup", async (req, res) => {
  if (!verifyCaptcha(req, res)) {
    return;
  }

  const username = String(
    req.body.username || ""
  ).trim();

  const password = String(
    req.body.password || ""
  );

  const confirmPassword = String(
    req.body.confirmPassword || ""
  );

  if (!/^2\d{5}$/.test(username)) {
    return res.status(400).json({
      error: "Username must be exactly 6 digits and start with 2."
    });
  }

  if (!passwordIsValid(password)) {
    return res.status(400).json({
      error: "Password must contain at least 8 characters, including uppercase, lowercase, number and special character."
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      error: "Passwords do not match."
    });
  }

  if (
    q("SELECT id FROM users WHERE username=?").get(username)
  ) {
    return res.status(409).json({
      error: "This username already exists."
    });
  }

  try {
    q(`
      INSERT INTO users(username,password_hash,role)
      VALUES(?,?,'user')
    `).run(
      username,
      bcrypt.hashSync(password, 12)
    );

    logAuth.run(
      username,
      "signup",
      "New user account created"
    );

    res.json({
      success: true,
      message: "Account created successfully. Please log in."
    });
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) {
      return res.status(409).json({
        error: "This username already exists."
      });
    }

    res.status(500).json({
      error: "Unable to create the account."
    });
  }
});

// User login

app.post("/api/login", async (req, res) => {
  if (!verifyCaptcha(req, res)) {
    return;
  }

  const username = String(
    req.body.username || ""
  ).trim();

  const password = String(
    req.body.password || ""
  );

  const user = q(
    "SELECT * FROM users WHERE username=?"
  ).get(username);

  if (
    !user ||
    !bcrypt.compareSync(password, user.password_hash)
  ) {
    logAuth.run(
      username || null,
      "login_failed",
      "Invalid username or password"
    );

    return res.status(401).json({
      error: "Invalid username or password."
    });
  }

  if (user.blocked) {
    logAuth.run(
      username,
      "blocked_attempt",
      "Blocked account attempted login"
    );

    return res.status(403).json({
      error: "Your account is blocked. Contact the administrator."
    });
  }

  try {
    await regenerateSession(req, user);

    logAuth.run(
      username,
      "login_success",
      "Login successful"
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      welcome: user.role === "user"
        ? "Welcome to BEL Machilipatnam"
        : null
    });
  } catch {
    res.status(500).json({
      error: "Unable to start your session. Please try again."
    });
  }
});

// Logout

app.post("/api/logout", requireAuth, (req, res) => {
  logAuth.run(
    req.currentUser.username,
    "logout",
    "User logged out"
  );

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        error: "Unable to log out."
      });
    }

    res.json({
      success: true
    });
  });
});

// User inventory

app.get("/api/inventory", requireAuth, (req, res) => {
  const items = q(`
    SELECT *
    FROM items
    WHERE user_id=?
    ORDER BY datetime(created_at) DESC,id DESC
  `).all(req.currentUser.id);

  res.json({
    items
  });
});

// User transactions

app.get("/api/transactions", requireAuth, (req, res) => {
  const transactions = q(`
    SELECT *
    FROM transactions
    WHERE user_id=?
    ORDER BY datetime(created_at) DESC,id DESC
    LIMIT 1000
  `).all(req.currentUser.id);

  res.json({
    transactions
  });
});

// Add inventory item

app.post("/api/items", requireAuth, (req, res) => {
  const part = String(
    req.body.part_number || ""
  ).trim();

  const name = String(
    req.body.item_name || ""
  ).trim();

  const price = Number(req.body.item_price);
  const qty = Number(req.body.quantity);

  if (!/^\d{10}$/.test(part)) {
    return res.status(400).json({
      error: "Part Number must be exactly 10 digits."
    });
  }

  if (!name || name.length > 120) {
    return res.status(400).json({
      error: "Item name is required (maximum 120 characters)."
    });
  }

  if (
    !Number.isFinite(price) ||
    price < 0 ||
    price > 1000000000
  ) {
    return res.status(400).json({
      error: "Enter a valid non-negative price."
    });
  }

  if (
    !Number.isSafeInteger(qty) ||
    qty < 0
  ) {
    return res.status(400).json({
      error: "Quantity must be a non-negative whole number."
    });
  }

  const createItem = () => withTransaction(() => {
    const info = q(`
      INSERT INTO items(
        user_id,
        part_number,
        item_name,
        item_price,
        quantity
      )
      VALUES(?,?,?,?,?)
    `).run(
      req.currentUser.id,
      part,
      name,
      price,
      qty
    );

    const createdItem = q(
      "SELECT * FROM items WHERE id=?"
    ).get(Number(info.lastInsertRowid));

    writeTransaction(
      req.currentUser,
      createdItem,
      "Created",
      qty,
      qty
    );

    return createdItem;
  });

  const item = createItem();

  res.json({
    success: true,
    item
  });
});

// Add or remove stock

app.post("/api/items/:id/adjust", requireAuth, (req, res) => {
  const id = validId(req.params.id);
  const direction = req.body.direction;
  const qty = Number(req.body.quantity);

  if (
    !id ||
    !["add", "remove"].includes(direction) ||
    !Number.isSafeInteger(qty) ||
    qty < 1
  ) {
    return res.status(400).json({
      error: "Enter a valid stock adjustment."
    });
  }

  const item = q(`
    SELECT *
    FROM items
    WHERE id=? AND user_id=?
  `).get(id, req.currentUser.id);

  if (!item) {
    return res.status(404).json({
      error: "Item not found."
    });
  }

  const next = item.quantity +
    (direction === "add" ? qty : -qty);

  if (next < 0) {
    return res.status(400).json({
      error: "Quantity cannot be negative."
    });
  }

  if (!Number.isSafeInteger(next)) {
    return res.status(400).json({
      error: "Quantity is too large."
    });
  }

  const update = db.prepare(`
    UPDATE items
    SET quantity=?
    WHERE id=? AND user_id=? AND quantity=?
  `);

  const adjust = () => withTransaction(() => {
    const result = update.run(
      next,
      id,
      req.currentUser.id,
      item.quantity
    );

    if (result.changes !== 1) {
      return false;
    }

    const updatedItem = q(
      "SELECT * FROM items WHERE id=?"
    ).get(id);

    writeTransaction(
      req.currentUser,
      updatedItem,
      direction === "add" ? "Added" : "Removed",
      qty,
      next
    );

    return updatedItem;
  });

  const updated = adjust();

  if (!updated) {
    return res.status(409).json({
      error: "Stock changed. Refresh and try again."
    });
  }

  res.json({
    success: true,
    item: updated
  });
});

// Delete inventory item

app.delete("/api/items/:id", requireAuth, (req, res) => {
  const id = validId(req.params.id);

  if (!id) {
    return res.status(400).json({
      error: "Invalid item."
    });
  }

  const item = q(`
    SELECT *
    FROM items
    WHERE id=? AND user_id=?
  `).get(id, req.currentUser.id);

  if (!item) {
    return res.status(404).json({
      error: "Item not found."
    });
  }

  const removeItem = () => withTransaction(() => {
    writeTransaction(
      req.currentUser,
      item,
      "Deleted",
      item.quantity,
      0
    );

    q(`
      DELETE FROM items
      WHERE id=? AND user_id=?
    `).run(
      id,
      req.currentUser.id
    );
  });

  removeItem();

  res.json({
    success: true
  });
});

// Admin overview dashboard

app.get("/api/admin/overview", requireAdmin, (req, res) => {
  const users = q(`
    SELECT COUNT(*) AS n
    FROM users
    WHERE role='user'
  `).get().n;

  const items = q(`
    SELECT COUNT(*) AS n
    FROM items
  `).get().n;

  const totalQty = q(`
    SELECT COALESCE(SUM(quantity),0) AS n
    FROM items
  `).get().n;

  const active = q(`
    SELECT COUNT(DISTINCT user_id) AS n
    FROM transactions
    WHERE datetime(created_at)>=datetime('now','-7 days')
  `).get().n;

  const recentItems = q(`
    SELECT i.*,u.username
    FROM items i
    JOIN users u ON u.id=i.user_id
    ORDER BY datetime(i.created_at) DESC,i.id DESC
    LIMIT 6
  `).all();

  const recentTransactions = q(`
    SELECT t.*,u.username
    FROM transactions t
    JOIN users u ON u.id=t.user_id
    ORDER BY datetime(t.created_at) DESC,t.id DESC
    LIMIT 8
  `).all();

  res.json({
    stats: {
      users,
      items,
      activeUsers: active,
      totalQty
    },
    recentItems,
    recentTransactions
  });
});

// Admin user management

app.get("/api/admin/users", requireAdmin, (req, res) => {
  const users = q(`
    SELECT
      u.id,
      u.username,
      u.role,
      u.blocked,
      u.created_at,
      (
        SELECT COUNT(*)
        FROM items i
        WHERE i.user_id=u.id
      ) AS itemCount
    FROM users u
    ORDER BY u.role DESC,datetime(u.created_at) DESC
  `).all();

  res.json({
    users
  });
});

// Block or unblock user

app.patch("/api/admin/users/:id/block", requireAdmin, (req, res) => {
  const id = validId(req.params.id);

  const user = id &&
    q("SELECT * FROM users WHERE id=? AND role='user'").get(id);

  if (!user) {
    return res.status(404).json({
      error: "User not found."
    });
  }

  const blocked = user.blocked ? 0 : 1;

  q(`
    UPDATE users
    SET blocked=?
    WHERE id=?
  `).run(
    blocked,
    user.id
  );

  q(`
    INSERT INTO admin_actions(
      admin_username,
      action,
      target_label
    )
    VALUES(?,?,?)
  `).run(
    req.currentUser.username,
    blocked ? "block_user" : "unblock_user",
    user.username
  );

  res.json({
    success: true,
    blocked
  });
});

// Delete user

app.delete("/api/admin/users/:id", requireAdmin, (req, res) => {
  const id = validId(req.params.id);

  const user = id &&
    q("SELECT * FROM users WHERE id=? AND role='user'").get(id);

  if (!user) {
    return res.status(404).json({
      error: "User not found or cannot remove administrator."
    });
  }

  const remove = () => withTransaction(() => {
    q(`
      INSERT INTO admin_actions(
        admin_username,
        action,
        target_label
      )
      VALUES(?,?,?)
    `).run(
      req.currentUser.username,
      "delete_user",
      user.username
    );

    q(
      "DELETE FROM users WHERE id=?"
    ).run(user.id);
  });

  remove();

  res.json({
    success: true
  });
});

// Admin all items

app.get("/api/admin/items", requireAdmin, (req, res) => {
  const items = q(`
    SELECT i.*,u.username
    FROM items i
    JOIN users u ON u.id=i.user_id
    ORDER BY datetime(i.created_at) DESC,i.id DESC
  `).all();

  res.json({
    items
  });
});

// Admin all transactions

app.get("/api/admin/transactions", requireAdmin, (req, res) => {
  const transactions = q(`
    SELECT t.*,u.username
    FROM transactions t
    JOIN users u ON u.id=t.user_id
    ORDER BY datetime(t.created_at) DESC,t.id DESC
    LIMIT 1000
  `).all();

  res.json({
    transactions
  });
});

// Admin activity logs

app.get("/api/admin/activity", requireAdmin, (req, res) => {
  const activities = q(`
    SELECT *
    FROM activity_logs
    ORDER BY datetime(created_at) DESC,id DESC
    LIMIT 1000
  `).all();

  res.json({
    activities
  });
});

// Admin security logs

app.get("/api/admin/security", requireAdmin, (req, res) => {
  res.json({
    authLogs: q(`
      SELECT *
      FROM auth_logs
      ORDER BY datetime(created_at) DESC,id DESC
      LIMIT 500
    `).all(),

    adminActions: q(`
      SELECT *
      FROM admin_actions
      ORDER BY datetime(created_at) DESC,id DESC
      LIMIT 500
    `).all()
  });
});

// Admin view of an individual user's items

app.get("/api/admin/user-items/:id", requireAdmin, (req, res) => {
  const id = validId(req.params.id);

  if (!id) {
    return res.status(400).json({
      error: "Invalid user."
    });
  }

  const items = q(`
    SELECT *
    FROM items
    WHERE user_id=?
    ORDER BY id DESC
  `).all(id);

  res.json({
    items
  });
});

// Serve the application

app.get("*", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

const server = app.listen(PORT, () => {
  console.log(
    `BEL Item Storage Unit running at http://localhost:${PORT}`
  );

  console.log(
    "SQLite database:",
    path.join(dataDir, "item-storage-unit.db")
  );

  console.log(
    "Server security configuration loaded."
  );
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
