package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	chi "github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"creativexvoting/backend/internal/config"
	"creativexvoting/backend/internal/db"
	"creativexvoting/backend/internal/handlers"
	appMiddleware "creativexvoting/backend/internal/middleware"
	"creativexvoting/backend/internal/models"
	"creativexvoting/backend/internal/repositories"
	"creativexvoting/backend/internal/services"
)

func main() {
	createAdmin := flag.Bool("create-admin", false, "create or update the first admin account")
	seedDemo := flag.Bool("seed-demo", false, "seed demo data and exit")
	adminUsername := flag.String("username", os.Getenv("ADMIN_USERNAME"), "admin username")
	adminPassword := flag.String("password", os.Getenv("ADMIN_PASSWORD"), "admin password")
	adminDisplayName := flag.String("display-name", os.Getenv("ADMIN_DISPLAY_NAME"), "admin display name")
	flag.Parse()

	cfg := config.Load()
	ctx := context.Background()

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer pool.Close()

	if err := db.RunMigrations(ctx, pool, cfg.MigrationsDir); err != nil {
		log.Fatalf("migration failed: %v", err)
	}

	authRepo := repositories.NewAuthRepository(pool)
	adminRepo := repositories.NewAdminRepository(pool)
	judgeRepo := repositories.NewJudgeRepository(pool)

	authService := services.NewAuthService(authRepo, cfg.JWTSecret)
	adminService := services.NewAdminService(adminRepo)
	judgeService := services.NewJudgeService(judgeRepo)
	importService := services.NewGoogleSheetsImportService()
	demoSeedService := services.NewDemoSeedService(pool, authRepo)

	if *createAdmin {
		if *adminUsername == "" || *adminPassword == "" || *adminDisplayName == "" {
			log.Fatal("username, password, and display-name are required for --create-admin")
		}
		if err := authService.CreateOrUpdateAdmin(ctx, *adminUsername, *adminPassword, *adminDisplayName); err != nil {
			log.Fatalf("create admin failed: %v", err)
		}
		fmt.Println("admin account created or updated successfully")
		return
	}

	if cfg.SeedDemoData || *seedDemo {
		if err := demoSeedService.Seed(ctx); err != nil {
			log.Fatalf("demo seed failed: %v", err)
		}
		log.Println("demo data seeded successfully")
		if *seedDemo {
			return
		}
	}

	router := chi.NewRouter()
	router.Use(chiMiddleware.RequestID)
	router.Use(chiMiddleware.RealIP)
	router.Use(chiMiddleware.Logger)
	router.Use(chiMiddleware.Recoverer)
	router.Use(chiMiddleware.Timeout(60 * time.Second))
	router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.AllowedFrontendOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	authHandler := handlers.NewAuthHandler(authService)
	judgeHandler := handlers.NewJudgeHandler(judgeService)
	adminHandler := handlers.NewAdminHandler(adminService, importService)

	router.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	router.Route("/api", func(api chi.Router) {
		api.Route("/auth", func(auth chi.Router) {
			auth.Post("/login", authHandler.Login)
			auth.Get("/me", authHandler.Me)
		})

		api.Group(func(secured chi.Router) {
			secured.Use(appMiddleware.RequireAuth(authService))

			secured.Route("/judge", func(judge chi.Router) {
				judge.Use(appMiddleware.RequireRole(models.RoleJudge))
				judge.Get("/groups", judgeHandler.Groups)
				judge.Get("/categories", judgeHandler.Categories)
				judge.Get("/projects", judgeHandler.Projects)
				judge.Get("/projects/{id}", judgeHandler.ProjectDetail)
				judge.Get("/projects/{id}/my-vote", judgeHandler.MyVote)
				judge.Post("/projects/{id}/vote", judgeHandler.SubmitVote)
				judge.Put("/projects/{id}/vote", judgeHandler.SubmitVote)
				judge.Get("/summary", judgeHandler.Summary)
			})

			secured.Route("/admin", func(admin chi.Router) {
				admin.Use(appMiddleware.RequireRole(models.RoleAdmin))
				admin.Get("/dashboard", adminHandler.Dashboard)

				admin.Get("/groups", adminHandler.ListAwardGroups)

				admin.Get("/categories", adminHandler.ListCategories)
				admin.Post("/categories", adminHandler.CreateCategory)
				admin.Put("/categories/{id}", adminHandler.UpdateCategory)
				admin.Delete("/categories/{id}", adminHandler.DeleteCategory)

				admin.Get("/projects", adminHandler.ListProjects)
				admin.Post("/projects", adminHandler.CreateProject)
				admin.Put("/projects/{id}", adminHandler.UpdateProject)
				admin.Delete("/projects/{id}", adminHandler.DeleteProject)
				admin.Get("/projects/{id}/vote-details", adminHandler.ProjectVoteDetail)

				admin.Get("/criteria", adminHandler.ListCriteria)
				admin.Post("/criteria", adminHandler.CreateCriterion)
				admin.Put("/criteria/{id}", adminHandler.UpdateCriterion)
				admin.Delete("/criteria/{id}", adminHandler.DeleteCriterion)

				admin.Get("/judges", adminHandler.ListJudges)
				admin.Post("/judges", adminHandler.CreateJudge)
				admin.Put("/judges/{id}", adminHandler.UpdateJudge)
				admin.Delete("/judges/{id}", adminHandler.DeleteJudge)
				admin.Post("/judges/{id}/reset-password", adminHandler.ResetPassword)
				admin.Get("/judges/{id}/groups", adminHandler.GetJudgeAssignments)
				admin.Post("/judges/{id}/groups", adminHandler.ReplaceJudgeAssignments)
				admin.Delete("/judges/{id}/groups/{group_id}", adminHandler.DeleteJudgeAssignment)

				admin.Get("/results", adminHandler.Results)
				admin.Get("/results/export.csv", adminHandler.ExportResults)
				admin.Post("/import/google-sheets", adminHandler.ImportGoogleSheets)
			})
		})
	})

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("backend listening on :%s", cfg.Port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server failed: %v", err)
	}
}
