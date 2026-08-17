package common

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"math/big"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// These tests exercise DecodeToken against a JWKS we control, so they cover the
// validation rules directly rather than going out to Auth0. installTestKey
// seeds the package-level cert cache and marks it freshly loaded, which keeps
// an unknown `kid` from triggering a real JWKS fetch.

const testKid = "test-key-1"

func installTestKey(t *testing.T) *rsa.PrivateKey {
	t.Helper()

	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generating key: %v", err)
	}

	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "trivia-test"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
	}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("creating certificate: %v", err)
	}

	certMutex.Lock()
	previousKeys, previousLoad := JwtKeys, lastCertLoad
	JwtKeys = Jwks{Keys: []JSONWebKeys{{
		Kty: "RSA",
		Kid: testKid,
		Use: "sig",
		X5c: []string{base64.StdEncoding.EncodeToString(der)},
	}}}
	lastCertLoad = time.Now()
	certMutex.Unlock()

	t.Cleanup(func() {
		certMutex.Lock()
		JwtKeys, lastCertLoad = previousKeys, previousLoad
		certMutex.Unlock()
	})

	return key
}

// sign builds a token from the given claims. Passing a nil method signs with
// RS256, which is what Auth0 uses.
func sign(t *testing.T, key *rsa.PrivateKey, claims jwt.MapClaims, method jwt.SigningMethod) string {
	t.Helper()

	if method == nil {
		method = jwt.SigningMethodRS256
	}

	token := jwt.NewWithClaims(method, claims)
	token.Header["kid"] = testKid

	signed, err := token.SignedString(key)
	if err != nil {
		t.Fatalf("signing token: %v", err)
	}
	return signed
}

// validClaims is a token that should pass every check.
func validClaims() jwt.MapClaims {
	now := time.Now()
	return jwt.MapClaims{
		"sub": "auth0|abc123",
		"aud": audience,
		"iss": auth0Domain,
		"iat": now.Unix(),
		"exp": now.Add(time.Hour).Unix(),
	}
}

func TestDecodeTokenAcceptsValidToken(t *testing.T) {
	key := installTestKey(t)

	claims, err := DecodeToken(sign(t, key, validClaims(), nil))
	if err != nil {
		t.Fatalf("expected valid token to be accepted, got %v", err)
	}

	if claims["sub"] != "auth0|abc123" {
		t.Errorf("expected sub claim to survive decoding, got %v", claims["sub"])
	}
}

// An `iat` a few seconds in the future is a clock-skew artifact between Auth0
// and this server, not a forgery, so it stays inside the leeway window.
func TestDecodeTokenToleratesSmallIssuedAtSkew(t *testing.T) {
	key := installTestKey(t)

	claims := validClaims()
	claims["iat"] = time.Now().Add(maxClockSkew / 2).Unix()

	if _, err := DecodeToken(sign(t, key, claims, nil)); err != nil {
		t.Fatalf("expected token within the skew window to be accepted, got %v", err)
	}
}

func TestDecodeTokenRejectsBadTokens(t *testing.T) {
	key := installTestKey(t)

	otherKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generating key: %v", err)
	}

	cases := []struct {
		name   string
		mutate func(jwt.MapClaims)
		key    *rsa.PrivateKey
		method jwt.SigningMethod
	}{
		{
			name:   "issued far in the future",
			mutate: func(c jwt.MapClaims) { c["iat"] = time.Now().Add(time.Hour).Unix() },
		},
		{
			name:   "expired",
			mutate: func(c jwt.MapClaims) { c["exp"] = time.Now().Add(-time.Hour).Unix() },
		},
		{
			name:   "no exp claim",
			mutate: func(c jwt.MapClaims) { delete(c, "exp") },
		},
		{
			name:   "wrong audience",
			mutate: func(c jwt.MapClaims) { c["aud"] = "https://example.com/other" },
		},
		{
			name:   "no aud claim",
			mutate: func(c jwt.MapClaims) { delete(c, "aud") },
		},
		{
			name:   "wrong issuer",
			mutate: func(c jwt.MapClaims) { c["iss"] = "https://evil.example.com/" },
		},
		{
			name:   "no iss claim",
			mutate: func(c jwt.MapClaims) { delete(c, "iss") },
		},
		{
			name: "signed by a different key",
			key:  otherKey,
		},
		{
			// Auth0 signs with RS256 only, so a token asking us to verify with
			// anything else is rejected before the signature is even checked.
			name:   "unexpected signing algorithm",
			method: jwt.SigningMethodRS512,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			claims := validClaims()
			if tc.mutate != nil {
				tc.mutate(claims)
			}

			signingKey := key
			if tc.key != nil {
				signingKey = tc.key
			}

			if _, err := DecodeToken(sign(t, signingKey, claims, tc.method)); err == nil {
				t.Fatal("expected token to be rejected, got no error")
			} else if _, ok := err.(InvalidTokenError); !ok {
				t.Errorf("expected InvalidTokenError, got %T: %v", err, err)
			}
		})
	}
}

// An unsigned token must never be accepted, regardless of what it claims.
func TestDecodeTokenRejectsUnsignedToken(t *testing.T) {
	installTestKey(t)

	token := jwt.NewWithClaims(jwt.SigningMethodNone, validClaims())
	token.Header["kid"] = testKid

	signed, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("signing token: %v", err)
	}

	if _, err := DecodeToken(signed); err == nil {
		t.Fatal("expected unsigned token to be rejected, got no error")
	}
}

// A `kid` we have no key for must not reach out to Auth0 on every request.
func TestDecodeTokenRejectsUnknownKidWithoutReloading(t *testing.T) {
	key := installTestKey(t)

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, validClaims())
	token.Header["kid"] = "not-a-key-we-have"

	signed, err := token.SignedString(key)
	if err != nil {
		t.Fatalf("signing token: %v", err)
	}

	if _, err := DecodeToken(signed); err == nil {
		t.Fatal("expected token with unknown kid to be rejected, got no error")
	}
}
