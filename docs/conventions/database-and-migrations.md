# Database and migrations

## Facts

- PostgreSQL through TypeORM 0.3. Connection config: `src/shared/config/database.config.ts`.
- `synchronize` is `false`. The schema changes only through migrations.
- Sessions use `-c timezone=UTC`. Timestamp columns hold UTC wall time without a timezone.
- Entities are `*.entity.ts` and most extend `BaseEntity` (uuid primary key, audit columns). Table names are snake_case plural.

## Who runs what

- Agents write migration files and entity changes. Agents never run migrations, never generate them against a live or development database, and never run seeds or other SQL against any database. Human maintainers verify a migration on a local database before merge.
- The container runs migrations at start: `docker-entrypoint.sh` takes a `pg_dump` backup, then runs `dist/config/run-migrations.js`, which runs pending migrations with `transaction: 'each'`.
- Each migration runs in its own transaction, both at container start and with the `yarn migration:run` CLI (`migrationsTransactionMode: 'each'` in `src/config/typeorm.config.ts`), so a new enum value added in one migration can be used by a later one.

## Creating a migration

1. Create the file with the TypeORM CLI, which needs no database connection and writes the current timestamp:

   ```bash
   yarn migration:create src/migrations/<DescriptiveName>
   ```

   Do not use `migration:generate` as an agent: it connects to a database to diff the schema.
2. File name: `src/migrations/<timestamp-ms>-<PascalCaseName>.ts`. The class name is `<PascalCaseName><timestamp>`, and the `name` property matches the class name. The timestamp must be newer than every migration already in `src/migrations/`.
3. Implement both `up()` and `down()`. `down()` must fully reverse `up()`.
4. Write raw SQL with `queryRunner.query()`, quote identifiers (`"gridSquare"`), and match the style of recent migrations.
5. Update the matching entity so the entity and the migration agree.

## Safety rules

- Use `IF NOT EXISTS` / `IF EXISTS` where the database supports it, for indexes, drops and enum types.
- Before adding a `NOT NULL` constraint to a table with data, backfill the existing rows in the same migration.
- Add `ON DELETE` behaviour explicitly on foreign keys.
- Use a nullable column for a new column on an existing table that has rows, unless a backfill is in the same migration.
- Never edit a migration that has run in any environment. Add a new migration instead. The only exception is a cosmetic edit that does not change SQL.
- A data migration that rewrites or deletes row content is irreversible unless its `down()` restores it. If it cannot be reversed, say so in the PR description.

## Common patterns

Look at a recent migration in `src/migrations/` (for example `1791200000000-AddPublicationAlreadyExisted.ts`) and copy its style rather than inventing a new one.
