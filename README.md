# Creative Excellence Voting System

Full-stack judging platform for event voting workflows. Judges sign in, see only their assigned categories, score projects against database-driven criteria, update votes later, and review their own ranking summary. Admins manage categories, projects, criteria, judges, assignments, and exportable results.

## Stack

- Frontend: React 19 + TypeScript + Vite + Ant Design
- Backend: Go + Chi + JWT + bcrypt
- Database: PostgreSQL
- Infrastructure: Docker Compose

## Project Structure

```text
.
├── backend
│   ├── cmd/server
│   ├── internal
│   │   ├── config
│   │   ├── db
│   │   ├── handlers
│   │   ├── middleware
│   │   ├── models
│   │   ├── repositories
│   │   ├── services
│   │   └── utils
│   ├── migrations
│   ├── .env.example
│   └── Dockerfile
├── frontend
│   ├── src
│   │   ├── api
│   │   ├── components
│   │   ├── contexts
│   │   ├── layouts
│   │   ├── pages
│   │   ├── routes
│   │   ├── types
│   │   └── utils
│   ├── .env.example
│   ├── Dockerfile
│   └── nginx.conf
└── docker-compose.yml
```

## Local Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
go mod tidy
go run ./cmd/server
```

The server runs migrations automatically on startup and listens on `http://localhost:8080`.

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`.

### 3. Docker Compose

```bash
docker compose up --build
```

This starts:

- PostgreSQL on `localhost:5432`
- Go backend on `localhost:8080`
- Frontend on `localhost:5173`

## Environment Variables

### Backend

See [backend/.env.example](/D:/mattc/Documents/Freelancing/Fastwork/Freelance/Chula_Ruj/CreativExVoting/backend/.env.example).

- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`
- `FRONTEND_URL`
- `MIGRATIONS_DIR`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_DISPLAY_NAME`

### Frontend

See [frontend/.env.example](/D:/mattc/Documents/Freelancing/Fastwork/Freelance/Chula_Ruj/CreativExVoting/frontend/.env.example).

- `VITE_API_BASE_URL`

## Create The First Admin

From the backend directory:

```bash
cd backend
go run ./cmd/server --create-admin --username admin --password admin123 --display-name "System Admin"
```

You can also rely on the environment defaults from `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_DISPLAY_NAME`.

## Demo Seed Data

The repo now includes an idempotent demo seed for local and Docker use.

- Docker Compose seeds demo data automatically because `SEED_DEMO_DATA=true` is set for the backend service.
- Local backend startup can do the same by setting `SEED_DEMO_DATA=true` in `backend/.env`.
- For a one-off seed run without starting the server:

```bash
cd backend
go run ./cmd/server --seed-demo
```

Seeded access:

- Admin: `admin` / `admin123`
- Judges: one account per category, all using password `judge123`

Judge usernames:

- `judge-city-festival`
- `judge-city-branding`
- `judge-city-policy`
- `judge-city-regeneration`
- `judge-city-collaboration`
- `judge-creative-ip`
- `judge-transformation`
- `judge-data`
- `judge-campaign`
- `judge-commerce`
- `judge-inclusivity`
- `judge-wellbeing`
- `judge-equality`
- `judge-education`
- `judge-green`

The seed creates:

- 15 award categories
- 4 scoring criteria per category
- 1 judge account per category
- 5 dummy projects per category

## Admin Workflow

1. Sign in with the admin account.
2. Create categories.
3. Create criteria for each category.
4. Create projects and attach their judging links/details.
5. Create judge accounts.
6. Assign judges to categories.
7. Monitor results and export CSV.

## Judge Workflow

1. Sign in with a judge account.
2. Pick one assigned category.
3. Review each project card and open `Detail & Vote`.
4. Read the project details and external links.
5. Open rubric help with the criterion info button.
6. Score every active criterion.
7. Submit the vote.
8. Reopen the project anytime to edit/resubmit.
9. Review `My Vote Summary` for that judge’s own ranking.

## API Response Shape

Successful responses:

```json
{
  "success": true,
  "data": {}
}
```

Error responses:

```json
{
  "success": false,
  "error": "message"
}
```

## API Documentation

### Authentication

- `POST /api/auth/login`
- `GET /api/auth/me`

### Judge APIs

- `GET /api/judge/categories`
- `GET /api/judge/projects?category_id=...`
- `GET /api/judge/projects/:id`
- `GET /api/judge/projects/:id/my-vote`
- `POST /api/judge/projects/:id/vote`
- `PUT /api/judge/projects/:id/vote`
- `GET /api/judge/summary?category_id=...`

### Admin APIs

- `GET /api/admin/dashboard`

Categories:

- `GET /api/admin/categories`
- `POST /api/admin/categories`
- `PUT /api/admin/categories/:id`
- `DELETE /api/admin/categories/:id`

Projects:

- `GET /api/admin/projects`
- `POST /api/admin/projects`
- `PUT /api/admin/projects/:id`
- `DELETE /api/admin/projects/:id`
- `GET /api/admin/projects/:id/vote-details`

Criteria:

- `GET /api/admin/criteria?category_id=...`
- `POST /api/admin/criteria`
- `PUT /api/admin/criteria/:id`
- `DELETE /api/admin/criteria/:id`

Judges:

- `GET /api/admin/judges`
- `POST /api/admin/judges`
- `PUT /api/admin/judges/:id`
- `DELETE /api/admin/judges/:id`
- `POST /api/admin/judges/:id/reset-password`

Assignments:

- `GET /api/admin/judges/:id/categories`
- `POST /api/admin/judges/:id/categories`
- `DELETE /api/admin/judges/:id/categories/:category_id`

Results:

- `GET /api/admin/results?category_id=...&judge_id=...`
- `GET /api/admin/results/export.csv`

Google Sheets placeholder:

- `POST /api/admin/import/google-sheets`
  Returns `501 not implemented yet`

## Sample cURL Commands

### Login

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
```

### Get Current User

```bash
curl http://localhost:8080/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT"
```

### Create Category

```bash
curl -X POST http://localhost:8080/api/admin/categories \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Brand Experience\",\"description\":\"Experiential brand work\",\"is_active\":true}"
```

### Create Criterion

```bash
curl -X POST http://localhost:8080/api/admin/criteria \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"category_id\":\"CATEGORY_UUID\",\"name\":\"Creativity\",\"description\":\"Originality and fresh thinking\",\"max_score\":40,\"display_order\":1,\"is_active\":true}"
```

### Create Judge

```bash
curl -X POST http://localhost:8080/api/admin/judges \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"judge01\",\"display_name\":\"Judge One\",\"password\":\"secret123\",\"role\":\"judge\",\"is_active\":true,\"category_ids\":[\"CATEGORY_UUID\"]}"
```

### Submit Or Update A Vote

```bash
curl -X POST http://localhost:8080/api/judge/projects/PROJECT_UUID/vote \
  -H "Authorization: Bearer JUDGE_JWT" \
  -H "Content-Type: application/json" \
  -d "{\"scores\":[{\"criterion_id\":\"CRITERION_UUID_1\",\"score\":35},{\"criterion_id\":\"CRITERION_UUID_2\",\"score\":28},{\"criterion_id\":\"CRITERION_UUID_3\",\"score\":25}]}"
```

## Database Notes

- PostgreSQL migrations live in [backend/migrations/001_init.sql](/D:/mattc/Documents/Freelancing/Fastwork/Freelance/Chula_Ruj/CreativExVoting/backend/migrations/001_init.sql).
- Votes are unique per `judge_id + project_id`.
- Vote totals are calculated on the backend.
- Each vote must contain all active criteria for the project category.
- Vote score writes happen inside a transaction.
- Vote edits are recorded in `vote_audit_logs`.

## CSV Export Columns

The admin CSV export includes:

- `category`
- `project title`
- `judge name`
- `criterion name`
- `criterion score`
- `project total score by judge`
- `project total score overall`
- `average score`

## Not Implemented Yet

- Google Sheets import
- Automated seed data for categories/projects/judges

The placeholder import endpoint exists so the backend structure is ready for the later Google Sheets pass.
