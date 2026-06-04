using EventBooking.API.Data;
using EventBooking.API.DTOs;
using Microsoft.Data.SqlClient;

namespace EventBooking.API.Services
{
    public interface IEventService
    {
        Task<PagedResultDto<EventDto>> GetEventsAsync(EventFilterDto filter);
        Task<EventDto>                GetEventByIdAsync(int id);
        Task<EventDto>                CreateEventAsync(CreateEventDto dto, int organizerId);
        Task<EventDto>                UpdateEventAsync(int id, UpdateEventDto dto, int organizerId);
        Task                          DeleteEventAsync(int id, int organizerId);
        Task<List<EventDto>>          GetOrganizerEventsAsync(int organizerId);
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
            var events     = new List<EventDto>();
            int totalCount = 0;

            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            // ── Build dynamic WHERE clause ──────────────────────────────────
            var conditions = new List<string> { "e.Status = 'Published'" };
            var parameters = new List<SqlParameter>();

            if (!string.IsNullOrWhiteSpace(filter.Search))
            {
                conditions.Add("(e.Title LIKE @Search OR e.Description LIKE @Search OR e.City LIKE @Search)");
                parameters.Add(new SqlParameter("@Search", $"%{filter.Search.Trim()}%"));
            }

            if (!string.IsNullOrWhiteSpace(filter.City))
            {
                conditions.Add("e.City = @City");
                parameters.Add(new SqlParameter("@City", filter.City.Trim()));
            }

            if (filter.Category.HasValue && filter.Category.Value >= 0 && filter.Category.Value < CategoryNames.Length)
            {
                conditions.Add("e.Category = @Category");
                parameters.Add(new SqlParameter("@Category", CategoryNames[filter.Category.Value]));
            }

            if (!string.IsNullOrWhiteSpace(filter.StartDate) &&
                DateTime.TryParse(filter.StartDate, out DateTime startDate))
            {
                conditions.Add("e.StartDateTime >= @StartDate");
                parameters.Add(new SqlParameter("@StartDate", startDate));
            }

            if (!string.IsNullOrWhiteSpace(filter.EndDate) &&
                DateTime.TryParse(filter.EndDate, out DateTime endDate))
            {
                conditions.Add("e.StartDateTime <= @EndDate");
                parameters.Add(new SqlParameter("@EndDate", endDate));
            }

            if (filter.MinPrice.HasValue)
            {
                conditions.Add("e.TicketPrice >= @MinPrice");
                parameters.Add(new SqlParameter("@MinPrice", filter.MinPrice.Value));
            }

            if (filter.MaxPrice.HasValue)
            {
                conditions.Add("e.TicketPrice <= @MaxPrice");
                parameters.Add(new SqlParameter("@MaxPrice", filter.MaxPrice.Value));
            }

            string whereClause = string.Join(" AND ", conditions);

            // ── Step 1: Get total count for pagination ──────────────────────
            string countQuery = $@"
                SELECT COUNT(1)
                FROM   Events e
                WHERE  {whereClause}";

            using (var countCmd = new SqlCommand(countQuery, connection))
            {
                countCmd.Parameters.AddRange(parameters.ToArray());
                totalCount = Convert.ToInt32(await countCmd.ExecuteScalarAsync());
            }

            if (totalCount == 0)
            {
                return new PagedResultDto<EventDto>
                {
                    Items      = events,
                    TotalCount = 0,
                    Page       = filter.Page,
                    PageSize   = filter.PageSize
                };
            }

            // ── Step 2: Get paged data ──────────────────────────────────────
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
                       u.Name AS OrganizerName
                FROM   Events e
                INNER JOIN Users u ON e.OrganizerId = u.Id
                WHERE  {whereClause}
                ORDER  BY e.StartDateTime ASC
                OFFSET {offset} ROWS FETCH NEXT {filter.PageSize} ROWS ONLY";

            using (var dataCmd = new SqlCommand(dataQuery, connection))
            {
                dataCmd.Parameters.AddRange(parameters.ToArray());

                using var reader = await dataCmd.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    events.Add(MapReaderToEventDto(reader));
                }
            }

            return new PagedResultDto<EventDto>
            {
                Items      = events,
                TotalCount = totalCount,
                Page       = filter.Page,
                PageSize   = filter.PageSize
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
        // CREATE EVENT
        // ─────────────────────────────────────────────
        public async Task<EventDto> CreateEventAsync(CreateEventDto dto, int organizerId)
        {
            // ✅ Parse date strings from Angular into DateTime for SQL Server
            if (!DateTime.TryParse(dto.StartDateTime, out DateTime startDateTime))
                throw new ArgumentException("Invalid StartDateTime format.");

            if (!DateTime.TryParse(dto.EndDateTime, out DateTime endDateTime))
                throw new ArgumentException("Invalid EndDateTime format.");

            if (endDateTime <= startDateTime)
                throw new ArgumentException("EndDateTime must be after StartDateTime.");

            // ✅ Map category int to string
            string categoryName = (dto.Category >= 0 && dto.Category < CategoryNames.Length)
                ? CategoryNames[dto.Category]
                : "Other";

            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            string query = @"
                INSERT INTO Events
                    (Title, Description, Category, Status,
                     StartDateTime, EndDateTime, Venue, City,
                     Address, ImageUrl, TicketPrice, TotalTickets,
                     BookedTickets, OrganizerId)
                OUTPUT INSERTED.Id
                VALUES
                    (@Title, @Description, @Category, 'Draft',
                     @StartDateTime, @EndDateTime, @Venue, @City,
                     @Address, @ImageUrl, @TicketPrice, @TotalTickets,
                     0, @OrganizerId)";

            using var cmd = new SqlCommand(query, connection);

            cmd.Parameters.AddWithValue("@Title",         dto.Title.Trim());
            cmd.Parameters.AddWithValue("@Description",   dto.Description.Trim());
            cmd.Parameters.AddWithValue("@Category",      categoryName);
            cmd.Parameters.AddWithValue("@StartDateTime", startDateTime);
            cmd.Parameters.AddWithValue("@EndDateTime",   endDateTime);
            cmd.Parameters.AddWithValue("@Venue",         dto.Venue.Trim());
            cmd.Parameters.AddWithValue("@City",          dto.City.Trim());
            cmd.Parameters.AddWithValue("@Address",
                string.IsNullOrWhiteSpace(dto.Address)  ? (object)DBNull.Value : dto.Address.Trim());
            cmd.Parameters.AddWithValue("@ImageUrl",
                string.IsNullOrWhiteSpace(dto.ImageUrl) ? (object)DBNull.Value : dto.ImageUrl.Trim());
            cmd.Parameters.AddWithValue("@TicketPrice",   dto.TicketPrice);
            cmd.Parameters.AddWithValue("@TotalTickets",  dto.TotalTickets);
            cmd.Parameters.AddWithValue("@OrganizerId",   organizerId);

            var scalar  = await cmd.ExecuteScalarAsync();
            int eventId = Convert.ToInt32(scalar);

            return await GetEventByIdAsync(eventId);
        }

        // ─────────────────────────────────────────────
        // UPDATE EVENT
        // ─────────────────────────────────────────────
        public async Task<EventDto> UpdateEventAsync(int id, UpdateEventDto dto, int organizerId)
        {
            // ✅ Parse date strings
            if (!DateTime.TryParse(dto.StartDateTime, out DateTime startDateTime))
                throw new ArgumentException("Invalid StartDateTime format.");

            if (!DateTime.TryParse(dto.EndDateTime, out DateTime endDateTime))
                throw new ArgumentException("Invalid EndDateTime format.");

            if (endDateTime <= startDateTime)
                throw new ArgumentException("EndDateTime must be after StartDateTime.");

            // ✅ Map category int to string
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
                checkCmd.Parameters.AddWithValue("@Id",          id);
                checkCmd.Parameters.AddWithValue("@OrganizerId", organizerId);

                int count = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                if (count == 0)
                    throw new UnauthorizedAccessException("You do not own this event.");
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
                       UpdatedAt     = @UpdatedAt
                WHERE  Id = @Id AND OrganizerId = @OrganizerId";

            using var cmd = new SqlCommand(query, connection);

            cmd.Parameters.AddWithValue("@Id",            id);
            cmd.Parameters.AddWithValue("@OrganizerId",   organizerId);
            cmd.Parameters.AddWithValue("@Title",         dto.Title.Trim());
            cmd.Parameters.AddWithValue("@Description",   dto.Description.Trim());
            cmd.Parameters.AddWithValue("@Category",      categoryName);
            cmd.Parameters.AddWithValue("@Status",        dto.Status.Trim());
            cmd.Parameters.AddWithValue("@StartDateTime", startDateTime);
            cmd.Parameters.AddWithValue("@EndDateTime",   endDateTime);
            cmd.Parameters.AddWithValue("@Venue",         dto.Venue.Trim());
            cmd.Parameters.AddWithValue("@City",          dto.City.Trim());
            cmd.Parameters.AddWithValue("@Address",
                string.IsNullOrWhiteSpace(dto.Address)  ? (object)DBNull.Value : dto.Address.Trim());
            cmd.Parameters.AddWithValue("@ImageUrl",
                string.IsNullOrWhiteSpace(dto.ImageUrl) ? (object)DBNull.Value : dto.ImageUrl.Trim());
            cmd.Parameters.AddWithValue("@TicketPrice",   dto.TicketPrice);
            cmd.Parameters.AddWithValue("@TotalTickets",  dto.TotalTickets);
            cmd.Parameters.AddWithValue("@UpdatedAt",     DateTime.UtcNow);

            await cmd.ExecuteNonQueryAsync();

            return await GetEventByIdAsync(id);
        }

        // ─────────────────────────────────────────────
        // DELETE EVENT
        // ─────────────────────────────────────────────
        public async Task DeleteEventAsync(int id, int organizerId)
        {
            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            // ✅ Block delete if active bookings exist
            string bookingCheck = @"
                SELECT COUNT(1) FROM Bookings
                WHERE  EventId = @EventId
                AND    Status  IN ('Confirmed', 'Pending')";

            using (var checkCmd = new SqlCommand(bookingCheck, connection))
            {
                checkCmd.Parameters.AddWithValue("@EventId", id);

                int activeBookings = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                if (activeBookings > 0)
                    throw new InvalidOperationException(
                        "Cannot delete event with active bookings. Cancel all bookings first.");
            }

            string query = @"
                DELETE FROM Events
                WHERE  Id          = @Id
                AND    OrganizerId = @OrganizerId";

            using var cmd = new SqlCommand(query, connection);
            cmd.Parameters.AddWithValue("@Id",          id);
            cmd.Parameters.AddWithValue("@OrganizerId", organizerId);

            int rows = await cmd.ExecuteNonQueryAsync();

            if (rows == 0)
                throw new UnauthorizedAccessException("Event not found or you do not own it.");
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
                       u.Name AS OrganizerName
                FROM   Events e
                INNER JOIN Users u ON e.OrganizerId = u.Id
                WHERE  e.OrganizerId = @OrganizerId
                ORDER  BY e.CreatedAt DESC";

            using var cmd = new SqlCommand(query, connection);
            cmd.Parameters.AddWithValue("@OrganizerId", organizerId);

            using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                events.Add(MapReaderToEventDto(reader));
            }

            return events;
        }

        // ─────────────────────────────────────────────
        // PRIVATE: Map SqlDataReader → EventDto
        // ─────────────────────────────────────────────
        private static EventDto MapReaderToEventDto(SqlDataReader reader)
        {
            return new EventDto
            {
                Id               = Convert.ToInt32(reader["Id"]),
                Title            = reader["Title"].ToString()!,
                Description      = reader["Description"].ToString()!,
                Category         = reader["Category"].ToString()!,
                Status           = reader["Status"].ToString()!,
                StartDateTime    = ((DateTime)reader["StartDateTime"]).ToString("o"),
                EndDateTime      = ((DateTime)reader["EndDateTime"]).ToString("o"),
                Venue            = reader["Venue"].ToString()!,
                City             = reader["City"].ToString()!,
                Address          = reader["Address"]  == DBNull.Value ? null : reader["Address"].ToString(),
                ImageUrl         = reader["ImageUrl"] == DBNull.Value ? null : reader["ImageUrl"].ToString(),
                TicketPrice      = Convert.ToDecimal(reader["TicketPrice"]),
                TotalTickets     = Convert.ToInt32(reader["TotalTickets"]),
                BookedTickets    = Convert.ToInt32(reader["BookedTickets"]),
                AvailableTickets = Convert.ToInt32(reader["AvailableTickets"]),
                OrganizerId      = Convert.ToInt32(reader["OrganizerId"]),
                OrganizerName    = reader["OrganizerName"].ToString()!,
                CreatedAt        = ((DateTime)reader["CreatedAt"]).ToString("o")
            };
        }
    }
}