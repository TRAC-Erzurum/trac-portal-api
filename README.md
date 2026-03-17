# TRAC Portal — API

Backend: NestJS, TypeScript, PostgreSQL, TypeORM. Ana repo (trac-portal): [TRAC-Erzurum/trac-portal](https://github.com/TRAC-Erzurum/trac-portal).

## Gereksinimler

Node 22+, yarn. Yerel geliştirme için PostgreSQL.

## Kurulum

```bash
yarn install
```

Ortam değişkenleri: Ana repo kökündeki `.env.example` → `.env` (bu repo ana repo ile birlikte kullanılıyorsa). Repo’yu tek başına çalıştırıyorsanız aynı değişkenleri kökte `.env` olarak uyarlayın.

| Değişken | Açıklama |
|----------|----------|
| `DB_HOST`, `DB_PORT` | PostgreSQL adres ve port |
| `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | PostgreSQL kullanıcı, şifre, veritabanı adı |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | JWT imzalama ve süre |
| `COOKIE_SECRET`, `SESSION_SECRET` | Oturum ve çerez güvenliği |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Google OAuth |

## Komutlar

```bash
yarn start:dev     # geliştirme (watch)
yarn start:prod    # production (önce yarn build)
yarn build         # derleme
yarn lint          # ESLint
```

## Veritabanı migrasyonları

```bash
yarn migration:run     # bekleyen migrasyonları uygula
yarn migration:revert  # son migrasyonu geri al
yarn migration:generate src/migrations/MigrationName  # yeni migrasyon üret (TypeORM)
```

## Test

```bash
yarn test
yarn test:e2e
yarn test:cov   # coverage
```

## Katkı

- **Issue’lar** yalnızca **ana repoda** (trac-portal): [trac-portal — Issues](https://github.com/TRAC-Erzurum/trac-portal/issues).
- **PR’lar** **bu repo’ya** (trac-portal-api), **main**’e açılır. main korumalıdır; katkı yalnızca PR ile.
- Akış, PR kuralları ve deploy: [Geliştirici dökümanı](https://github.com/TRAC-Erzurum/trac-portal/blob/main/docs/gelistirici.md).
