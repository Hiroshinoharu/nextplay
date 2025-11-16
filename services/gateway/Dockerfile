FROM golang:1.24 AS builder

WORKDIR /app

# Copy only module files first (compose sets context to repo root)
COPY services/gateway/go.mod services/gateway/go.sum ./
RUN go mod download

# Copy service source
COPY services/gateway/ ./

# Build a small, static binary
ENV CGO_ENABLED=0
RUN go build -ldflags="-s -w" -o /gateway .

# ----- RUNTIME STAGE -----
FROM scratch AS final

WORKDIR /

# Optionally include certs for outbound HTTPS (small overhead)
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

# Copy binary
COPY --from=builder /app/gateway /gateway

EXPOSE 8084
ENTRYPOINT ["/gateway"]