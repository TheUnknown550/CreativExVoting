package services

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	_ "image/gif"  // register GIF decoder
	_ "image/jpeg" // register JPEG decoder
	_ "image/png"  // register PNG decoder
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/deepteams/webp"
	"golang.org/x/image/draw"
)

const (
	maxUploadBytes = 15 << 20 // 15 MB
	maxDimension   = 1600     // px (longest side)
	webpQuality    = 80
	webpMethod     = 4
	uploadURLBase  = "/uploads"
)

// ImageService stores uploaded project images on the local disk (a mounted
// volume). It downscales and re-encodes to WebP so files stay small and uniform.
type ImageService struct {
	dir string
}

func NewImageService(dir string) *ImageService {
	return &ImageService{dir: dir}
}

// Save reads an uploaded image, downscales it to maxDimension, re-encodes it as
// WebP, writes it under the uploads dir, and returns its public path
// ("/uploads/<file>").
func (s *ImageService) Save(r io.Reader) (string, error) {
	data, err := io.ReadAll(io.LimitReader(r, maxUploadBytes+1))
	if err != nil {
		return "", err
	}
	if len(data) > maxUploadBytes {
		return "", errors.New("image exceeds the 15MB limit")
	}

	src, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return "", errors.New("unsupported or corrupt image file")
	}

	dst := downscale(src, maxDimension)

	if err := os.MkdirAll(s.dir, 0o755); err != nil {
		return "", err
	}

	suffix, err := randomHex(8)
	if err != nil {
		return "", err
	}
	filename := fmt.Sprintf("img-%s.webp", suffix)

	file, err := os.Create(filepath.Join(s.dir, filename))
	if err != nil {
		return "", err
	}
	defer file.Close()

	if err := webp.Encode(file, dst, &webp.EncoderOptions{
		Quality: webpQuality,
		Method:  webpMethod,
		Exact:   true,
	}); err != nil {
		return "", err
	}

	return uploadURLBase + "/" + filename, nil
}

// Delete removes a locally stored image given its public path. It is a safe
// no-op for empty values or external URLs.
func (s *ImageService) Delete(publicPath string) {
	if !strings.HasPrefix(publicPath, uploadURLBase+"/") {
		return
	}
	_ = os.Remove(filepath.Join(s.dir, filepath.Base(publicPath)))
}

func downscale(src image.Image, max int) image.Image {
	bounds := src.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w <= max && h <= max {
		return src
	}

	nw, nh := w, h
	if w >= h {
		nw = max
		nh = int(float64(h) * float64(max) / float64(w))
	} else {
		nh = max
		nw = int(float64(w) * float64(max) / float64(h))
	}

	dst := image.NewRGBA(image.Rect(0, 0, nw, nh))
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, bounds, draw.Over, nil)
	return dst
}

func randomHex(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
