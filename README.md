# FluctBot - Production-Grade NestJS Application

A production-ready NestJS application built with best practices, featuring modular architecture, comprehensive error handling, logging, validation, and security.

## Features

- ✅ **Modular Architecture** - Well-organized folder structure with feature modules
- ✅ **Configuration Management** - Environment-based configuration with validation
- ✅ **Logging** - Winston-based logging with daily rotation
- ✅ **Error Handling** - Global exception filters with proper error responses
- ✅ **Validation** - Class-validator with DTOs
- ✅ **API Documentation** - Swagger/OpenAPI integration
- ✅ **Security** - Helmet, CORS, and security best practices
- ✅ **Health Checks** - Application and database health monitoring
- ✅ **Database** - TypeORM integration with PostgreSQL
- ✅ **Interceptors** - Logging, transformation, and timeout handling
- ✅ **Middleware** - Request logging and CORS
- ✅ **TypeScript** - Strict type checking and modern ES features

## Project Structure

```
src/
├── common/              # Shared modules, decorators, DTOs
│   ├── decorators/     # Custom decorators
│   ├── dto/           # Shared DTOs
│   ├── filters/       # Exception filters
│   ├── interceptors/  # Request/response interceptors
│   ├── logger/        # Winston logger service
│   └── middleware/    # Custom middleware
├── config/            # Configuration modules
├── database/          # Database configuration
├── health/            # Health check endpoints
├── users/             # Example feature module
│   ├── dto/          # Data transfer objects
│   ├── entities/     # TypeORM entities
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── users.module.ts
├── app.module.ts      # Root module
├── app.controller.ts  # Root controller
├── app.service.ts     # Root service
└── main.ts           # Application entry point
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- pnpm (or npm/yarn)
- PostgreSQL (for database)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Copy environment file:
   ```bash
   cp .env.example .env
   ```

4. Update `.env` with your configuration values

5. Start the database (if using Docker):
   ```bash
   docker-compose up -d
   ```

6. Run migrations (if needed):
   ```bash
   pnpm run migration:run
   ```

7. Start the application:
   ```bash
   # Development
   pnpm run start:dev

   # Production
   pnpm run build
   pnpm run start:prod
   ```

## API Documentation

Once the application is running, access Swagger documentation at:
- http://localhost:3000/api/docs

## Available Scripts

- `pnpm run start` - Start the application
- `pnpm run start:dev` - Start in development mode with hot reload
- `pnpm run start:debug` - Start in debug mode
- `pnpm run start:prod` - Start in production mode
- `pnpm run build` - Build the application
- `pnpm run test` - Run unit tests
- `pnpm run test:watch` - Run tests in watch mode
- `pnpm run test:cov` - Run tests with coverage
- `pnpm run test:e2e` - Run end-to-end tests
- `pnpm run lint` - Lint the codebase
- `pnpm run format` - Format the codebase

## Environment Variables

See `.env.example` for all available environment variables.

## Best Practices Implemented

1. **Separation of Concerns** - Clear separation between controllers, services, and entities
2. **DRY Principle** - Reusable modules, decorators, and utilities
3. **Error Handling** - Comprehensive error handling with proper HTTP status codes
4. **Validation** - Input validation using class-validator
5. **Security** - Helmet, CORS, and security headers
6. **Logging** - Structured logging with Winston
7. **Documentation** - Swagger/OpenAPI documentation
8. **Testing** - Jest configuration for unit and e2e tests
9. **Type Safety** - Full TypeScript support with strict mode
10. **Configuration** - Environment-based configuration management

## License

UNLICENSED
