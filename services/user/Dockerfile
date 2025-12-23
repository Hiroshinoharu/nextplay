############################################################
# Multi-stage build for the User service.
# Stage 1 (builder): compile a static Go binary.
# Stage 2 (runtime): run the compiled binary on Alpine.
############################################################

# ---- Builder stage: uses the official Go toolchain image
FROM golang:1.24 AS builder

WORKDIR /app/services/user

# Copy only go.mod/go.sum first to leverage Docker layer caching
COPY services/user/go.mod services/user/go.sum ./
COPY services/shared/go.mod services/shared/go.sum ../shared/
# Download module dependencies (cached unless mod files change)
RUN go mod download

# Copy the rest of the source code for the user service
COPY services/user/ ./
COPY services/shared/ ../shared/

# Disable CGO to produce a static binary that runs well on Alpine
ENV CGO_ENABLED=0
# Build the service binary
RUN go build -o user .

# ---- Runtime stage: minimal base image for fast, small deploys
FROM alpine:3.20
WORKDIR /
# Install CA certs for HTTPS and curl for simple health/debug checks
RUN apk add --no-cache ca-certificates curl
COPY --from=builder /app/services/user/user /user

# Service listens on 8083
EXPOSE 8083
# Start the user service
ENTRYPOINT ["/user"]
