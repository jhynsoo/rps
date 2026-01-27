# RPS Server - AGENTS.md

> An online Rock Paper Scissors game built with Colyseus

---

## Project Overview

This project implements a real-time online Rock Paper Scissors game using the
Colyseus multiplayer game framework.

### Core Tech Stack

| Category | Technology |
|------|------|
| Runtime | Node.js >= 20.9.0 |
| Language | TypeScript |
| Game Server | Colyseus 0.16.x |
| HTTP Server | Express.js |
| Package Manager | pnpm |
| Linter/Formatter | Biome |
| Testing | Mocha + @colyseus/testing |

---

## Directory Structure

```
server/
├── src/
│   ├── index.ts              # Server entry point
│   ├── app.config.ts         # Colyseus and Express configuration
│   └── rooms/
│       ├── MyRoom.ts         # Room handler (game logic)
│       └── schema/
│           └── MyRoomState.ts  # Synchronized state schema
├── test/
│   └── MyRoom_test.ts        # Room tests
├── loadtest/                 # Load tests
├── biome.json               # Biome configuration
├── tsconfig.json            # TypeScript configuration
└── package.json
```

---

## Development Setup

### Prerequisites

- Node.js >= 20.9.0 (see `.nvmrc`)
- pnpm installed

### Install Dependencies

```bash
pnpm install
```

### Run the Development Server

```bash
pnpm start
```

The server runs on port `2567` by default.

- **Playground**: <http://localhost:2567> (enabled only in development)
- **Monitor**: <http://localhost:2567/monitor>

---

## Key Scripts

| Command | Description |
|--------|------|
| `pnpm start` | Run the development server (using `tsx watch`) |
| `pnpm build` | Build for production |
| `pnpm test` | Run tests |
| `pnpm loadtest` | Run load tests |

---

## Colyseus Architecture Guide

### 1. Room (Game Room)

A Room is the core class that manages a game session.

**Location**: `src/rooms/MyRoom.ts`

```typescript
import { Room, Client } from "@colyseus/core";

export class MyRoom extends Room<MyRoomState> {
  maxClients = 2;  // Rock Paper Scissors is a 2-player game
  
  onCreate(options: any) { /* When the room is created */ }
  onJoin(client: Client, options: any) { /* When a player joins */ }
  onLeave(client: Client, consented: boolean) { /* When a player leaves */ }
  onDispose() { /* When the room is disposed */ }
}
```

### 2. Schema (State Schema)

A Schema defines the state that is automatically synchronized between the server
and clients.

**Location**: `src/rooms/schema/MyRoomState.ts`

```typescript
import { Schema, type } from "@colyseus/schema";

export class MyRoomState extends Schema {
  @type("string") gameStatus: string;
  // Define player, choice, result, and related state here
}
```

### 3. Message Handling

Communication between the client and server happens through messages.

```typescript
// Server: receive message
this.onMessage("choice", (client, choice) => {
  // Handle rock/paper/scissors selection
});

// Server: send message
this.broadcast("result", { winner: "player1" });
```

---

## Rock Paper Scissors Game Logic Guide

### Game Flow

1. **Waiting**: Wait for two players to join
2. **Choosing**: Both players submit their choices
3. **Result**: Determine the winner and send the result
4. **Restart**: Start a new round or end the game

### Example State Schema Design

```typescript
class Player extends Schema {
  @type("string") sessionId: string;
  @type("string") choice: string;  // rock, paper, scissors
  @type("boolean") ready: boolean;
}

class MyRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("string") gameStatus: string;  // waiting, choosing, result
  @type("string") winner: string;
}
```

### Message Types

| Message | Direction | Description |
|--------|------|------|
| `choice` | Client → Server | Player choice (`rock`, `paper`, or `scissors`) |
| `ready` | Client → Server | Ready for the next round |
| `countdown` | Server → Client | Game start countdown |
| `result` | Server → Client | Round result |

---

## Code Style

This project uses Biome to manage code style.

- **Indentation**: 2 spaces
- **Line width**: 100 characters
- **Quotes**: Double quotes

### Run Lint/Format

```bash
pnpm exec biome check --write .
```

---

## Testing

Use `@colyseus/testing` to test Room logic.

**Location**: `test/` directory

```typescript
import { ColyseusTestServer, boot } from "@colyseus/testing";

describe("RPS Game", () => {
  let colyseus: ColyseusTestServer;
  
  before(async () => colyseus = await boot(appConfig));
  after(async () => colyseus.shutdown());
  
  it("should determine winner correctly", async () => {
    const room = await colyseus.createRoom<MyRoomState>("my_room", {});
    // Test logic
  });
});
```

### Run Tests

```bash
pnpm test
```

---

## Deployment

### Build

```bash
pnpm build
```

The build output is generated in the `build/` directory.

### Run with PM2

```bash
pm2 start ecosystem.config.cjs
```

---

## Environment Variables

| Variable | Description | Default |
|------|------|--------|
| `PORT` | Server port | 2567 |
| `NODE_ENV` | Environment mode | development |

---

## References

- [Colyseus Official Documentation](https://docs.colyseus.io/)
- [Colyseus Schema](https://docs.colyseus.io/state/schema/)
- [Colyseus Testing](https://docs.colyseus.io/tools/unit-testing/)
