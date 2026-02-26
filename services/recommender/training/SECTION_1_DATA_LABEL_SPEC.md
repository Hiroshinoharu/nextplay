# Section 1: Data + Labels Specification

This document defines the minimum data contract required before full recommender model training.

## 1) Task definition

- **Primary task:** top-N implicit-feedback ranking.
- **Prediction target:** probability that a user will positively engage with a candidate game.
- **Positive label (`label=1`):**
  - explicit `liked=true`, or
  - `rating >= 4.0` on a 1-5 scale.
- **Negative label (`label=0`):**
  - explicit `liked=false`, or
  - `rating <= 2.0`.
- **Dropped/neutral rows:** interactions with no reliable signal (e.g. rating in `(2.0, 4.0)` and null `liked`) are excluded from supervised training.

## 2) Leakage boundaries

- Feature generation and labels must only use information available at or before each interaction timestamp.
- No future interactions from the same user are allowed in feature creation for earlier events.
- Time split is performed on `event_ts` (UTC ISO-8601) and applied globally.

## 3) Split strategy

- Default split mode is **time-based**.
- Rows are sorted by `event_ts` and split in chronological order:
  - train: first 80%
  - validation: next 10%
  - test: final 10%
- Split output is deterministic for fixed input.

## 4) Dataset/version traceability

For every split run we produce a `manifest.json` containing:

- source input path
- SHA-256 hash of raw input bytes (`source_sha256`)
- row counts per split
- split ratios
- split boundaries (`train_end_ts`, `validation_end_ts`)
- code version marker for this utility (`splitter_version`)

## 5) Input schema expected by split utility

CSV columns:

- `user_id` (int)
- `game_id` (int)
- `event_ts` (UTC ISO-8601 string)
- `liked` (`true/false`, optional)
- `rating` (float, optional)

Any additional columns are preserved.