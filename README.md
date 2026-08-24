# 🏴‍☠️ One Piece RPG: Ship VS Ship Multiplayer Battle Simulator

A real-time, lobby-based multiplayer tactical naval combat application inspired by the One Piece universe. Players can create private battle lobbies, configure and outfit their pirate flagships, position secret engines, shields, weapons, and repair kits, and engage in server-authoritative 1d6 tactical battles with live WebSockets.

---

## ⚡ Features

- **No User Registration or Accounts**: Completely lobby-based. Instant lobby creation, invite links, and Lobby Codes.
- **Ship Outfitting & Arsenal**:
  - 16 total ships (11 combat hulls + 5 utility vessels) with customizable weapon slots (4 to 10 slots).
  - 8 distinct naval weapons with authentic stats, range, HP, and damage.
  - **🔥 Concealed Engine Core**: Position your secret engine anywhere on your ship. Destroying the enemy engine results in immediate victory.
  - **🛡️ Iron Naval Shield**: Protect any slot (weapon or engine) with 50 shield HP.
  - **🛠️ Ship Inventory & Repair Kits**: Drag & drop emergency repair kits (+25 HP) into your crew backpack to repair damaged operational weapons or engine in combat.
- **Authoritative Turn-Based Combat Engine**:
  - Server-authoritative **1d6 dice rolls** with damage multipliers ($1=50\%, 2=75\%, 3=90\%, 4=100\%, 5=125\%, 6=150\%$).
  - **Fog of War / Hidden Information**: Opponent only learns of damage dealt without revealing engine or weapon identities until engine destruction.
  - Misses on empty positions deal **0 Damage**.
- **Real-Time WebSockets**: Live synchronized game state, broadside animations, interactive 3D dice rolls, and sound synthesizer.
- **Admin Spectator Mode**: Full unmasked dual-ship view with live battle moderation tools.
- **Battle History & Replay**: Permanent battle archive with turn-by-turn replay timeline.

---

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Lucide Icons, Canvas Confetti, Web Audio API Sound Synthesizer.
- **Backend**: Node.js, Express, Socket.IO.
- **Database**: SQLite via `better-sqlite3`.
- **Testing**: Automated backend test suite.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
npm --prefix client install
```

### 2. Run in Development Mode
```bash
npm run dev
```

### 3. Build & Run Production Server
```bash
npm run build
npm start
```
The application will be accessible at `http://localhost:3001`.

### 4. Run Automated Test Suite
```bash
npm test
```
