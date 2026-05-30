-- ============================================================
-- Local Event Booking Platform - MySQL Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS EventBookingDb CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE EventBookingDb;

-- ============================================================
-- Users
-- ============================================================
CREATE TABLE IF NOT EXISTS Users (
    Id          INT AUTO_INCREMENT PRIMARY KEY,
    Name        VARCHAR(150) NOT NULL,
    Email       VARCHAR(255) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    Role        ENUM('User','Organizer','Admin') NOT NULL DEFAULT 'User',
    Phone       VARCHAR(30),
    CreatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    IsActive    TINYINT(1) NOT NULL DEFAULT 1,
    INDEX idx_users_email (Email)
) ENGINE=InnoDB;

-- ============================================================
-- Events
-- ============================================================
CREATE TABLE IF NOT EXISTS Events (
    Id            INT AUTO_INCREMENT PRIMARY KEY,
    Title         VARCHAR(255) NOT NULL,
    Description   TEXT NOT NULL,
    Category      ENUM('Music','Sports','Technology','Food','Art','Business','Health','Other') NOT NULL,
    Status        ENUM('Draft','Published','Cancelled','Completed') NOT NULL DEFAULT 'Draft',
    StartDateTime DATETIME NOT NULL,
    EndDateTime   DATETIME NOT NULL,
    Venue         VARCHAR(255) NOT NULL,
    City          VARCHAR(100) NOT NULL,
    Address       VARCHAR(400),
    ImageUrl      VARCHAR(500),
    TicketPrice   DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    TotalTickets  INT NOT NULL,
    BookedTickets INT NOT NULL DEFAULT 0,
    OrganizerId   INT NOT NULL,
    CreatedAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_events_organizer FOREIGN KEY (OrganizerId) REFERENCES Users(Id) ON DELETE RESTRICT,
    INDEX idx_events_status (Status),
    INDEX idx_events_city (City),
    INDEX idx_events_category (Category),
    INDEX idx_events_start (StartDateTime)
) ENGINE=InnoDB;

-- ============================================================
-- Bookings
-- ============================================================
CREATE TABLE IF NOT EXISTS Bookings (
    Id               INT AUTO_INCREMENT PRIMARY KEY,
    BookingReference VARCHAR(50) NOT NULL UNIQUE,
    UserId           INT NOT NULL,
    EventId          INT NOT NULL,
    TicketCount      INT NOT NULL,
    TotalAmount      DECIMAL(18,2) NOT NULL,
    Status           ENUM('Pending','Confirmed','Cancelled','Refunded') NOT NULL DEFAULT 'Confirmed',
    BookedAt         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CancelledAt      DATETIME,
    Notes            TEXT,
    CONSTRAINT fk_bookings_user  FOREIGN KEY (UserId)  REFERENCES Users(Id)  ON DELETE RESTRICT,
    CONSTRAINT fk_bookings_event FOREIGN KEY (EventId) REFERENCES Events(Id) ON DELETE RESTRICT,
    INDEX idx_bookings_user   (UserId),
    INDEX idx_bookings_event  (EventId),
    INDEX idx_bookings_status (Status),
    INDEX idx_bookings_ref    (BookingReference)
) ENGINE=InnoDB;

-- ============================================================
-- Tickets
-- ============================================================
CREATE TABLE IF NOT EXISTS Tickets (
    Id             INT AUTO_INCREMENT PRIMARY KEY,
    TicketNumber   VARCHAR(100) NOT NULL UNIQUE,
    BookingId      INT NOT NULL,
    AttendeeeName  VARCHAR(150) NOT NULL,
    AttendeeEmail  VARCHAR(255) NOT NULL,
    IsUsed         TINYINT(1) NOT NULL DEFAULT 0,
    IssuedAt       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tickets_booking FOREIGN KEY (BookingId) REFERENCES Bookings(Id) ON DELETE CASCADE,
    INDEX idx_tickets_booking (BookingId)
) ENGINE=InnoDB;

-- ============================================================
-- EF Core Migrations history table (created by EF automatically)
-- ============================================================

-- ============================================================
-- Sample Data
-- ============================================================

-- Admin user (password: Admin@123)
INSERT INTO Users (Name, Email, PasswordHash, Role) VALUES
('Admin User', 'admin@eventbook.com', '$2a$11$examplehashadmin', 'Admin');

-- Sample Organizer (password: Organizer@123)
INSERT INTO Users (Name, Email, PasswordHash, Role) VALUES
('Event Organizer', 'organizer@eventbook.com', '$2a$11$examplehashorg', 'Organizer');

-- Sample Events (OrganizerId = 2)
INSERT INTO Events (Title, Description, Category, Status, StartDateTime, EndDateTime, Venue, City, TicketPrice, TotalTickets, OrganizerId) VALUES
('Summer Music Festival', 'An incredible outdoor music festival featuring top artists.', 'Music', 'Published', DATE_ADD(NOW(), INTERVAL 30 DAY), DATE_ADD(NOW(), INTERVAL 31 DAY), 'City Park Amphitheater', 'Los Angeles', 49.99, 500, 2),
('Tech Innovation Summit 2026', 'The biggest tech conference of the year.', 'Technology', 'Published', DATE_ADD(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 16 DAY), 'Convention Center', 'San Francisco', 149.00, 300, 2),
('Street Food Carnival', 'Taste the best street food from 50+ vendors.', 'Food', 'Published', DATE_ADD(NOW(), INTERVAL 7 DAY), DATE_ADD(NOW(), INTERVAL 7 DAY), 'Downtown Square', 'Chicago', 0.00, 1000, 2);
