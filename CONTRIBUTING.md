# Contributing Guide

## Development Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Copy environment file:
   ```bash
   cp .env.example .env
   ```

3. Start database:
   ```bash
   docker-compose up -d
   ```

4. Run migrations (if needed)

5. Start development server:
   ```bash
   pnpm run start:dev
   ```

## Code Style

- Follow TypeScript best practices
- Use ESLint and Prettier
- Run `pnpm run lint` before committing
- Run `pnpm run format` to format code

## Testing

- Write tests for new features
- Maintain test coverage
- Run `pnpm run test` before committing
- Run `pnpm run test:cov` to check coverage

## Commit Messages

Follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Build/tooling changes

## Pull Request Process

1. Create feature branch
2. Make changes
3. Write/update tests
4. Update documentation
5. Run linting and tests
6. Submit PR with clear description

