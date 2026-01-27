# RPS Web Client - AGENTS.md

> Web client for an online rock-paper-scissors game built with Next.js

---

## Project Overview

This project implements the web client for a real-time online rock-paper-scissors game using Next.js.
The server uses Colyseus and is located in `apps/server`.

### Core Tech Stack

| Category | Technology |
|------|------|
| Framework | Next.js |
| Language | TypeScript |
| Animation | Motion (Framer Motion) |
| Server Integration | Colyseus.js Client |
| Package Manager | pnpm |
| Linter/Formatter | Biome |

---

## Design Guidelines

### Color Palette

Use a **monotone (grayscale)** color system.

| Usage | Color |
|------|------|
| Background (Primary) | `#000000` (Black) |
| Background (Secondary) | `#0A0A0A`, `#1A1A1A` |
| Surface | `#262626`, `#333333` |
| Border | `#404040`, `#525252` |
| Text (Primary) | `#FFFFFF` (White) |
| Text (Secondary) | `#A3A3A3`, `#737373` |
| Text (Muted) | `#525252` |

### Animation

Use the **Motion** library actively to create visual effects:

- Page transition animations
- Button hover/tap interactions
- Modal/overlay enter and exit animations
- Loading state indicators
- Game result reveal effects

---

## User Flow

### 1. First Visit (Nickname Input)

```
┌─────────────────────────────┐
│                             │
│      [ Enter Nickname ]     │
│      [    Start     ]       │
│                             │
└─────────────────────────────┘
```

- No login or sign-up flow
- Uses a temporary session-based nickname
- The nickname is stored in local storage and can persist across revisits

### 2. Main Screen

``` 
┌─────────────────────────────┐
│                             │
│      [ 🎮 Quick Match ]     │
│                             │
│      [ 🏠 Private Room ]    │
│                             │
└─────────────────────────────┘
```

#### Quick Match

- Join the automatic matchmaking queue when the button is clicked
- Start the game once an opponent is matched

#### Private Room

Provides two scenarios:

**Scenario A: Create Room**

1. Click the `Create Room` button
2. Generate and display a 6-digit numeric code
3. Wait for the opponent to join, then show their information
4. The host clicks `Start Game` to begin

```
┌─────────────────────────────┐
│      Room Created           │
│                             │
│      [ 1 2 3 4 5 6 ]        │
│                             │
│      Waiting...             │
│    ─────────────────        │
│    👤 Player2 Connected     │
│                             │
│      [ 🎮 Start Game ]      │
└─────────────────────────────┘
```

**Scenario B: Join Room**

1. Click the `Join Room` button
2. Enter the 6-digit numeric code
3. Attempt to join the room
   - Success: show the host's information and wait for the game to start
   - Failure: show an error message if the room does not exist or is full
4. Start the game when the host begins

```
┌─────────────────────────────┐
│    Enter Room Code          │
│                             │
│    [ _ _ _ _ _ _ ]          │
│                             │
│    👤 Host: Player1         │
│                             │
│    Waiting for game start...│
└─────────────────────────────┘
```

### 3. Game Screen

```
┌─────────────────────────────┐
│  Opponent: ???              │
│                             │
│        vs                   │
│                             │
│  [ ✊ ] [ ✋ ] [ ✌️ ]        │
│                             │
│  Time Left: 5s              │
└─────────────────────────────┘
```

---

## Screen Map

| Route | Screen | Description |
|------|------|------|
| `/` | Nickname Input | Set the nickname on first visit |
| `/lobby` | Main Lobby | Choose Quick Match or Private Room |
| `/room/create` | Create Room | Show the 6-digit code and wait |
| `/room/join` | Join Room | Enter the 6-digit code |
| `/room/[roomId]` | Waiting Room | Waiting screen before the game starts |
| `/game/[roomId]` | Game | Real-time gameplay |

---

## Error Handling

| Situation | Example Message |
|------|-------------|
| Room not found | "No room was found for that code." |
| Room full | "The room is full." |
| Connection lost | "The connection to the server was lost." |
| Opponent left | "Your opponent left the game." |

---

## Server Integration

Use the `colyseus.js` client to connect to the Colyseus server.

```typescript
import { Client } from "colyseus.js";

const client = new Client("ws://localhost:2567");

// Create a room
const room = await client.create("rps_room", { nickname: "Player1" });

// Join a room
const room = await client.joinById(roomId, { nickname: "Player2" });
```

---

## Development Setup

### Run the Development Server

```bash
pnpm dev
```

The development server runs at `http://localhost:3000`.

### Build

```bash
pnpm build
```

### Main Scripts

| Command | Description |
|--------|------|
| `pnpm dev` | Run the development server |
| `pnpm build` | Create a production build |
| `pnpm start` | Run the production server |
| `pnpm lint` | Run lint checks |

---

## Notes

- The authentication system is planned for later; for now, only temporary nicknames are used
- Port configuration: the Colyseus server uses `2567`, and the web client uses `3000`
- Private Room codes consist of 6 digits
