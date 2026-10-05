# Contributing to Pulse CRM

First off, thank you for considering contributing to Pulse CRM! 🎉 It's people like you that make open-source software a powerful tool for everyone.

Following these guidelines helps keep our codebase maintainable, secure, and easy for new developers to navigate.

---

## 🧭 Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

---

## 🛠️ How Can I Contribute?

### 1. Reporting Bugs
- Ensure the bug was not already reported by searching on GitHub under [Issues](https://github.com/your-username/pulse-crm/issues).
- If you're unable to find an open issue addressing the problem, open a new one using our **Bug Report** template.
- Include a clear title and description, as much relevant information as possible, and a code sample or an executable test case demonstrating the expected vs actual behavior.

### 2. Suggesting Enhancements
- Open a feature request issue describing the feature, why it is needed, and any architectural thoughts you have.
- Discuss your proposal with the community before investing significant development time.

### 3. Submitting Pull Requests
1. **Fork the repo** and create your branch from `main`:
   ```bash
   git checkout -b feature/my-new-feature
   ```
2. **Install dependencies**:
   ```bash
   npm run install:all
   ```
3. **Make your changes**:
   - Write clean, readable code with descriptive variable and function names.
   - Respect our existing architectural patterns:
     - Sensitive credentials (e.g. SMTP passwords) **MUST** be encrypted via AES-256 (`backend/utils/crypto.js`).
     - Real-time updates should emit through Socket.IO handlers.
     - Never log raw passwords, JWT tokens, or API keys to the console or log files.
4. **Test your changes**:
   - Verify frontend compiles without errors:
     ```bash
     npm run build:frontend
     ```
   - Test endpoints and database interactions.
5. **Commit your changes**:
   - We follow standard [Conventional Commits](https://www.conventionalcommits.org/):
     - `feat: Add webhook listener for Brevo bounces`
     - `fix: Resolve pagination issue on lead grid`
     - `docs: Update API endpoint reference in README`
6. **Push to your fork and submit a Pull Request** against the `main` branch.

---

## 🔒 Security Vulnerabilities

If you discover a security vulnerability within Pulse CRM, please do **NOT** open a public issue. Instead, report it privately to the maintainers via email or GitHub Private Vulnerability Reporting so that it can be patched before public disclosure.

---

## 💡 Code Style & Conventions

- **JavaScript / React**: Standard modern ES6+, functional React components with hooks.
- **Styling**: Vanilla CSS and CSS custom properties (tokens) in `index.css` for optimal speed and zero build overhead.
- **Backend**: Express modular routers (`backend/routes/`), Mongoose schemas with validation, and centralized error handling in `backend/server.js`.

Thank you for helping make Pulse CRM better! 🚀
