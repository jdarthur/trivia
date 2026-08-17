package common

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v4"
	"net/http"
	"sync"
	"time"
)

//Error when calling a user-controlled endpoint without a valid JWT
type InvalidUserError struct {
	UserId string
}

func (e InvalidUserError) Error() string {
	return fmt.Sprintf("User %v is not valid", e.UserId)
}

type InvalidTokenError struct {
	Token string
}

func (e InvalidTokenError) Error() string {
	return fmt.Sprintf("Token '%v' is not valid", e.Token)
}

type MissingTokenError struct{}

func (e MissingTokenError) Error() string {
	return "Missing auth token"
}

var USER_ID = "userId"

var auth0Domain = "https://borttrivia.us.auth0.com/"
var audience = "https://borttrivia.com/editor"

type Jwks struct {
	Keys []JSONWebKeys `json:"keys"`
}

type JSONWebKeys struct {
	Kty string   `json:"kty"`
	Kid string   `json:"kid"`
	Use string   `json:"use"`
	N   string   `json:"n"`
	E   string   `json:"e"`
	X5c []string `json:"x5c"`
}

var JwtKeys = Jwks{}

// Guards JwtKeys and lastCertLoad, which are read on every authenticated
// request and rewritten whenever Auth0 rotates its signing keys.
var certMutex sync.RWMutex
var lastCertLoad time.Time

// Don't re-fetch the JWKS more than this often. Without a floor, a caller
// sending tokens with random `kid` headers could make us hammer Auth0.
const minCertReloadInterval = time.Minute

// Tolerated clock skew between Auth0 and this server for the `iat` claim.
const maxClockSkew = 30 * time.Second

func LoadCerts() error {

	resp, err := http.Get(auth0Domain + ".well-known/jwks.json")
	if err != nil {
		return err
	}

	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("fetching jwks returned status %d", resp.StatusCode)
	}

	keys := Jwks{}
	err = json.NewDecoder(resp.Body).Decode(&keys)
	if err != nil {
		return err
	}

	if len(keys.Keys) == 0 {
		return errors.New("jwks response contained no keys")
	}

	certMutex.Lock()
	defer certMutex.Unlock()
	JwtKeys = keys
	lastCertLoad = time.Now()

	return nil
}

// findPemCert looks up the signing cert for a token's `kid` in the cached JWKS.
func findPemCert(kid string) (string, bool) {
	certMutex.RLock()
	defer certMutex.RUnlock()

	for _, key := range JwtKeys.Keys {
		if key.Kid == kid && len(key.X5c) > 0 {
			return "-----BEGIN CERTIFICATE-----\n" + key.X5c[0] + "\n-----END CERTIFICATE-----", true
		}
	}
	return "", false
}

// shouldReloadCerts reports whether enough time has passed to justify another
// trip to Auth0's JWKS endpoint.
func shouldReloadCerts() bool {
	certMutex.RLock()
	defer certMutex.RUnlock()
	return time.Since(lastCertLoad) > minCertReloadInterval
}

func getPemCert(token *jwt.Token) (string, error) {
	kid, ok := token.Header["kid"].(string)
	if !ok || kid == "" {
		return "", errors.New("token header has no kid")
	}

	if cert, found := findPemCert(kid); found {
		return cert, nil
	}

	// Unknown kid: Auth0 has most likely rotated its signing keys since we
	// started up, so refresh the JWKS once and look again. Previously this only
	// loaded at boot, which meant a rotation broke the API until a restart.
	if !shouldReloadCerts() {
		return "", errors.New("unable to find appropriate key")
	}

	if err := LoadCerts(); err != nil {
		return "", fmt.Errorf("unable to find key %q and reloading jwks failed: %w", kid, err)
	}

	if cert, found := findPemCert(kid); found {
		return cert, nil
	}

	return "", errors.New("unable to find appropriate key")
}

func DecodeToken(jwtToken string) (jwt.MapClaims, error) {

	token, err := jwt.Parse(jwtToken, func(token *jwt.Token) (interface{}, error) {

		// Only RS256 is acceptable here. Auth0 signs with RSA, and pinning the
		// family keeps an attacker from steering us at a different algorithm.
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method %v", token.Header["alg"])
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return nil, errors.New("failed to get claims")
		}

		// The `true` argument makes these claims required. With `false`, a token
		// carrying no aud/iss at all would pass verification.
		if !claims.VerifyAudience(audience, true) {
			return nil, errors.New("invalid audience")
		}
		if !claims.VerifyIssuer(auth0Domain, true) {
			return nil, errors.New("invalid issuer")
		}

		cert, err := getPemCert(token)
		if err != nil {
			return nil, err
		}

		return jwt.ParseRSAPublicKeyFromPEM([]byte(cert))
	})

	if err != nil {
		// A token whose only problem is an `iat` slightly in the future is a
		// clock-skew artifact, not a forgery, so tolerate a small window. Any
		// other validation error (bad signature, expired, wrong audience) is
		// fatal, including iat combined with something else.
		validation, ok := err.(*jwt.ValidationError)
		if !ok || validation.Errors != jwt.ValidationErrorIssuedAt || token == nil {
			fmt.Printf("rejecting token: %v\n", err)
			return nil, InvalidTokenError{Token: jwtToken}
		}

		skew, skewErr := issuedAtSkew(token)
		if skewErr != nil || skew > maxClockSkew {
			fmt.Printf("rejecting token: iat skew %v (%v)\n", skew, skewErr)
			return nil, InvalidTokenError{Token: jwtToken}
		}

		fmt.Printf("token issued %v early, within tolerance\n", skew)
		token.Valid = true
	}

	if !token.Valid {
		return nil, InvalidTokenError{Token: jwtToken}
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("failed to get claims")
	}

	// v4 treats `exp` as optional, so require it explicitly rather than
	// accepting a token that never expires.
	if _, ok := claims["exp"]; !ok {
		return nil, InvalidTokenError{Token: jwtToken}
	}

	return claims, nil
}

// issuedAtSkew returns how far in the future a token's `iat` claim is. A
// negative result means it was issued in the past, which is the normal case.
func issuedAtSkew(token *jwt.Token) (time.Duration, error) {
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return 0, errors.New("failed to get claims")
	}

	raw, ok := claims["iat"]
	if !ok {
		return 0, errors.New("token has no iat claim")
	}

	issuedAt, ok := raw.(float64)
	if !ok {
		return 0, fmt.Errorf("iat claim is %T, not a number", raw)
	}

	seconds := issuedAt - float64(time.Now().Unix())
	return time.Duration(seconds) * time.Second, nil
}

func (e *Env) AsUser(c *gin.Context) {
	tokenValue := c.GetHeader("borttrivia-token")
	if tokenValue != "" {
		token, err := DecodeToken(tokenValue)
		if err != nil {
			Respond(c, nil, err)
			c.Abort()
			return
		}

		userId, ok := token["sub"]
		if !ok {
			Respond(c, nil, InvalidUserError{UserId: ""})
			c.Abort()
			return
		}

		c.Set(USER_ID, userId)
		c.Next()
	} else {
		Respond(c, nil, MissingTokenError{})
		c.Abort()
		return
	}
}

func AssertUser(c *gin.Context, correctUserId string) error {

	userIdFromRequest := GetUserId(c)

	if userIdFromRequest == "" {
		return InvalidUserError{UserId: ""}
	}

	return AssertUserId(userIdFromRequest, correctUserId)
}

func GetUserId(c *gin.Context) string {
	value, ok := c.Get(USER_ID)
	if ok {
		return value.(string)
	}
	return ""
}

func AssertUserId(userIdInRequest, userIdInDatabase string) error {
	if userIdInRequest != userIdInDatabase {
		return InvalidUserError{UserId: userIdInRequest}
	}
	return nil
}

func AssertHasUserId(c *gin.Context) (string, error) {
	value, ok := c.Get(USER_ID)
	if ok {
		userIdFromRequest := value.(string)
		return userIdFromRequest, nil
	} else {
		return "", InvalidUserError{UserId: ""}
	}
}
