# 🚀 Pulse CRM & Intelligent Outreach Engine

<div align="center">

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node Version](https://img.shields.io/badge/Node-%3E%3D18.0.0-green.svg)
![React Version](https://img.shields.io/badge/React-19.x-61dafb.svg)
![Vite Version](https://img.shields.io/badge/Vite-7.x-646cff.svg)
![MongoDB](https://img.shields.io/badge/Database-MongoDB-47A248.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

**A high-performance, open-source CRM and automated multi-inbox outreach platform designed for agile teams, admissions offices, and sales organizations.**

[Features](#-features) • [Quick Start](#-quick-start) • [Default Accounts](#-default-seed-accounts) • [Architecture](#-architecture) • [Contributing](#-contributing) • [License](#-license)

</div>

---

## 🌟 Overview

**Pulse CRM** combines enterprise lead management with a distributed cold email and multichannel outreach machine. Unlike legacy CRMs, Pulse natively supports:
- **Mass Mailbox Rotation**: Distribute automated campaigns across hundreds of inboxes (Hostinger Agentic Mail API, Google Workspace, Microsoft Outlook 365, or Custom SMTP).
- **Role-Based Mailbox Allocation**: Master Administrators can partition and assign specific pools of inboxes to individual team members or campaigns.
- **Multichannel Touchpoints**: Email campaigns, unified two-way CRM inbox, WhatsApp Web messaging, and automated Cloudflare webhook routing.
- **AI-Powered Scoring**: Automatic lead classification, sentiment analysis, and smart response generation via local Ollama or HuggingFace.

---

## ✨ Features

### 📬 Distributed Multi-Inbox Engine
- **Multi-Provider Support**: Seamlessly connect Hostinger Business Webmail, Google Workspace / Gmail (via App Passwords), Microsoft Outlook 365, Brevo, or custom cPanel/Zoho servers.
- **Hostinger Agentic Mail API Integration**: Direct REST API integration (`https://api.mail.hostinger.com`) with automatic fallback to high-speed SMTP.
- **Smart Round-Robin Rotation**: Evenly distribute campaign volume across dozens or hundreds of mailboxes to safeguard sender domain reputation.
- **Two-Way Reply Sync**: Automatically poll and ingest incoming email replies into the CRM inbox, tagging matching leads as *Hot / Replied*.
- **Admin Inbox Allocation**: Assign specific sets of mailboxes to `admin`, `sales`, or `mail_pedia` roles with strict data isolation.

### 🎯 Intelligent Lead & Pipeline Management
- **Visual Lead Pipeline**: Drag-and-drop Kanban view, tabular data grids, and customizable status pipelines.
- **Bulk Import / Export**: Instant CSV/Excel ingestion with auto-mapping for standard and custom fields.
- **Activity & Timeline Logging**: Granular audit logs tracking every email dispatch, WhatsApp message, status transition, and manual note.

### 🤖 AI Scoring & Automated Workflows
- **Lead Heat Scoring**: AI-driven lead scoring (Hot, Warm, Cold) based on behavioral response and engagement frequency.
- **Local & Cloud LLMs**: Out-of-the-box support for offline local Ollama models (`llama3`, `mistral`) or cloud HuggingFace inference.

### 💬 Multichannel Communications
- **WhatsApp Web Integration**: Scan QR code to trigger direct WhatsApp chats and templates from the lead card.
- **Live WebSocket Telemetry**: Real-time campaign dispatch progress bars, live counter broadcasts, and incoming lead notifications powered by Socket.IO.

---

## 🛠️ Architecture & Tech Stack

```text
┌────────────────────────────────────────────────────────┐
│                   Frontend (Client)                    │
│      React 19 • Vite 7 • React Router 7 • Lucide Icons │
└───────────────────────────▲────────────────────────────┘
                            │ REST APIs & WebSockets
┌───────────────────────────▼────────────────────────────┐
│                    Backend (API)                       │
│        Node.js • Express • Socket.IO • Nodemailer      │
└──────────────┬───────────────────────────┬─────────────┘
               │                           │
┌──────────────▼─────────────┐   ┌─────────▼─────────────┐
│      MongoDB Database      │   │   External Providers  │
│  Leads, Mailboxes, Emails, │   │ • Hostinger Mail API  │
│  Campaigns, Users & Audit  │   │ • Google Workspace    │
└────────────────────────────┘   │ • Microsoft 365       │
                                 │ • WhatsApp Web Engine │
                                 └───────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **MongoDB**: Local MongoDB instance running on `mongodb://127.0.0.1:27017` or a MongoDB Atlas cloud URI.

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/pulse-crm.git
cd pulse-crm
```

### 2. Install Dependencies
Install dependencies across root, backend, and frontend with a single command:
```bash
npm run install:all
```

### 3. Configure Environment Variables
Copy the sample environment file in the `backend/` folder:
```bash
cp backend/.env.example backend/.env
```
Open `backend/.env` and update your settings:
```env
PORT=12000
JWT_SECRET=choose_a_strong_random_secret_key_here
MONGO_URI=mongodb://127.0.0.1:27017/new_crm
```

### 4. Seed the Database
Populate standard roles and administrator accounts:
```bash
npm run seed
```

### 5. Launch the Application
Run both backend and frontend concurrently:
```bash
npm run dev
```

- **Frontend App**: [http://localhost:5173](http://localhost:5173) (or port displayed in terminal)
- **Backend API**: [http://localhost:12000](http://localhost:12000)

---

## 🔑 Default Seed Accounts

After running `npm run seed`, you can immediately sign in with any of the following accounts:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Master Architect** | `master@crm.com` | `master123` | Full unrestricted system access, mailbox allocation, role governance |
| **System Admin** | `admin@crm.com` | `admin123` | User management, lead pipeline management, campaign supervision |
| **Mail Pedia** | `mailpedia@crm.com` | `mailpedia123` | Campaign builder, assigned mailbox manager, email marketing operations |
| **Sales Executive** | `sales@crm.com` | `sales123` | Lead pipeline handling, 1-to-1 follow-ups, WhatsApp communication |

> **Security Note:** Remember to change these default passwords immediately when deploying to a staging or production server!

---

## 📁 Project Structure

```text
pulse-crm/
├── backend/
│   ├── config/              # Database connection & socket configuration
│   ├── middleware/          # JWT authentication & RBAC middleware
│   ├── models/              # Mongoose data schemas (Lead, Mailbox, User, Campaign, Email)
│   ├── routes/              # Express API endpoints (leads, mailboxes, campaigns, auth)
│   ├── scripts/             # Database maintenance and automation tools
│   ├── services/            # Campaign dispatcher, AI scoring, Hostinger Mail API service
│   ├── utils/               # AES-256 password encryption and helpers
│   ├── seed.js              # Initial database seeder
│   └── server.js            # Express app entry point
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components (Navbar, Sidebar, Modals, Filters)
│   │   ├── context/         # Auth, Theme, and Socket context providers
│   │   ├── pages/           # Views (Dashboard, Leads, MailboxManager, Campaigns, Inbox)
│   │   └── App.jsx          # Route declarations & navigation guard
│   └── vite.config.js       # Vite bundler configuration
├── .gitignore               # Multi-layer secret & build isolation
├── CONTRIBUTING.md          # Guidelines for open-source contributors
├── CODE_OF_CONDUCT.md       # Contributor Covenant Code of Conduct
├── LICENSE                  # MIT Open-Source License
└── package.json             # Root monorepo orchestration scripts
```

---

## 🤝 Contributing

Contributions are welcome and highly appreciated! Whether it's adding new features, fixing bugs, or improving documentation:

1. Read our **[Contributing Guidelines](CONTRIBUTING.md)**.
2. Check open issues or create a new one.
3. Fork the repository and create your feature branch:
   ```bash
   git checkout -b feature/amazing-feature
   ```
4. Commit your changes:
   ```bash
   git commit -m "feat: Add automated mailbox health check"
   ```
5. Push to your branch and open a Pull Request.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.
