<div align="center">

# 🏥 PHC Smart Manager

**A smart dashboard for tracking medical supplies, inventory, and staff attendance at rural Primary Health Centres (PHCs).**

[![TypeScript](https://img.shields.io/badge/TypeScript-94.7%25-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Built%20with-Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Gemini API](https://img.shields.io/badge/AI-Gemini-8E75B2?logo=google&logoColor=white)](https://ai.google.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Open Issues](https://img.shields.io/github/issues/samikshakalra02/PHC-Smart-Manager)](https://github.com/samikshakalra02/PHC-Smart-Manager/issues)
[![Last Commit](https://img.shields.io/github/last-commit/samikshakalra02/PHC-Smart-Manager)](https://github.com/samikshakalra02/PHC-Smart-Manager/commits/main)

[Features](#-features) •
[Tech Stack](#-tech-stack) •
[Getting Started](#-getting-started) •
[Usage](#-usage) •
[Roadmap](#-roadmap) •
[Contributing](#-contributing)

</div>

---

## 📖 Table of Contents

- [About](#-about)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the App](#running-the-app)
- [Usage](#-usage)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)
- [Contact](#-contact)

---

## 🩺 About

**PHC Smart Manager** replaces paper registers at rural Primary Health Centres with a single live dashboard. Frontline staff log updates in plain language, and the app takes care of turning that into structured, trackable data — so health officers always know what's in stock and who's on duty, without waiting for a monthly report.

## ✨ Features

| Feature | Description |
|---|---|
| 📊 **Dashboard Overview** | Real-time tracking of medicine quantities (e.g. Paracetamol, Anti-Venom) |
| 👩‍⚕️ **Staff Attendance** | Live view of active medical officer rosters |
| 🤖 **AI Report Parser** | Powered by Gemini — turns conversational notes into structured inventory data |
| 🗺️ **Smart Maps** | Geolocation with automatic fallback to the Mangaluru hub if browser sandboxing blocks GPS |

## 🛠 Tech Stack

- **Frontend:** TypeScript, Vite
- **Backend:** Node.js (`server.ts`)
- **AI:** Google Gemini API (report parsing)
- **Markup:** HTML5

## 📁 Project Structure

```
PHC-Smart-Manager/
├── .env.example        # Sample environment variables
├── index.html           # App entry point
├── metadata.json         # App metadata
├── package.json          # Dependencies & scripts
├── server.ts             # Backend server
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts          # Vite build configuration
└── README.md
```

> 💡 As the app grows, consider moving frontend source files into a dedicated `src/` directory (e.g. `src/components`, `src/lib`, `src/types`) to keep the root clean and make the codebase easier to navigate.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A [Google Gemini API key](https://ai.google.dev/)

### Installation

```bash
# Clone the repository
git clone https://github.com/samikshakalra02/PHC-Smart-Manager.git
cd PHC-Smart-Manager

# Install dependencies
npm install
```

### Environment Variables

Copy the example file and add your credentials:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Your Google Gemini API key, used to parse field notes into structured data |

### Running the App

```bash
npm run dev
```

The app will be available at `http://localhost:5173` (default Vite port).

## 📋 Usage

1. Log in as PHC staff and enter a plain-language update (e.g. *"Used 12 ORS packets, 3 patients seen today"*).
2. The AI Report Parser converts it into structured inventory and attendance data.
3. View live stock levels, staff rosters, and centre location on the dashboard.
4. Health officers can monitor multiple centres from a single view.

## 🗺 Roadmap

- [ ] Add automated tests for the AI report parser
- [ ] Add authentication & role-based access (staff vs. officer)
- [ ] Multi-centre comparison view
- [ ] Low-stock alerts & notifications
- [ ] CI pipeline (lint + type-check on PRs)

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## 📬 Contact

**Shivanshu Pandey** — [GitHub](https://github.com/shivanshu23625)

Project Link: [https://github.com/samikshakalra02/PHC-Smart-Manager](https://github.com/samikshakalra02/PHC-Smart-Manager)
