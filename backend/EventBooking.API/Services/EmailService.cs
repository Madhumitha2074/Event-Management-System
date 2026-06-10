using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using EventBooking.API.Data;
using Microsoft.Data.SqlClient;
using EventBooking.API.DTOs;
using System.Text;

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
        private readonly IQrCodeService        _qrCodeService;

        public EmailService(
            DatabaseHelper        db,
            IConfiguration        config,
            ILogger<EmailService> logger,
            IQrCodeService        qrCodeService)
        {
            _db = db;
            _config = config;
            _logger = logger;
            _qrCodeService = qrCodeService;
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

                // Get booking and event details
                string bookingQuery = @"
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

                string userName = "";
                string userEmail = "";
                string eventTitle = "";
                string venue = "";
                string city = "";
                string bookingReference = "";
                int ticketCount = 0;
                decimal totalAmount = 0;
                string eventDate = "";

                using (var bookingCmd = new SqlCommand(bookingQuery, connection))
                {
                    bookingCmd.Parameters.AddWithValue("@BookingId", bookingId);

                    using (var reader = await bookingCmd.ExecuteReaderAsync())
                    {
                        if (!await reader.ReadAsync())
                        {
                            _logger.LogWarning("SendBookingConfirmationAsync: Booking {BookingId} not found.", bookingId);
                            return;
                        }

                        userName = reader["UserName"].ToString()!;
                        userEmail = reader["UserEmail"].ToString()!;
                        eventTitle = reader["Title"].ToString()!;
                        venue = reader["Venue"].ToString()!;
                        city = reader["City"].ToString()!;
                        bookingReference = reader["BookingReference"].ToString()!;
                        ticketCount = Convert.ToInt32(reader["TicketCount"]);
                        totalAmount = Convert.ToDecimal(reader["TotalAmount"]);
                        eventDate = reader["StartDateTime"] == DBNull.Value
                            ? "TBD"
                            : ((DateTime)reader["StartDateTime"]).ToString("dddd, MMMM d yyyy 'at' h:mm tt");
                    }
                }

                // Now get tickets with QR codes
                var tickets = await GetTicketsWithQrCodesAsync(bookingId, connection);

                string subject = $"Booking Confirmed — {eventTitle} [{bookingReference}]";
                
                // Build email with attachments
                await SendEmailWithAttachmentsAsync(userEmail, subject, userName, eventTitle, venue, city, eventDate, bookingReference, ticketCount, totalAmount, tickets);

                _logger.LogInformation(
                    "Booking confirmation email sent to {Email} for booking {BookingId} with {TicketCount} tickets.",
                    userEmail, bookingId, tickets.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to send booking confirmation email for BookingId {BookingId}.", bookingId);
            }
        }

        // ─────────────────────────────────────────────
        // GET TICKETS WITH QR CODES (WITH NULL CHECK FIX)
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
                        
                        string? qrCodeBase64 = null;
                        byte[]? qrCodeBytes = null;
                        
                        try
                        {
                            // Generate QR code for each ticket
                            string ticketData = $"{ticketNumber}|{bookingId}|{attendeeEmail}";
                            qrCodeBytes = _qrCodeService.GenerateQrCodeBytes(ticketData);
                            
                            // FIXED: Added null check before converting to Base64
                            if (qrCodeBytes != null)
                            {
                                qrCodeBase64 = Convert.ToBase64String(qrCodeBytes);
                                _logger.LogInformation("QR Code generated for ticket {TicketNumber}, Length: {Length}", 
                                    ticketNumber, qrCodeBase64.Length);
                            }
                            else
                            {
                                _logger.LogWarning("QR Code bytes were null for ticket {TicketNumber}", ticketNumber);
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
        // CANCELLATION EMAIL
        // ─────────────────────────────────────────────
        public async Task SendCancellationEmailAsync(int bookingId)
        {
            try
            {
                using var connection = _db.CreateConnection();
                await connection.OpenAsync();

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

                string userName = reader["UserName"].ToString()!;
                string userEmail = reader["UserEmail"].ToString()!;
                string eventTitle = reader["Title"].ToString()!;
                string bookingReference = reader["BookingReference"].ToString()!;

                string subject = $"Booking Cancelled — {eventTitle} [{bookingReference}]";
                string body = BuildCancellationEmailBody(userName, eventTitle, bookingReference);

                await SendSimpleEmailAsync(userEmail, subject, body);

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
        // SEND EMAIL WITH QR CODE ATTACHMENTS
        // ─────────────────────────────────────────────
        private async Task SendEmailWithAttachmentsAsync(
            string toEmail, string subject,
            string userName, string eventTitle, string venue, string city,
            string eventDate, string bookingReference, int ticketCount,
            decimal totalAmount, List<TicketDto> tickets)
        {
            var smtp = _config.GetSection("Smtp");
            var message = new MimeMessage();

            message.From.Add(new MailboxAddress(
                smtp["SenderName"],
                smtp["SenderEmail"]
            ));

            message.To.Add(MailboxAddress.Parse(toEmail));
            message.Subject = subject;

            var bodyBuilder = new BodyBuilder();

            // Build HTML body
            bodyBuilder.HtmlBody = BuildConfirmationEmailBodyWithCid(
                userName, eventTitle, venue, city,
                eventDate, bookingReference, ticketCount, totalAmount, tickets
            );

            // Attach QR codes as images
            for (int i = 0; i < tickets.Count; i++)
            {
                var ticket = tickets[i];
                if (ticket.QrCodeBytes != null && ticket.QrCodeBytes.Length > 0)
                {
                    var image = bodyBuilder.LinkedResources.Add($"qr_{i}.png", ticket.QrCodeBytes, new ContentType("image", "png"));
                    image.ContentId = $"qr_{i}";
                    image.ContentDisposition = new ContentDisposition(ContentDisposition.Inline);
                }
            }

            message.Body = bodyBuilder.ToMessageBody();

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

        // ─────────────────────────────────────────────
        // SEND SIMPLE EMAIL (NO ATTACHMENTS)
        // ─────────────────────────────────────────────
        private async Task SendSimpleEmailAsync(string to, string subject, string htmlBody)
        {
            var smtp = _config.GetSection("Smtp");
            var message = new MimeMessage();

            message.From.Add(new MailboxAddress(
                smtp["SenderName"],
                smtp["SenderEmail"]
            ));
            message.To.Add(MailboxAddress.Parse(to));
            message.Subject = subject;
            message.Body = new BodyBuilder { HtmlBody = htmlBody }.ToMessageBody();

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

        // ─────────────────────────────────────────────
        // BUILD CONFIRMATION EMAIL WITH CID REFERENCES
        // ─────────────────────────────────────────────
        private string BuildConfirmationEmailBodyWithCid(
            string userName,
            string eventTitle,
            string venue,
            string city,
            string eventDate,
            string bookingReference,
            int ticketCount,
            decimal totalAmount,
            List<TicketDto> tickets)
        {
            var ticketsHtml = new StringBuilder();
            
            for (int i = 0; i < tickets.Count; i++)
            {
                var ticket = tickets[i];
                string seatInfo = string.IsNullOrEmpty(ticket.SeatNumber) 
                    ? "" 
                    : $"<div style='margin-top: 5px;'><strong>Seat:</strong> {ticket.SeatNumber} ({ticket.Tier})</div>";
                
                ticketsHtml.Append($@"
                    <div style='border: 1px solid #dee2e6; border-radius: 12px; padding: 15px; margin-bottom: 15px; display: flex; align-items: center; gap: 15px; background: #fafbfc;'>
                        <div style='flex-shrink: 0;'>
                            <img src='cid:qr_{i}' alt='QR Code' style='width: 80px; height: 80px; border-radius: 8px;' />
                        </div>
                        <div style='flex: 1;'>
                            <div><strong>{ticket.AttendeeName}</strong></div>
                            <div style='font-family: monospace; margin-top: 4px;'>
                                Ticket: {ticket.TicketNumber}
                            </div>
                            {seatInfo}
                        </div>
                    </div>
                ");
            }

            return $@"
<!DOCTYPE html>
<html>
<head>
    <meta charset='UTF-8'>
</head>
<body style='font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f8; margin: 0; padding: 20px;'>
  <div style='max-width: 600px; margin: auto; background: white;
              border-radius: 16px; overflow: hidden;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);'>

    <div style='background: linear-gradient(135deg, #6c5ce7, #a29bfe);
                padding: 30px; text-align: center;'>
      <h1 style='color: white; margin: 0; font-size: 28px;'>✅ Booking Confirmed!</h1>
      <p style='color: rgba(255,255,255,0.9); margin-top: 8px;'>Your tickets are ready</p>
    </div>

    <div style='padding: 30px;'>
      <p style='font-size: 16px; color: #2d3436;'>Dear <strong>{userName}</strong>,</p>
      <p>Your booking for <strong>{eventTitle}</strong> has been confirmed.</p>

      <table style='width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8f9fa; border-radius: 12px; overflow: hidden;'>
        <tr><td style='padding: 12px;'><strong>Booking Reference:</strong></td><td>{bookingReference}</td></tr>
        <tr style='background: #f8f9fa;'><td style='padding: 12px;'><strong>Event:</strong></td><td>{eventTitle}</td></tr>
        <tr><td style='padding: 12px;'><strong>Date:</strong></td><td>{eventDate}</td></tr>
        <tr style='background: #f8f9fa;'><td style='padding: 12px;'><strong>Venue:</strong></td><td>{venue}, {city}</td></tr>
        <tr><td style='padding: 12px;'><strong>Total Amount:</strong></td><td style='color:#00b894; font-weight:bold;'>₹{totalAmount:N2}</td></tr>
      </table>

      <h3>🎫 Your E-Tickets ({ticketCount})</h3>
      {ticketsHtml}

      <div style='background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 20px; border-radius: 8px;'>
        <p style='margin: 0; color: #856404;'><strong>📌 Important:</strong> Please present the QR code at the venue entrance for scanning.</p>
      </div>
    </div>

    <div style='background: #2d3436; padding: 20px; text-align: center;'>
      <p style='color: #b2bec3; margin: 0;'>© {DateTime.UtcNow.Year} EventBook</p>
    </div>
  </div>
</body>
</html>";
        }

        // ─────────────────────────────────────────────
        // BUILD CANCELLATION EMAIL BODY
        // ─────────────────────────────────────────────
        private string BuildCancellationEmailBody(string userName, string eventTitle, string bookingReference)
        {
            return $@"
<!DOCTYPE html>
<html>
<body style='font-family: Arial, sans-serif;'>
  <div style='max-width: 600px; margin: auto; padding: 20px;'>
    <h1 style='color: #d63031;'>❌ Booking Cancelled</h1>
    <p>Dear <strong>{userName}</strong>,</p>
    <p>Your booking for <strong>{eventTitle}</strong> has been cancelled.</p>
    <p><strong>Booking Reference:</strong> {bookingReference}</p>
    <p>If you did not request this cancellation, please contact support.</p>
    <hr>
    <p style='color: #999;'>© {DateTime.UtcNow.Year} EventBook</p>
  </div>
</body>
</html>";
        }
    }
}