# ProjectHealth AI — Phase 2

## Requirements
- Docker Desktop running
- Node.js 22 (recommended)
- VS Code
- SMTP email credentials configured in `backend/.env` (copied from `.env.example`)

## Install and start (new database)
From the project root:

```bash
docker compose up -d
cd backend
npm install
cp .env.example .env  # Only if you do not already have backend/.env
# Edit backend/.env with SMTP settings and a secure JWT_SECRET
npm run dev
```

In a **second terminal** from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 . Backend health: http://localhost:4000/api/health .

## Existing Phase 1 database: IMPORTANT migration
If you already used Phase 1, Docker will NOT rerun `init.sql` because the database volume already exists. Keep the volume and run this migration once from the project root:

```bash
docker compose up -d
docker compose exec -T db psql -U projecthealth -d projecthealth < backend/sql/phase2.sql
```

On Windows PowerShell, use:

```powershell
Get-Content -Raw backend/sql/phase2.sql | docker compose exec -T db psql -U projecthealth -d projecthealth
```

**Do not run `docker compose down -v`**; it deletes the database volume and user data.

## Test
1. Register two accounts with real email addresses; log in and verify email OTP.
2. Go to Projects > New project, set a deadline and create.
3. Add the second registered user's email to the project.
4. Create a task, assign it to the second user, set priority and deadline.
5. Change its status to In progress, then Done.
6. Log in as the second user and confirm the shared project is visible.
7. Restart both servers and verify the data remains in PostgreSQL.

## Features
- Project create, list, detail, edit API, delete (owner only)
- Add/remove existing registered team members (owner only)
- Task create, edit, delete, assignment, status, priority, due date
- Protected backend routes: only project members can access project data
- PostgreSQL persistence and transactional project creation
- Existing homepage, registration, OTP login and logout preserved

## Limitations
- No email invitations to nonregistered users yet.
- No Asana, AI, file uploads or automated deadline reminders yet.
- Development runs on localhost, not public internet.
- Production deployment requires HTTPS, CSRF protections, stronger rate limits, secure secrets and backups.
