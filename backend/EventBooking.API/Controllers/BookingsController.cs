using EventBooking.API.DTOs;
using EventBooking.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using System.Text;

namespace EventBooking.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "User")]                       // All endpoints require login
    public class BookingsController : ControllerBase
    {
        private readonly IBookingService _bookingService;

        public BookingsController(IBookingService bookingService)
        {
            _bookingService = bookingService;
        }

        // ─────────────────────────────────────────────
        // POST api/bookings
        // ─────────────────────────────────────────────
        [HttpPost]
        public async Task<IActionResult> CreateBooking([FromBody] CreateBookingDto dto)
        {
            // ✅ Safe token claim parse
            if (!TryGetUserId(out int userId))
                return Unauthorized(new { message = "Invalid token." });

            try
            {
                var booking = await _bookingService.CreateBookingAsync(dto, userId);
                return CreatedAtAction(nameof(GetBooking), new { id = booking.Id }, booking);
            }
            catch (ArgumentException ex)
            {
                // Attendees count mismatch or invalid date
                return BadRequest(new { message = ex.Message });
            }
            catch (KeyNotFoundException ex)
            {
                // Event not found
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                // Not enough tickets available
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to create booking.", detail = ex.Message });
            }
        }

        // ─────────────────────────────────────────────
        // POST api/bookings/with-seats  (NEW - seat-based booking)
        // ─────────────────────────────────────────────
        [HttpPost("with-seats")]
        public async Task<IActionResult> CreateBookingWithSeats([FromBody] CreateBookingWithSeatsDto dto)
        {
            // ✅ Safe token claim parse
            if (!TryGetUserId(out int userId))
                return Unauthorized(new { message = "Invalid token." });

            try
            {
                var booking = await _bookingService.CreateBookingWithSeatsAsync(dto, userId);
                return CreatedAtAction(nameof(GetBooking), new { id = booking.Id }, booking);
            }
            catch (ArgumentException ex)
            {
                // Attendees count mismatch or invalid date
                return BadRequest(new { message = ex.Message });
            }
            catch (KeyNotFoundException ex)
            {
                // Event not found or seat not found
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                // Not enough tickets available or seat already booked
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to create booking.", detail = ex.Message });
            }
        }

        // ─────────────────────────────────────────────
        // GET api/bookings
        // ─────────────────────────────────────────────
        [HttpGet]
        public async Task<IActionResult> GetMyBookings()
        {
            if (!TryGetUserId(out int userId))
                return Unauthorized(new { message = "Invalid token." });

            try
            {
                var bookings = await _bookingService.GetUserBookingsAsync(userId);
                return Ok(bookings);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to retrieve bookings.", detail = ex.Message });
            }
        }

        // ─────────────────────────────────────────────
        // GET api/bookings/{id}
        // ─────────────────────────────────────────────
        [HttpGet("{id}")]
        public async Task<IActionResult> GetBooking(int id)
        {
            if (!TryGetUserId(out int userId))
                return Unauthorized(new { message = "Invalid token." });

            try
            {
                var booking = await _bookingService.GetBookingByIdAsync(id, userId);
                return Ok(booking);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to retrieve booking.", detail = ex.Message });
            }
        }

        // ─────────────────────────────────────────────
        // GET api/bookings/{id}/download
        // ─────────────────────────────────────────────
        [HttpGet("{id}/download")]
        public async Task<IActionResult> DownloadBooking(int id)
        {
            if (!TryGetUserId(out int userId))
                return Unauthorized(new { message = "Invalid token." });

            try
            {
                var pdfBytes = await _bookingService.GenerateBookingPdfAsync(id, userId);

                return File(
                    pdfBytes,
                    "application/pdf",
                    $"Booking-{id}.pdf"
                );
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to generate PDF.", detail = ex.Message });
            }
        }

        // ─────────────────────────────────────────────
        // POST api/bookings/{id}/cancel
        // ─────────────────────────────────────────────
        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> CancelBooking(int id)
        {
            if (!TryGetUserId(out int userId))
                return Unauthorized(new { message = "Invalid token." });

            try
            {
                await _bookingService.CancelBookingAsync(id, userId);
                return Ok(new { message = "Booking cancelled successfully." });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                // Already cancelled
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to cancel booking.", detail = ex.Message });
            }
        }

        // ─────────────────────────────────────────────
        // POST api/bookings/verify-ticket (NEW - QR Code verification for Organizers)
        // ─────────────────────────────────────────────
        [HttpPost("verify-ticket")]
        [Authorize(Roles = "Organizer,Admin")]
        public async Task<IActionResult> VerifyTicket([FromBody] VerifyTicketDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.QrData))
            {
                return BadRequest(new { message = "QR data is required." });
            }

            try
            {
                var result = await _bookingService.VerifyTicketAsync(dto.QrData);
                return Ok(result);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to verify ticket.", detail = ex.Message });
            }
        }

        // ─────────────────────────────────────────────
        // GET api/bookings/verify-scanner (Simple scanner page for organizers)
        // ─────────────────────────────────────────────
        [HttpGet("verify-scanner")]
        [Authorize(Roles = "Organizer,Admin")]
        public IActionResult GetScannerPage()
        {
            // Return a simple HTML page for QR scanning
            var html = @"
            <!DOCTYPE html>
            <html>
            <head>
                <title>Ticket Scanner - EventBook</title>
                <meta charset='UTF-8'>
                <meta name='viewport' content='width=device-width, initial-scale=1.0'>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        padding: 20px;
                    }
                    .container {
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    .scanner-card {
                        background: white;
                        border-radius: 20px;
                        padding: 30px;
                        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                        text-align: center;
                    }
                    h1 {
                        color: #6c5ce7;
                        margin-bottom: 20px;
                    }
                    .video-container {
                        position: relative;
                        width: 100%;
                        max-width: 400px;
                        margin: 20px auto;
                        border-radius: 16px;
                        overflow: hidden;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                    }
                    video {
                        width: 100%;
                        height: auto;
                        display: block;
                    }
                    .result-box {
                        margin-top: 20px;
                        padding: 20px;
                        border-radius: 12px;
                        background: #f8f9fa;
                    }
                    .result-valid {
                        background: #d4edda;
                        color: #155724;
                        border: 1px solid #c3e6cb;
                    }
                    .result-invalid {
                        background: #f8d7da;
                        color: #721c24;
                        border: 1px solid #f5c6cb;
                    }
                    .result-info {
                        background: #cce5ff;
                        color: #004085;
                        border: 1px solid #b8daff;
                    }
                    .btn {
                        background: #6c5ce7;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 30px;
                        cursor: pointer;
                        font-size: 14px;
                        margin-top: 15px;
                    }
                    .btn:hover {
                        background: #5a4ad1;
                    }
                    .ticket-details {
                        text-align: left;
                        margin-top: 15px;
                        padding: 15px;
                        border-top: 1px solid #dee2e6;
                    }
                    .status-badge {
                        display: inline-block;
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 12px;
                        font-weight: bold;
                    }
                    .status-valid { background: #28a745; color: white; }
                    .status-used { background: #dc3545; color: white; }
                    @media (max-width: 600px) {
                        .scanner-card { padding: 20px; }
                        h1 { font-size: 24px; }
                    }
                </style>
            </head>
            <body>
                <div class='container'>
                    <div class='scanner-card'>
                        <h1>🎫 Ticket Scanner</h1>
                        <p>Position the QR code in front of the camera</p>
                        
                        <div class='video-container'>
                            <video id='video' playsinline></video>
                        </div>
                        
                        <button class='btn' onclick='startScanner()'>Start Scanner</button>
                        <button class='btn' onclick='stopScanner()' style='background:#6c757d;'>Stop</button>
                        
                        <div id='result' class='result-box result-info'>
                            <strong>📱 Ready to scan</strong><br>
                            Waiting for QR code...
                        </div>
                    </div>
                </div>

                <script src='https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'></script>
                <script>
                    let html5QrCode = null;
                    
                    function startScanner() {
                        if (html5QrCode) {
                            html5QrCode.stop();
                        }
                        
                        html5QrCode = new Html5Qrcode('video');
                        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
                        
                        html5QrCode.start(
                            { facingMode: 'environment' },
                            config,
                            (decodedText) => {
                                verifyTicket(decodedText);
                            },
                            (error) => {
                                // Silent fail
                            }
                        ).catch(err => {
                            console.error('Unable to start scanning:', err);
                            document.getElementById('result').innerHTML = '<strong>❌ Error</strong><br>Unable to access camera. Please ensure camera permissions are granted.';
                        });
                    }
                    
                    function stopScanner() {
                        if (html5QrCode) {
                            html5QrCode.stop();
                            html5QrCode = null;
                        }
                    }
                    
                    async function verifyTicket(qrData) {
                        try {
                            const response = await fetch('/api/bookings/verify-ticket', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ qrData: qrData })
                            });
                            
                            const result = await response.json();
                            
                            if (response.ok && result.isValid) {
                                document.getElementById('result').innerHTML = `
                                    <div class='result-valid' style='padding:15px; border-radius:12px;'>
                                        <strong>✅ VALID TICKET</strong><br>
                                        <div class='ticket-details'>
                                            <p><strong>Ticket Number:</strong> ${result.ticketNumber}</p>
                                            <p><strong>Attendee:</strong> ${result.attendeeName}</p>
                                            <p><strong>Email:</strong> ${result.attendeeEmail}</p>
                                            <p><strong>Event:</strong> ${result.eventTitle}</p>
                                            <p><strong>Venue:</strong> ${result.venue}, ${result.city}</p>
                                            <p><strong>Booking Ref:</strong> ${result.bookingReference}</p>
                                            <p><strong>Verified At:</strong> ${new Date(result.verifiedAt).toLocaleString()}</p>
                                            <span class='status-badge status-valid'>VALID</span>
                                        </div>
                                    </div>
                                `;
                                
                                // Optional: Beep sound for valid scan
                                const audio = new Audio('data:audio/wav;base64,U3RlYWx0aCBiZWVw');
                                audio.play().catch(e => console.log('Audio not supported'));
                            } else {
                                document.getElementById('result').innerHTML = `
                                    <div class='result-invalid' style='padding:15px; border-radius:12px;'>
                                        <strong>❌ INVALID TICKET</strong><br>
                                        <p>${result.message || 'This ticket has already been used or is invalid.'}</p>
                                        <div class='ticket-details'>
                                            <p><strong>Ticket Number:</strong> ${result.ticketNumber || 'N/A'}</p>
                                            <p><strong>Attendee:</strong> ${result.attendeeName || 'N/A'}</p>
                                            <p><strong>Status:</strong> ${result.isUsed ? 'Already Used' : 'Invalid'}</p>
                                        </div>
                                    </div>
                                `;
                            }
                        } catch (error) {
                            document.getElementById('result').innerHTML = `
                                <div class='result-invalid' style='padding:15px; border-radius:12px;'>
                                    <strong>❌ Verification Failed</strong><br>
                                    Unable to verify ticket. Please try again.
                                </div>
                            `;
                        }
                    }
                </script>
            </body>
            </html>";
            
            return Content(html, "text/html");
        }

        // ─────────────────────────────────────────────
        // GET api/bookings/test-qr/{bookingId} (TEST QR CODE ENDPOINT)
        // ─────────────────────────────────────────────
        [HttpGet("test-qr/{bookingId}")]
        [Authorize]
        public async Task<IActionResult> TestQrCode(int bookingId)
        {
            try
            {
                if (!TryGetUserId(out int userId))
                    return Unauthorized(new { message = "Invalid token." });

                var booking = await _bookingService.GetBookingByIdAsync(bookingId, userId);
                
                if (booking == null || booking.Tickets == null || booking.Tickets.Count == 0)
                    return BadRequest(new { message = "No tickets found" });

                var html = new StringBuilder();
                html.Append("<html><body style='font-family: Arial; padding: 20px;'>");
                html.Append("<h1>QR Code Test</h1>");
                html.Append($"<p>Booking ID: {bookingId}</p>");
                html.Append($"<p>Booking Reference: {booking.BookingReference}</p>");
                
                foreach (var ticket in booking.Tickets)
                {
                    html.Append($"<div style='border: 1px solid #ccc; padding: 15px; margin-bottom: 15px; border-radius: 8px;'>");
                    html.Append($"<h3>Ticket: {ticket.TicketNumber}</h3>");
                    html.Append($"<p><strong>Attendee:</strong> {ticket.AttendeeName}</p>");
                    html.Append($"<p><strong>Email:</strong> {ticket.AttendeeEmail}</p>");
                    html.Append($"<p><strong>QR Code Base64 Length:</strong> {ticket.QrCodeBase64?.Length ?? 0}</p>");
                    
                    if (!string.IsNullOrEmpty(ticket.QrCodeBase64) && ticket.QrCodeBase64.Length > 100)
                    {
                        html.Append($"<div><strong>QR Code:</strong></div>");
                        html.Append($"<img src='data:image/png;base64,{ticket.QrCodeBase64}' style='width: 150px; height: 150px; border: 1px solid #ccc; margin-top: 10px;' />");
                        html.Append($"<p style='font-size: 11px; color: green;'>✓ QR Code is valid (Length: {ticket.QrCodeBase64.Length} bytes)</p>");
                    }
                    else
                    {
                        html.Append("<p style='color:red'>❌ QR Code is missing or invalid!</p>");
                        html.Append($"<p>Raw QR value: {(ticket.QrCodeBase64 ?? "NULL")}</p>");
                    }
                    html.Append("</div>");
                }
                
                html.Append("</body></html>");
                
                return Content(html.ToString(), "text/html");
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message, stackTrace = ex.StackTrace });
            }
        }

        // ─────────────────────────────────────────────
        // PRIVATE: Safe user ID extraction from JWT
        // ─────────────────────────────────────────────
        private bool TryGetUserId(out int userId)
        {
            userId = 0;
            var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return !string.IsNullOrWhiteSpace(claim) && int.TryParse(claim, out userId);
        }

        [HttpGet("whoami")]
        public IActionResult WhoAmI()
        {
            return Ok(new
            {
                UserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value,
                Name = User.FindFirst(ClaimTypes.Name)?.Value,
                Role = User.FindFirst(ClaimTypes.Role)?.Value
            });
        }
    }

    // DTO for ticket verification
    public class VerifyTicketDto
    {
        public string QrData { get; set; } = string.Empty;
    }
}