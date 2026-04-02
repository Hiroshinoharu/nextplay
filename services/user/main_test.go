package main

import "testing"

// TestResolveUserDatabaseURLPrefersLocalForDockerHostnames tests that
// resolveUserDatabaseURL prefers the local database URL when given a
// database URL with a hostname that matches a Docker container name
// (i.e. "postgres").
func TestResolveUserDatabaseURLPrefersLocalForDockerHostnames(t *testing.T) {
	got := resolveUserDatabaseURL(
		"postgresql://nextplay:secret@postgres:5432/nextplay?sslmode=disable",
		"postgresql://nextplay:secret@localhost:5432/nextplay?sslmode=disable",
	)

	want := "postgresql://nextplay:secret@localhost:5432/nextplay?sslmode=disable"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

// TestResolveUserDatabaseURLKeepsExplicitNonDockerHost tests that
// resolveUserDatabaseURL keeps the explicit non-docker host (127.0.0.1)
// when resolving the user database URL.
func TestResolveUserDatabaseURLKeepsExplicitNonDockerHost(t *testing.T) {
	got := resolveUserDatabaseURL(
		"postgresql://nextplay:secret@127.0.0.1:5432/nextplay?sslmode=disable",
		"postgresql://nextplay:secret@localhost:5432/nextplay?sslmode=disable",
	)

	want := "postgresql://nextplay:secret@127.0.0.1:5432/nextplay?sslmode=disable"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

// TestResolveUserDatabaseURLEmptyDatabaseUsesLocal tests that resolveUserDatabaseURL returns the local database URL when given an empty database URL.
func TestResolveUserDatabaseURLEmptyDatabaseUsesLocal(t *testing.T) {
	got := resolveUserDatabaseURL(
		"",
		"postgresql://nextplay:secret@localhost:5432/nextplay?sslmode=disable",
	)

	want := "postgresql://nextplay:secret@localhost:5432/nextplay?sslmode=disable"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestResolveUserDatabaseURLWithoutLocalOverrideKeepsDatabaseURL(t *testing.T) {
	got := resolveUserDatabaseURL(
		"postgresql://nextplay:secret@postgres:5432/nextplay?sslmode=disable",
		"",
	)

	want := "postgresql://nextplay:secret@postgres:5432/nextplay?sslmode=disable"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}
