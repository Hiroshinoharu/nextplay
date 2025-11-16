FROM golang:1.24 AS builder

WORKDIR /app

COPY services/user/go.mod services/user/go.sum ./
RUN go mod download

COPY services/user/ ./

ENV CGO_ENABLED=0
RUN go build -o user .

FROM scratch
WORKDIR /
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /app/user /user

EXPOSE 8083
ENTRYPOINT ["/user"]