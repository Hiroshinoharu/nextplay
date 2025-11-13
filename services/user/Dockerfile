# ----- BUILD STAGE -----
FROM golang:1.24.5 AS builder
WORKDIR /app
COPY . .
RUN go mod tidy
RUN go build -o app .

# ----- RUN STAGE -----
FROM debian:stable-slim
WORKDIR /app
COPY --from=builder /app/app .

EXPOSE 8083
CMD ["./app"]