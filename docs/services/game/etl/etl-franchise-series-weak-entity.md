# ETL design guide: Franchise, Series, and weak entities

This guide explains how to model and load **franchise** and **series** data in your ETL pipeline using the existing NextPlay schema.

## 1) Business meaning (keep these separate)

- **Franchise**: the broader IP universe (e.g., _Final Fantasy_).
- **Series**: a more specific sequence/grouping of titles (e.g., _Final Fantasy VII_ line).

A game can belong to:

- zero or one/many franchises (depending on source quality), and
- zero or one/many series.

Because these are reusable across many games, they should stay as strong lookup entities (`franchise`, `series`) plus relationship tables.

## 2) What is the weak entity here?

In relational modeling for this schema, the weak entities are the **bridge tables**:

- `game_franchise`
- `game_series`

Why weak:

- Their identity is derived from parents (`game_id` + `franchise_id`, `game_id` + `series_id`).
- They have no independent lifecycle without parent rows.
- Their composite PKs enforce dependency on parent entities.

## 3) Current schema alignment

Your schema already reflects this well:

- `franchise(franchise_id, igdb_id, name)`
- `series(series_id, igdb_id, name)`
- `game_franchise(franchise_id, game_id)` with composite PK
- `game_series(series_id, game_id)` with composite PK

That means your ETL should treat franchise/series as dimensions (lookup entities) and bridge tables as weak relationship entities.

## 4) ETL loading pattern (recommended)

Use this deterministic order each run:

1. **Extract** game payloads, including franchise/series IDs from source.
2. **Stage** unique franchise rows and series rows by source key (`igdb_id`).
3. **Upsert dimensions** (`franchise`, `series`) by `igdb_id`.
4. Build in-memory maps: `igdb_franchise_id -> franchise_id`, `igdb_series_id -> series_id`, `igdb_game_id -> game_id`.
5. **Load weak entities** (`game_franchise`, `game_series`) using mapped DB IDs.
6. **Deduplicate** with `ON CONFLICT DO NOTHING` on composite PKs.

## 5) SQL template for weak-entity inserts

```sql
INSERT INTO game_franchise (game_id, franchise_id)
SELECT * FROM UNNEST($1::int[], $2::int[])
ON CONFLICT (franchise_id, game_id) DO NOTHING;

INSERT INTO game_series (game_id, series_id)
SELECT * FROM UNNEST($1::int[], $2::int[])
ON CONFLICT (series_id, game_id) DO NOTHING;
```

> Note: the conflict target must match the table PK column order.

## 6) Data quality rules

For stable ETL behavior:

- Drop links when either parent key is missing after mapping.
- Trim and sanitize dimension names before upsert.
- Keep a metric counter for:
  - links skipped because of missing game,
  - links skipped because of missing franchise/series,
  - links inserted vs already existing.

## 7) Minimal source contract for pipeline

For each extracted game record, target these optional fields:

- `franchises: [{ igdb_id, name }]`
- `series: [{ igdb_id, name }]`

If source only gives IDs, fetch names in a follow-up endpoint call before dimension upsert.

## 8) Practical rule of thumb

If an entity can exist without a game and is reused by many games, model it as a strong lookup (`franchise`, `series`).
If a record only exists to tie parents together, it is a weak entity (`game_franchise`, `game_series`).
