# Auth and roles

## Authentication

- The browser sends a JWT in the httpOnly cookie `auth_token`. `JwtStrategy` reads it, verifies it with `JWT_SECRET`, and loads the user on every request.
- A token is refused when the user no longer exists, or when it was issued before `sessionsValidAfter` (sessions revoked by an admin).
- Login methods: local credentials, Google OAuth, and SSO registration flows in `auth`. The API is also an OIDC provider (`oidc` module, issuer `${PUBLIC_API_ORIGIN}/api/oidc`). The cross-repo contract is in the root repo's `docs/system/contracts.md`.
- Never put a token, password or OAuth secret in logs, responses or error messages.

## Global guard chain

Registered in `src/app.module.ts` as `APP_GUARD` providers, in this order:

1. `ThrottlerGuard`: rate limit (see `api-design.md`).
2. `JwtAuthGuard`: requires an authenticated user, unless the route is `@Public()`.
3. `RolesGuard`: callsign check and role check.

Every route is protected by default. Add `@Public()` only for routes that must be anonymous (for example `login`, `register`, and `GET /api/health`).

## Decorators

| Decorator | Use |
|---|---|
| `@Public()` | Skip JWT authentication (`auth/decorators/public.decorator.ts`) |
| `@Roles(...roles)` | Minimum effective role required (`auth/decorators/roles.decorator.ts`) |
| `@AllowWithoutCallsign()` | Let a user without a call sign reach this route |
| `@CurrentUser()` | Parameter decorator returning the request user (`ICurrentUser`) |
| `@Req() req: RequestWithUser` | Same user, in the common style used across controllers |

## Roles

Defined in `src/auth/enums/role.enum.ts`.

- `GlobalRole`: `guest`, `super_admin`.
- `BranchRole`: `president`, `admin`, `member`, `volunteer`.
- Effective rank (highest wins): `super_admin` 60 > `president` 50 > `admin` 40 > `member` 30 > `volunteer` 20 > `guest` 10.
- `@Roles(X)` means "rank at least X". `@Roles(GlobalRole.GUEST)` therefore admits every authenticated user.
- The effective role comes from `UserService.getEffectiveRole`: `super_admin` if the user has that global role, otherwise the highest role across the user's approved branch memberships, otherwise `guest`.
- Use `isLeadershipOrSuperEffective()` for "leadership" checks instead of comparing strings.

Do not use the legacy names `Role.ADMIN` or `Role.MEMBER`. They no longer exist.

## Call sign rule

`RolesGuard` refuses a `guest` who has no call sign with `error.forbiddenDescription`, unless the route is `@AllowWithoutCallsign()`. Routes that a new user must reach before a call sign exists (registration, profile completion) use that decorator.

## Resource-level authorization

Role checks are not enough for per-resource actions. Services and resource guards check ownership and membership:

- Resource guards live in the module (for example `disaster/guards/disaster-admin.guard.ts`, `net/guards/manage-net.guard.ts`, `branch/guards/portal-or-branch-leader.guard.ts`).
- Check that the record belongs to the route's parent (for example the attendee belongs to the net in the URL) before you mutate it.
- Record security-relevant actions as activity events (see `events-and-logging.md`).

## Rules for changes

- Never weaken `JwtAuthGuard`, `RolesGuard`, the cookie settings, or the callsign rule to make a test pass.
- A new endpoint needs an explicit authorization decision: `@Roles(...)`, a resource guard, or `@Public()` with a written reason in the PR.
- Changes to authorization, roles or sessions are security-sensitive. Name the risk in the PR description.
