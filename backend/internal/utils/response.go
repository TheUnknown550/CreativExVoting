package utils

import (
	"encoding/json"
	"net/http"

	"creativexvoting/backend/internal/models"
)

func WriteJSON(w http.ResponseWriter, status int, payload models.APIResponse) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func Success(w http.ResponseWriter, status int, data any) {
	WriteJSON(w, status, models.APIResponse{
		Success: true,
		Data:    data,
	})
}

func Error(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, models.APIResponse{
		Success: false,
		Error:   message,
	})
}
