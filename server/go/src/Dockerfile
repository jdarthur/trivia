FROM golang:1.21-alpine

RUN apk add --no-cache git

WORKDIR /go/src

RUN mkdir -p /go/src

RUN mkdir /go/src/common
RUN mkdir /go/src/models
RUN mkdir /go/src/questions
RUN mkdir /go/src/rounds
RUN mkdir /go/src/games
RUN mkdir /go/src/players
RUN mkdir /go/src/sessions
RUN mkdir /go/src/collections

ADD go.mod /go/src
ADD go.sum /go/src
ADD main.go /go/src
ADD ./common /go/src/common
ADD ./models /go/src/models

RUN go get "github.com/gin-gonic/gin"
RUN go get "github.com/globalsign/mgo"
RUN go get "github.com/google/uuid"
RUN go get "github.com/joho/godotenv"

# editor server
ADD ./questions /go/src/questions
ADD ./rounds /go/src/rounds
ADD ./games /go/src/games
ADD ./players /go/src/players
ADD ./sessions /go/src/sessions
ADD ./collections /go/src/collections

RUN go build -o main .

CMD ["/go/src/main"]
