using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using EventBooking.API.Data;
using Microsoft.Data.SqlClient;

namespace EventBooking.API.Services
{
    public interface IEmailService
    {
        Task SendBookingConfirmationAsync(int bookingId);
        Task SendCancellationEmailAsync(int bookingId);
    }

    public class EmailService : IEmailService
    {
        private readonly DatabaseHelper        _db;
        private readonly IConfiguration        _config;
        private readonly ILogger<EmailService> _logger;

        public EmailService(
            DatabaseHelper        db,
            IConfiguration        config,
            ILogger<EmailService> logger)
        {
            _db     = db;
            _config = config;
            _logger = logger;
        }

        // ─────────────────────────────────────────────
        // BOOKING CONFIRMATION EMAIL
        // ─────────────────────────────────────────────
        public async Task SendBookingConfirmationAsync(int bookingId)
        {
            try
            {
                using var connection = _db.CreateConnection();
                await connection.OpenAsync();

                // ✅ Added BookingReference and StartDateTime to query
                string query = @"
                    SELECT b.Id,
                           b.BookingReference,
                           b.TicketCount,
                           b.TotalAmount,
                           u.Name  AS UserName,
                           u.Email AS UserEmail,
                           e.Title,
                           e.Venue,
                           e.City,
                           e.StartDateTime
                    FROM   Bookings b
                    INNER JOIN Users  u ON b.UserId  = u.Id
                    INNER JOIN Events e ON b.EventId = e.Id
                    WHERE  b.Id = @BookingId";

                using var command = new SqlCommand(query, connection);
                command.Parameters.AddWithValue("@BookingId", bookingId);

                using var reader = await command.ExecuteReaderAsync();

                if (!await reader.ReadAsync())
                {
                    _logger.LogWarning("SendBookingConfirmationAsync: Booking {BookingId} not found.", bookingId);
                    return;
                }

                string   userName         = reader["UserName"].ToString()!;
                string   userEmail        = reader["UserEmail"].ToString()!;
                string   eventTitle       = reader["Title"].ToString()!;
                string   venue            = reader["Venue"].ToString()!;
                string   city             = reader["City"].ToString()!;
                string   bookingReference = reader["BookingReference"].ToString()!;
                int      ticketCount      = Convert.ToInt32(reader["TicketCount"]);
                decimal  totalAmount      = Convert.ToDecimal(reader["TotalAmount"]);

                // ✅ Format DateTime cleanly for email display
                string eventDate = reader["StartDateTime"] == DBNull.Value
                    ? "TBD"
                    : ((DateTime)reader["StartDateTime"]).ToString("dddd, MMMM d yyyy 'at' h:mm tt");

                string subject = $"Booking Confirmed — {eventTitle} [{bookingReference}]";
                string body    = BuildConfirmationEmailBody(
                    userName, eventTitle, venue, city,
                    eventDate, bookingReference, ticketCount, totalAmount
                );

                await SendEmailAsync(userEmail, subject, body);

                _logger.LogInformation(
                    "Booking confirmation email sent to {Email} for booking {BookingId}.",
                    userEmail, bookingId
                );
            }
            catch (Exception ex)
            {
                // ✅ Log full detail but don't rethrow — email failure must not fail the booking
                _logger.LogError(ex,
                    "Failed to send booking confirmation email for BookingId {BookingId}.", bookingId);
            }
        }

        // ─────────────────────────────────────────────
        // CANCELLATION EMAIL
        // ─────────────────────────────────────────────
        public async Task SendCancellationEmailAsync(int bookingId)
        {
            try
            {
                using var connection = _db.CreateConnection();
                await connection.OpenAsync();

                // ✅ Added BookingReference to cancellation query
                string query = @"
                    SELECT b.BookingReference,
                           u.Name  AS UserName,
                           u.Email AS UserEmail,
                           e.Title
                    FROM   Bookings b
                    INNER JOIN Users  u ON b.UserId  = u.Id
                    INNER JOIN Events e ON b.EventId = e.Id
                    WHERE  b.Id = @BookingId";

                using var command = new SqlCommand(query, connection);
                command.Parameters.AddWithValue("@BookingId", bookingId);

                using var reader = await command.ExecuteReaderAsync();

                if (!await reader.ReadAsync())
                {
                    _logger.LogWarning("SendCancellationEmailAsync: Booking {BookingId} not found.", bookingId);
                    return;
                }

                string userName         = reader["UserName"].ToString()!;
                string userEmail        = reader["UserEmail"].ToString()!;
                string eventTitle       = reader["Title"].ToString()!;
                string bookingReference = reader["BookingReference"].ToString()!;

                string subject = $"Booking Cancelled — {eventTitle} [{bookingReference}]";
                string body    = BuildCancellationEmailBody(userName, eventTitle, bookingReference);

                await SendEmailAsync(userEmail, subject, body);

                _logger.LogInformation(
                    "Cancellation email sent to {Email} for booking {BookingId}.",
                    userEmail, bookingId
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to send cancellation email for BookingId {BookingId}.", bookingId);
            }
        }

        // ─────────────────────────────────────────────
        // PRIVATE: Build Confirmation HTML Body
        // ─────────────────────────────────────────────
        private static string BuildConfirmationEmailBody(
            string  userName,
            string  eventTitle,
            string  venue,
            string  city,
            string  eventDate,
            string  bookingReference,
            int     ticketCount,
            decimal totalAmount)
        {
            // ✅ Inline styles for Gmail/Outlook compatibility
            return $@"
<!DOCTYPE html>
<html>
<body style=""font-family: Arial, sans-serif; background: #f4f4f8; margin: 0; padding: 20px;"">
  <div style=""max-width: 600px; margin: auto; background: white;
              border-radius: 12px; overflow: hidden;
              box-shadow: 0 2px 15px rgba(0,0,0,0.1);"">

    <!-- Header -->
    <div style=""background: linear-gradient(135deg, #6c5ce7, #a29bfe);
                padding: 30px; text-align: center;"">
      <h1 style=""color: white; margin: 0; font-size: 24px;"">
        ✅ Booking Confirmed!
      </h1>
    </div>

    <!-- Body -->
    <div style=""padding: 30px;"">
      <p style=""font-size: 16px; color: #2d3436;"">Dear <strong>{userName}</strong>,</p>
      <p style=""color: #636e72;"">
        Your booking for <strong>{eventTitle}</strong> has been confirmed.
        Here are your booking details:
      </p>

      <!-- Details Table -->
      <table style=""width: 100%; border-collapse: collapse; margin: 20px 0;"">
        <tr style=""background: #f8f9fa;"">
          <td style=""padding: 12px; border: 1px solid #dee2e6;
                      font-weight: bold; color: #2d3436; width: 40%;"">
            Booking Reference
          </td>
          <td style=""padding: 12px; border: 1px solid #dee2e6;
                      color: #6c5ce7; font-weight: bold; font-size: 16px;"">
            {bookingReference}
          </td>
        </tr>
        <tr>
          <td style=""padding: 12px; border: 1px solid #dee2e6;
                      font-weight: bold; color: #2d3436;"">
            Event
          </td>
          <td style=""padding: 12px; border: 1px solid #dee2e6; color: #2d3436;"">
            {eventTitle}
          </td>
        </tr>
        <tr style=""background: #f8f9fa;"">
          <td style=""padding: 12px; border: 1px solid #dee2e6;
                      font-weight: bold; color: #2d3436;"">
            Date
          </td>
          <td style=""padding: 12px; border: 1px solid #dee2e6; color: #2d3436;"">
            {eventDate}
          </td>
        </tr>
        <tr>
          <td style=""padding: 12px; border: 1px solid #dee2e6;
                      font-weight: bold; color: #2d3436;"">
            Venue
          </td>
          <td style=""padding: 12px; border: 1px solid #dee2e6; color: #2d3436;"">
            {venue}, {city}
          </td>
        </tr>
        <tr style=""background: #f8f9fa;"">
          <td style=""padding: 12px; border: 1px solid #dee2e6;
                      font-weight: bold; color: #2d3436;"">
            Tickets
          </td>
          <td style=""padding: 12px; border: 1px solid #dee2e6; color: #2d3436;"">
            {ticketCount} ticket(s)
          </td>
        </tr>
        <tr>
          <td style=""padding: 12px; border: 1px solid #dee2e6;
                      font-weight: bold; color: #2d3436;"">
            Total Paid
          </td>
          <td style=""padding: 12px; border: 1px solid #dee2e6;
                      color: #00b894; font-weight: bold; font-size: 18px;"">
            ₹{totalAmount:N2}
          </td>
        </tr>
      </table>

      <p style=""color: #636e72; font-size: 14px;"">
        Please keep your booking reference <strong>{bookingReference}</strong>
        handy when you arrive at the event.
      </p>
    </div>

    <!-- Footer -->
    <div style=""background: #2d3436; padding: 20px; text-align: center;"">
      <p style=""color: #b2bec3; margin: 0; font-size: 13px;"">
        © {DateTime.UtcNow.Year} EventBook — Discover &amp; Book Local Events
      </p>
    </div>

  </div>
</body>
</html>";
        }

        // ─────────────────────────────────────────────
        // PRIVATE: Build Cancellation HTML Body
        // ─────────────────────────────────────────────
        private static string BuildCancellationEmailBody(
            string userName,
            string eventTitle,
            string bookingReference)
        {
            return $@"
<!DOCTYPE html>
<html>
<body style=""font-family: Arial, sans-serif; background: #f4f4f8; margin: 0; padding: 20px;"">
  <div style=""max-width: 600px; margin: auto; background: white;
              border-radius: 12px; overflow: hidden;
              box-shadow: 0 2px 15px rgba(0,0,0,0.1);"">

    <!-- Header -->
    <div style=""background: linear-gradient(135deg, #d63031, #e17055);
                padding: 30px; text-align: center;"">
      <h1 style=""color: white; margin: 0; font-size: 24px;"">
        ❌ Booking Cancelled
      </h1>
    </div>

    <!-- Body -->
    <div style=""padding: 30px;"">
      <p style=""font-size: 16px; color: #2d3436;"">Dear <strong>{userName}</strong>,</p>
      <p style=""color: #636e72;"">
        Your booking for <strong>{eventTitle}</strong> has been successfully cancelled.
      </p>

      <table style=""width: 100%; border-collapse: collapse; margin: 20px 0;"">
        <tr style=""background: #f8f9fa;"">
          <td style=""padding: 12px; border: 1px solid #dee2e6;
                      font-weight: bold; color: #2d3436; width: 40%;"">
            Booking Reference
          </td>
          <td style=""padding: 12px; border: 1px solid #dee2e6;
                      color: #d63031; font-weight: bold;"">
            {bookingReference}
          </td>
        </tr>
        <tr>
          <td style=""padding: 12px; border: 1px solid #dee2e6;
                      font-weight: bold; color: #2d3436;"">
            Event
          </td>
          <td style=""padding: 12px; border: 1px solid #dee2e6; color: #2d3436;"">
            {eventTitle}
          </td>
        </tr>
      </table>

      <p style=""color: #636e72; font-size: 14px;"">
        If you did not request this cancellation, please contact our support team immediately.
      </p>
    </div>

    <!-- Footer -->
    <div style=""background: #2d3436; padding: 20px; text-align: center;"">
      <p style=""color: #b2bec3; margin: 0; font-size: 13px;"">
        © {DateTime.UtcNow.Year} EventBook — Discover &amp; Book Local Events
      </p>
    </div>

  </div>
</body>
</html>";
        }

        // ─────────────────────────────────────────────
        // PRIVATE: Send via SMTP (MailKit)
        // ─────────────────────────────────────────────
        private async Task SendEmailAsync(string to, string subject, string htmlBody)
        {
            var smtp = _config.GetSection("Smtp");

            var message = new MimeMessage();

            message.From.Add(new MailboxAddress(
                smtp["SenderName"],
                smtp["SenderEmail"]
            ));

            message.To.Add(MailboxAddress.Parse(to));
            message.Subject = subject;

            message.Body = new BodyBuilder
            {
                HtmlBody = htmlBody
            }.ToMessageBody();

            using var client = new SmtpClient();

            await client.ConnectAsync(
                smtp["Host"],
                int.Parse(smtp["Port"] ?? "587"),
                SecureSocketOptions.StartTls
            );

            await client.AuthenticateAsync(
                smtp["Username"],
                smtp["Password"]
            );

            await client.SendAsync(message);
            await client.DisconnectAsync(true);
        }
    }
}