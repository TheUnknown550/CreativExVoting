FROM golang:1.24-alpine AS builder

WORKDIR /app/backend

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /tmp/server ./cmd/server

FROM alpine:3.21

WORKDIR /app/backend

COPY --from=builder /tmp/server ./server
COPY --from=builder /app/backend/migrations ./migrations

EXPOSE 8080

CMD ["./server"]
