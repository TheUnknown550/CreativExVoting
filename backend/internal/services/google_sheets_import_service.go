package services

import "errors"

type GoogleSheetsImportService struct{}

func NewGoogleSheetsImportService() *GoogleSheetsImportService {
	return &GoogleSheetsImportService{}
}

func (s *GoogleSheetsImportService) Import() error {
	return errors.New("not implemented yet")
}
