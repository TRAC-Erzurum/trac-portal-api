# Module structure

## Top-level layout (`src/`)

Feature modules, each registered in `src/app.module.ts`:

| Module | Purpose |
|---|---|
| `auth` | Login, JWT cookie, Google OAuth, roles, guards |
| `user` | User accounts, profile, `@CurrentUser()` |
| `operator` | Amateur radio operator profiles (call signs) |
| `branch` | Branches and branch memberships |
| `net` | Radio nets, attendees, certificates, report sharing |
| `net-scheduler` | Scheduled nets (cron) |
| `communication-channel` | Branch and net communication channels |
| `certificate-template` | Certificate templates |
| `inventory` | Equipment, categories, statuses, photos |
| `disaster` | Disasters, observations, memberships, scoring |
| `publishing` | Publishing observations to external targets, delivery and retries |
| `oidc` | API as an OpenID Connect provider (`/api/oidc`) |
| `activity` | Activity log, fed by events |
| `dashboard`, `insights`, `qth`, `feedback` | Statistics, insights, location data, feedback to GitHub issues |
| `shared` | Config, base entity, filters, storage, logging, utils, enums |
| `config` | TypeORM CLI data source (`typeorm.config.ts`), `run-migrations.ts` |
| `migrations` | TypeORM migrations (see `database-and-migrations.md`) |

## Feature folder layout

Create only the folders a module needs:

```
<feature>/
  <feature>.module.ts
  controllers/   # HTTP endpoints, <feature>.controller.ts
  services/      # business logic, <feature>.service.ts
  entities/      # TypeORM entities, <name>.entity.ts
  dto/           # create-<name>.dto.ts, update-<name>.dto.ts, *-query.dto.ts
  enums/
  guards/        # resource-level guards, e.g. manage-net.guard.ts
  decorators/
  types/
  utils/
  constants/
```

## Naming

- Files: kebab-case, following the suffix above.
- Classes: `<Feature>Controller`, `<Feature>Service`, entity class without suffix (`Net`, `Branch`), DTOs `Create<Name>Dto`, `Update<Name>Dto`.
- Tables: snake_case plural (`@Entity('operator_branch_memberships')`). Columns are camelCase in the entity; TypeORM maps them to the database.

## Barrels and registration

- Most modules export their controllers and services as arrays from `controllers/index.ts` and `services/index.ts`:

  ```typescript
  // services/index.ts
  import { BranchService } from './branch.service';
  export const services = [BranchService];
  ```

  When a module already has such a barrel, add new classes to it. Do not register classes by importing the file directly in the module.
- A new module must be added to the `imports` array of `AppModule`.
- Entities are loaded by glob (`dist/**/*.entity{.ts,.js}`). Still register them with `TypeOrmModule.forFeature([...])` in the owning module.
- Use `forwardRef(() => Module)` only for real circular dependencies.

## Shared code

- `shared/entities/base.entity.ts`: `id` (uuid), `createdAt`, `updatedAt`, `createdBy`, `updatedBy` (string array). Most entities extend it, but not all (for example `activity`, `equipment-photo`, `report-share-token`). Check the module before assuming audit columns.
- Do not change `BaseEntity` without a migration plan for every table that extends it.
- Put a helper in `shared/utils` only when two or more modules need it. Otherwise keep it in the module.
