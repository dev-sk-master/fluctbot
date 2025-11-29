# Quick Start Guide

## Installation

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Start PostgreSQL (using Docker)
docker-compose up -d

# Start development server
pnpm run start:dev
```

## Environment Setup

Create a `.env` file in the root directory with the following variables:

```env
APP_NAME=FluctBot
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1
CORS_ORIGINS=http://localhost:3000

DB_HOST=localhost
DB_PORT=5433
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=fluctbot
DB_SSL=false

LOG_LEVEL=debug

SWAGGER_ENABLED=true
SWAGGER_PATH=api/docs
```

## Access Points

- **API**: http://localhost:3000/api/v1
- **Swagger Docs**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/v1/health

## Example API Calls

### Get all users
```bash
curl http://localhost:3000/api/v1/users
```

### Create a user
```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","name":"John Doe"}'
```

### Get user by ID
```bash
curl http://localhost:3000/api/v1/users/{id}
```

## Project Structure Overview

- `src/common/` - Shared utilities, decorators, filters, interceptors
- `src/config/` - Configuration modules
- `src/database/` - Database setup
- `src/health/` - Health check endpoints
- `src/users/` - Example feature module

## Next Steps

1. Review the architecture in `ARCHITECTURE.md`
2. Check `CONTRIBUTING.md` for development guidelines
3. Explore the example `users` module
4. Add your own feature modules following the same pattern

