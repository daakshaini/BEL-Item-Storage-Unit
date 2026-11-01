## Version 1.3 — Premium Blue & Purple UI

Distinct user login/signup colours, navy admin login, coordinated dark user/admin workspace themes, and horizontal CAPTCHA controls. Existing SQLite schema and stored data are preserved.

# BEL Item Storage Unit

An independent rebuild of the BEL Item Storage Unit using plain HTML, CSS and JavaScript, with Node.js, Express and SQLite. The original Lovable project was used as a visual and feature reference; the rebuilt app does not require Lovable, React, Supabase or cloud services.

## Requirements

- Node.js **22.5 or newer** (Node 24 LTS/current is recommended)
- VS Code
- Internet access only for the first `npm install`

SQLite is provided by Node.js (`node:sqlite`), so no separate SQLite installation or database server is required.

## Run in VS Code

1. Extract the ZIP file.
2. Open the extracted `Item-Storage-Unit` folder in VS Code.
3. Select **Terminal → New Terminal**.
4. Run:

   ```bash
   npm install
   ```

5. Copy `.env.example` to `.env`. For local testing, the supplied administrator credentials are already configured. Change `SESSION_SECRET` to a long random value before deployment.
6. Start the application:

   ```bash
   npm start
   ```

   For development with automatic restart:

   ```bash
   npm run dev
   ```

7. Open **http://localhost:3000** in your browser.

## Administrator login

- Username: `masteradmin@2026`
- Password: `masteradmin`

These are the requested initial local credentials. Change the administrator password before any public deployment. If you change `ADMIN_PASSWORD` after the first run, it does not overwrite an existing admin password in the database; change it through a future admin password feature or reset the local database before initialising again.

## Features

- Login, open signup and logout.
- Username must be exactly six digits and begin with `2`.
- Password must be at least eight characters and contain uppercase, lowercase, a number and a special character.
- Confirm-password validation is performed in both the browser and server.
- Arithmetic CAPTCHA is generated and validated on the server; no OTP is used.
- A successful regular-user login displays exactly: **Welcome to BEL Machilipatnam**.
- Regular users can add inventory items, add stock, remove stock and delete their own items.
- Part Number must contain exactly 10 digits.
- Each user's inventory and transaction history are private to that user.
- Admin dashboard shows overall users, items, active users and stock quantity.
- Admin can view all items, users and stock transactions; block, unblock and remove regular users.
- Activity and authentication/admin audit logs are stored separately.
- Passwords are stored as bcrypt hashes.

## Database and persistence

On first start, the application automatically creates:

`data/item-storage-unit.db`

This SQLite database stores user accounts, password hashes, items, stock quantities, transactions, activity logs, authentication logs, administrator actions and login sessions. The database is stored in the project folder, so records remain after the browser or server is closed and reopened. Login sessions also use a small SQLite-backed Express session store rather than the default in-memory store.

**Do not delete `data/item-storage-unit.db` if you want to keep your records.** Back it up regularly. To reset a local test installation, stop the server and remove the database file; it will be recreated on the next start.

Business records and login sessions are not stored in browser Local Storage; they are persisted in SQLite.

## Project structure

```text
Item-Storage-Unit/
├── data/                         # SQLite database is created here
├── public/
│   ├── index.html                # Main HTML shell
│   ├── styles.css                # BEL-inspired styling
│   └── app.js                    # Browser pages and interactions
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── server.js                     # Express API, validation and SQLite logic
```

## Security and deployment notes

- Use HTTPS, a strong `SESSION_SECRET`, a production-grade persistent session store and database backups before public deployment.
- The requested initial admin password is intentionally simple for the local project handover; do not expose it on a public server.
- Use only synthetic/sample data unless BEL has authorised the use of actual internal inventory information.
- The project is designed as a local standalone application. A local SQLite file is not suitable for multi-instance hosting without a deliberate shared-persistence design.
