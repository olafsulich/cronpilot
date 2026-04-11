---
paths:
  - "packages/db/**"
---

# Database migrations

Never edit existing migration files. If a schema change is needed, always generate a new migration with `pnpm db:migrate`. Editing a migration that has already run will corrupt the database state in production.
