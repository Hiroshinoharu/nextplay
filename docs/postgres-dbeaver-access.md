# PostgreSQL Desktop Access

This project keeps PostgreSQL on the internal Compose network by default. That is correct for the app stack, but desktop database clients such as DBeaver and pgAdmin need a host port to connect.

Use the PostgreSQL host override file together with the main Compose file when you want GUI access while the app stack is running.

## Start The Full Stack With PostgreSQL Exposed

From the repo root:

```bash
docker compose --env-file .env -f deploy/docker-compose.yml -f deploy/docker-compose.postgres-host.yml up -d --build
```

This keeps the app services running as usual and also publishes PostgreSQL to the host on `127.0.0.1:5432` by default.

## Expose PostgreSQL When The Stack Is Already Running

If the stack is already up and you only need to add host access for PostgreSQL:

```bash
docker compose --env-file .env -f deploy/docker-compose.yml -f deploy/docker-compose.postgres-host.yml up -d --force-recreate --no-deps postgres
```

That recreates only the `postgres` container with the host port binding.

## DBeaver Connection Settings

Use these values:

- Host: `127.0.0.1`
- Port: `5432`
- Database: use `POSTGRES_DB` from your repo-root `.env` file (default `nextplay`)
- Username: use `POSTGRES_USER` from your repo-root `.env` file (default `nextplay`)
- Password: use `POSTGRES_PASSWORD` from your repo-root `.env` file

Do not use `0.0.0.0` as the client host value. Use `127.0.0.1` or `localhost`.

## Custom PostgreSQL Host Port

If `5432` is already in use on your machine, override it:

```bash
POSTGRES_HOST_PORT=55432 docker compose --env-file .env -f deploy/docker-compose.yml -f deploy/docker-compose.postgres-host.yml up -d --force-recreate --no-deps postgres
```

Then connect DBeaver to `127.0.0.1:55432`.

## Verify The Port

You can confirm the host mapping with:

```bash
docker port deploy-postgres-1
```

Expected output includes:

```text
5432/tcp -> 0.0.0.0:5432
```

## Troubleshooting

- `Connection refused`: the container is running without the override, or PostgreSQL was recreated without the host port binding. Re-run the `--force-recreate --no-deps postgres` command above.
- `Connection lost`: close the old DBeaver connection tab and open a fresh connection after the container restart.
- `Port already allocated`: set `POSTGRES_HOST_PORT` to another value and connect to that port instead.


