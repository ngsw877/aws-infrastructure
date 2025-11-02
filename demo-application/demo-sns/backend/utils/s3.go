package utils

import (
	"bytes"
	"demo-sns-backend/config"
	"fmt"
	"io"
	"mime/multipart"
	"path/filepath"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
)

type S3Uploader struct {
	client *s3.S3
	bucket string
	cfg    *config.Config
}

func NewS3Uploader(cfg *config.Config) (*S3Uploader, error) {
	sess, err := session.NewSession(&aws.Config{
		Region:           aws.String(cfg.AWSRegion),
		Credentials:      credentials.NewStaticCredentials(cfg.AWSAccessKeyID, cfg.AWSSecretAccessKey, ""),
		Endpoint:         aws.String(cfg.AWSEndpoint),
		S3ForcePathStyle: aws.Bool(true),
	})
	if err != nil {
		return nil, err
	}

	return &S3Uploader{
		client: s3.New(sess),
		bucket: cfg.AWSBucket,
		cfg:    cfg,
	}, nil
}

func (u *S3Uploader) UploadFile(file *multipart.FileHeader, folder string) (string, error) {
	src, err := file.Open()
	if err != nil {
		return "", err
	}
	defer src.Close()

	buf := new(bytes.Buffer)
	if _, err := io.Copy(buf, src); err != nil {
		return "", err
	}

	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%s/%d%s", folder, time.Now().UnixNano(), ext)

	_, err = u.client.PutObject(&s3.PutObjectInput{
		Bucket:      aws.String(u.bucket),
		Key:         aws.String(filename),
		Body:        bytes.NewReader(buf.Bytes()),
		ContentType: aws.String(file.Header.Get("Content-Type")),
	})
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("%s/%s/%s", u.cfg.AWSEndpoint, u.bucket, filename)
	return url, nil
}
