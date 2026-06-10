using EventBooking.API.Data;
using EventBooking.API.DTOs;
using Microsoft.Data.SqlClient;
using System.Text.Json;

namespace EventBooking.API.Services
{
    public interface IEventService
    {
        Task<PagedResultDto<EventDto>> GetEventsAsync(EventFilterDto filter);
        Task<EventDto> GetEventByIdAsync(int id);
        Task<EventDto> CreateEventAsync(CreateEventDto dto, int organizerId);
        Task<EventDto> UpdateEventAsync(int id, UpdateEventDto dto, int organizerId);
        Task DeleteEventAsync(int id, int organizerId);
        Task<List<EventDto>> GetOrganizerEventsAsync(int organizerId);
    }

    public class EventService : IEventService
    {
        private readonly DatabaseHelper _db;

        // Category map — Angular sends int (0-7), DB stores string
        private static readonly string[] CategoryNames =
        {
            "Music", "Sports", "Technology", "Food",
            "Art",   "Business", "Health",   "Other"
        };

        public EventService(DatabaseHelper db)
        {
            _db = db;
        }

        // ─────────────────────────────────────────────
        // GET ALL EVENTS  (with filters + pagination)
        // ─────────────────────────────────────────────
        public async Task<PagedResultDto<EventDto>> GetEventsAsync(EventFilterDto filter)
        {
            var events = new List<EventDto>();
            int totalCount = 0;

            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            // ── Build dynamic WHERE clause ──────────────────────────────
            var conditions = new List<string> { "e.Status = 'Published'" };

            var paramValues = new List<(string Name, object Value)>();

            if (!string.IsNullOrWhiteSpace(filter.Search))
            {
                conditions.Add("(e.Title LIKE @Search OR e.Description LIKE @Search OR e.City LIKE @Search)");
                paramValues.Add(("@Search", $"%{filter.Search.Trim()}%"));
            }

            if (!string.IsNullOrWhiteSpace(filter.City))
            {
                conditions.Add("e.City LIKE @City");
                paramValues.Add(("@City", $"%{filter.City.Trim()}%"));
            }

            if (filter.Category.HasValue &&
                filter.Category.Value >= 0 &&
                filter.Category.Value < CategoryNames.Length)
            {
                conditions.Add("e.Category = @Category");
                paramValues.Add(("@Category", CategoryNames[filter.Category.Value]));
            }

            if (!string.IsNullOrWhiteSpace(filter.StartDate) &&
                DateTime.TryParse(filter.StartDate, out DateTime startDate))
            {
                conditions.Add("e.StartDateTime >= @StartDate");
                paramValues.Add(("@StartDate", startDate));
            }

            if (!string.IsNullOrWhiteSpace(filter.EndDate) &&
                DateTime.TryParse(filter.EndDate, out DateTime endDate))
            {
                conditions.Add("e.StartDateTime <= @EndDate");
                paramValues.Add(("@EndDate", endDate));
            }

            if (filter.MinPrice.HasValue)
            {
                conditions.Add("e.TicketPrice >= @MinPrice");
                paramValues.Add(("@MinPrice", filter.MinPrice.Value));
            }

            if (filter.MaxPrice.HasValue)
            {
                conditions.Add("e.TicketPrice <= @MaxPrice");
                paramValues.Add(("@MaxPrice", filter.MaxPrice.Value));
            }

            string whereClause = string.Join(" AND ", conditions);

            SqlParameter[] MakeParams() =>
                paramValues
                    .Select(p => new SqlParameter(p.Name, p.Value))
                    .ToArray();

            // ── Step 1: Total count for pagination ───────────────────────
            string countQuery = $@"
                SELECT COUNT(1)
                FROM   Events e
                WHERE  {whereClause}";

            using (var countCmd = new SqlCommand(countQuery, connection))
            {
                countCmd.Parameters.AddRange(MakeParams());
                totalCount = Convert.ToInt32(await countCmd.ExecuteScalarAsync());
            }

            if (totalCount == 0)
            {
                return new PagedResultDto<EventDto>
                {
                    Items = events,
                    TotalCount = 0,
                    Page = filter.Page,
                    PageSize = filter.PageSize
                };
            }

            // ── Step 2: Paged data ───────────────────────────────────────
            int offset = (filter.Page - 1) * filter.PageSize;

            string dataQuery = $@"
                SELECT e.Id,
                       e.Title,
                       e.Description,
                       e.Category,
                       e.Status,
                       e.StartDateTime,
                       e.EndDateTime,
                       e.Venue,
                       e.City,
                       e.Address,
                       e.ImageUrl,
                       e.TicketPrice,
                       e.TotalTickets,
                       e.BookedTickets,
                       (e.TotalTickets - e.BookedTickets) AS AvailableTickets,
                       e.OrganizerId,
                       e.CreatedAt,
                       e.SeatConfig,
                       e.GoogleMapsUrl,
                       u.Name AS OrganizerName
                FROM   Events e
                INNER JOIN Users u ON e.OrganizerId = u.Id
                WHERE  {whereClause}
                ORDER  BY e.StartDateTime ASC
                OFFSET {offset} ROWS FETCH NEXT {filter.PageSize} ROWS ONLY";

            using (var dataCmd = new SqlCommand(dataQuery, connection))
            {
                dataCmd.Parameters.AddRange(MakeParams());

                using var reader = await dataCmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                    events.Add(MapReaderToEventDto(reader));
            }

            return new PagedResultDto<EventDto>
            {
                Items = events,
                TotalCount = totalCount,
                Page = filter.Page,
                PageSize = filter.PageSize
            };
        }

        // ─────────────────────────────────────────────
        // GET EVENT BY ID
        // ─────────────────────────────────────────────
        public async Task<EventDto> GetEventByIdAsync(int id)
        {
            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            string query = @"
                SELECT e.Id,
                       e.Title,
                       e.Description,
                       e.Category,
                       e.Status,
                       e.StartDateTime,
                       e.EndDateTime,
                       e.Venue,
                       e.City,
                       e.Address,
                       e.ImageUrl,
                       e.TicketPrice,
                       e.TotalTickets,
                       e.BookedTickets,
                       (e.TotalTickets - e.BookedTickets) AS AvailableTickets,
                       e.OrganizerId,
                       e.CreatedAt,
                       e.SeatConfig,
                       e.GoogleMapsUrl,
                       u.Name AS OrganizerName
                FROM   Events e
                INNER JOIN Users u ON e.OrganizerId = u.Id
                WHERE  e.Id = @Id";

            using var cmd = new SqlCommand(query, connection);
            cmd.Parameters.AddWithValue("@Id", id);

            using var reader = await cmd.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
                throw new KeyNotFoundException("Event not found.");

            return MapReaderToEventDto(reader);
        }

        // ─────────────────────────────────────────────
        // CREATE EVENT (with seat configuration support)
        // ─────────────────────────────────────────────
        public async Task<EventDto> CreateEventAsync(CreateEventDto dto, int organizerId)
        {
            if (!DateTime.TryParse(dto.StartDateTime, out DateTime startDateTime))
                throw new ArgumentException("Invalid StartDateTime format.");

            if (!DateTime.TryParse(dto.EndDateTime, out DateTime endDateTime))
                throw new ArgumentException("Invalid EndDateTime format.");

            if (endDateTime <= startDateTime)
                throw new ArgumentException("EndDateTime must be after StartDateTime.");

            string categoryName = (dto.Category >= 0 && dto.Category < CategoryNames.Length)
                ? CategoryNames[dto.Category]
                : "Other";

            using var connection = _db.CreateConnection();
            await connection.OpenAsync();
            
            using var transaction = connection.BeginTransaction();

            try
            {
                // Calculate totals based on seat configuration
                string? seatConfigJson = null;
                int totalTickets = dto.TotalTickets;
                decimal ticketPrice = dto.TicketPrice;
                
                if (dto.SeatTiers != null && dto.SeatTiers.Any())
                {
                    seatConfigJson = JsonSerializer.Serialize(dto.SeatTiers);
                    totalTickets = dto.SeatTiers.Sum(t => t.Rows * t.SeatsPerRow);
                    ticketPrice = dto.SeatTiers.Min(t => t.Price);
                }

                string query = @"
                    INSERT INTO Events
                        (Title, Description, Category, Status,
                         StartDateTime, EndDateTime, Venue, City,
                         Address, ImageUrl, TicketPrice, TotalTickets,
                         BookedTickets, OrganizerId, SeatConfig, GoogleMapsUrl)
                    OUTPUT INSERTED.Id
                    VALUES
                        (@Title, @Description, @Category, 'Draft',
                         @StartDateTime, @EndDateTime, @Venue, @City,
                         @Address, @ImageUrl, @TicketPrice, @TotalTickets,
                         0, @OrganizerId, @SeatConfig, @GoogleMapsUrl)";

                using var cmd = new SqlCommand(query, connection, transaction);

                cmd.Parameters.AddWithValue("@Title", dto.Title.Trim());
                cmd.Parameters.AddWithValue("@Description", dto.Description.Trim());
                cmd.Parameters.AddWithValue("@Category", categoryName);
                cmd.Parameters.AddWithValue("@StartDateTime", startDateTime);
                cmd.Parameters.AddWithValue("@EndDateTime", endDateTime);
                cmd.Parameters.AddWithValue("@Venue", dto.Venue.Trim());
                cmd.Parameters.AddWithValue("@City", dto.City.Trim());
                cmd.Parameters.AddWithValue("@Address",
                    string.IsNullOrWhiteSpace(dto.Address) ? (object)DBNull.Value : dto.Address.Trim());
                cmd.Parameters.AddWithValue("@ImageUrl",
                    string.IsNullOrWhiteSpace(dto.ImageUrl) ? (object)DBNull.Value : dto.ImageUrl.Trim());
                cmd.Parameters.AddWithValue("@TicketPrice", ticketPrice);
                cmd.Parameters.AddWithValue("@TotalTickets", totalTickets);
                cmd.Parameters.AddWithValue("@OrganizerId", organizerId);
                cmd.Parameters.AddWithValue("@SeatConfig", seatConfigJson ?? (object)DBNull.Value);
                cmd.Parameters.AddWithValue("@GoogleMapsUrl", dto.GoogleMapsUrl ?? (object)DBNull.Value);

                var scalar = await cmd.ExecuteScalarAsync();
                int eventId = Convert.ToInt32(scalar);

                // Generate seats if seat tiers are configured
                if (dto.SeatTiers != null && dto.SeatTiers.Any())
                {
                    var seatService = new SeatService(_db);
                    await seatService.GenerateSeatsAsync(eventId, dto.SeatTiers, connection, transaction);
                }

                await transaction.CommitAsync();
                return await GetEventByIdAsync(eventId);
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        // ─────────────────────────────────────────────
        // UPDATE EVENT
        // ─────────────────────────────────────────────
        public async Task<EventDto> UpdateEventAsync(int id, UpdateEventDto dto, int organizerId)
        {
            if (!DateTime.TryParse(dto.StartDateTime, out DateTime startDateTime))
                throw new ArgumentException("Invalid StartDateTime format.");

            if (!DateTime.TryParse(dto.EndDateTime, out DateTime endDateTime))
                throw new ArgumentException("Invalid EndDateTime format.");

            if (endDateTime <= startDateTime)
                throw new ArgumentException("EndDateTime must be after StartDateTime.");

            string categoryName = (dto.Category >= 0 && dto.Category < CategoryNames.Length)
                ? CategoryNames[dto.Category]
                : "Other";

            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            // ✅ Verify ownership first
            string ownerCheck = @"
                SELECT COUNT(1) FROM Events
                WHERE Id = @Id AND OrganizerId = @OrganizerId";

            using (var checkCmd = new SqlCommand(ownerCheck, connection))
            {
                checkCmd.Parameters.AddWithValue("@Id", id);
                checkCmd.Parameters.AddWithValue("@OrganizerId", organizerId);

                int count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                if (count == 0)
                    throw new UnauthorizedAccessException("You do not own this event.");
            }

            // Calculate seat config if provided
            string? seatConfigJson = null;
            if (dto.SeatTiers != null && dto.SeatTiers.Any())
            {
                seatConfigJson = JsonSerializer.Serialize(dto.SeatTiers);
            }

            string query = @"
                UPDATE Events
                SET    Title         = @Title,
                       Description   = @Description,
                       Category      = @Category,
                       Status        = @Status,
                       StartDateTime = @StartDateTime,
                       EndDateTime   = @EndDateTime,
                       Venue         = @Venue,
                       City          = @City,
                       Address       = @Address,
                       ImageUrl      = @ImageUrl,
                       TicketPrice   = @TicketPrice,
                       TotalTickets  = @TotalTickets,
                       SeatConfig    = @SeatConfig,
                       GoogleMapsUrl = @GoogleMapsUrl,
                       UpdatedAt     = @UpdatedAt
                WHERE  Id = @Id AND OrganizerId = @OrganizerId";

            using var cmd = new SqlCommand(query, connection);

            cmd.Parameters.AddWithValue("@Id", id);
            cmd.Parameters.AddWithValue("@OrganizerId", organizerId);
            cmd.Parameters.AddWithValue("@Title", dto.Title.Trim());
            cmd.Parameters.AddWithValue("@Description", dto.Description.Trim());
            cmd.Parameters.AddWithValue("@Category", categoryName);
            cmd.Parameters.AddWithValue("@Status", dto.Status.Trim());
            cmd.Parameters.AddWithValue("@StartDateTime", startDateTime);
            cmd.Parameters.AddWithValue("@EndDateTime", endDateTime);
            cmd.Parameters.AddWithValue("@Venue", dto.Venue.Trim());
            cmd.Parameters.AddWithValue("@City", dto.City.Trim());
            cmd.Parameters.AddWithValue("@Address",
                string.IsNullOrWhiteSpace(dto.Address) ? (object)DBNull.Value : dto.Address.Trim());
            cmd.Parameters.AddWithValue("@ImageUrl",
                string.IsNullOrWhiteSpace(dto.ImageUrl) ? (object)DBNull.Value : dto.ImageUrl.Trim());
            cmd.Parameters.AddWithValue("@TicketPrice", dto.TicketPrice);
            cmd.Parameters.AddWithValue("@TotalTickets", dto.TotalTickets);
            cmd.Parameters.AddWithValue("@SeatConfig", seatConfigJson ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("@GoogleMapsUrl", dto.GoogleMapsUrl ?? (object)DBNull.Value);
            cmd.Parameters.AddWithValue("@UpdatedAt", DateTime.UtcNow);

            await cmd.ExecuteNonQueryAsync();

            // Regenerate seats if config changed and no bookings exist
            if (dto.SeatTiers != null && dto.SeatTiers.Any())
            {
                var seatService = new SeatService(_db);
                try
                {
                    await seatService.RegenerateSeatsAsync(id, dto.SeatTiers);
                }
                catch (InvalidOperationException ex)
                {
                    // Seat regeneration failed due to existing bookings - just update event info
                    Console.WriteLine($"Warning: Could not regenerate seats: {ex.Message}");
                }
            }

            return await GetEventByIdAsync(id);
        }

        // ─────────────────────────────────────────────
        // DELETE EVENT (Properly handles all foreign key constraints)
        // ─────────────────────────────────────────────
        public async Task DeleteEventAsync(int id, int organizerId)
        {
            using var connection = _db.CreateConnection();
            await connection.OpenAsync();
            using var transaction = connection.BeginTransaction();

            try
            {
                // ✅ Verify organizer owns the event
                string ownerCheck = @"
                    SELECT COUNT(1) FROM Events
                    WHERE Id = @Id AND OrganizerId = @OrganizerId";

                using (var checkCmd = new SqlCommand(ownerCheck, connection, transaction))
                {
                    checkCmd.Parameters.AddWithValue("@Id", id);
                    checkCmd.Parameters.AddWithValue("@OrganizerId", organizerId);

                    int count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                    if (count == 0)
                        throw new UnauthorizedAccessException("You do not own this event.");
                }

                // Check if there are any confirmed bookings
                string bookingCheck = @"
                    SELECT COUNT(1) FROM Bookings
                    WHERE EventId = @EventId AND Status IN ('Confirmed', 'Pending')";

                using (var checkBookingCmd = new SqlCommand(bookingCheck, connection, transaction))
                {
                    checkBookingCmd.Parameters.AddWithValue("@EventId", id);
                    int activeBookings = Convert.ToInt32(await checkBookingCmd.ExecuteScalarAsync());
                    
                    if (activeBookings > 0)
                    {
                        throw new InvalidOperationException(
                            $"Cannot delete event with {activeBookings} active booking(s). Please cancel all bookings first.");
                    }
                }

                // Delete in correct order to avoid foreign key conflicts
                
                // 1. Delete tickets (through bookings)
                string deleteTicketsQuery = @"
                    DELETE FROM Tickets 
                    WHERE BookingId IN (SELECT Id FROM Bookings WHERE EventId = @EventId)";
                
                using (var cmd1 = new SqlCommand(deleteTicketsQuery, connection, transaction))
                {
                    cmd1.Parameters.AddWithValue("@EventId", id);
                    await cmd1.ExecuteNonQueryAsync();
                }

                // 2. Delete event seats
                string deleteSeatsQuery = "DELETE FROM EventSeats WHERE EventId = @EventId";
                using (var cmd2 = new SqlCommand(deleteSeatsQuery, connection, transaction))
                {
                    cmd2.Parameters.AddWithValue("@EventId", id);
                    await cmd2.ExecuteNonQueryAsync();
                }

                // 3. Delete bookings
                string deleteBookingsQuery = "DELETE FROM Bookings WHERE EventId = @EventId";
                using (var cmd3 = new SqlCommand(deleteBookingsQuery, connection, transaction))
                {
                    cmd3.Parameters.AddWithValue("@EventId", id);
                    await cmd3.ExecuteNonQueryAsync();
                }

                // 4. Finally delete the event
                string deleteEventQuery = "DELETE FROM Events WHERE Id = @Id AND OrganizerId = @OrganizerId";
                using (var cmd4 = new SqlCommand(deleteEventQuery, connection, transaction))
                {
                    cmd4.Parameters.AddWithValue("@Id", id);
                    cmd4.Parameters.AddWithValue("@OrganizerId", organizerId);
                    int rows = await cmd4.ExecuteNonQueryAsync();

                    if (rows == 0)
                        throw new UnauthorizedAccessException("Event not found or you do not own it.");
                }

                await transaction.CommitAsync();
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        // ─────────────────────────────────────────────
        // GET ORGANIZER EVENTS  (dashboard)
        // ─────────────────────────────────────────────
        public async Task<List<EventDto>> GetOrganizerEventsAsync(int organizerId)
        {
            var events = new List<EventDto>();

            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            string query = @"
                SELECT e.Id,
                       e.Title,
                       e.Description,
                       e.Category,
                       e.Status,
                       e.StartDateTime,
                       e.EndDateTime,
                       e.Venue,
                       e.City,
                       e.Address,
                       e.ImageUrl,
                       e.TicketPrice,
                       e.TotalTickets,
                       e.BookedTickets,
                       (e.TotalTickets - e.BookedTickets) AS AvailableTickets,
                       e.OrganizerId,
                       e.CreatedAt,
                       e.SeatConfig,
                       e.GoogleMapsUrl,
                       u.Name AS OrganizerName
                FROM   Events e
                INNER JOIN Users u ON e.OrganizerId = u.Id
                WHERE  e.OrganizerId = @OrganizerId
                ORDER  BY e.CreatedAt DESC";

            using var cmd = new SqlCommand(query, connection);
            cmd.Parameters.AddWithValue("@OrganizerId", organizerId);

            using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
                events.Add(MapReaderToEventDto(reader));

            return events;
        }

        // ─────────────────────────────────────────────
        // PRIVATE: Map SqlDataReader → EventDto
        // ─────────────────────────────────────────────
        private static EventDto MapReaderToEventDto(SqlDataReader reader)
        {
            string categoryString = reader["Category"].ToString()!;

            // Convert category string back to index for Angular form dropdown
            int categoryIndex = Array.IndexOf(CategoryNames, categoryString);
            if (categoryIndex < 0) categoryIndex = 7;

            string? seatConfig = reader["SeatConfig"] == DBNull.Value ? null : reader["SeatConfig"].ToString();
            string? googleMapsUrl = reader["GoogleMapsUrl"] == DBNull.Value ? null : reader["GoogleMapsUrl"].ToString();
            
            // Calculate min and max prices from seat configuration
            decimal ticketPrice = Convert.ToDecimal(reader["TicketPrice"]);
            decimal minPrice = ticketPrice;
            decimal maxPrice = ticketPrice;
            
            // If seat config exists, parse it to get actual price range
            if (!string.IsNullOrEmpty(seatConfig))
            {
                try
                {
                    // Try to deserialize as array directly
                    var tiers = JsonSerializer.Deserialize<List<SeatTierConfigDto>>(seatConfig);
                    if (tiers != null && tiers.Any())
                    {
                        minPrice = tiers.Min(t => t.Price);
                        maxPrice = tiers.Max(t => t.Price);
                    }
                }
                catch
                {
                    // If that fails, try with wrapper object { "seatTiers": [...] }
                    try
                    {
                        using JsonDocument doc = JsonDocument.Parse(seatConfig);
                        if (doc.RootElement.TryGetProperty("seatTiers", out JsonElement seatTiersElement))
                        {
                            var tiers = JsonSerializer.Deserialize<List<SeatTierConfigDto>>(seatTiersElement.GetRawText());
                            if (tiers != null && tiers.Any())
                            {
                                minPrice = tiers.Min(t => t.Price);
                                maxPrice = tiers.Max(t => t.Price);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"Error parsing seat config: {ex.Message}");
                    }
                }
            }

            return new EventDto
            {
                Id = Convert.ToInt32(reader["Id"]),
                Title = reader["Title"].ToString()!,
                Description = reader["Description"].ToString()!,
                Category = categoryString,
                CategoryIndex = categoryIndex,
                Status = reader["Status"].ToString()!,
                StartDateTime = ((DateTime)reader["StartDateTime"]).ToString("o"),
                EndDateTime = ((DateTime)reader["EndDateTime"]).ToString("o"),
                Venue = reader["Venue"].ToString()!,
                City = reader["City"].ToString()!,
                Address = reader["Address"] == DBNull.Value ? null : reader["Address"].ToString(),
                ImageUrl = reader["ImageUrl"] == DBNull.Value ? null : reader["ImageUrl"].ToString(),
                TicketPrice = ticketPrice,
                MinPrice = minPrice,
                MaxPrice = maxPrice,
                TotalTickets = Convert.ToInt32(reader["TotalTickets"]),
                BookedTickets = Convert.ToInt32(reader["BookedTickets"]),
                AvailableTickets = Convert.ToInt32(reader["AvailableTickets"]),
                OrganizerId = Convert.ToInt32(reader["OrganizerId"]),
                OrganizerName = reader["OrganizerName"].ToString()!,
                CreatedAt = ((DateTime)reader["CreatedAt"]).ToString("o"),
                HasSeatMap = !string.IsNullOrEmpty(seatConfig),
                SeatConfig = seatConfig,
                GoogleMapsUrl = googleMapsUrl
            };
        }
    }
}