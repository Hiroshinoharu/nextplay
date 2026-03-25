package handlers

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"io"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	userdb "github.com/maxceban/nextplay/services/user/db"
)

func TestDeleteUserRemovesUserAndAssociatedRecords(t *testing.T) {
	scenario := &deleteDBScenario{
		expectedUserID:            "42",
		recommendationEventsTable: "recommendation_events",
		deletionAuditTable:        "user_deletion_audit",
		deletedUserID:             42,
		deletedUsername:           "max",
		deletedEmail:              "max@example.com",
		hasDeletedUser:            true,
		expectedOperationsInOrder: []string{
			"begin",
			"delete_interactions",
			"inspect_recommendation_events",
			"delete_recommendation_events",
			"soft_delete_user",
			"inspect_deletion_audit",
			"insert_deletion_audit",
			"commit",
		},
	}

	restoreDB := installDeleteTestDB(t, scenario)
	defer restoreDB()

	app := fiber.New()
	app.Delete("/users/:id", DeleteUser)

	resp, err := app.Test(httptest.NewRequest(fiber.MethodDelete, "/users/42", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}

	var body struct {
		Message string `json:"message"`
		UserID  string `json:"user_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body.Message != "Delete user" || body.UserID != "42" {
		t.Fatalf("unexpected delete response: %#v", body)
	}

	scenario.Assert(t)
	if !scenario.committed {
		t.Fatalf("expected delete transaction to commit")
	}
	if scenario.rolledBack {
		t.Fatalf("did not expect delete transaction to roll back")
	}
}

func TestDeleteUserSkipsRecommendationEventDeletionWhenTableMissing(t *testing.T) {
	scenario := &deleteDBScenario{
		expectedUserID:            "42",
		recommendationEventsTable: "",
		deletionAuditTable:        "user_deletion_audit",
		deletedUserID:             42,
		deletedUsername:           "max",
		deletedEmail:              "max@example.com",
		hasDeletedUser:            true,
		expectedOperationsInOrder: []string{
			"begin",
			"delete_interactions",
			"inspect_recommendation_events",
			"soft_delete_user",
			"inspect_deletion_audit",
			"insert_deletion_audit",
			"commit",
		},
	}

	restoreDB := installDeleteTestDB(t, scenario)
	defer restoreDB()

	app := fiber.New()
	app.Delete("/users/:id", DeleteUser)

	resp, err := app.Test(httptest.NewRequest(fiber.MethodDelete, "/users/42", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusOK {
		t.Fatalf("expected status %d, got %d", fiber.StatusOK, resp.StatusCode)
	}

	scenario.Assert(t)
	if !scenario.committed {
		t.Fatalf("expected delete transaction to commit")
	}
	if scenario.rolledBack {
		t.Fatalf("did not expect delete transaction to roll back")
	}
}

func TestDeleteUserReturnsNotFoundAndRollsBackWhenUserDoesNotExist(t *testing.T) {
	scenario := &deleteDBScenario{
		expectedUserID:            "42",
		recommendationEventsTable: "recommendation_events",
		deletionAuditTable:        "user_deletion_audit",
		expectedOperationsInOrder: []string{
			"begin",
			"delete_interactions",
			"inspect_recommendation_events",
			"delete_recommendation_events",
			"soft_delete_user",
			"rollback",
		},
	}

	restoreDB := installDeleteTestDB(t, scenario)
	defer restoreDB()

	app := fiber.New()
	app.Delete("/users/:id", DeleteUser)

	resp, err := app.Test(httptest.NewRequest(fiber.MethodDelete, "/users/42", nil))
	if err != nil {
		t.Fatalf("app.Test returned error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != fiber.StatusNotFound {
		t.Fatalf("expected status %d, got %d", fiber.StatusNotFound, resp.StatusCode)
	}

	var body struct {
		Error string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body.Error != "user not found" {
		t.Fatalf("unexpected error response: %#v", body)
	}

	scenario.Assert(t)
	if scenario.committed {
		t.Fatalf("did not expect delete transaction to commit")
	}
	if !scenario.rolledBack {
		t.Fatalf("expected delete transaction to roll back")
	}
}

type deleteDBScenario struct {
	expectedUserID            string
	recommendationEventsTable string
	deletionAuditTable        string
	deletedUserID             int64
	deletedUsername           string
	deletedEmail              string
	hasDeletedUser            bool
	expectedOperationsInOrder []string

	mu         sync.Mutex
	operations []string
	committed  bool
	rolledBack bool
}

func (s *deleteDBScenario) record(operation string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.operations = append(s.operations, operation)
}

func (s *deleteDBScenario) Assert(t *testing.T) {
	t.Helper()

	s.mu.Lock()
	defer s.mu.Unlock()

	if !reflect.DeepEqual(s.expectedOperationsInOrder, s.operations) {
		t.Fatalf("unexpected delete workflow\nexpected: %#v\nactual:   %#v", s.expectedOperationsInOrder, s.operations)
	}
}

var (
	deleteDriverRegisterOnce sync.Once
	deleteDriverScenarioSeq  uint64
	deleteDriverScenarios    sync.Map
)

func installDeleteTestDB(t *testing.T, scenario *deleteDBScenario) func() {
	t.Helper()

	deleteDriverRegisterOnce.Do(func() {
		sql.Register("nextplay-delete-test", deleteTestDriver{})
	})

	dsn := fmt.Sprintf("scenario-%d", atomic.AddUint64(&deleteDriverScenarioSeq, 1))
	deleteDriverScenarios.Store(dsn, scenario)

	dbConn, err := sql.Open("nextplay-delete-test", dsn)
	if err != nil {
		t.Fatalf("sql.Open returned error: %v", err)
	}

	oldDB := userdb.DB
	userdb.DB = dbConn

	return func() {
		userdb.DB = oldDB
		deleteDriverScenarios.Delete(dsn)
		_ = dbConn.Close()
	}
}

type deleteTestDriver struct{}

func (deleteTestDriver) Open(name string) (driver.Conn, error) {
	rawScenario, ok := deleteDriverScenarios.Load(name)
	if !ok {
		return nil, fmt.Errorf("missing delete scenario %q", name)
	}
	scenario, ok := rawScenario.(*deleteDBScenario)
	if !ok {
		return nil, fmt.Errorf("unexpected scenario type for %q", name)
	}
	return &deleteTestConn{scenario: scenario}, nil
}

type deleteTestConn struct {
	scenario *deleteDBScenario
}

func (c *deleteTestConn) Prepare(string) (driver.Stmt, error) {
	return nil, fmt.Errorf("prepared statements are not supported in delete tests")
}

func (c *deleteTestConn) Close() error {
	return nil
}

func (c *deleteTestConn) Begin() (driver.Tx, error) {
	return c.BeginTx(context.Background(), driver.TxOptions{})
}

func (c *deleteTestConn) BeginTx(context.Context, driver.TxOptions) (driver.Tx, error) {
	c.scenario.record("begin")
	return &deleteTestTx{scenario: c.scenario}, nil
}

func (c *deleteTestConn) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	normalizedQuery := normalizeDeleteQuery(query)
	switch normalizedQuery {
	case "DELETE FROM user_interactions WHERE user_id = $1":
		if err := expectDeleteUserID(c.scenario.expectedUserID, args); err != nil {
			return nil, err
		}
		c.scenario.record("delete_interactions")
		return driver.RowsAffected(1), nil
	case "DELETE FROM recommendation_events WHERE user_id = $1":
		if err := expectDeleteUserID(c.scenario.expectedUserID, args); err != nil {
			return nil, err
		}
		c.scenario.record("delete_recommendation_events")
		return driver.RowsAffected(1), nil
	case "INSERT INTO user_deletion_audit (user_id, username, email, deleted_at) VALUES ($1, $2, $3, COALESCE($4, NOW()))":
		if err := expectDeletionAuditArgs(c.scenario, args); err != nil {
			return nil, err
		}
		c.scenario.record("insert_deletion_audit")
		return driver.RowsAffected(1), nil
	default:
		return nil, fmt.Errorf("unexpected exec query: %s", normalizedQuery)
	}
}

func (c *deleteTestConn) QueryContext(_ context.Context, query string, args []driver.NamedValue) (driver.Rows, error) {
	normalizedQuery := normalizeDeleteQuery(query)
	switch normalizedQuery {
	case "SELECT to_regclass('public.recommendation_events')::text":
		c.scenario.record("inspect_recommendation_events")
		var value driver.Value
		if strings.TrimSpace(c.scenario.recommendationEventsTable) != "" {
			value = c.scenario.recommendationEventsTable
		}
		return &deleteTestRows{
			columns: []string{"to_regclass"},
			values:  [][]driver.Value{{value}},
		}, nil
	case "SELECT to_regclass('public.user_deletion_audit')::text":
		c.scenario.record("inspect_deletion_audit")
		var value driver.Value
		if strings.TrimSpace(c.scenario.deletionAuditTable) != "" {
			value = c.scenario.deletionAuditTable
		}
		return &deleteTestRows{
			columns: []string{"to_regclass"},
			values:  [][]driver.Value{{value}},
		}, nil
	case "UPDATE app_user SET deleted_at = NOW() WHERE user_id = $1 AND deleted_at IS NULL RETURNING user_id, username, email, deleted_at":
		if err := expectDeleteUserID(c.scenario.expectedUserID, args); err != nil {
			return nil, err
		}
		c.scenario.record("soft_delete_user")
		rows := &deleteTestRows{columns: []string{"user_id", "username", "email", "deleted_at"}}
		if c.scenario.hasDeletedUser {
			rows.values = [][]driver.Value{{
				c.scenario.deletedUserID,
				c.scenario.deletedUsername,
				c.scenario.deletedEmail,
				time.Date(2026, time.March, 25, 12, 0, 0, 0, time.UTC),
			}}
		}
		return rows, nil
	default:
		return nil, fmt.Errorf("unexpected query: %s", normalizedQuery)
	}
}

type deleteTestTx struct {
	scenario *deleteDBScenario
}

func (tx *deleteTestTx) Commit() error {
	tx.scenario.record("commit")
	tx.scenario.mu.Lock()
	tx.scenario.committed = true
	tx.scenario.mu.Unlock()
	return nil
}

func (tx *deleteTestTx) Rollback() error {
	tx.scenario.record("rollback")
	tx.scenario.mu.Lock()
	tx.scenario.rolledBack = true
	tx.scenario.mu.Unlock()
	return nil
}

type deleteTestRows struct {
	columns []string
	values  [][]driver.Value
	index   int
}

func (r *deleteTestRows) Columns() []string {
	return r.columns
}

func (r *deleteTestRows) Close() error {
	return nil
}

func (r *deleteTestRows) Next(dest []driver.Value) error {
	if r.index >= len(r.values) {
		return io.EOF
	}

	copy(dest, r.values[r.index])
	r.index++
	return nil
}

func normalizeDeleteQuery(query string) string {
	return strings.Join(strings.Fields(query), " ")
}

func expectDeleteUserID(expected string, args []driver.NamedValue) error {
	if len(args) != 1 {
		return fmt.Errorf("expected one SQL arg, got %d", len(args))
	}
	got := strings.TrimSpace(fmt.Sprint(args[0].Value))
	if got != strings.TrimSpace(expected) {
		return fmt.Errorf("expected user id %q, got %q", expected, got)
	}
	return nil
}

func expectDeletionAuditArgs(scenario *deleteDBScenario, args []driver.NamedValue) error {
	if len(args) != 4 {
		return fmt.Errorf("expected four SQL args, got %d", len(args))
	}
	if got := strings.TrimSpace(fmt.Sprint(args[0].Value)); got != strings.TrimSpace(fmt.Sprint(scenario.deletedUserID)) {
		return fmt.Errorf("expected deleted user id %q, got %q", fmt.Sprint(scenario.deletedUserID), got)
	}
	if got := strings.TrimSpace(fmt.Sprint(args[1].Value)); got != strings.TrimSpace(scenario.deletedUsername) {
		return fmt.Errorf("expected deleted username %q, got %q", scenario.deletedUsername, got)
	}
	if got := strings.TrimSpace(fmt.Sprint(args[2].Value)); got != strings.TrimSpace(scenario.deletedEmail) {
		return fmt.Errorf("expected deleted email %q, got %q", scenario.deletedEmail, got)
	}
	if _, ok := args[3].Value.(time.Time); !ok {
		return fmt.Errorf("expected deleted_at to be time.Time, got %T", args[3].Value)
	}
	return nil
}

var (
	_ driver.Conn           = (*deleteTestConn)(nil)
	_ driver.ConnBeginTx    = (*deleteTestConn)(nil)
	_ driver.ExecerContext  = (*deleteTestConn)(nil)
	_ driver.QueryerContext = (*deleteTestConn)(nil)
)
