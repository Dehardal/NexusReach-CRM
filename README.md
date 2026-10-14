<div align="center">

# ⚡ NexusReach CRM
### *The Open-Source Multichannel CRM & High-Volume Outreach Engine*

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React 19](https://img.shields.io/badge/React-19.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite 7](https://img.shields.io/badge/Vite-7.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg?style=for-the-badge)](CONTRIBUTING.md)

<p align="center">
  <b>A self-hosted, scalable alternative to HubSpot, Lemlist, and Smartlead.</b><br>
  Manage your entire lead lifecycle, rotate hundreds of sender mailboxes with smart round-robin distribution, automate WhatsApp outreach, and sync two-way replies with AI classification.
</p>

[Quick Start](#-quick-start-in-3-minutes) • [Why NexusReach?](#-why-nexusreach-vs-commercial-alternatives) • [Features](#-core-capabilities) • [Architecture](#-architecture) • [Roadmap](#-public-roadmap--contributing) • [License](#-license)

---

</div>

## 💡 Why NexusReach? (vs. Commercial Alternatives)

Commercial tools charge hundreds of dollars per seat and severely limit mailbox connections, contact tiers, and outreach volumes. **NexusReach CRM is 100% free, open-source, and self-hosted.**

| Feature | NexusReach CRM | Lemlist / Smartlead | HubSpot CRM |
| :--- | :---: | :---: | :---: |
| **Pricing** | **100% Free & Open-Source** | $59 - $200+/month | $50 - $800+/month |
| **Connected Mailboxes** | **Unlimited** | Tiered / Extra cost | Limited |
| **Hostinger Agentic Mail API** | **Native Built-in** | ❌ No | ❌ No |
| **Google / Outlook / Custom SMTP** | **Seamless Round-Robin** | SMTP only | Manual setup |
| **WhatsApp Web Outreach** | **Built-in Web Engine** | ❌ No | Paid add-ons |
| **Data Ownership** | **100% Self-Hosted (MongoDB)** | Vendor cloud | Vendor cloud |
| **AI Scoring & Responses** | **Local Ollama / Free HuggingFace** | Paid add-on | Paid add-on |
| **Role-Based Mailbox Allocation** | **Granular (Admin / Mail Pedia)** | Limited | Enterprise tier only |

---

## 🌟 Core Capabilities

### 📬 1. Distributed Mass Mailbox Pool & Smart Rotation
- **Multi-Provider Unification**: Connect Hostinger Business Webmail, Google Workspace / Gmail (via App Passwords), Microsoft Outlook 365, Brevo, or custom cPanel/Zoho SMTP servers in a single pool.
- **Hostinger Agentic Mail API**: Direct integration with Hostinger’s modern Agentic Mail endpoints (`https://api.mail.hostinger.com`) with instant fallback to standard high-speed SMTP.
- **Round-Robin Load Balancing**: Campaigns rotate sequentially across all assigned mailboxes to protect domain reputation and maximize deliverability.
- **Dynamic Capacity Tracking**: Live sent counters, daily dispatch limits, and real-time failure alerts.
- **Two-Way Reply Ingestion**: Automatically poll and ingest incoming email responses into the CRM inbox, instantly auto-tagging leads as *Hot / Replied*.

### 🎯 2. Visual Lead Pipeline & Smart Data Hub
- **Interactive Kanban Pipeline**: Drag-and-drop lead stages (`New`, `Contacted`, `Engaged`, `Converted`, `Archived`).
- **Data Table with Filters**: Instant sorting, search across custom fields, stage tags, and assignees.
- **Zero-Friction CSV/Excel Import**: High-volume ingestion engine with intelligent column mapping.
- **Audit Timeline**: Every email dispatched, status update, note, and WhatsApp message is logged in a permanent activity history.

### 👥 3. Multi-User Governance & Mailbox Assignment
- **Master Architect Role**: Full system visibility, user lifecycle management, and global mailbox delegation.
- **Role-Based Access Control (RBAC)**: Partition system into `admin`, `sales`, and `mail_pedia` roles.
- **Targeted Inbox Allocation**: Select specific mailboxes from the pool and assign them exclusively to specific team members or campaigns.

### 💬 4. WhatsApp Web & Multichannel Communication
- **WhatsApp Web Integration**: Scan QR code to launch direct chats, conversation threads, and template messages directly from lead profiles.
- **Unified Two-Way Inbox**: Read and respond to emails from all connected providers within the CRM without switching tabs.

### 🤖 5. AI-Assisted Lead Intelligence
- **Heat Scoring (Hot / Warm / Cold)**: Automatically calculate lead priority based on engagement signals.
- **Smart Response & Drafting**: Integrates with local offline LLMs via **Ollama** (`llama3`, `mistral`) or cloud **HuggingFace** inference for response generation.

### ⚡ 6. Real-Time Telemetry & WebSockets
- **Live Dispatch Visualizer**: Real-time progress bars and socket broadcasts as campaigns process leads.
- **Instant System Alerts**: Live toast notifications for incoming replies and campaign completions.

---

## 🏗️ Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (Single Page App)                  │
│       React 19 • Vite 7 • React Router 7 • Lucide Icons         │
│          Vanilla CSS System (Zero Heavy Framework Bloat)        │
└────────────────────────────────▲────────────────────────────────┘
                                 │ REST APIs & WebSockets
┌────────────────────────────────▼────────────────────────────────┐
│                    Backend Server (Node / Express)              │
│       JWT Auth • Mongoose ODM • Nodemailer • Socket.IO Engine   │
└──────────────┬──────────────────────────────────┬───────────────┘
               │                                  │
┌──────────────▼────────────────┐    ┌────────────▼───────────────┐
│       MongoDB Database        │    │    External Services       │
│ • Leads & Custom Fields       │    │ • Hostinger Mail REST API  │
│ • Encrypted Mailbox Vault     │    │ • Google & Outlook SMTP    │
│ • Campaigns & Email Logs      │    │ • WhatsApp Web Engine      │
│ • Users & RBAC Audit History  │    │ • Ollama / HuggingFace AI  │
└───────────────────────────────┘    └────────────────────────────┘
```

---

## ⚡ Quick Start (in 3 Minutes)

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **MongoDB**: Local MongoDB instance (`mongodb://127.0.0.1:27017`) or free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) URI

### 1. Clone & Install Dependencies
```bash
# Clone the repository
git clone https://github.com/your-username/nexusreach-crm.git
cd nexusreach-crm

# Install dependencies across root, backend, and frontend in 1 step
npm run install:all
```

### 2. Configure Environment Variables
```bash
cp backend/.env.example backend/.env
```
*(Open `backend/.env` to configure your `JWT_SECRET` and `MONGO_URI` if different from local)*

### 3. Seed Default Admin & Team Accounts
```bash
npm run seed
```

### 4. Launch Development Server
```bash
npm run dev
```

- **Frontend Client**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:12000](http://localhost:12000)

---

## 🔑 Default Seed Accounts

Running `npm run seed` creates ready-to-test accounts for every role:

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Master Architect** | `master@crm.com` | `master123` | Complete system control, mailbox allocation, role management |
| **System Admin** | `admin@crm.com` | `admin123` | Pipeline administration, campaign launch, user assignment |
| **Mail Pedia** | `mailpedia@crm.com` | `mailpedia123` | Dedicated campaign management & assigned mailbox operations |
| **Sales Executive** | `sales@crm.com` | `sales123` | Lead pipeline handling, 1-to-1 inbox follow-ups, WhatsApp |

> 🔒 *Security reminder: Change these passwords before deploying to a public server!*

---

## ⚙️ Environment Configuration

| Variable | Description | Default | Required? |
| :--- | :--- | :--- | :---: |
| `PORT` | Backend server port | `12000` | No |
| `NODE_ENV` | Environment mode (`development` / `production`) | `development` | No |
| `JWT_SECRET` | Secret key for JWT auth tokens | *Random String* | **Yes** |
| `MONGO_URI` | MongoDB connection URL | `mongodb://127.0.0.1:27017/new_crm` | **Yes** |
| `HOSTINGER_MAIL_API_KEY` | Hostinger Agentic Mail API Token | *(Empty)* | Optional |
| `HOSTINGER_DOMAIN` | Default domain for Hostinger API | *(Empty)* | Optional |
| `EMAIL_USER` | Fallback SMTP email for notifications | *(Empty)* | Optional |
| `EMAIL_PASS` | Fallback SMTP password | *(Empty)* | Optional |
| `OLLAMA_URL` | Local Ollama endpoint for AI scoring | `http://localhost:11434/api/generate` | Optional |
| `HUGGING_FACE_TOKEN` | Free HuggingFace inference API token | *(Empty)* | Optional |

---

## 🗺️ Public Roadmap & Contributing

We welcome open-source contributions! Here is what we're working on next:

- [x] Multi-mailbox round-robin campaign rotation
- [x] Hostinger Agentic Mail API direct integration
- [x] Role-based mailbox assignment (`admin`, `mail_pedia`)
- [x] Two-way incoming reply synchronization
- [x] **Dark / Light Theme Toggle**: Seamless UI theme switcher with persistent preference
- [ ] **Multi-Language Support (i18n)**: Localization for Spanish, French, German, and Hindi.
- [ ] **Browser Extension**: Quick lead capture extension for LinkedIn & web directories.

### How to Contribute
1. Fork the repo & create your branch: `git checkout -b feature/cool-feature`
2. Follow our **[Contributing Guidelines](CONTRIBUTING.md)** and **[Code of Conduct](CODE_OF_CONDUCT.md)**.
3. Commit with conventional commit messages (`feat: ...`, `fix: ...`).
4. Open a Pull Request against `main`.

---

## 📄 License

NexusReach CRM is open-source software licensed under the **[MIT License](LICENSE)**.

<div align="center">
  <sub>Built with ❤️ by open-source creators worldwide. Star ⭐ this repository if you find it helpful!</sub>
</div>
