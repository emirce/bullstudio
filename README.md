<div align="center">
  <img src="assets/logo.svg" height="100px" />
</div>

<p align="center">
	<h1 align="center"><b>bullstudio</b></h1>
<p align="center">
    Modern queue management for BullMQ.
    <br />
    <br />
    <a href="https://bullstudio.dev">Website</a>
    <a href="https://docs.bullstudio.dev">Docs</a>
    <a href="https://discord.gg/RWhrk4aXze">Discord</a>
  </p>
</p>

---

## What is bullstudio?

bullstudio is a cloud-hosted dashboard that gives you real-time visibility into your Bull and BullMQ job queues. It's built for backend developers and DevOps teams who need to monitor queue health, debug failed jobs, and get alerted before backlogs become outages. Unlike basic Redis GUIs or self-hosted alternatives, bullstudio offers intelligent alerting, multi-environment support, and a polished UI designed for production workflows.

<div align="center">
	<img width="80%" src="https://github.com/user-attachments/assets/63502c4f-06ac-4581-84b4-7b32746d29e2" />
</div>

---

## Tech Stack

| Layer     | Technology                      |
| --------- | ------------------------------- |
| Framework | Next.js 16 (App Router)         |
| Language  | TypeScript                      |
| Styling   | Tailwind CSS + shadcn/ui        |
| API       | tRPC                            |
| Database  | PostgreSQL + Prisma             |
| Auth      | Auth.js (Google, GitHub, Email) |
| Payments  | Polar                           |
| Email     | Resend                          |
| Bg-Jobs   | BullMQ                          |
| Monorepo  | Turborepo + pnpm                |

---

## Features

- **Real-time queue monitoring** - View job counts, throughput, and worker status across all your queues
- **Job management** - Inspect, retry, or delete jobs with filtering by status, name, and timestamp
- **Intelligent alerts** - Get notified on failure spikes, growing backlogs, slow processing times, or missing workers
- **Multi-connection support** - Monitor multiple Redis instances from a single dashboard
- **Team collaboration** - Organizations and workspaces with role-based access control
- **Encrypted credentials** - All Redis connection details stored with AES encryption

---

## Quickstart

### Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL database
- Redis instance to monitor

### 1. Clone and install

```bash
git clone https://github.com/emirce/bullstudio.git
cd bullstudio
pnpm install
```

### 2. Configure environment

```bash
cp .env.example apps/web/.env
cp .env.example apps/workers/.env
```

Fill in the following env vars for the web app (apps/web/.env)

```env
DATABASE_URL=...
ENCRYPTION_KEY=...
AUTH_URL=...
AUTH_SECRET=....
```

And the following ones for the workers app (apps/workers.env)

```env
DATABASE_URL=...
RESEND_API_KEY=...
DATABASE_URL=...
```

### 3. Setup database

```bash
pnpm prisma:generate
pnpm prisma:migrate-dev
```

### 4. Run development workers and web

```bash
pnpm dev -F web -F workers
```

Open [http://localhost:3000](http://localhost:3000) and create your first workspace.

---

## License

bullstudio is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE). You are free to use, modify, and distribute this software, but any modifications or derivative works must also be open-sourced under the same license.
