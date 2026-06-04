using EventBooking.API.DTOs;
using EventBooking.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

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
}