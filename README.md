# SyncDoc

Collaborative document engine with AST conflict resolution, built for real-time multi-user editing.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, DOMPurify |
| Backend | Node.js, Express.js, worker_threads |
| Database | MongoDB (Mongoose), Redis (ioredis) |
| Real-Time | Socket.io, Yjs (CRDT) |
| Auth | JWT, RSA-256 asymmetric cryptography |

## Project Structure

```
syncdoc/
├── client/          # React + TypeScript frontend
│   └── src/
│       ├── components/blocks/   # AST block renderers
│       ├── pages/               # Document browser & editor
│       └── styles/              # Tailwind globals
├── server/          # Node.js + Express backend
│   └── src/
│       ├── config/              # MongoDB, Redis, crypto
│       ├── middleware/          # JWT auth middleware
│       ├── models/              # Mongoose AST schemas
│       ├── routes/              # REST API endpoints
│       └── __tests__/           # Vitest test suites
├── shared/          # Shared types & utilities
│   ├── types/                   # TypeScript interfaces
│   └── utils/                   # Pure utility functions
└── package.json     # Workspace root
```

## Getting Started

### Prerequisites

- Node.js >= 20
- MongoDB running locally or connection string
- Redis running locally or connection string

### Installation

```bash
# Install pnpm if not already installed
npm install -g pnpm

# Install all dependencies
pnpm install

# Build shared types
pnpm build:shared
```

### Development

```bash
# Start both server and client
pnpm dev

# Or individually
pnpm dev:server   # Express on :3001
pnpm dev:client   # Vite on :5173
```

### Environment Variables

Create `server/.env`:

```env
PORT=3001
MONGO_URI=mongodb://localhost:27017/syncdoc
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
CORS_ORIGIN=http://localhost:5173
```

### Testing

```bash
# Run server tests
pnpm test

# Run typechecks
pnpm typecheck
```

## API Endpoints

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login |
| POST | /api/auth/refresh | Refresh access token |

### Documents

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/documents | List user's documents |
| GET | /api/documents/:id | Get document with AST |
| POST | /api/documents | Create new document |
| PUT | /api/documents/:id | Update document |
| DELETE | /api/documents/:id | Delete document |

## AST Node Types

| Type | Children | Description |
|------|----------|-------------|
| `paragraph` | No | Block text content |
| `heading` | No | H1-H6 via `metadata.level` |
| `code_block` | No | Syntax-highlighted code |
| `list_item` | Yes | Nested list items |

## Evaluation Criteria

- [ ] Sub-5ms MongoDB/Redis query times under stress
- [ ] 60 FPS viewport processing (RequestAnimationFrame)
- [ ] 10 concurrent client stress test with zero conflicts
- [ ] Zero `any` in TypeScript
- [ ] Zero XSS vulnerabilities (DOMPurify enforced)
- [ ] Clean monorepo with README.md
