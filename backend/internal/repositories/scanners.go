package repositories

import "creativexvoting/backend/internal/models"

type userScanner interface {
	Scan(dest ...any) error
}

type projectScanner interface {
	Scan(dest ...any) error
}

func scanUser(scanner userScanner) (models.User, error) {
	var user models.User
	err := scanner.Scan(
		&user.ID,
		&user.Username,
		&user.DisplayName,
		&user.PasswordHash,
		&user.Role,
		&user.IsActive,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	return user, err
}

func scanProject(scanner projectScanner) (models.Project, error) {
	var project models.Project
	err := scanner.Scan(
		&project.ID,
		&project.CategoryID,
		&project.CategoryName,
		&project.Title,
		&project.ShortDescription,
		&project.FullDescription,
		&project.Concept,
		&project.DesignerName,
		&project.TeamName,
		&project.ImageURL,
		&project.ImageSourceURL,
		&project.SocialMediaLink,
		&project.DriveLink,
		&project.ExtraDetails,
		&project.IsActive,
		&project.CreatedAt,
		&project.UpdatedAt,
	)
	return project, err
}
