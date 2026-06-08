using EventBooking.API.Data;
using EventBooking.API.DTOs;
using Microsoft.Data.SqlClient;
using System.Data;

namespace EventBooking.API.Services
{
    public interface IBookingService
    {
        Task<BookingDto> CreateBookingAsync(CreateBookingDto dto, int userId);

        // NEW: Create booking with specific seats
        Task<BookingDto> CreateBookingWithSeatsAsync(CreateBookingWithSeatsDto dto, int userId);
        Task<List<BookingDto>> GetUserBookingsAsync(int userId);
        Task<BookingDto> GetBookingByIdAsync(int id, int userId);
        Task CancelBookingAsync(int id, int userId);
        Task<List<BookingDto>> GetEventBookingsAsync(int eventId, int organizerId);
        Task<byte[]> GenerateBookingPdfAsync(int bookingId, int userId);
    }

    public class BookingService : IBookingService
    {
        private readonly DatabaseHelper _db;
        private readonly IEmailService _emailService;
        private readonly PdfService _pdfService;

        public BookingService(DatabaseHelper db, IEmailService emailService)
        {
            _db = db;
            _emailService = emailService;
            _pdfService = new PdfService();
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

                // ── Step 3: Insert Tickets (one per attendee) ───────────────
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

                    ticketDtos.Add(new TicketDto
                    {
                        Id = ticketId,
                        TicketNumber = ticketNumber,
                        AttendeeName = attendee.Name.Trim(),
                        AttendeeEmail = attendee.Email.Trim().ToLower(),
                        IsUsed = false
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
                // ✅ Roll back everything if any step throws
                await transaction.RollbackAsync();
                throw;
            }
        }

        // Add this implementation to BookingService class
        // In BookingService.cs - Replace the entire CreateBookingWithSeatsAsync method

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
                    Tickets = new List<TicketDto>()   // tickets loaded separately in GetById
                });
            }

            return bookings;
        }

        // ─────────────────────────────────────────────
        // GET BOOKING BY ID  (includes tickets)
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

            // ── Load Tickets for this booking ───────────────────────────────
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
                    booking.Tickets.Add(new TicketDto
                    {
                        Id = Convert.ToInt32(ticketReader["Id"]),
                        TicketNumber = ticketReader["TicketNumber"].ToString()!,
                        AttendeeName = ticketReader["AttendeeName"].ToString()!,
                        AttendeeEmail = ticketReader["AttendeeEmail"].ToString()!,
                        IsUsed = Convert.ToBoolean(ticketReader["IsUsed"])
                    });
                }
            }

            return booking;
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
        // GET EVENT BOOKINGS  (organizer view)
        // ─────────────────────────────────────────────
        public async Task<List<BookingDto>> GetEventBookingsAsync(int eventId, int organizerId)
        {
            var bookings = new List<BookingDto>();

            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            // ✅ Verify organizer owns the event before returning data
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

            string query = @"
                SELECT b.Id, b.BookingReference, b.EventId,
                       b.TicketCount, b.TotalAmount, b.Status, b.BookedAt,
                       e.Title AS EventTitle, e.Venue AS EventVenue,
                       e.StartDateTime AS EventStartDateTime
                FROM   Bookings b
                INNER JOIN Events e ON b.EventId = e.Id
                WHERE  b.EventId = @EventId
                ORDER  BY b.BookedAt DESC";

            using var cmd = new SqlCommand(query, connection);
            cmd.Parameters.AddWithValue("@EventId", eventId);

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
        // GENERATE BOOKING PDF
        // ─────────────────────────────────────────────
        public async Task<byte[]> GenerateBookingPdfAsync(int bookingId, int userId)
        {
            var booking = await GetBookingByIdAsync(bookingId, userId);
            return await Task.Run(() => _pdfService.GenerateBookingPdf(booking));
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
}