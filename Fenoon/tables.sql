DROP TABLE IF EXISTS profile;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    userId INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    passwordHash VARCHAR(255) NOT NULL,
    phoneNumber VARCHAR(16),
    preferences JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE profile (
    userId INT PRIMARY KEY,
    displayName VARCHAR(100) NOT NULL,
    bio TEXT,
    location_opt VARCHAR(100),
    avatar_url VARCHAR(255),
    website VARCHAR(255),
    is_public BOOLEAN NOT NULL DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_profile_user
        FOREIGN KEY (userId)
        REFERENCES users(userId)
        ON DELETE CASCADE
);

