-- schema.sql (SQL Server version) - COMPLETE WITH SEAT CONFIGURATION

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

-- Events (UPDATED with SeatConfig column)
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
    SeatConfig    NVARCHAR(MAX)  NULL,       -- JSON string storing seat tier configuration
    CONSTRAINT FK_Events_Organizer FOREIGN KEY (OrganizerId) REFERENCES Users(Id)
);
CREATE INDEX IX_Events_Status   ON Events(Status);
CREATE INDEX IX_Events_City     ON Events(City);
CREATE INDEX IX_Events_Category ON Events(Category);
CREATE INDEX IX_Events_Start    ON Events(StartDateTime);
GO

-- EventSeats (NEW TABLE - individual seats for events with seat maps)
CREATE TABLE EventSeats (
    Id         INT IDENTITY(1,1) PRIMARY KEY,
    EventId    INT NOT NULL,
    SeatNumber NVARCHAR(20) NOT NULL,      -- e.g., "P-A1", "O-B12", "E-C5"
    Tier       NVARCHAR(20) NOT NULL,      -- 'Premium', 'Ordinary', 'Economy'
    Price      DECIMAL(18,2) NOT NULL,
    IsBooked   BIT NOT NULL DEFAULT 0,
    TicketId   INT NULL,                    -- References Ticket when booked
    CONSTRAINT FK_EventSeats_Event FOREIGN KEY (EventId) REFERENCES Events(Id) ON DELETE CASCADE,
    CONSTRAINT FK_EventSeats_Ticket FOREIGN KEY (TicketId) REFERENCES Tickets(Id)
);
CREATE INDEX IX_EventSeats_EventId ON EventSeats(EventId);
CREATE INDEX IX_EventSeats_IsBooked ON EventSeats(IsBooked);
CREATE INDEX IX_EventSeats_TicketId ON EventSeats(TicketId);
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

-- Tickets (UPDATED with SeatId column)
CREATE TABLE Tickets (
    Id            INT IDENTITY(1,1) PRIMARY KEY,
    TicketNumber  NVARCHAR(100)  NOT NULL UNIQUE,
    BookingId     INT            NOT NULL,
    AttendeeName  NVARCHAR(150)  NOT NULL,
    AttendeeEmail NVARCHAR(255)  NOT NULL,
    IsUsed        BIT            NOT NULL DEFAULT 0,
    IssuedAt      DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    SeatId        INT NULL,                     -- References specific seat if seat map is enabled
    CONSTRAINT FK_Tickets_Booking FOREIGN KEY (BookingId) REFERENCES Bookings(Id) ON DELETE CASCADE,
    CONSTRAINT FK_Tickets_Seat FOREIGN KEY (SeatId) REFERENCES EventSeats(Id)
);
CREATE INDEX IX_Tickets_Booking ON Tickets(BookingId);
CREATE INDEX IX_Tickets_SeatId ON Tickets(SeatId);
GO

-- Insert sample data (optional - for testing)
INSERT INTO Users (Name, Email, PasswordHash, Role) VALUES 
('Admin User', 'admin@eventbook.com', '$2a$11$K8QxP9L5M7N3R2T1Y4W6X8Z0A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U', 'Admin'),
('Organizer User', 'organizer@eventbook.com', '$2a$11$K8QxP9L5M7N3R2T1Y4W6X8Z0A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U', 'Organizer'),
('Regular User', 'user@eventbook.com', '$2a$11$K8QxP9L5M7N3R2T1Y4W6X8Z0A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U', 'User');
GO

-- Insert sample event with seat configuration
INSERT INTO Events (Title, Description, Category, Status, StartDateTime, EndDateTime, Venue, City, Address, TicketPrice, TotalTickets, BookedTickets, OrganizerId, SeatConfig) VALUES
('Summer Music Festival', 'An amazing summer music festival with top artists!', 'Music', 'Published', DATEADD(day, 30, GETUTCDATE()), DATEADD(day, 31, GETUTCDATE()), 'Central Park', 'New York', 'Central Park Main Stage', 50.00, 100, 0, 2, '{"seatTiers":[{"tier":"Premium","rows":5,"seatsPerRow":10,"price":100},{"tier":"Ordinary","rows":10,"seatsPerRow":10,"price":50},{"tier":"Economy","rows":5,"seatsPerRow":10,"price":25}]}');
GO

-- Generate seats for the sample event (EventId = 1)
DECLARE @EventId INT = 1;

-- Premium tier seats (5 rows × 10 seats = 50 seats)
DECLARE @RowNum INT = 0;
WHILE @RowNum < 5
BEGIN
    DECLARE @SeatNum INT = 1;
    DECLARE @RowLabel CHAR(1) = CHAR(65 + @RowNum); -- A, B, C, D, E
    WHILE @SeatNum <= 10
    BEGIN
        INSERT INTO EventSeats (EventId, SeatNumber, Tier, Price, IsBooked)
        VALUES (@EventId, 'P-' + @RowLabel + CAST(@SeatNum AS VARCHAR), 'Premium', 100.00, 0);
        SET @SeatNum = @SeatNum + 1;
    END
    SET @RowNum = @RowNum + 1;
END

-- Ordinary tier seats (10 rows × 10 seats = 100 seats)
SET @RowNum = 0;
WHILE @RowNum < 10
BEGIN
    SET @SeatNum = 1;
    SET @RowLabel = CHAR(65 + @RowNum); -- F, G, H, I, J, K, L, M, N, O
    WHILE @SeatNum <= 10
    BEGIN
        INSERT INTO EventSeats (EventId, SeatNumber, Tier, Price, IsBooked)
        VALUES (@EventId, 'O-' + @RowLabel + CAST(@SeatNum AS VARCHAR), 'Ordinary', 50.00, 0);
        SET @SeatNum = @SeatNum + 1;
    END
    SET @RowNum = @RowNum + 1;
END

-- Economy tier seats (5 rows × 10 seats = 50 seats)
SET @RowNum = 0;
WHILE @RowNum < 5
BEGIN
    SET @SeatNum = 1;
    SET @RowLabel = CHAR(65 + @RowNum); -- P, Q, R, S, T
    WHILE @SeatNum <= 10
    BEGIN
        INSERT INTO EventSeats (EventId, SeatNumber, Tier, Price, IsBooked)
        VALUES (@EventId, 'E-' + @RowLabel + CAST(@SeatNum AS VARCHAR), 'Economy', 25.00, 0);
        SET @SeatNum = @SeatNum + 1;
    END
    SET @RowNum = @RowNum + 1;
END
GO

-- Create stored procedure to generate seats for new events (optional)
CREATE OR ALTER PROCEDURE sp_GenerateEventSeats
    @EventId INT,
    @SeatConfig NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Delete existing seats if any
    DELETE FROM EventSeats WHERE EventId = @EventId;
    
    -- Parse JSON and insert seats
    DECLARE @TierConfig TABLE (
        Tier NVARCHAR(20),
        Rows INT,
        SeatsPerRow INT,
        Price DECIMAL(18,2)
    );
    
    INSERT INTO @TierConfig (Tier, Rows, SeatsPerRow, Price)
    SELECT 
        JSON_VALUE(value, '$.tier'),
        JSON_VALUE(value, '$.rows'),
        JSON_VALUE(value, '$.seatsPerRow'),
        JSON_VALUE(value, '$.price')
    FROM OPENJSON(@SeatConfig);
    
    DECLARE @Tier NVARCHAR(20), @Rows INT, @SeatsPerRow INT, @Price DECIMAL(18,2);
    DECLARE @Prefix CHAR(1);
    DECLARE @RowNum INT = 0;
    DECLARE @SeatNum INT;
    DECLARE @RowLabel NVARCHAR(10);
    
    DECLARE tier_cursor CURSOR FOR 
        SELECT Tier, Rows, SeatsPerRow, Price FROM @TierConfig;
    
    OPEN tier_cursor;
    FETCH NEXT FROM tier_cursor INTO @Tier, @Rows, @SeatsPerRow, @Price;
    
    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- Set prefix based on tier
        SET @Prefix = CASE @Tier
            WHEN 'Premium' THEN 'P'
            WHEN 'Ordinary' THEN 'O'
            WHEN 'Economy' THEN 'E'
            ELSE LEFT(@Tier, 1)
        END;
        
        SET @RowNum = 0;
        WHILE @RowNum < @Rows
        BEGIN
            -- Generate row label (A, B, C... Z, AA, AB...)
            IF @RowNum < 26
                SET @RowLabel = CHAR(65 + @RowNum);
            ELSE
                SET @RowLabel = 'A' + CHAR(65 + (@RowNum - 26));
            
            SET @SeatNum = 1;
            WHILE @SeatNum <= @SeatsPerRow
            BEGIN
                INSERT INTO EventSeats (EventId, SeatNumber, Tier, Price, IsBooked)
                VALUES (@EventId, @Prefix + '-' + @RowLabel + CAST(@SeatNum AS NVARCHAR), @Tier, @Price, 0);
                SET @SeatNum = @SeatNum + 1;
            END
            
            SET @RowNum = @RowNum + 1;
        END
        
        FETCH NEXT FROM tier_cursor INTO @Tier, @Rows, @SeatsPerRow, @Price;
    END
    
    CLOSE tier_cursor;
    DEALLOCATE tier_cursor;
    
    -- Update TotalTickets in Events table
    DECLARE @TotalSeats INT;
    SELECT @TotalSeats = SUM(@Rows * @SeatsPerRow) FROM @TierConfig;
    
    UPDATE Events 
    SET TotalTickets = @TotalSeats,
        TicketPrice = (SELECT MIN(Price) FROM @TierConfig)
    WHERE Id = @EventId;
END
GO

PRINT 'Database schema created successfully with seat configuration tables!';