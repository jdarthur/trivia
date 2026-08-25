package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestListenOnLoopback(t *testing.T) {
	cases := []struct {
		name string
		addr string
		want bool
	}{
		{"default all-interfaces", ":8080", false},
		{"explicit wildcard", "0.0.0.0:8080", false},
		{"ipv4 any", "0.0.0.0", false},
		{"loopback ipv4", "127.0.0.1:8080", true},
		{"localhost", "localhost:8080", true},
		{"loopback ipv6", "[::1]:8080", true},
		{"private lan ip", "192.168.8.147:8080", false},
		{"public ip", "8.8.8.8:8080", false},
		{"bare port (no colon)", "8080", false},
		{"empty", "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := listenOnLoopback(tc.addr); got != tc.want {
				t.Errorf("listenOnLoopback(%q) = %v, want %v", tc.addr, got, tc.want)
			}
		})
	}
}

func TestTLSOptionsValidate(t *testing.T) {
	dir := t.TempDir()
	certA, keyA := writeTestKeyPair(t, dir)
	_, keyB := writeTestKeyPair(t, dir) // from a second pair, to mismatch certA

	cases := []struct {
		name    string
		cert    string
		key     string
		wantErr string // substring of the expected error; empty means success
	}{
		{"both empty is plain HTTP", "", "", ""},
		{"key without cert", "", keyA, "--tls-key is set but --tls-cert is not"},
		{"cert without key", certA, "", "--tls-cert is set but --tls-key is not"},
		{"missing cert file", filepath.Join(dir, "nope-cert.pem"), keyA, "does not exist"},
		{"missing key file", certA, filepath.Join(dir, "nope-key.pem"), "does not exist"},
		{"cert path is a directory", dir, keyA, "not a regular file"},
		{"key path is a directory", certA, dir, "not a regular file"},
		{"valid pair", certA, keyA, ""},
		{"mismatched cert and key", certA, keyB, "invalid TLS certificate/key pair"},
	}

	// An unreadable file only fails for a non-root user: root can open
	// mode-0000 files. Guard the case so the suite passes regardless.
	if os.Geteuid() != 0 {
		unreadable := filepath.Join(dir, "unreadable.pem")
		if err := os.WriteFile(unreadable, []byte("secret"), 0o600); err != nil {
			t.Fatal(err)
		}
		if err := os.Chmod(unreadable, 0o000); err != nil {
			t.Fatal(err)
		}
		cases = append(cases, struct {
			name    string
			cert    string
			key     string
			wantErr string
		}{"unreadable cert file", unreadable, keyA, "not readable"})
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := tlsOptions{certFile: tc.cert, keyFile: tc.key}.validate()
			if tc.wantErr == "" {
				if err != nil {
					t.Errorf("validate() = %v, want success", err)
				}
				return
			}
			if err == nil {
				t.Errorf("validate() succeeded, want error containing %q", tc.wantErr)
				return
			}
			if !strings.Contains(err.Error(), tc.wantErr) {
				t.Errorf("validate() error = %q, want it to contain %q", err, tc.wantErr)
			}
		})
	}
}

// writeTestKeyPair writes a self-signed certificate and its private key as PEM
// files into dir and returns their paths. Each call generates a fresh key, so
// a cert from one call can be paired with a key from another to simulate a
// mismatched certificate/key.
func writeTestKeyPair(t *testing.T, dir string) (certFile, keyFile string) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	tmpl := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "localhost"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	der, err := x509.CreateCertificate(rand.Reader, &tmpl, &tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	keyDer, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}

	// Each call gets its own subdirectory so a second call never overwrites
	// the first pair's files (which would turn "mismatched pair" into a match).
	sub, err := os.MkdirTemp(dir, "pair")
	if err != nil {
		t.Fatal(err)
	}
	certFile = filepath.Join(sub, "cert.pem")
	keyFile = filepath.Join(sub, "key.pem")
	if err := os.WriteFile(certFile, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(keyFile, pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: keyDer}), 0o600); err != nil {
		t.Fatal(err)
	}
	return certFile, keyFile
}
