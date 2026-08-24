# Finance CRM

A loan-management / CRM platform, organized as a monorepo with a TypeScript
NestJS backend and a React (TanStack) frontend.

## Structure

```
.
├── backend/     # Bun workspace — NestJS services + shared libraries
│   ├── core-api/           # Primary REST API (auth, leads, CAM, loans, collections…)
│   ├── integrations-api/   # Third-party vendor integrations (KYC, bureau, SMS, email, UPI)
│   ├── reporting-api/      # Reports & exports
│   ├── automation-worker/  # Cron / background jobs
│   ├── common/             # Shared NestJS library (@finance-crm/common)
│   ├── database/           # TypeORM entities + SQL migrations (@finance-crm/database)
│   └── gateway/            # nginx reverse-proxy config
└── frontend/    # Bun workspace — Vite + React + TanStack Router
    ├── core-crm/      # CRM web app
    └── crm-redesign/  # Redesigned CRM web app

docs/            # all docs: be-*.md (backend) and fe-*.md (frontend)
CLAUDE.md        # architecture & conventions for both workspaces
```

## Getting started

Both `backend/` and `frontend/` are independent Bun workspaces.

```bash
# Backend
cd backend
cp .env.example .env      # fill in your own values
bun install
bun run typecheck

# Frontend
cd frontend
cp core-crm/.env.example core-crm/.env.local
bun install
bun run dev
```

## Configuration & secrets

No secrets are committed to this repository. Every service reads configuration
from environment variables (see each `.env.example`). In deployed environments,
configuration can additionally be sourced from AWS Secrets Manager / SSM
Parameter Store (see `docs/be-deployment.md`).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License & attribution

Licensed under the [MIT License with an attribution requirement](./LICENSE).

If you use this code — in whole or in part, modified or unmodified — you must
give clear, visible credit to the original author:

**Ansul Agrawal** — https://github.com/ansulagrawal

Please keep this attribution in your project's README (or an About/credits
screen for hosted apps).
