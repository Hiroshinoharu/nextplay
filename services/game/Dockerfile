#
# Multi-stage Dockerfile for building and running the `game` service.
# Uses a Go builder stage for fast, reproducible builds, then ships a small
# runtime image with only the compiled binary.
#
# Select the service directory to build (defaults to `game`).
ARG SERVICE_NAME=game

FROM golang:1.24.5 AS builder
WORKDIR /app

COPY services/${SERVICE_NAME}/go.mod .
COPY services/${SERVICE_NAME}/go.sum .
# Copy the rest of the service source code.
COPY services/${SERVICE_NAME}/ ./

# Download and tidy dependencies, then build the binary.
RUN go mod tidy
RUN go build -o app .

FROM debian:stable-slim
WORKDIR /app
# Copy the compiled binary from the builder stage.
COPY --from=builder /app/app .
# Default command starts the service.
CMD ["./app"]
