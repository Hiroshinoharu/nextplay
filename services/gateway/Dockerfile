# ---- BUILD STAGE ----
FROM golang:1.24 AS builder

WORKDIR /app

# Copy go.mod + go.sum
COPY services/gateway/go.mod services/gateway/go.sum ./
RUN go mod download

# Copy service source
COPY services/gateway/ ./

# Build static binary
ENV CGO_ENABLED=0
RUN go build -o gateway .

# ---- RUNTIME STAGE ----
FROM scratch

WORKDIR /
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /app/gateway /gateway

EXPOSE 8084
ENTRYPOINT ["/gateway"]