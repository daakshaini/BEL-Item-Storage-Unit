# BEL Item Storage Unit

A secure, web-based inventory and item storage management application developed independently as part of a 45-day internship project at **Bharat Electronics Limited (BEL)**.

The application helps manage inventory items, track stock movements, maintain transaction history, and provide administrators with tools to manage users and monitor system activities.

## Project Overview

The Item Storage Unit is designed to simplify inventory management through a centralized web application. It provides separate access for administrators and regular users, with role-based functionality and secure authentication.

## Features

### User Features
- User registration and login.
- Secure password validation.
- Server-side CAPTCHA verification.
- Inventory item management.
- Add and remove stock quantities.
- View item details and available stock.
- Track stock transactions and history.
- Secure logout functionality.

### Admin Features
- Dedicated administrator login.
- Admin dashboard.
- View and manage registered users.
- Block and unblock user accounts.
- Delete user accounts.
- Monitor administrative activities.
- View system activity logs.

### Security Features
- Password hashing using bcrypt.
- Session-based authentication.
- Role-based access control.
- Server-side input validation.
- CAPTCHA verification.
- Rate limiting.
- Security headers using Helmet.
- Environment variables for sensitive configuration.
- SQLite database for persistent data storage.

## Technologies Used

| Technology | Purpose |
|---|---|
| HTML5 | Application structure |
| CSS3 | User interface and styling |
| JavaScript | Frontend functionality |
| Node.js | Backend runtime |
| Express.js | Backend framework |
| SQLite | Database |
| bcryptjs | Password hashing |
| express-session | Session management |
| Helmet | Security headers |
| dotenv | Environment configuration |

## Project Structure

```text
BEL-Item-Storage-Unit/
│
├── data/
│   └── .gitkeep
│
├── public/
│   ├── app.js
│   ├── index.html
│   └── styles.css
│
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
└── server.js
```

The SQLite database is generated locally inside the `data` directory and is excluded from GitHub.

## Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/daakshaini/BEL-Item-Storage-Unit.git
```

### 2. Open the Project Folder

```bash
cd BEL-Item-Storage-Unit
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the project root directory.

Use `.env.example` as a reference and configure:

```env
PORT=3000
SESSION_SECRET=your-long-random-secret
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD=your-strong-admin-password
NODE_ENV=development
```

**Important:** Replace the example values with your own secure credentials. Never upload the `.env` file or share actual passwords publicly.

### 5. Start the Application

```bash
npm start
```

### 6. Open in Browser

```text
http://localhost:3000
```

## Admin Configuration

Administrator credentials are configured through environment variables.

- Set the administrator username using `ADMIN_USERNAME`.
- Set the administrator password using `ADMIN_PASSWORD`.
- The application stores password hashes in the database.
- Existing administrator passwords must be updated in the database when credentials are changed.

Never publish administrator credentials in the README or GitHub repository.

## Database

The application uses SQLite for persistent data storage.

The database maintains information related to:

- User accounts
- Inventory items
- Stock transactions
- Activity logs
- Authentication logs
- Administrator actions
- User sessions

Database files and backups should remain private and must not be committed to GitHub.

## Future Enhancements

- Advanced inventory reports.
- Export inventory data to Excel or PDF.
- Low-stock notifications.
- Improved search and filtering.
- Enhanced dashboard analytics.
- Cloud database integration.

## Project Repository

GitHub: https://github.com/daakshaini/BEL-Item-Storage-Unit

## Acknowledgement

I sincerely thank **Bharat Electronics Limited (BEL)** for providing the opportunity to work on this project as part of my 45-day internship.

This project helped me gain practical experience in web application development, backend programming, database management, authentication, and application security.

---

**Project:** Item Storage Unit  
**Organization:** Bharat Electronics Limited (BEL)  
**Project Type:** Inventory Management Web Application  
**Developer:** Independent Project Development