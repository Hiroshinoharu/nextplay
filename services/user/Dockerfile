FROM golang:1.24 AS builder

WORKDIR /app

# Copy only module files first (compose sets context to repo root)
COPY services/user/go.mod services/user/go.sum ./
RUN go mod download

# Copy service source
COPY services/user/ ./

# Build a small, static binary
ENV CGO_ENABLED=0
RUN go build -ldflags="-s -w" -o /user .

# ----- RUNTIME STAGE -----
FROM scratch AS final

WORKDIR /

# Optionally include certs for outbound HTTPS (small overhead)
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

# Copy binary
COPY --from=builder /user /user
EXPOSE 8083
ENTRYPOINT ["/user"]
