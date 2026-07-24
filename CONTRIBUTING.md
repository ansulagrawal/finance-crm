# Contributing

Thanks for your interest in the project.

## Development setup

This is a monorepo with two independent [Bun](https://bun.sh) workspaces:

- `backend/` — NestJS services + shared libraries
- `frontend/` — Vite + React (TanStack Router) apps

```bash
# backend
cd backend && cp .env.example .env && bun install && bun run typecheck

# frontend
cd frontend && cp core-crm/.env.example core-crm/.env.local && bun install && bun run dev
```

## Conventions

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:` …). A commit-msg
  hook enforces this.
- Formatting and linting are handled by [Biome](https://biomejs.dev)
  (`bun run check`).
- Run `bun run typecheck` (and `bun run test` where a test runner is available)
  before opening a pull request.

## Security

Never commit secrets. All configuration is read from environment variables
(see the `.env.example` files) or, in deployed environments, from a secret
store. If you find a security issue, please open a private report rather than a
public issue.
