package common

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/dgrijalva/jwt-go"
	"github.com/gin-gonic/gin"
	"net/http"
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
	return fmt.Sprintf("Missing auth token")
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

func LoadCerts() error {

	resp, err := http.Get(auth0Domain + ".well-known/jwks.json")
	if err != nil {
		return err
	}

	defer resp.Body.Close()

	err = json.NewDecoder(resp.Body).Decode(&JwtKeys)
	return err
}

func getPemCert(token *jwt.Token) (string, error) {
	cert := ""
	for k, _ := range JwtKeys.Keys {
		if token.Header["kid"] == JwtKeys.Keys[k].Kid {
			cert = "-----BEGIN CERTIFICATE-----\n" + JwtKeys.Keys[k].X5c[0] + "\n-----END CERTIFICATE-----"
		}
	}

	if cert == "" {
		err := errors.New("unable to find appropriate key")
		return cert, err
	}

	return cert, nil
}

func DecodeToken(jwtToken string) (jwt.MapClaims, error) {

	token, err := jwt.Parse(jwtToken, func(token *jwt.Token) (interface{}, error) {

		// Verify 'aud' claim
		checkAud := token.Claims.(jwt.MapClaims).VerifyAudience(audience, false)
		if !checkAud {
			return token, errors.New("invalid audience")
		}
		// Verify 'iss' claim
		checkIss := token.Claims.(jwt.MapClaims).VerifyIssuer(auth0Domain, false)
		if !checkIss {
			return token, errors.New("invalid issuer")
		}

		cert, err := getPemCert(token)
		if err != nil {
			panic(err.Error())
		}

		result, _ := jwt.ParseRSAPublicKeyFromPEM([]byte(cert))
		return result, nil
	})

	if err != nil {
		fmt.Println(err)
		return nil, InvalidTokenError{Token: jwtToken}
	}

	if !token.Valid {
		return nil, InvalidTokenError{Token: jwtToken}
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("failed to get claims")
	}

	fmt.Println(claims)

	return claims, nil
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
