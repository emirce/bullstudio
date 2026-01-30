<p align="center">
  <img src="public/logo.svg" alt="bullstudio" width="120" />
</p>

<h1 align="center">bullstudio CLI</h1>

<p align="center">
  A lightweight, beautiful queue management dashboard for <a href="https://docs.bullmq.io/">BullMQ</a>.<br/>
  Monitor your queues, inspect jobs, visualize flows, and manage your Redis-backed job infrastructure.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/BullMQ-5.x-orange" alt="BullMQ" />
  <img src="https://img.shields.io/badge/React-19-blue" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue" alt="TypeScript" />
</p>

---


<div align="center">
<img width="80%" src="https://github.com/user-attachments/assets/b5eea348-5919-40ff-ad55-3a0387dbec47" />
</div>


## Quick Start

```bash
npx bullstudio -r <redis_url>
```

That's it! The dashboard opens automatically at [http://localhost:4000](http://localhost:4000). No code integration needed.

---

## Installation

### Run directly with npx (recommended)

```bash
npx bullstudio
```

### Or install globally

```bash
npm install -g bullstudio
bullstudio
```

---

## Usage

```bash
bullstudio [options]
```

### Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--redis <url>` | `-r` | Redis connection URL | `redis://localhost:6379` |
| `--port <port>` | `-p` | Port to run the dashboard on | `4000` |
| `--no-open` | | Don't open browser automatically | Opens browser |
| `--help` | `-h` | Show help message | |

---

## Examples

### Connect to local Redis

```bash
bullstudio
```

### Connect to a remote Redis server

```bash
bullstudio -r redis://myhost.com:6379
```

### Connect with authentication

```bash
bullstudio -r redis://:yourpassword@myhost.com:6379
```

### Use a custom port

```bash
bullstudio -p 5000
```

### Connect to Redis with username and password

```bash
bullstudio -r redis://username:password@myhost.com:6379
```

### Run without opening browser

```bash
bullstudio --no-open
```

### Combine options

```bash
bullstudio -r redis://:secret@production.redis.io:6379 -p 8080 --no-open
```

---

## Features

### Overview Dashboard
Get a bird's-eye view of your queue health with real-time metrics, throughput charts, and failure tracking.

### Jobs Browser
- Browse all jobs across queues
- Filter by status (waiting, active, completed, failed, delayed)
- Search jobs by name, ID, or data
- Retry failed jobs with one click
- View detailed job data, return values, and stack traces

### Flows Visualization
- Visualize parent-child job relationships as interactive graphs
- See the live state of each job in the flow
- Click nodes to navigate to job details
- Auto-refresh while flows are active

---

## Requirements

- **Node.js** 18 or higher
- **Redis** server running (local or remote)
- **BullMQ** queues in your Redis instance

---

## Environment Variables

You can also configure bullstudio using environment variables:

```bash
export REDIS_URL=redis://localhost:6379
export PORT=4000
bullstudio
```

Command-line options take precedence over environment variables.

---

## Troubleshooting

### "Connection refused" error

Make sure Redis is running:

```bash
# Check if Redis is running
redis-cli ping

# Start Redis (macOS with Homebrew)
brew services start redis

# Start Redis (Docker)
docker run -d -p 6379:6379 redis
```

### No queues showing up

bullstudio discovers queues by scanning for BullMQ metadata keys in Redis. Make sure:
1. Your application has created at least one queue
2. You're connecting to the correct Redis instance
3. If using a prefix other than `bull`, your queues use the default prefix

### Port already in use

Use a different port:

```bash
bullstudio -p 5000
```

---

## License

MIT

---

<p align="center">
  Made with love for the BullMQ community
</p>
