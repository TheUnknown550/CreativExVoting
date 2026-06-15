$env:DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/creativex_voting?sslmode=disable'
$env:JWT_SECRET = 'change-me'
$env:PORT = '8081'
$env:FRONTEND_URL = 'http://localhost:5174'
$env:MIGRATIONS_DIR = './migrations'
$env:SEED_DEMO_DATA = 'true'
go run ./cmd/server
