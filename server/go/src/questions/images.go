package questions

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jdarthur/trivia/common"
	"os"
	"strings"
)

type ImageResponse struct {
	FileName string ``
}

func (e *Env) UploadImage(c *gin.Context) {
	imageDir := os.Getenv("IMAGE_DIR")
	if len(imageDir) == 0 {
		imageDir = "images"
	}

	file, err := c.FormFile("file")
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	uploadedFileName := file.Filename
	parts := strings.Split(uploadedFileName, ".")
	extension := parts[len(parts)-1]

	uuidFilename, err := uuid.NewUUID()
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	responseFileName := imageDir + "/" + uuidFilename.String() + "." + extension

	err = c.SaveUploadedFile(file, responseFileName)
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	common.Respond(c, gin.H{"filename": responseFileName}, nil)
}
