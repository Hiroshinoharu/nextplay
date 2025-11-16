ARG SERVICE_NAME=user

FROM golang:1.24.5 AS builder
WORKDIR /app

COPY services/${SERVICE_NAME}/go.mod .
COPY services/${SERVICE_NAME}/go.sum .
COPY services/${SERVICE_NAME}/ ./

RUN go mod tidy
RUN go build -o app .

FROM debian:stable-slim
WORKDIR /app
COPY --from=builder /app/app .
CMD ["./app"]