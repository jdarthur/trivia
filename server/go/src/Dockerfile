FROM golang:alpine

RUN apk add --no-cache git

WORKDIR /go/src

RUN go get "github.com/gin-gonic/gin"
RUN go get "github.com/globalsign/mgo"
RUN go get "github.com/google/uuid"
RUN go get "github.com/joho/godotenv"

RUN mkdir -p /go/src

RUN mkdir /go/src/common
RUN mkdir /go/src/models
RUN mkdir /go/src/questions
RUN mkdir /go/src/rounds
RUN mkdir /go/src/games
RUN mkdir /go/src/players
RUN mkdir /go/src/sessions

ADD main.go /go/src
ADD ./common /go/src/common
ADD ./models /go/src/models

# editor server
ADD ./questions /go/src/questions
ADD ./rounds /go/src/rounds
ADD ./games /go/src/games
ADD ./players /go/src/players
ADD ./sessions /go/src/sessions



RUN go build -o main .

CMD ["/go/src/main"]