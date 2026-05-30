using EventBooking.API.DTOs;
using EventBooking.API.Models;
using Microsoft.Data.SqlClient;
using System.Data;

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
        private readonly IConfiguration _configuration;
        private readonly string _connectionString;

        public EventService(IConfiguration configuration)
        {
            _configuration = configuration;
            _connectionString = _configuration.GetConnectionString("DefaultConnection")!;
        }

        public async Task<PagedResultDto<EventDto>> GetEventsAsync(EventFilterDto filter)
        {
            var events = new List<EventDto>();

            using SqlConnection connection = new SqlConnection(_connectionString);

            string query = @"
                SELECT 
                    Id,
                    Title,
                    Description,
                    Venue,
                    City,
                    Price,
                    TotalTickets,
                    AvailableTickets
                FROM Events
            ";

            using SqlCommand command = new SqlCommand(query, connection);

            await connection.OpenAsync();

            using SqlDataReader reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                events.Add(new EventDto
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Title = reader["Title"].ToString()!,
                    Description = reader["Description"].ToString()!,
                    Venue = reader["Venue"].ToString()!,
                    City = reader["City"].ToString()!,
                    TicketPrice = Convert.ToDecimal(reader["Price"]),
                    TotalTickets = Convert.ToInt32(reader["TotalTickets"]),
                    AvailableTickets = Convert.ToInt32(reader["AvailableTickets"])
                });
            }

            return new PagedResultDto<EventDto>
            {
                Items = events,
                TotalCount = events.Count,
                Page = 1,
                PageSize = events.Count
            };
        }

        public async Task<EventDto> GetEventByIdAsync(int id)
        {
            using SqlConnection connection = new SqlConnection(_connectionString);

            string query = @"
                SELECT 
                    Id,
                    Title,
                    Description,
                    Venue,
                    City,
                    Price,
                    TotalTickets,
                    AvailableTickets
                FROM Events
                WHERE Id = @Id
            ";

            using SqlCommand command = new SqlCommand(query, connection);

            command.Parameters.AddWithValue("@Id", id);

            await connection.OpenAsync();

            using SqlDataReader reader = await command.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                return new EventDto
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Title = reader["Title"].ToString()!,
                    Description = reader["Description"].ToString()!,
                    Venue = reader["Venue"].ToString()!,
                    City = reader["City"].ToString()!,
                    TicketPrice = Convert.ToDecimal(reader["Price"]),
                    TotalTickets = Convert.ToInt32(reader["TotalTickets"]),
                    AvailableTickets = Convert.ToInt32(reader["AvailableTickets"])
                };
            }

            throw new KeyNotFoundException("Event not found");
        }

        public async Task<EventDto> CreateEventAsync(CreateEventDto dto, int organizerId)
        {
            using SqlConnection connection = new SqlConnection(_connectionString);

            string query = @"
                INSERT INTO Events
                (
                    Title,
                    Description,
                    Venue,
                    City,
                    Price,
                    TotalTickets,
                    AvailableTickets,
                    OrganizerId,
                    EventDate
                )
                OUTPUT INSERTED.Id
                VALUES
                (
                    @Title,
                    @Description,
                    @Venue,
                    @City,
                    @Price,
                    @TotalTickets,
                    @AvailableTickets,
                    @OrganizerId,
                    @EventDate
                )
            ";

            using SqlCommand command = new SqlCommand(query, connection);

            command.Parameters.AddWithValue("@Title", dto.Title);
            command.Parameters.AddWithValue("@Description", dto.Description);
            command.Parameters.AddWithValue("@Venue", dto.Venue);
            command.Parameters.AddWithValue("@City", dto.City);
            command.Parameters.AddWithValue("@Price", dto.TicketPrice);
            command.Parameters.AddWithValue("@TotalTickets", dto.TotalTickets);
            command.Parameters.AddWithValue("@AvailableTickets", dto.TotalTickets);
            command.Parameters.AddWithValue("@OrganizerId", organizerId);
            command.Parameters.AddWithValue("@EventDate", dto.StartDateTime);

            await connection.OpenAsync();

            int eventId = Convert.ToInt32(await command.ExecuteScalarAsync());

            return await GetEventByIdAsync(eventId);
        }

        public async Task<EventDto> UpdateEventAsync(int id, UpdateEventDto dto, int organizerId)
        {
            using SqlConnection connection = new SqlConnection(_connectionString);

            string query = @"
                UPDATE Events
                SET
                    Title = @Title,
                    Description = @Description,
                    Venue = @Venue,
                    City = @City,
                    Price = @Price,
                    TotalTickets = @TotalTickets,
                    EventDate = @EventDate
                WHERE Id = @Id
                AND OrganizerId = @OrganizerId
            ";

            using SqlCommand command = new SqlCommand(query, connection);

            command.Parameters.AddWithValue("@Id", id);
            command.Parameters.AddWithValue("@OrganizerId", organizerId);
            command.Parameters.AddWithValue("@Title", dto.Title);
            command.Parameters.AddWithValue("@Description", dto.Description);
            command.Parameters.AddWithValue("@Venue", dto.Venue);
            command.Parameters.AddWithValue("@City", dto.City);
            command.Parameters.AddWithValue("@Price", dto.TicketPrice);
            command.Parameters.AddWithValue("@TotalTickets", dto.TotalTickets);
            command.Parameters.AddWithValue("@EventDate", dto.StartDateTime);

            await connection.OpenAsync();

            await command.ExecuteNonQueryAsync();

            return await GetEventByIdAsync(id);
        }

        public async Task DeleteEventAsync(int id, int organizerId)
        {
            using SqlConnection connection = new SqlConnection(_connectionString);

            string query = @"
                DELETE FROM Events
                WHERE Id = @Id
                AND OrganizerId = @OrganizerId
            ";

            using SqlCommand command = new SqlCommand(query, connection);

            command.Parameters.AddWithValue("@Id", id);
            command.Parameters.AddWithValue("@OrganizerId", organizerId);

            await connection.OpenAsync();

            await command.ExecuteNonQueryAsync();
        }

        public async Task<List<EventDto>> GetOrganizerEventsAsync(int organizerId)
        {
            var events = new List<EventDto>();

            using SqlConnection connection = new SqlConnection(_connectionString);

            string query = @"
                SELECT 
                    Id,
                    Title,
                    Description,
                    Venue,
                    City,
                    Price,
                    TotalTickets,
                    AvailableTickets
                FROM Events
                WHERE OrganizerId = @OrganizerId
            ";

            using SqlCommand command = new SqlCommand(query, connection);

            command.Parameters.AddWithValue("@OrganizerId", organizerId);

            await connection.OpenAsync();

            using SqlDataReader reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                events.Add(new EventDto
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    Title = reader["Title"].ToString()!,
                    Description = reader["Description"].ToString()!,
                    Venue = reader["Venue"].ToString()!,
                    City = reader["City"].ToString()!,
                    TicketPrice = Convert.ToDecimal(reader["Price"]),
                    TotalTickets = Convert.ToInt32(reader["TotalTickets"]),
                    AvailableTickets = Convert.ToInt32(reader["AvailableTickets"])
                });
            }

            return events;
        }
    }
}