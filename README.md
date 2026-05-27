# Fempy API

NestJS + Prisma backend a Fempy platformhoz. Ez szolgálja ki a mobil appot, a tenant admin webfelületet és a szuperadmin felületet.

## Fő funkciók

- Tenant alapú autentikáció és jogosultságkezelés
- Tenant admin felhasználó-, pozíció- és szervezeti beállítás kezelés
- Szuperadmin tenant kezelés, impersonation, audit és aktivitás áttekintés
- Napi hangulat és napi kérdőív funkciók
- Kérdőív kampányok kampánynaptól számolt ütemezéssel
- Push értesítések Expo tokenekkel és BullMQ háttérmunkákkal
- Email küldés SMTP-n keresztül
- Tartalomtár API vezetői fejlesztő tartalmakhoz
- Prisma migrációk, seed és Docker alapú lokális Postgres/Redis

## Technológia

- Node.js 20+
- NestJS 11
- Prisma 6
- PostgreSQL
- Redis + BullMQ
- Expo Server SDK
- Nodemailer
- Jest

## Telepítés

```bash
npm install
```

Lokális infrastruktúrához:

```bash
docker compose up -d
```

## Környezeti változók

Hozz létre egy `.env` fájlt a repo gyökerében. Éles jelszavakat ne commitolj.

```env
DATABASE_URL="postgresql://fempy:fempy_pw@localhost:5432/fempy_db"
JWT_SECRET="replace-with-a-long-random-secret"
JWT_EXPIRES_IN="7d"
PORT=3000

REDIS_URL="redis://localhost:6379"

SMTP_HOST="smtp.example.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="no-reply@example.com"
SMTP_PASSWORD="change-me"
SMTP_FROM_EMAIL="no-reply@example.com"
SMTP_FROM_NAME="Fempy csapata"
SMTP_REPLY_TO="info@example.com"
SMTP_CONNECTION_TIMEOUT_MS=10000
SMTP_GREETING_TIMEOUT_MS=10000
SMTP_SOCKET_TIMEOUT_MS=20000

# Ha ez be van állítva, az API Resend HTTP küldést használ SMTP helyett.
RESEND_API_KEY="re_xxxxxxxxx"

ADMIN_WEB_URL="http://localhost:5173"
APP_DOWNLOAD_URL="https://fempyapp.com"
```

Railway Redis esetén általában a jelszót tartalmazó URL-t érdemes átadni:

```env
REDIS_URL="${{Redis.REDIS_URL}}"
```

## Adatbázis

Prisma kliens generálása:

```bash
npx prisma generate
```

Migrációk futtatása:

```bash
npx prisma migrate deploy
```

Seed futtatása:

```bash
npm run build
npx prisma db seed
```

Figyelem: a seed szándékosan törli a tenantokhoz és felhasználókhoz kötött adatokat, majd létrehoz egy szuperadmin felhasználót és a globális kérdőív kampányt. A tartalomtár adatait nem törli.

Alap szuperadmin:

```text
Email: superadmin@fempy.hu
Jelszó: superpass123
```

## Futtatás

Fejlesztői mód:

```bash
npm run start:dev
```

Production build:

```bash
npm run build
npm run start:prod
```

Alapértelmezett URL:

```text
http://localhost:3000
```

## Hasznos script-ek

```bash
npm run build
npm run start:dev
npm run start:prod
npm run lint
npm run test
npm run test:e2e
npm run prisma:generate
npm run prisma:migrate:deploy
```

## Fontos modulok

- `src/auth`: login, JWT, tenant guardok
- `src/users`: mobil/tenant user kezelés és profilok
- `src/admin`: tenant admin dashboard, pozíciók, user management
- `src/super-admin`: platform szintű admin API-k
- `src/daily-questions`: kérdések, válaszok, kampányok, ütemezés
- `src/dialy-mood`: napi hangulat
- `src/notifications`: BullMQ és push notification queue
- `src/devices`: Expo device token regisztráció
- `src/mail`: email szolgáltatás és sablonos levelek
- `src/content`: tartalomtár API
- `src/activity`: audit és aktivitási napló

## Kérdőív kampányok

A napi kérdőív kampányok nem konkrét dátummal működnek, hanem kampánynappal. Ha egy kampány ma indul, az első nap kérdései azonnal kimennek, a második nap kérdései másnap reggel 9-kor. Az ütemezett frissítést a scheduler `Europe/Budapest` időzónában futtatja.

## Email

Az email szolgáltatás SMTP-t használ. Railway-ről egyes SMTP szolgáltatók időtúllépést adhatnak hálózati korlátozás miatt. Ilyenkor HTTP API alapú email szolgáltató, például Resend használata javasolt egy későbbi integrációval.

## Push értesítések

A mobil app Expo push tokent regisztrál a backend felé. A backend BullMQ-n keresztül dolgozza fel az értesítési jobokat, ezért Redis szükséges.

## Deployment

Railway tipikus sorrend:

```bash
npx prisma migrate deploy
npx prisma generate
npm run build
npm run start:prod
```

Seed csak akkor fusson éles környezetben, ha tényleg törölni akarod a felhasználói/tenant adatokat:

```bash
npx prisma db seed
```

## Ellenőrzés módosítás után

```bash
npx prisma validate
npx prisma generate
npm run build
npm run test
```

## Biztonsági megjegyzések

- `.env` fájl és valós titkok nem kerülhetnek gitbe.
- `JWT_SECRET`, SMTP jelszó, Redis URL és adatbázis URL legyen környezetenként külön.
- Szuperadmin impersonation és support session események audit naplóba kerülnek.
