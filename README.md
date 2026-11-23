# ProjectHealth AI — Phase 1

A fresh React + TypeScript / Express + PostgreSQL capstone starter with real email OTP verification.

## Requirements
- Node.js 20.19+ or 22.12+ (Node.js 22 LTS recommended)
- Docker Desktop
- An SMTP email account (e.g. Gmail with 2-Step Verification and an App Password)

## Start in VS Code
1. Open the `projecthealth-ai-v2` folder.
2. In the VS Code terminal, run `docker compose up -d` (starts PostgreSQL on localhost port **5433**).
3. Open a second terminal: `cd backend` then `npm install`.
4. Copy `backend/.env.example` to `backend/.env` and edit its values. Use a random JWT_SECRET (32+ characters). Configure real SMTP credentials; do not commit `.env`.
5. In that backend terminal run `npm run dev` (API on http://localhost:4000).
6. Open a third terminal: `cd frontend`, `npm install`, then `npm run dev`.
7. Visit http://localhost:5173. Register with an email you can receive mail at; log in, check inbox/spam for OTP, and verify it.

## How to test
- http://localhost:4000/api/health should return `{ "ok": true }`.
- Register -> login -> OTP email -> enter code -> dashboard -> sign out.
- Passwords are bcrypt-hashed; OTPs are SHA-256 hashed, expire in 5 minutes, max 5 attempts.
- Login endpoint has a general rate limit. For public deployment, add per-account/IP OTP request throttling, CSRF protection, session revocation, email verification at registration, password reset, audit logging and secure secrets management.

## Troubleshooting
- If `docker compose up -d` fails, start Docker Desktop first.
- If port 5433 is occupied, change the host port in docker-compose.yml and DATABASE_URL together.
- If OTP email fails, verify SMTP_USER, SMTP_PASSWORD, SMTP_HOST, SMTP_PORT and MAIL_FROM. For Gmail use an App Password, not your normal account password. Some Google accounts cannot use App Passwords.
- `docker compose down` stops PostgreSQL; `docker compose down -v` **deletes the local database**.

## Important
- The UI shows illustrative data on the public homepage; the signed-in dashboard has empty real-data states. Asana integration, scoring, AI and reminders are intentionally not yet implemented.
- `localhost` is local-only. Public access requires deployment of frontend, backend and PostgreSQL to hosted services, a production FRONTEND_URL, HTTPS, and production cookie/CORS settings.
- Docker Compose is used only for the database in Phase 1.
