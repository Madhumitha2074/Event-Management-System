using EventBooking.API.Data;
using EventBooking.API.DTOs;
using Microsoft.Data.SqlClient;
using System.Data;

namespace EventBooking.API.Services
{
    public interface IBookingService
    {
        Task<BookingDto> CreateBookingAsync(CreateBookingDto dto, int userId);
        Task<BookingDto> CreateBookingWithSeatsAsync(CreateBookingWithSeatsDto dto, int userId);
        Task<List<BookingDto>> GetUserBookingsAsync(int userId);
        Task<BookingDto> GetBookingByIdAsync(int id, int userId);
        Task CancelBookingAsync(int id, int userId);
        Task<List<BookingDto>> GetEventBookingsAsync(int eventId, int organizerId);
        Task<byte[]> GenerateBookingPdfAsync(int bookingId, int userId);
        Task<TicketVerificationDto> VerifyTicketAsync(string qrData);
        
        // ✅ ADD THIS METHOD
        Task<bool> HasBookingsAsync(int eventId);
    }

    public class BookingService : IBookingService
    {
        private readonly DatabaseHelper _db;
        private readonly IEmailService _emailService;
        private readonly PdfService _pdfService;
        private readonly IQrCodeService _qrCodeService;
        private readonly ILogger<BookingService> _logger;

        public BookingService(DatabaseHelper db, IEmailService emailService, IQrCodeService qrCodeService, ILogger<BookingService> logger)
        {
            _db = db;
            _emailService = emailService;
            _qrCodeService = qrCodeService;
            _pdfService = new PdfService();
            _logger = logger;
        }

        // ─────────────────────────────────────────────
        // CREATE BOOKING  (Transaction — most critical)
        // ─────────────────────────────────────────────
        public async Task<BookingDto> CreateBookingAsync(CreateBookingDto dto, int userId)
        {
            // Validate attendees count matches ticket count
            if (dto.Attendees == null || dto.Attendees.Count != dto.TicketCount)
                throw new ArgumentException("Number of attendees must match ticket count.");

            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            // ✅ Use a transaction — if any step fails, everything rolls back
            using var transaction = connection.BeginTransaction();

            try
            {
                // ── Step 1: Get event details + check availability ──────────
                decimal ticketPrice;
                int availableTickets;
                string eventTitle;
                string eventVenue;
                string eventStartDateTime;

                string eventQuery = @"
                    SELECT TicketPrice, (TotalTickets - BookedTickets) AS AvailableTickets,
                           Title, Venue, StartDateTime
                    FROM   Events
                    WHERE  Id = @EventId AND Status = 'Published'";

                using (var eventCmd = new SqlCommand(eventQuery, connection, transaction))
                {
                    eventCmd.Parameters.AddWithValue("@EventId", dto.EventId);

                    using var eventReader = await eventCmd.ExecuteReaderAsync();

                    if (!await eventReader.ReadAsync())
                        throw new KeyNotFoundException("Event not found or not published.");

                    ticketPrice = Convert.ToDecimal(eventReader["TicketPrice"]);
                    availableTickets = Convert.ToInt32(eventReader["AvailableTickets"]);
                    eventTitle = eventReader["Title"].ToString()!;
                    eventVenue = eventReader["Venue"].ToString()!;
                    eventStartDateTime = ((DateTime)eventReader["StartDateTime"]).ToString("o");
                }

                // ✅ Check availability BEFORE booking
                if (availableTickets < dto.TicketCount)
                    throw new InvalidOperationException(
                        $"Only {availableTickets} ticket(s) available.");

                decimal totalAmount = ticketPrice * dto.TicketCount;
                string bookingReference = GenerateReference();

                // ── Step 2: Insert Booking ──────────────────────────────────
                int bookingId;

                string insertBookingQuery = @"
                    INSERT INTO Bookings
                        (BookingReference, UserId, EventId, TicketCount, TotalAmount, Status)
                    OUTPUT INSERTED.Id
                    VALUES
                        (@BookingReference, @UserId, @EventId, @TicketCount, @TotalAmount, 'Confirmed')";

                using (var bookingCmd = new SqlCommand(insertBookingQuery, connection, transaction))
                {
                    bookingCmd.Parameters.AddWithValue("@BookingReference", bookingReference);
                    bookingCmd.Parameters.AddWithValue("@UserId", userId);
                    bookingCmd.Parameters.AddWithValue("@EventId", dto.EventId);
                    bookingCmd.Parameters.AddWithValue("@TicketCount", dto.TicketCount);
                    bookingCmd.Parameters.AddWithValue("@TotalAmount", totalAmount);

                    var scalar = await bookingCmd.ExecuteScalarAsync();
                    bookingId = Convert.ToInt32(scalar);
                }

                // ── Step 3: Insert Tickets (one per attendee) with QR codes ───
                var ticketDtos = new List<TicketDto>();

                foreach (var attendee in dto.Attendees)
                {
                    string ticketNumber = GenerateTicketNumber();

                    string insertTicketQuery = @"
                        INSERT INTO Tickets
                            (TicketNumber, BookingId, AttendeeName, AttendeeEmail)
                        OUTPUT INSERTED.Id
                        VALUES
                            (@TicketNumber, @BookingId, @AttendeeName, @AttendeeEmail)";

                    using var ticketCmd = new SqlCommand(insertTicketQuery, connection, transaction);

                    ticketCmd.Parameters.AddWithValue("@TicketNumber", ticketNumber);
                    ticketCmd.Parameters.AddWithValue("@BookingId", bookingId);
                    ticketCmd.Parameters.AddWithValue("@AttendeeName", attendee.Name.Trim());
                    ticketCmd.Parameters.AddWithValue("@AttendeeEmail", attendee.Email.Trim().ToLower());

                    var ticketScalar = await ticketCmd.ExecuteScalarAsync();
                    int ticketId = Convert.ToInt32(ticketScalar);

                    // FIXED: Generate QR code with proper null handling
                    string ticketData = $"{ticketNumber}|{bookingId}|{attendee.Email.Trim().ToLower()}";
                    byte[]? qrCodeBytes = _qrCodeService.GenerateQrCodeBytes(ticketData);
                    string? qrCodeBase64 = null;

                    if (qrCodeBytes != null)
                    {
                        qrCodeBase64 = Convert.ToBase64String(qrCodeBytes);
                    }

                    ticketDtos.Add(new TicketDto
                    {
                        Id = ticketId,
                        TicketNumber = ticketNumber,
                        AttendeeName = attendee.Name.Trim(),
                        AttendeeEmail = attendee.Email.Trim().ToLower(),
                        IsUsed = false,
                        QrCodeBase64 = qrCodeBase64,
                        QrCodeBytes = qrCodeBytes
                    });
                }

                // ── Step 4: Increment BookedTickets on Events ───────────────
                string updateEventQuery = @"
                    UPDATE Events
                    SET    BookedTickets = BookedTickets + @Count
                    WHERE  Id = @EventId";

                using (var updateCmd = new SqlCommand(updateEventQuery, connection, transaction))
                {
                    updateCmd.Parameters.AddWithValue("@Count", dto.TicketCount);
                    updateCmd.Parameters.AddWithValue("@EventId", dto.EventId);
                    await updateCmd.ExecuteNonQueryAsync();
                }

                // ── Step 5: Commit only after all steps succeed ─────────────
                await transaction.CommitAsync();

                // ── Step 6: Send confirmation email (outside transaction) ────
                await _emailService.SendBookingConfirmationAsync(bookingId);

                // ── Step 7: Return the full booking DTO ─────────────────────
                return new BookingDto
                {
                    Id = bookingId,
                    BookingReference = bookingReference,
                    EventId = dto.EventId,
                    EventTitle = eventTitle,
                    EventVenue = eventVenue,
                    EventStartDateTime = eventStartDateTime,
                    TicketCount = dto.TicketCount,
                    TotalAmount = totalAmount,
                    Status = "Confirmed",
                    BookedAt = DateTime.UtcNow.ToString("o"),
                    Tickets = ticketDtos
                };
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        // ─────────────────────────────────────────────
        // CREATE BOOKING WITH SEATS (Stored Procedure with QR codes)
        // ─────────────────────────────────────────────
        public async Task<BookingDto> CreateBookingWithSeatsAsync(CreateBookingWithSeatsDto dto, int userId)
        {
            // Validate attendees count matches seat count
            if (dto.Attendees == null || dto.Attendees.Count != dto.SeatIds.Count)
                throw new ArgumentException("Number of attendees must match number of seats selected.");

            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            try
            {
                // Prepare JSON data for stored procedure
                string seatIdsJson = System.Text.Json.JsonSerializer.Serialize(dto.SeatIds);

                var attendeesWithSeatIds = new List<object>();
                for (int i = 0; i < dto.SeatIds.Count; i++)
                {
                    attendeesWithSeatIds.Add(new
                    {
                        seatId = dto.SeatIds[i],
                        name = dto.Attendees[i].Name.Trim(),
                        email = dto.Attendees[i].Email.Trim().ToLower()
                    });
                }
                string attendeesJson = System.Text.Json.JsonSerializer.Serialize(attendeesWithSeatIds);

                // Execute stored procedure
                using var cmd = new SqlCommand("sp_BookSeats", connection);
                cmd.CommandType = CommandType.StoredProcedure;

                cmd.Parameters.AddWithValue("@EventId", dto.EventId);
                cmd.Parameters.AddWithValue("@UserId", userId);
                cmd.Parameters.AddWithValue("@SeatIds", seatIdsJson);
                cmd.Parameters.AddWithValue("@AttendeesJson", attendeesJson);

                var bookingRefParam = new SqlParameter("@BookingReference", SqlDbType.NVarChar, 50)
                {
                    Direction = ParameterDirection.Output
                };
                var bookingIdParam = new SqlParameter("@BookingId", SqlDbType.Int)
                {
                    Direction = ParameterDirection.Output
                };

                cmd.Parameters.Add(bookingRefParam);
                cmd.Parameters.Add(bookingIdParam);

                await cmd.ExecuteNonQueryAsync();

                string bookingReference = bookingRefParam.Value.ToString()!;
                int bookingId = Convert.ToInt32(bookingIdParam.Value);

                // Get the created booking details
                var booking = await GetBookingByIdAsync(bookingId, userId);

                // Send confirmation email (don't await - fire and forget)
                _ = Task.Run(() => _emailService.SendBookingConfirmationAsync(bookingId));

                return booking;
            }
            catch (SqlException ex) when (ex.Number == 50001)
            {
                throw new InvalidOperationException("One or more selected seats are no longer available. Please refresh and try again.");
            }
            catch (Exception ex)
            {
                throw new Exception("Failed to create booking. Please try again.", ex);
            }
        }

        // ─────────────────────────────────────────────
        // GET USER BOOKINGS
        // ─────────────────────────────────────────────
        public async Task<List<BookingDto>> GetUserBookingsAsync(int userId)
        {
            var bookings = new List<BookingDto>();

            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            string query = @"
                SELECT b.Id, b.BookingReference, b.EventId,
                       b.TicketCount, b.TotalAmount, b.Status, b.BookedAt,
                       e.Title AS EventTitle, e.Venue AS EventVenue,
                       e.StartDateTime AS EventStartDateTime
                FROM   Bookings b
                INNER JOIN Events e ON b.EventId = e.Id
                WHERE  b.UserId = @UserId
                ORDER  BY b.BookedAt DESC";

            using var cmd = new SqlCommand(query, connection);
            cmd.Parameters.AddWithValue("@UserId", userId);

            using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                bookings.Add(new BookingDto
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    BookingReference = reader["BookingReference"].ToString()!,
                    EventId = Convert.ToInt32(reader["EventId"]),
                    EventTitle = reader["EventTitle"].ToString()!,
                    EventVenue = reader["EventVenue"].ToString()!,
                    EventStartDateTime = ((DateTime)reader["EventStartDateTime"]).ToString("o"),
                    TicketCount = Convert.ToInt32(reader["TicketCount"]),
                    TotalAmount = Convert.ToDecimal(reader["TotalAmount"]),
                    Status = reader["Status"].ToString()!,
                    BookedAt = ((DateTime)reader["BookedAt"]).ToString("o"),
                    Tickets = new List<TicketDto>()
                });
            }

            return bookings;
        }

        // ─────────────────────────────────────────────
        // GET BOOKING BY ID (includes tickets with QR codes)
        // ─────────────────────────────────────────────
        public async Task<BookingDto> GetBookingByIdAsync(int id, int userId)
        {
            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            // ── Booking + Event details ─────────────────────────────────────
            string bookingQuery = @"
                SELECT b.Id, b.BookingReference, b.EventId,
                       b.TicketCount, b.TotalAmount, b.Status, b.BookedAt,
                       e.Title AS EventTitle, e.Venue AS EventVenue,
                       e.StartDateTime AS EventStartDateTime
                FROM   Bookings b
                INNER JOIN Events e ON b.EventId = e.Id
                WHERE  b.Id = @Id AND b.UserId = @UserId";

            BookingDto? booking = null;

            using (var bookingCmd = new SqlCommand(bookingQuery, connection))
            {
                bookingCmd.Parameters.AddWithValue("@Id", id);
                bookingCmd.Parameters.AddWithValue("@UserId", userId);

                using var reader = await bookingCmd.ExecuteReaderAsync();

                if (!await reader.ReadAsync())
                    throw new KeyNotFoundException("Booking not found.");

                booking = new BookingDto
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    BookingReference = reader["BookingReference"].ToString()!,
                    EventId = Convert.ToInt32(reader["EventId"]),
                    EventTitle = reader["EventTitle"].ToString()!,
                    EventVenue = reader["EventVenue"].ToString()!,
                    EventStartDateTime = ((DateTime)reader["EventStartDateTime"]).ToString("o"),
                    TicketCount = Convert.ToInt32(reader["TicketCount"]),
                    TotalAmount = Convert.ToDecimal(reader["TotalAmount"]),
                    Status = reader["Status"].ToString()!,
                    BookedAt = ((DateTime)reader["BookedAt"]).ToString("o"),
                    Tickets = new List<TicketDto>()
                };
            }

            // ── Load Tickets with QR codes for this booking ─────────────────
            string ticketQuery = @"
                SELECT Id, TicketNumber, AttendeeName, AttendeeEmail, IsUsed
                FROM   Tickets
                WHERE  BookingId = @BookingId";

            using (var ticketCmd = new SqlCommand(ticketQuery, connection))
            {
                ticketCmd.Parameters.AddWithValue("@BookingId", id);

                using var ticketReader = await ticketCmd.ExecuteReaderAsync();

                while (await ticketReader.ReadAsync())
                {
                    string ticketNumber = ticketReader["TicketNumber"].ToString()!;
                    string attendeeEmail = ticketReader["AttendeeEmail"].ToString()!;
                    string ticketData = $"{ticketNumber}|{id}|{attendeeEmail}";
                    
                    // FIXED: Add null check
                    byte[]? qrCodeBytes = _qrCodeService.GenerateQrCodeBytes(ticketData);
                    string? qrCodeBase64 = null;
                    
                    if (qrCodeBytes != null)
                    {
                        qrCodeBase64 = Convert.ToBase64String(qrCodeBytes);
                    }

                    booking.Tickets.Add(new TicketDto
                    {
                        Id = Convert.ToInt32(ticketReader["Id"]),
                        TicketNumber = ticketNumber,
                        AttendeeName = ticketReader["AttendeeName"].ToString()!,
                        AttendeeEmail = attendeeEmail,
                        IsUsed = Convert.ToBoolean(ticketReader["IsUsed"]),
                        QrCodeBase64 = qrCodeBase64,
                        QrCodeBytes = qrCodeBytes
                    });
                }
            }

            return booking;
        }

        // ─────────────────────────────────────────────
        // GET TICKETS WITH QR CODES (FOR EMAIL SERVICE)
        // ─────────────────────────────────────────────
        private async Task<List<TicketDto>> GetTicketsWithQrCodesAsync(int bookingId, SqlConnection connection)
        {
            var tickets = new List<TicketDto>();

            string ticketQuery = @"
                SELECT t.Id, t.TicketNumber, t.AttendeeName, t.AttendeeEmail, 
                       t.IsUsed, t.SeatId, es.SeatNumber, es.Tier, es.Price
                FROM Tickets t
                LEFT JOIN EventSeats es ON t.SeatId = es.Id
                WHERE t.BookingId = @BookingId";

            using (var cmd = new SqlCommand(ticketQuery, connection))
            {
                cmd.Parameters.AddWithValue("@BookingId", bookingId);

                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        string ticketNumber = reader["TicketNumber"].ToString()!;
                        string attendeeEmail = reader["AttendeeEmail"].ToString()!;
                        
                        byte[]? qrCodeBytes = null;
                        string? qrCodeBase64 = null;
                        
                        try
                        {
                            // Generate QR code for each ticket
                            string ticketData = $"{ticketNumber}|{bookingId}|{attendeeEmail}";
                            qrCodeBytes = _qrCodeService.GenerateQrCodeBytes(ticketData);
                            
                            // FIXED: Add null check before converting
                            if (qrCodeBytes != null)
                            {
                                qrCodeBase64 = Convert.ToBase64String(qrCodeBytes);
                                _logger.LogInformation("QR Code generated for ticket {TicketNumber}, Length: {Length}", 
                                    ticketNumber, qrCodeBase64.Length);
                            }
                            else
                            {
                                _logger.LogWarning("QR Code generation returned null for ticket {TicketNumber}", ticketNumber);
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Failed to generate QR code for ticket {TicketNumber}", ticketNumber);
                        }

                        var ticket = new TicketDto
                        {
                            Id = Convert.ToInt32(reader["Id"]),
                            TicketNumber = ticketNumber,
                            AttendeeName = reader["AttendeeName"].ToString()!,
                            AttendeeEmail = attendeeEmail,
                            IsUsed = Convert.ToBoolean(reader["IsUsed"]),
                            QrCodeBase64 = qrCodeBase64,
                            QrCodeBytes = qrCodeBytes
                        };

                        // Add seat info if available
                        if (reader["SeatNumber"] != DBNull.Value)
                        {
                            ticket.SeatNumber = reader["SeatNumber"].ToString();
                            ticket.Tier = reader["Tier"].ToString();
                            ticket.SeatPrice = reader["Price"] != DBNull.Value ? Convert.ToDecimal(reader["Price"]) : null;
                        }

                        tickets.Add(ticket);
                    }
                }
            }

            return tickets;
        }

        // ─────────────────────────────────────────────
        // CANCEL BOOKING
        // ─────────────────────────────────────────────
        public async Task CancelBookingAsync(int id, int userId)
        {
            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            using var transaction = connection.BeginTransaction();

            try
            {
                // ── Step 1: Get booking details before cancelling ───────────
                int eventId;
                int ticketCount;
                string currentStatus;

                string selectQuery = @"
                    SELECT EventId, TicketCount, Status
                    FROM   Bookings
                    WHERE  Id = @Id AND UserId = @UserId";

                using (var selectCmd = new SqlCommand(selectQuery, connection, transaction))
                {
                    selectCmd.Parameters.AddWithValue("@Id", id);
                    selectCmd.Parameters.AddWithValue("@UserId", userId);

                    using var reader = await selectCmd.ExecuteReaderAsync();

                    if (!await reader.ReadAsync())
                        throw new KeyNotFoundException("Booking not found.");

                    currentStatus = reader["Status"].ToString()!;

                    if (currentStatus == "Cancelled")
                        throw new InvalidOperationException("Booking is already cancelled.");

                    eventId = Convert.ToInt32(reader["EventId"]);
                    ticketCount = Convert.ToInt32(reader["TicketCount"]);
                }

                // ── Step 2: Mark booking as Cancelled ──────────────────────
                string cancelQuery = @"
                    UPDATE Bookings
                    SET    Status = 'Cancelled', CancelledAt = @CancelledAt
                    WHERE  Id = @Id AND UserId = @UserId";

                using (var cancelCmd = new SqlCommand(cancelQuery, connection, transaction))
                {
                    cancelCmd.Parameters.AddWithValue("@CancelledAt", DateTime.UtcNow);
                    cancelCmd.Parameters.AddWithValue("@Id", id);
                    cancelCmd.Parameters.AddWithValue("@UserId", userId);
                    await cancelCmd.ExecuteNonQueryAsync();
                }

                // ── Step 3: ✅ Restore ticket count on event ────────────────
                string restoreQuery = @"
                    UPDATE Events
                    SET    BookedTickets = BookedTickets - @Count
                    WHERE  Id = @EventId";

                using (var restoreCmd = new SqlCommand(restoreQuery, connection, transaction))
                {
                    restoreCmd.Parameters.AddWithValue("@Count", ticketCount);
                    restoreCmd.Parameters.AddWithValue("@EventId", eventId);
                    await restoreCmd.ExecuteNonQueryAsync();
                }

                await transaction.CommitAsync();

                // Send cancellation email outside transaction
                await _emailService.SendCancellationEmailAsync(id);
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        // ─────────────────────────────────────────────
        // GET EVENT BOOKINGS (Organizer view with tickets)
        // ─────────────────────────────────────────────
        public async Task<List<BookingDto>> GetEventBookingsAsync(int eventId, int organizerId)
        {
            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            //  Verify organizer owns the event before returning data
            string ownerCheck = @"
                SELECT COUNT(1) FROM Events
                WHERE Id = @EventId AND OrganizerId = @OrganizerId";

            using (var checkCmd = new SqlCommand(ownerCheck, connection))
            {
                checkCmd.Parameters.AddWithValue("@EventId", eventId);
                checkCmd.Parameters.AddWithValue("@OrganizerId", organizerId);

                int count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                if (count == 0)
                    throw new UnauthorizedAccessException("You do not own this event.");
            }

            // Get bookings with tickets
            string query = @"
                SELECT b.Id, b.BookingReference, b.EventId,
                       b.TicketCount, b.TotalAmount, b.Status, b.BookedAt,
                       e.Title AS EventTitle, e.Venue AS EventVenue,
                       e.StartDateTime AS EventStartDateTime,
                       t.Id AS TicketId, t.TicketNumber, t.AttendeeName, t.AttendeeEmail, t.IsUsed
                FROM Bookings b
                INNER JOIN Events e ON b.EventId = e.Id
                LEFT JOIN Tickets t ON b.Id = t.BookingId
                WHERE b.EventId = @EventId
                ORDER BY b.BookedAt DESC, t.Id";

            using var cmd = new SqlCommand(query, connection);
            cmd.Parameters.AddWithValue("@EventId", eventId);

            using var reader = await cmd.ExecuteReaderAsync();
            
            var bookingDict = new Dictionary<int, BookingDto>();

            while (await reader.ReadAsync())
            {
                int bookingId = Convert.ToInt32(reader["Id"]);
                
                if (!bookingDict.ContainsKey(bookingId))
                {
                    bookingDict.Add(bookingId, new BookingDto
                    {
                        Id = bookingId,
                        BookingReference = reader["BookingReference"].ToString()!,
                        EventId = Convert.ToInt32(reader["EventId"]),
                        EventTitle = reader["EventTitle"].ToString()!,
                        EventVenue = reader["EventVenue"].ToString()!,
                        EventStartDateTime = ((DateTime)reader["EventStartDateTime"]).ToString("o"),
                        TicketCount = Convert.ToInt32(reader["TicketCount"]),
                        TotalAmount = Convert.ToDecimal(reader["TotalAmount"]),
                        Status = reader["Status"].ToString()!,
                        BookedAt = ((DateTime)reader["BookedAt"]).ToString("o"),
                        Tickets = new List<TicketDto>()
                    });
                }
                
                // Add ticket if exists
                if (reader["TicketId"] != DBNull.Value)
                {
                    bookingDict[bookingId].Tickets.Add(new TicketDto
                    {
                        Id = Convert.ToInt32(reader["TicketId"]),
                        TicketNumber = reader["TicketNumber"].ToString()!,
                        AttendeeName = reader["AttendeeName"].ToString()!,
                        AttendeeEmail = reader["AttendeeEmail"].ToString()!,
                        IsUsed = Convert.ToBoolean(reader["IsUsed"])
                    });
                }
            }

            return bookingDict.Values.ToList();
        }

        // ─────────────────────────────────────────────
        // GENERATE BOOKING PDF
        // ─────────────────────────────────────────────
        public async Task<byte[]> GenerateBookingPdfAsync(int bookingId, int userId)
        {
            var booking = await GetBookingByIdAsync(bookingId, userId);
            return await Task.Run(() => _pdfService.GenerateBookingPdf(booking));
        }

        // ─────────────────────────────────────────────
        // ✅ CHECK IF EVENT HAS BOOKINGS
        // ─────────────────────────────────────────────
        public async Task<bool> HasBookingsAsync(int eventId)
        {
            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            string query = @"
                SELECT COUNT(1) 
                FROM Bookings 
                WHERE EventId = @EventId 
                AND Status IN ('Confirmed', 'Pending')";

            using var cmd = new SqlCommand(query, connection);
            cmd.Parameters.AddWithValue("@EventId", eventId);

            int count = Convert.ToInt32(await cmd.ExecuteScalarAsync());
            return count > 0;
        }

        // ─────────────────────────────────────────────
        // VERIFY TICKET VIA QR CODE
        // ─────────────────────────────────────────────
        public async Task<TicketVerificationDto> VerifyTicketAsync(string qrData)
        {
            // Parse QR data (format: "TKT-XXXX|BookingId|Email")
            var parts = qrData.Split('|');
            if (parts.Length < 3)
                throw new ArgumentException("Invalid QR code data. Expected format: TicketNumber|BookingId|Email");

            string ticketNumber = parts[0];
            if (!int.TryParse(parts[1], out int bookingId))
                throw new ArgumentException("Invalid Booking ID in QR code");

            string email = parts[2];

            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            string query = @"
                SELECT t.Id, t.TicketNumber, t.AttendeeName, t.AttendeeEmail, t.IsUsed,
                       b.EventId, e.Title as EventTitle, e.Venue, e.City,
                       b.BookingReference
                FROM Tickets t
                INNER JOIN Bookings b ON t.BookingId = b.Id
                INNER JOIN Events e ON b.EventId = e.Id
                WHERE t.TicketNumber = @TicketNumber AND t.AttendeeEmail = @Email";

            using var cmd = new SqlCommand(query, connection);
            cmd.Parameters.AddWithValue("@TicketNumber", ticketNumber);
            cmd.Parameters.AddWithValue("@Email", email);

            using var reader = await cmd.ExecuteReaderAsync();
            
            if (!await reader.ReadAsync())
                throw new KeyNotFoundException("Ticket not found. Please verify the QR code.");

            bool isUsed = Convert.ToBoolean(reader["IsUsed"]);
            
            var result = new TicketVerificationDto
            {
                TicketNumber = ticketNumber,
                AttendeeName = reader["AttendeeName"].ToString()!,
                AttendeeEmail = reader["AttendeeEmail"].ToString()!,
                EventTitle = reader["EventTitle"].ToString()!,
                Venue = reader["Venue"].ToString()!,
                City = reader["City"].ToString()!,
                BookingReference = reader["BookingReference"].ToString()!,
                IsUsed = isUsed,
                IsValid = !isUsed,
                VerifiedAt = DateTime.UtcNow
            };

            return result;
        }

        // ─────────────────────────────────────────────
        // PRIVATE HELPERS
        // ─────────────────────────────────────────────
        private static string GenerateReference()
        {
            return $"EVT-{Guid.NewGuid().ToString()[..8].ToUpper()}";
        }

        private static string GenerateTicketNumber()
        {
            return $"TKT-{Guid.NewGuid().ToString()[..8].ToUpper()}";
        }
    }

    // DTO for ticket verification
    public class TicketVerificationDto
    {
        public string TicketNumber { get; set; } = string.Empty;
        public string AttendeeName { get; set; } = string.Empty;
        public string AttendeeEmail { get; set; } = string.Empty;
        public string EventTitle { get; set; } = string.Empty;
        public string Venue { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string BookingReference { get; set; } = string.Empty;
        public bool IsUsed { get; set; }
        public bool IsValid { get; set; }
        public DateTime VerifiedAt { get; set; }
    }
}