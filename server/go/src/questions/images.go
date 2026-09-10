package questions

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jdarthur/trivia/common"
	"os"
	"path/filepath"
	"strings"
)

type ImageResponse struct {
	FileName string ``
}

// allowedExtensions are the file extensions the editor may upload. They are the
// kinds the client's pickers offer (images and audio) and nothing else: an
// upload must never be able to drop a .php, .svg, .html or other script-bearing
// file into IMAGE_DIR, because router.Static serves that directory to everyone.
var allowedExtensions = map[string]bool{
	"png":  true,
	"jpg":  true,
	"jpeg": true,
	"gif":  true,
	"mp3":  true,
	"wav":  true,
}

// invalidExtensionError reports an upload whose extension is not allowed. It
// implements common.InvalidDataError so Respond maps it to a 400.
type invalidExtensionError struct {
	Extension string
}

func (e invalidExtensionError) Error() string { return "unallowed file extension: " + e.Extension }
func (e invalidExtensionError) Field() string { return "file" }
func (e invalidExtensionError) Data() interface{} {
	return e.Extension
}

func (e *Env) UploadFile(c *gin.Context) {
	imageDir := os.Getenv("IMAGE_DIR")
	if len(imageDir) == 0 {
		imageDir = "images"
	}

	file, err := c.FormFile("file")
	if err != nil {
		common.Respond(c, nil, err)
		return
	}

	// Derive and validate the extension from the file's actual suffix rather
	// than trusting the client. The stored name is always a fresh UUID, so the
	// only thing an attacker controls is this suffix, and only the allowlist
	// gets through.
	extension := strings.ToLower(strings.TrimPrefix(filepath.Ext(file.Filename), "."))
	if !allowedExtensions[extension] {
		common.Respond(c, nil, invalidExtensionError{Extension: extension})
		return
	}

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
