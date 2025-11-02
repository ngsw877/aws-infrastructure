# Build stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o main .

# Runtime stage
FROM alpine:latest

WORKDIR /root/

RUN apk --no-cache add ca-certificates tzdata

COPY --from=builder /app/main .

EXPOSE 8080

CMD ["./main"]
