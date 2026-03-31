package db

import (
	"database/sql"
	"errors"
	"testing"
)

type stubSchemaExecutor struct {
	queries []string
	errAt   int
	err     error
}

// Exec implements the sql.Execer interface by recording the query and
// returning an error if the query index matches the error index.
// The error returned is the error set on the struct when it was
// initialized.
// The result returned is always a stubSchemaResult with a value of 0.
func (s *stubSchemaExecutor) Exec(query string, _ ...any) (sql.Result, error) {
	s.queries = append(s.queries, query)
	if s.errAt > 0 && len(s.queries) == s.errAt {
		return stubSchemaResult(0), s.err
	}
	return stubSchemaResult(0), nil
}

type stubSchemaResult int64

// LastInsertId is a no-op for stubSchemaResult, returning 0 and nil
func (stubSchemaResult) LastInsertId() (int64, error) {
	return 0, nil
}

func (stubSchemaResult) RowsAffected() (int64, error) {
	return 0, nil
}

// TestEnsureUserSchemaExecutesAllStatements tests that the ensureUserSchema
// function executes all configured schema migration statements and that the
// order of execution matches the order of the configured statements.
func TestEnsureUserSchemaExecutesAllStatements(t *testing.T) {
	exec := &stubSchemaExecutor{}

	if err := ensureUserSchema(exec); err != nil {
		t.Fatalf("expected schema bootstrap to succeed, got %v", err)
	}
	if len(exec.queries) != len(userSchemaStatements) {
		t.Fatalf("expected %d statements, got %d", len(userSchemaStatements), len(exec.queries))
	}
	for i, query := range exec.queries {
		if query != userSchemaStatements[i] {
			t.Fatalf("expected statement %d to match configured migration", i)
		}
	}
}

func TestEnsureUserSchemaStopsOnFirstError(t *testing.T) {
	wantErr := errors.New("boom")
	exec := &stubSchemaExecutor{errAt: 2, err: wantErr}

	err := ensureUserSchema(exec)
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected %v, got %v", wantErr, err)
	}
	if len(exec.queries) != 2 {
		t.Fatalf("expected execution to stop after the failing statement, got %d queries", len(exec.queries))
	}
}
