-- schema.sql (SQL Server version)

CREATE DATABASE EventBookingDb;
GO
USE EventBookingDb;
GO

-- Users
CREATE TABLE Users (
    Id           INT IDENTITY(1,1) PRIMARY KEY,
    Name         NVARCHAR(150)  NOT NULL,
    Email        NVARCHAR(255)  NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255)  NOT NULL,
    Role         NVARCHAR(20)   NOT NULL DEFAULT 'User',  -- 'User','Organizer','Admin'
    Phone        NVARCHAR(30)   NULL,
    CreatedAt    DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    IsActive     BIT            NOT NULL DEFAULT 1
);
CREATE INDEX IX_Users_Email ON Users(Email);
GO

-- Events
CREATE TABLE Events (
    Id            INT IDENTITY(1,1) PRIMARY KEY,
    Title         NVARCHAR(255)  NOT NULL,
    Description   NVARCHAR(MAX)  NOT NULL,
    Category      NVARCHAR(50)   NOT NULL,   -- 'Music','Sports','Technology', etc.
    Status        NVARCHAR(20)   NOT NULL DEFAULT 'Draft', -- 'Draft','Published','Cancelled','Completed'
    StartDateTime DATETIME2      NOT NULL,
    EndDateTime   DATETIME2      NOT NULL,
    Venue         NVARCHAR(255)  NOT NULL,
    City          NVARCHAR(100)  NOT NULL,
    Address       NVARCHAR(400)  NULL,
    ImageUrl      NVARCHAR(500)  NULL,
    TicketPrice   DECIMAL(18,2)  NOT NULL DEFAULT 0.00,
    TotalTickets  INT            NOT NULL,
    BookedTickets INT            NOT NULL DEFAULT 0,
    OrganizerId   INT            NOT NULL,
    CreatedAt     DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    UpdatedAt     DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_Events_Organizer FOREIGN KEY (OrganizerId) REFERENCES Users(Id)
);
CREATE INDEX IX_Events_Status   ON Events(Status);
CREATE INDEX IX_Events_City     ON Events(City);
CREATE INDEX IX_Events_Category ON Events(Category);
CREATE INDEX IX_Events_Start    ON Events(StartDateTime);
GO

-- Bookings
CREATE TABLE Bookings (
    Id               INT IDENTITY(1,1) PRIMARY KEY,
    BookingReference NVARCHAR(50)   NOT NULL UNIQUE,
    UserId           INT            NOT NULL,
    EventId          INT            NOT NULL,
    TicketCount      INT            NOT NULL,
    TotalAmount      DECIMAL(18,2)  NOT NULL,
    Status           NVARCHAR(20)   NOT NULL DEFAULT 'Confirmed', -- 'Pending','Confirmed','Cancelled','Refunded'
    BookedAt         DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    CancelledAt      DATETIME2      NULL,
    Notes            NVARCHAR(MAX)  NULL,
    CONSTRAINT FK_Bookings_User  FOREIGN KEY (UserId)  REFERENCES Users(Id),
    CONSTRAINT FK_Bookings_Event FOREIGN KEY (EventId) REFERENCES Events(Id)
);
CREATE INDEX IX_Bookings_User   ON Bookings(UserId);
CREATE INDEX IX_Bookings_Event  ON Bookings(EventId);
CREATE INDEX IX_Bookings_Status ON Bookings(Status);
GO

-- Tickets
CREATE TABLE Tickets (
    Id            INT IDENTITY(1,1) PRIMARY KEY,
    TicketNumber  NVARCHAR(100)  NOT NULL UNIQUE,
    BookingId     INT            NOT NULL,
    AttendeeName  NVARCHAR(150)  NOT NULL,
    AttendeeEmail NVARCHAR(255)  NOT NULL,
    IsUsed        BIT            NOT NULL DEFAULT 0,
    IssuedAt      DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_Tickets_Booking FOREIGN KEY (BookingId) REFERENCES Bookings(Id) ON DELETE CASCADE
);
CREATE INDEX IX_Tickets_Booking ON Tickets(BookingId);
GO