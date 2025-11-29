# TypeORM Migrations Guide

## Overview

This project uses TypeORM migrations for database schema management. Migrations allow you to:
- Version control your database schema
- Safely apply changes in production
- Rollback changes if needed
- Track schema history

## Current Setup

- **Data Source**: `src/database/data-source.ts` - Configuration for migrations
- **Migrations Directory**: `migrations/` - Contains all migration files (at root level)
- **Auto-sync**: Disabled in production, enabled in development (via `synchronize`)

## Migration Commands

### Generate Migration (Auto)

Automatically generate a migration based on entity changes:

```bash
pnpm run migration:generate migrations/MigrationName
```

**Example:**
```bash
pnpm run migration:generate migrations/AddUserFields
```

This will:
1. Compare your entities with the current database
2. Generate SQL to make them match
3. Create a new migration file

### Create Empty Migration (Manual)

Create an empty migration file for manual SQL:

```bash
pnpm run migration:create migrations/MigrationName
```

**Example:**
```bash
pnpm run migration:create migrations/AddCustomIndex
```

### Run Migrations

Apply all pending migrations:

```bash
pnpm run migration:run
```

### Revert Last Migration

Rollback the last migration:

```bash
pnpm run migration:revert
```

### Show Migration Status

Check which migrations have been applied:

```bash
pnpm run migration:show
```

## Initial Migration

An initial migration has been created:
- `1732828800000-CreateUsersAndUserPlatforms.ts`

This creates:
- `users` table with all fields
- `user_platforms` table with relationships
- All indexes and constraints

## Workflow

### Development

1. **Make changes to entities** (e.g., add a field to User)
2. **Generate migration**:
   ```bash
   pnpm run migration:generate migrations/AddFieldToUser
   ```
3. **Review the generated migration** file in `migrations/`
4. **Run migration**:
   ```bash
   pnpm run migration:run
   ```

### Production

1. **Build the application**:
   ```bash
   pnpm run build
   ```
2. **Run migrations**:
   ```bash
   pnpm run migration:run
   ```
3. **Start the application**:
   ```bash
   pnpm run start:prod
   ```

## Migration File Naming

Migrations are named with timestamp prefix:
- Format: `{timestamp}-{Description}.ts`
- Example: `1732828800000-CreateUsersAndUserPlatforms.ts`

The timestamp ensures migrations run in the correct order.

## Important Notes

### ⚠️ Never Modify Existing Migrations

Once a migration has been run in production, **never modify it**. Instead:
1. Create a new migration to fix issues
2. Or revert and create a new one (if not in production)

### ⚠️ Synchronize Setting

- **Development**: `synchronize: true` - Auto-syncs schema (convenient for dev)
- **Production**: `synchronize: false` - Must use migrations (safe for prod)

### ⚠️ Backup Before Migrations

Always backup your database before running migrations in production!

## Example: Adding a New Field

1. **Update entity** (`src/users/entities/user.entity.ts`):
   ```typescript
   @Column({ type: 'varchar', length: 50, nullable: true })
   nickname?: string;
   ```

2. **Generate migration**:
   ```bash
   pnpm run migration:generate migrations/AddNicknameToUser
   ```

3. **Review** the generated file in `migrations/`

4. **Run migration**:
   ```bash
   pnpm run migration:run
   ```

## Troubleshooting

### Migration Fails

1. Check database connection
2. Verify migration file syntax
3. Check for conflicting migrations
4. Review error logs

### Need to Reset Database

⚠️ **Warning**: This will delete all data!

```bash
# Drop all tables
# Then run all migrations from scratch
pnpm run migration:run
```

### Migration Already Exists Error

If you see "migration already exists", check:
- The migrations table in your database
- Whether the migration was already applied

## Best Practices

1. ✅ **Always review** generated migrations before running
2. ✅ **Test migrations** in development/staging first
3. ✅ **Backup database** before production migrations
4. ✅ **One feature per migration** - Keep migrations focused
5. ✅ **Use transactions** - Migrations run in transactions by default
6. ✅ **Version control** - Commit all migration files

## Current Migrations

- `1732828800000-CreateUsersAndUserPlatforms.ts` - Initial schema setup

