using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Data.SqlClient;
using MimeKit;

namespace EventBooking.API.Services
{
    public interface IEmailService
    {
        Task SendBookingConfirmationAsync(int bookingId);
        Task SendCancellationEmailAsync(int bookingId);
    }

    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;
        private readonly ILogger<EmailService> _logger;
        private readonly string _connectionString;

        public EmailService(IConfiguration config, ILogger<EmailService> logger)
        {
            _config = config;
            _logger = logger;
            _connectionString = _config.GetConnectionString("DefaultConnection")!;
        }

        public async Task SendBookingConfirmationAsync(int bookingId)
        {
            try
            {
                using SqlConnection connection = new SqlConnection(_connectionString);

                string query = @"
                    SELECT 
                        b.Id,
                        b.TicketCount,
                        b.TotalAmount,
                        u.Name AS UserName,
                        u.Email,
                        e.Title,
                        e.EventDate,
                        e.Venue,
                        e.City
                    FROM Bookings b
                    INNER JOIN Users u ON b.UserId = u.Id
                    INNER JOIN Events e ON b.EventId = e.Id
                    WHERE b.Id = @BookingId
                ";

                using SqlCommand command = new SqlCommand(query, connection);

                command.Parameters.AddWithValue("@BookingId", bookingId);

                await connection.OpenAsync();

                using SqlDataReader reader = await command.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    string userName = reader["UserName"].ToString()!;
                    string email = reader["Email"].ToString()!;
                    string title = reader["Title"].ToString()!;
                    string venue = reader["Venue"].ToString()!;
                    string city = reader["City"].ToString()!;
                    int ticketCount = Convert.ToInt32(reader["TicketCount"]);
                    decimal totalAmount = Convert.ToDecimal(reader["TotalAmount"]);

                    var subject = "Booking Confirmation";

                    var body = $@"
<html>
<body>
<h2>Booking Confirmed!</h2>

<p>Dear {userName},</p>

<p>Your booking for <strong>{title}</strong> has been confirmed.</p>

<table>
<tr>
<td><b>Venue:</b></td>
<td>{venue}, {city}</td>
</tr>

<tr>
<td><b>Tickets:</b></td>
<td>{ticketCount}</td>
</tr>

<tr>
<td><b>Total Amount:</b></td>
<td>{totalAmount}</td>
</tr>
</table>

<p>Thank you for booking with us!</p>

</body>
</html>";

                    await SendEmailAsync(email, subject, body);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send booking confirmation");
            }
        }

        public async Task SendCancellationEmailAsync(int bookingId)
        {
            try
            {
                using SqlConnection connection = new SqlConnection(_connectionString);

                string query = @"
                    SELECT 
                        u.Name AS UserName,
                        u.Email,
                        e.Title
                    FROM Bookings b
                    INNER JOIN Users u ON b.UserId = u.Id
                    INNER JOIN Events e ON b.EventId = e.Id
                    WHERE b.Id = @BookingId
                ";

                using SqlCommand command = new SqlCommand(query, connection);

                command.Parameters.AddWithValue("@BookingId", bookingId);

                await connection.OpenAsync();

                using SqlDataReader reader = await command.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    string userName = reader["UserName"].ToString()!;
                    string email = reader["Email"].ToString()!;
                    string title = reader["Title"].ToString()!;

                    var subject = "Booking Cancelled";

                    var body = $@"
<html>
<body>

<h2>Booking Cancelled</h2>

<p>Dear {userName},</p>

<p>Your booking for <strong>{title}</strong> has been cancelled.</p>

</body>
</html>";

                    await SendEmailAsync(email, subject, body);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send cancellation email");
            }
        }

        private async Task SendEmailAsync(string to, string subject, string htmlBody)
        {
            var smtpConfig = _config.GetSection("Smtp");

            var message = new MimeMessage();

            message.From.Add(
                new MailboxAddress(
                    smtpConfig["SenderName"],
                    smtpConfig["SenderEmail"]
                )
            );

            message.To.Add(MailboxAddress.Parse(to));

            message.Subject = subject;

            message.Body = new BodyBuilder
            {
                HtmlBody = htmlBody
            }.ToMessageBody();

            using var client = new SmtpClient();

            await client.ConnectAsync(
                smtpConfig["Host"],
                int.Parse(smtpConfig["Port"] ?? "587"),
                SecureSocketOptions.StartTls
            );

            await client.AuthenticateAsync(
                smtpConfig["Username"],
                smtpConfig["Password"]
            );

            await client.SendAsync(message);

            await client.DisconnectAsync(true);
        }
    }
}