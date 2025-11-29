# Architecture Documentation

## Overview

This NestJS application follows a modular, scalable architecture with clear separation of concerns and production-ready best practices.

## Architecture Principles

### 1. Modular Design
- Each feature is organized as a self-contained module
- Modules can be easily added, removed, or modified independently
- Clear boundaries between modules

### 2. Layered Architecture
```
Controller Layer (HTTP)
    ↓
Service Layer (Business Logic)
    ↓
Repository/Entity Layer (Data Access)
```

### 3. Dependency Injection
- All dependencies are injected through NestJS DI container
- Promotes testability and loose coupling

## Folder Structure

```
src/
├── common/              # Shared utilities and cross-cutting concerns
│   ├── decorators/     # Custom decorators (Public, ApiResponse, etc.)
│   ├── dto/           # Shared DTOs (PaginationDto, etc.)
│   ├── filters/       # Exception filters
│   ├── guards/        # Authentication/Authorization guards
│   ├── interceptors/  # Request/Response interceptors
│   ├── logger/        # Winston logger service
│   ├── middleware/    # Custom middleware
│   ├── utils/         # Utility functions
│   └── constants/     # Application constants
├── config/            # Configuration modules
│   ├── app.config.ts
│   ├── database.config.ts
│   └── swagger.config.ts
├── database/          # Database configuration
├── health/            # Health check endpoints
├── users/             # Example feature module
│   ├── dto/          # Data Transfer Objects
│   ├── entities/     # TypeORM entities
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── users.module.ts
├── app.module.ts      # Root application module
└── main.ts           # Application bootstrap
```

## Key Components

### Configuration Management
- **Location**: `src/config/`
- Uses `@nestjs/config` for environment-based configuration
- Type-safe configuration with interfaces
- Supports multiple environment files (.env, .env.local)

### Logging
- **Location**: `src/common/logger/`
- Winston-based logging with daily rotation
- Separate error and combined logs
- Structured logging with context

### Error Handling
- **Location**: `src/common/filters/`
- Global exception filter
- Consistent error response format
- Proper HTTP status codes

### Validation
- Uses `class-validator` and `class-transformer`
- DTO-based validation
- Automatic transformation

### Security
- Helmet for security headers
- CORS configuration
- Input validation and sanitization
- Authentication guard (placeholder for JWT)

### API Documentation
- Swagger/OpenAPI integration
- Auto-generated from decorators
- Interactive API explorer

## Request Flow

1. **Request arrives** → Middleware (RequestLoggerMiddleware)
2. **Route matching** → Controller
3. **Validation** → ValidationPipe (DTO validation)
4. **Authorization** → Guards (if applicable)
5. **Business Logic** → Service
6. **Data Access** → Repository/TypeORM
7. **Response** → Interceptors (Transform, Logging)
8. **Error Handling** → Exception Filter (if error occurs)

## Best Practices

### 1. DTOs for All Input/Output
- Always use DTOs for request/response
- Validation at the boundary
- Type safety

### 2. Service Layer for Business Logic
- Controllers should be thin
- Business logic in services
- Services are testable

### 3. Error Handling
- Use appropriate HTTP exceptions
- Global exception filter for consistency
- Log errors appropriately

### 4. Logging
- Log important events
- Include context
- Use appropriate log levels

### 5. Testing
- Unit tests for services
- Integration tests for controllers
- E2E tests for critical flows

## Adding New Features

1. Create feature module folder (e.g., `src/products/`)
2. Create entity (if database needed)
3. Create DTOs for input/output
4. Create service with business logic
5. Create controller with endpoints
6. Create module file
7. Import module in `app.module.ts`
8. Add Swagger tags and documentation

## Database

- Uses TypeORM
- Entity-based approach
- Migrations for schema changes
- Repository pattern

## Environment Configuration

- Development: `.env` or `.env.local`
- Production: Environment variables
- Configuration validated at startup

## Security Considerations

1. **Input Validation**: All inputs validated via DTOs
2. **SQL Injection**: TypeORM parameterized queries
3. **XSS**: Helmet security headers
4. **CORS**: Configured for specific origins
5. **Authentication**: JWT guard (to be implemented)
6. **Rate Limiting**: Can be added via middleware

## Performance

1. **Compression**: Enabled via compression middleware
2. **Caching**: Config module caching enabled
3. **Database**: Connection pooling via TypeORM
4. **Logging**: Async file writes via Winston

## Monitoring

1. **Health Checks**: `/health` endpoint
2. **Logging**: Structured logs with Winston
3. **Error Tracking**: Global exception filter logs errors

