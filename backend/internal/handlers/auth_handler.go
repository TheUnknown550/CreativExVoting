package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"creativexvoting/backend/internal/services"
	"creativexvoting/backend/internal/utils"
)

type AuthHandler struct {
	authService *services.AuthService
}

func NewAuthHandler(authService *services.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		utils.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	response, err := h.authService.Login(r.Context(), strings.TrimSpace(request.Username), request.Password)
	if err != nil {
		utils.Error(w, http.StatusUnauthorized, err.Error())
		return
	}

	utils.Success(w, http.StatusOK, response)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	header := r.Header.Get("Authorization")
	if header == "" {
		utils.Error(w, http.StatusUnauthorized, "missing authorization header")
		return
	}

	token := strings.TrimSpace(strings.TrimPrefix(header, "Bearer"))
	user, err := h.authService.GetCurrentUser(r.Context(), token)
	if err != nil {
		utils.Error(w, http.StatusUnauthorized, "invalid or expired token")
		return
	}

	utils.Success(w, http.StatusOK, user)
}
