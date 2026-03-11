package auth

import "testing"

// TestValidatePasswordPolicy runs a series of tests to verify that
// ValidatePasswordPolicy correctly identifies valid and invalid passwords.
//
// The tests cover the following cases:
// - a valid complex password
// - a too short password
// - a password missing uppercase characters
// - a password missing lowercase characters
// - a password missing digits
// - a password missing special characters
func TestValidatePasswordPolicy(t *testing.T) {
	tests := []struct {
		name     string
		password string
		wantErr  bool
	}{
		{
			name:     "valid complex password",
			password: "Abcd1234!",
			wantErr:  false,
		},
		{
			name:     "too short",
			password: "Ab1!",
			wantErr:  true,
		},
		{
			name:     "missing uppercase",
			password: "abcd1234!",
			wantErr:  true,
		},
		{
			name:     "missing lowercase",
			password: "ABCD1234!",
			wantErr:  true,
		},
		{
			name:     "missing digit",
			password: "Abcdefg!",
			wantErr:  true,
		},
		{
			name:     "missing special character",
			password: "Abcd1234",
			wantErr:  true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidatePasswordPolicy(tc.password)
			if tc.wantErr && err == nil {
				t.Fatalf("expected error for password %q, got nil", tc.password)
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("expected no error for password %q, got %v", tc.password, err)
			}
		})
	}
}
