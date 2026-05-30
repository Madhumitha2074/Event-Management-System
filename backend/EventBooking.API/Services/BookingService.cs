using EventBooking.API.DTOs;
using EventBooking.API.Models;
using Microsoft.Data.SqlClient;

namespace EventBooking.API.Services
{
    public interface IBookingService
    {
        Task<BookingDto> CreateBookingAsync(CreateBookingDto dto, int userId);
        Task<List<BookingDto>> GetUserBookingsAsync(int userId);
        Task<BookingDto> GetBookingByIdAsync(int id, int userId);
        Task CancelBookingAsync(int id, int userId);
        Task<List<BookingDto>> GetEventBookingsAsync(int eventId, int organizerId);
    }

    public class BookingService : IBookingService
    {
        private readonly IConfiguration _configuration;
        private readonly string _connectionString;
        private readonly IEmailService _emailService;

        public BookingService(
            IConfiguration configuration,
            IEmailService emailService)
        {
            _configuration = configuration;
            _connectionString = _configuration.GetConnectionString("DefaultConnection")!;
            _emailService = emailService;
        }

        public async Task<BookingDto> CreateBookingAsync(CreateBookingDto dto, int userId)
        {
            using SqlConnection connection = new SqlConnection(_connectionString);

            await connection.OpenAsync();

            string bookingReference = GenerateReference();

            decimal totalAmount = 0;

            string eventQuery = @"
                SELECT Price
                FROM Events
                WHERE Id = @EventId
            ";

            using (SqlCommand eventCommand = new SqlCommand(eventQuery, connection))
            {
                eventCommand.Parameters.AddWithValue("@EventId", dto.EventId);

                var result = await eventCommand.ExecuteScalarAsync();

                if (result == null)
                    throw new Exception("Event not found");

                decimal price = Convert.ToDecimal(result);

                totalAmount = price * dto.TicketCount;
            }

            string insertQuery = @"
                INSERT INTO Bookings
                (
                    UserId,
                    EventId,
                    TicketCount,
                    TotalAmount,
                    Status
                )
                OUTPUT INSERTED.Id
                VALUES
                (
                    @UserId,
                    @EventId,
                    @TicketCount,
                    @TotalAmount,
                    @Status
                )
            ";

            int bookingId;

            using (SqlCommand command = new SqlCommand(insertQuery, connection))
            {
                command.Parameters.AddWithValue("@UserId", userId);
                command.Parameters.AddWithValue("@EventId", dto.EventId);
                command.Parameters.AddWithValue("@TicketCount", dto.TicketCount);
                command.Parameters.AddWithValue("@TotalAmount", totalAmount);
                command.Parameters.AddWithValue("@Status", "Confirmed");

                bookingId = Convert.ToInt32(await command.ExecuteScalarAsync());
            }

            await _emailService.SendBookingConfirmationAsync(bookingId);

            return await GetBookingByIdAsync(bookingId, userId);
        }

        public async Task<List<BookingDto>> GetUserBookingsAsync(int userId)
        {
            List<BookingDto> bookings = new();

            using SqlConnection connection = new SqlConnection(_connectionString);

            string query = @"
                SELECT 
                    b.Id,
                    b.TicketCount,
                    b.TotalAmount,
                    b.Status,
                    b.BookingDate,
                    e.Title
                FROM Bookings b
                INNER JOIN Events e ON b.EventId = e.Id
                WHERE b.UserId = @UserId
            ";

            using SqlCommand command = new SqlCommand(query, connection);

            command.Parameters.AddWithValue("@UserId", userId);

            await connection.OpenAsync();

            using SqlDataReader reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                bookings.Add(new BookingDto
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    TicketCount = Convert.ToInt32(reader["TicketCount"]),
                    TotalAmount = Convert.ToDecimal(reader["TotalAmount"]),
                    Status = reader["Status"].ToString()!,
                    EventTitle = reader["Title"].ToString()!,
                    BookedAt = Convert.ToDateTime(reader["BookingDate"])
                });
            }

            return bookings;
        }

        public async Task<BookingDto> GetBookingByIdAsync(int id, int userId)
        {
            using SqlConnection connection = new SqlConnection(_connectionString);

            string query = @"
                SELECT 
                    b.Id,
                    b.TicketCount,
                    b.TotalAmount,
                    b.Status,
                    b.BookingDate,
                    e.Title
                FROM Bookings b
                INNER JOIN Events e ON b.EventId = e.Id
                WHERE b.Id = @Id
                AND b.UserId = @UserId
            ";

            using SqlCommand command = new SqlCommand(query, connection);

            command.Parameters.AddWithValue("@Id", id);
            command.Parameters.AddWithValue("@UserId", userId);

            await connection.OpenAsync();

            using SqlDataReader reader = await command.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                return new BookingDto
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    TicketCount = Convert.ToInt32(reader["TicketCount"]),
                    TotalAmount = Convert.ToDecimal(reader["TotalAmount"]),
                    Status = reader["Status"].ToString()!,
                    EventTitle = reader["Title"].ToString()!,
                    BookedAt = Convert.ToDateTime(reader["BookingDate"])
                };
            }

            throw new Exception("Booking not found");
        }

        public async Task CancelBookingAsync(int id, int userId)
        {
            using SqlConnection connection = new SqlConnection(_connectionString);

            string query = @"
                UPDATE Bookings
                SET Status = 'Cancelled'
                WHERE Id = @Id
                AND UserId = @UserId
            ";

            using SqlCommand command = new SqlCommand(query, connection);

            command.Parameters.AddWithValue("@Id", id);
            command.Parameters.AddWithValue("@UserId", userId);

            await connection.OpenAsync();

            await command.ExecuteNonQueryAsync();

            await _emailService.SendCancellationEmailAsync(id);
        }

        public async Task<List<BookingDto>> GetEventBookingsAsync(int eventId, int organizerId)
        {
            List<BookingDto> bookings = new();

            using SqlConnection connection = new SqlConnection(_connectionString);

            string query = @"
                SELECT 
                    b.Id,
                    b.TicketCount,
                    b.TotalAmount,
                    b.Status,
                    b.BookingDate
                FROM Bookings b
                WHERE b.EventId = @EventId
            ";

            using SqlCommand command = new SqlCommand(query, connection);

            command.Parameters.AddWithValue("@EventId", eventId);

            await connection.OpenAsync();

            using SqlDataReader reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                bookings.Add(new BookingDto
                {
                    Id = Convert.ToInt32(reader["Id"]),
                    TicketCount = Convert.ToInt32(reader["TicketCount"]),
                    TotalAmount = Convert.ToDecimal(reader["TotalAmount"]),
                    Status = reader["Status"].ToString()!,
                    BookedAt = Convert.ToDateTime(reader["BookingDate"])
                });
            }

            return bookings;
        }

        private static string GenerateReference()
        {
            return $"EVT-{Guid.NewGuid().ToString().Substring(0, 8).ToUpper()}";
        }
    }
}