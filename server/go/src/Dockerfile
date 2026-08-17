FROM golang:1.26-alpine

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

# Cache the module downloads in their own layer. `go get` here would resolve
# and rewrite go.mod inside the image rather than honouring the versions we
# committed, so download exactly what go.mod/go.sum pin instead.
RUN go mod download

# editor server
ADD ./questions /go/src/questions
ADD ./rounds /go/src/rounds
ADD ./games /go/src/games
ADD ./players /go/src/players
ADD ./sessions /go/src/sessions
ADD ./collections /go/src/collections

RUN go build -o main .

CMD ["/go/src/main"]
