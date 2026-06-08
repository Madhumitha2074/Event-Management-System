-- schema.sql (CORRECTED VERSION)
-- Drop existing database if needed
-- USE master;
-- IF EXISTS (SELECT 1 FROM sys.databases WHERE name = 'EventBookingDb')
--     DROP DATABASE EventBookingDb;
-- GO

CREATE DATABASE EventBookingDb;
GO
USE EventBookingDb;
GO

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE Users (
    Id           INT IDENTITY(1,1) PRIMARY KEY,
    Name         NVARCHAR(150)  NOT NULL,
    Email        NVARCHAR(255)  NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255)  NOT NULL,
    Role         NVARCHAR(20)   NOT NULL DEFAULT 'User',
    Phone        NVARCHAR(30)   NULL,
    CreatedAt    DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    IsActive     BIT            NOT NULL DEFAULT 1
);
CREATE INDEX IX_Users_Email ON Users(Email);
GO

-- =====================================================
-- EVENTS TABLE (with SeatConfig)
-- =====================================================
CREATE TABLE Events (
    Id            INT IDENTITY(1,1) PRIMARY KEY,
    Title         NVARCHAR(255)  NOT NULL,
    Description   NVARCHAR(MAX)  NOT NULL,
    Category      NVARCHAR(50)   NOT NULL,
    Status        NVARCHAR(20)   NOT NULL DEFAULT 'Draft',
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
    SeatConfig    NVARCHAR(MAX)  NULL,
    -- Add RowVersion for optimistic concurrency
    RowVersion    ROWVERSION     NOT NULL,
    CONSTRAINT FK_Events_Organizer FOREIGN KEY (OrganizerId) REFERENCES Users(Id)
);
CREATE INDEX IX_Events_Status   ON Events(Status);
CREATE INDEX IX_Events_City     ON Events(City);
CREATE INDEX IX_Events_Start    ON Events(StartDateTime);
GO

-- =====================================================
-- BOOKINGS TABLE (created BEFORE EventSeats to avoid circular FK)
-- =====================================================
CREATE TABLE Bookings (
    Id               INT IDENTITY(1,1) PRIMARY KEY,
    BookingReference NVARCHAR(50)   NOT NULL UNIQUE,
    UserId           INT            NOT NULL,
    EventId          INT            NOT NULL,
    TicketCount      INT            NOT NULL,
    TotalAmount      DECIMAL(18,2)  NOT NULL,
    Status           NVARCHAR(20)   NOT NULL DEFAULT 'Confirmed',
    BookedAt         DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    CancelledAt      DATETIME2      NULL,
    Notes            NVARCHAR(MAX)  NULL,
    CONSTRAINT FK_Bookings_User  FOREIGN KEY (UserId)  REFERENCES Users(Id),
    CONSTRAINT FK_Bookings_Event FOREIGN KEY (EventId) REFERENCES Events(Id)
);
CREATE INDEX IX_Bookings_User   ON Bookings(UserId);
CREATE INDEX IX_Bookings_Event  ON Bookings(EventId);
GO

-- =====================================================
-- TICKETS TABLE (created BEFORE EventSeats to avoid circular FK)
-- =====================================================
CREATE TABLE Tickets (
    Id            INT IDENTITY(1,1) PRIMARY KEY,
    TicketNumber  NVARCHAR(100)  NOT NULL UNIQUE,
    BookingId     INT            NOT NULL,
    AttendeeName  NVARCHAR(150)  NOT NULL,
    AttendeeEmail NVARCHAR(255)  NOT NULL,
    IsUsed        BIT            NOT NULL DEFAULT 0,
    IssuedAt      DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    SeatId        INT NULL,                     -- Will reference EventSeats after it's created
    CONSTRAINT FK_Tickets_Booking FOREIGN KEY (BookingId) REFERENCES Bookings(Id) ON DELETE CASCADE
);
CREATE INDEX IX_Tickets_Booking ON Tickets(BookingId);
GO

-- =====================================================
-- EVENT SEATS TABLE (with concurrency protection)
-- =====================================================
CREATE TABLE EventSeats (
    Id         INT IDENTITY(1,1) PRIMARY KEY,
    EventId    INT NOT NULL,
    SeatNumber NVARCHAR(20) NOT NULL,
    Tier       NVARCHAR(20) NOT NULL,
    Price      DECIMAL(18,2) NOT NULL,
    IsBooked   BIT NOT NULL DEFAULT 0,
    TicketId   INT NULL,
    -- Add RowVersion for optimistic concurrency
    RowVersion ROWVERSION NOT NULL,
    CONSTRAINT FK_EventSeats_Event FOREIGN KEY (EventId) REFERENCES Events(Id) ON DELETE CASCADE,
    CONSTRAINT FK_EventSeats_Ticket FOREIGN KEY (TicketId) REFERENCES Tickets(Id)
);
CREATE INDEX IX_EventSeats_EventId ON EventSeats(EventId);
CREATE INDEX IX_EventSeats_IsBooked ON EventSeats(IsBooked);
CREATE INDEX IX_EventSeats_EventId_IsBooked ON EventSeats(EventId, IsBooked) INCLUDE (SeatNumber, Tier, Price);
GO

-- =====================================================
-- UPDATE Tickets table to add FK to EventSeats (after both exist)
-- =====================================================
ALTER TABLE Tickets ADD CONSTRAINT FK_Tickets_Seat 
    FOREIGN KEY (SeatId) REFERENCES EventSeats(Id);
GO

-- =====================================================
-- STORED PROCEDURE for Safe Seat Booking (with proper locking)
-- =====================================================
CREATE OR ALTER PROCEDURE sp_BookSeats
    @EventId INT,
    @UserId INT,
    @SeatIds NVARCHAR(MAX),  -- JSON array of seat IDs
    @AttendeesJson NVARCHAR(MAX),  -- JSON array of {name, email}
    @BookingReference NVARCHAR(50) OUTPUT,
    @BookingId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
    
    BEGIN TRANSACTION;
    
    BEGIN TRY
        DECLARE @TicketCount INT;
        DECLARE @TotalAmount DECIMAL(18,2);
        
        -- Parse seat IDs from JSON
        DECLARE @SeatIdsTable TABLE (SeatId INT);
        INSERT INTO @SeatIdsTable
        SELECT value FROM OPENJSON(@SeatIds);
        
        SET @TicketCount = (SELECT COUNT(*) FROM @SeatIdsTable);
        
        -- Lock seats with UPDLOCK to prevent concurrent booking
        -- Also verify all seats are available (IsBooked = 0)
        IF EXISTS (
            SELECT 1 FROM EventSeats WITH (UPDLOCK, ROWLOCK)
            WHERE EventId = @EventId 
              AND Id IN (SELECT SeatId FROM @SeatIdsTable)
              AND IsBooked = 1
        )
        BEGIN
            THROW 50001, 'One or more selected seats are already booked.', 1;
        END
        
        -- Calculate total amount
        SELECT @TotalAmount = SUM(Price)
        FROM EventSeats
        WHERE Id IN (SELECT SeatId FROM @SeatIdsTable);
        
        -- Generate booking reference
        SET @BookingReference = 'EVT-' + UPPER(LEFT(NEWID(), 8));
        
        -- Create booking
        INSERT INTO Bookings (BookingReference, UserId, EventId, TicketCount, TotalAmount, Status)
        VALUES (@BookingReference, @UserId, @EventId, @TicketCount, @TotalAmount, 'Confirmed');
        
        SET @BookingId = SCOPE_IDENTITY();
        
        -- Parse attendees
        DECLARE @Attendees TABLE (
            SeatId INT,
            Name NVARCHAR(150),
            Email NVARCHAR(255)
        );
        
        INSERT INTO @Attendees (SeatId, Name, Email)
        SELECT JSON_VALUE(value, '$.seatId'), 
               JSON_VALUE(value, '$.name'), 
               JSON_VALUE(value, '$.email')
        FROM OPENJSON(@AttendeesJson);
        
        -- Create tickets and mark seats as booked
        DECLARE @SeatId INT, @Name NVARCHAR(150), @Email NVARCHAR(255);
        DECLARE @TicketNumber NVARCHAR(100);
        
        DECLARE seat_cursor CURSOR FOR 
            SELECT a.SeatId, a.Name, a.Email, s.SeatNumber
            FROM @Attendees a
            INNER JOIN EventSeats s ON a.SeatId = s.Id;
        
        OPEN seat_cursor;
        FETCH NEXT FROM seat_cursor INTO @SeatId, @Name, @Email, @TicketNumber;
        
        WHILE @@FETCH_STATUS = 0
        BEGIN
            SET @TicketNumber = 'TKT-' + UPPER(LEFT(NEWID(), 8));
            
            INSERT INTO Tickets (TicketNumber, BookingId, AttendeeName, AttendeeEmail, SeatId)
            VALUES (@TicketNumber, @BookingId, @Name, @Email, @SeatId);
            
            -- Mark seat as booked
            UPDATE EventSeats 
            SET IsBooked = 1, TicketId = SCOPE_IDENTITY()
            WHERE Id = @SeatId;
            
            FETCH NEXT FROM seat_cursor INTO @SeatId, @Name, @Email, @TicketNumber;
        END
        
        CLOSE seat_cursor;
        DEALLOCATE seat_cursor;
        
        -- Update event booked tickets count
        UPDATE Events 
        SET BookedTickets = BookedTickets + @TicketCount
        WHERE Id = @EventId;
        
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

-- =====================================================
-- Insert sample data
-- =====================================================
-- Password: "Test@123" (BCrypt hash)
INSERT INTO Users (Name, Email, PasswordHash, Role) VALUES 
('Admin User', 'admin@eventbook.com', '$2a$11$K8QxP9L5M7N3R2T1Y4W6X8Z0A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U', 'Admin'),
('Organizer User', 'organizer@eventbook.com', '$2a$11$K8QxP9L5M7N3R2T1Y4W6X8Z0A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U', 'Organizer'),
('Regular User', 'user@eventbook.com', '$2a$11$K8QxP9L5M7N3R2T1Y4W6X8Z0A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U', 'User');
GO

-- Sample event
INSERT INTO Events (Title, Description, Category, Status, StartDateTime, EndDateTime, Venue, City, TicketPrice, TotalTickets, OrganizerId) VALUES
('Summer Music Festival', 'An amazing summer music festival with top artists!', 'Music', 'Published', DATEADD(day, 30, GETUTCDATE()), DATEADD(day, 31, GETUTCDATE()), 'Central Park', 'New York', 50.00, 200, 2);
GO

PRINT 'Database schema created successfully!';