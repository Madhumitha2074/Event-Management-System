using EventBooking.API.DTOs;
using EventBooking.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace EventBooking.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EventsController : ControllerBase
    {
        private readonly IEventService _eventService;
        private readonly IBookingService _bookingService;
        private readonly ISeatService _seatService;
        private readonly IImageService _imageService;
        private readonly ILogger<EventsController> _logger;

        public EventsController(
            IEventService eventService,
            IBookingService bookingService,
            ISeatService seatService,
            IImageService imageService,
            ILogger<EventsController> logger)
        {
            _eventService = eventService;
            _bookingService = bookingService;
            _seatService = seatService;
            _imageService = imageService;
            _logger = logger;
        }

        // ─────────────────────────────────────────────
        // GET api/events  (public — no auth needed)
        // ─────────────────────────────────────────────
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetEvents([FromQuery] EventFilterDto filter)
        {
            try
            {
                var result = await _eventService.GetEventsAsync(filter);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve events");
                return StatusCode(500, new { message = "Failed to retrieve events.", detail = ex.Message });
            }
        }

        // ─────────────────────────────────────────────
        // GET api/events/{id}  (public — no auth needed)
        // ─────────────────────────────────────────────
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetEvent(int id)
        {
            try
            {
                var ev = await _eventService.GetEventByIdAsync(id);
                return Ok(ev);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve event {EventId}", id);
                return StatusCode(500, new { message = "Failed to retrieve event.", detail = ex.Message });
            }
        }

        // ─────────────────────────────────────────────
        // POST api/events  (Organizer or Admin only)
        // ─────────────────────────────────────────────
        [HttpPost]
        [Authorize(Roles = "Organizer,Admin")]
        public async Task<IActionResult> CreateEvent([FromBody] CreateEventDto dto)
        {
            if (!TryGetUserId(out int organizerId))
                return Unauthorized(new { message = "Invalid token." });

            try
            {
                // Log the incoming data
                _logger.LogInformation("📥 Creating event for user {OrganizerId}", organizerId);
                _logger.LogInformation("📋 Event data: {@EventData}", dto);

                if (dto.SeatTiers != null && dto.SeatTiers.Any())
                {
                    _logger.LogInformation("🪑 Seat tiers count: {Count}", dto.SeatTiers.Count);
                    foreach (var tier in dto.SeatTiers)
                    {
                        _logger.LogInformation("  - {Tier}: {Rows}x{SeatsPerRow} = {Total} seats at ₹{Price}",
                            tier.Tier, tier.Rows, tier.SeatsPerRow, tier.Rows * tier.SeatsPerRow, tier.Price);
                    }
                }

                var ev = await _eventService.CreateEventAsync(dto, organizerId);
                _logger.LogInformation("✅ Event created successfully with ID {EventId}", ev.Id);
                return CreatedAtAction(nameof(GetEvent), new { id = ev.Id }, ev);
            }
            catch (ArgumentException ex)
            {
                _logger.LogError(ex, "❌ Argument error creating event");
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error creating event: {Message}", ex.Message);
                _logger.LogError("📚 Stack trace: {StackTrace}", ex.StackTrace);
                return StatusCode(500, new { message = "Failed to create event.", error = ex.Message });
            }
        }

        // ─────────────────────────────────────────────
        // PUT api/events/{id}  (Organizer or Admin only)
        // ─────────────────────────────────────────────
        [HttpPut("{id}")]
        [Authorize(Roles = "Organizer,Admin")]
        public async Task<IActionResult> UpdateEvent(int id, [FromBody] UpdateEventDto dto)
        {
            if (!TryGetUserId(out int organizerId))
                return Unauthorized(new { message = "Invalid token." });

            try
            {
                _logger.LogInformation("📥 Updating event {EventId} for user {OrganizerId}", id, organizerId);
                var ev = await _eventService.UpdateEventAsync(id, dto, organizerId);
                _logger.LogInformation("✅ Event {EventId} updated successfully", id);
                return Ok(ev);
            }
            catch (ArgumentException ex)
            {
                _logger.LogError(ex, "❌ Argument error updating event {EventId}", id);
                return BadRequest(new { message = ex.Message });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error updating event {EventId}: {Message}", id, ex.Message);
                return StatusCode(500, new { message = "Failed to update event.", detail = ex.Message });
            }
        }

        // ─────────────────────────────────────────────
        // DELETE api/events/{id}  (Organizer or Admin only)
        // ─────────────────────────────────────────────
        [HttpDelete("{id}")]
        [Authorize(Roles = "Organizer,Admin")]
        public async Task<IActionResult> DeleteEvent(int id)
        {
            if (!TryGetUserId(out int organizerId))
                return Unauthorized(new { message = "Invalid token." });

            try
            {
                _logger.LogInformation("📥 Deleting event {EventId} for user {OrganizerId}", id, organizerId);
                await _eventService.DeleteEventAsync(id, organizerId);
                _logger.LogInformation("✅ Event {EventId} deleted successfully", id);
                return NoContent();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error deleting event {EventId}: {Message}", id, ex.Message);
                return StatusCode(500, new { message = "Failed to delete event.", detail = ex.Message });
            }
        }

        // ─────────────────────────────────────────────
        // GET api/events/my-events  (Organizer or Admin)
        // ─────────────────────────────────────────────
        [HttpGet("my-events")]
        [Authorize(Roles = "Organizer,Admin")]
        public async Task<IActionResult> GetMyEvents()
        {
            if (!TryGetUserId(out int organizerId))
                return Unauthorized(new { message = "Invalid token." });

            try
            {
                var events = await _eventService.GetOrganizerEventsAsync(organizerId);
                return Ok(events);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve events for user {OrganizerId}", organizerId);
                return StatusCode(500, new { message = "Failed to retrieve your events.", detail = ex.Message });
            }
        }

        // ─────────────────────────────────────────────
        // GET api/events/{id}/attendees  (Organizer or Admin)
        // ─────────────────────────────────────────────
        [HttpGet("{id}/attendees")]
        [Authorize(Roles = "Organizer,Admin")]
        public async Task<IActionResult> GetAttendees(int id)
        {
            if (!TryGetUserId(out int organizerId))
                return Unauthorized(new { message = "Invalid token." });

            try
            {
                var bookings = await _bookingService.GetEventBookingsAsync(id, organizerId);
                return Ok(bookings);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve attendees for event {EventId}", id);
                return StatusCode(500, new { message = "Failed to retrieve attendees.", detail = ex.Message });
            }
        }

        // ════════════════════════════════════════════════════════════════
        // ✅ IMAGE UPLOAD ENDPOINTS
        // ════════════════════════════════════════════════════════════════

        [HttpPost("upload-image")]
        [AllowAnonymous]
        [RequestSizeLimit(5 * 1024 * 1024)]
        [RequestFormLimits(MultipartBodyLengthLimit = 5 * 1024 * 1024)]
        public async Task<IActionResult> UploadImage([FromForm] IFormFile image)
        {
            try
            {
                if (image == null || image.Length == 0)
                {
                    return BadRequest(new { message = "No image file provided" });
                }

                var result = await _imageService.SaveImageAsync(image);

                if (!result.Success)
                {
                    return BadRequest(new { message = result.ErrorMessage });
                }

                return Ok(new
                {
                    success = true,
                    imageUrl = result.ImageUrl,
                    fileName = result.FileName,
                    fileSize = result.FileSize,
                    message = "Image uploaded successfully"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading image");
                return StatusCode(500, new { message = "Failed to upload image", error = ex.Message });
            }
        }

        [HttpDelete("delete-image")]
        [Authorize(Roles = "Organizer,Admin")]
        public async Task<IActionResult> DeleteImage([FromBody] ImageDeleteRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request?.ImageUrl))
                {
                    return BadRequest(new { message = "Image URL is required" });
                }

                var result = await _imageService.DeleteImageAsync(request.ImageUrl);

                if (result)
                {
                    return Ok(new { message = "Image deleted successfully" });
                }

                return NotFound(new { message = "Image not found" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting image");
                return StatusCode(500, new { message = "Failed to delete image" });
            }
        }

        [HttpPost("upload-image-base64")]
        [Authorize(Roles = "Organizer,Admin")]
        public async Task<IActionResult> UploadImageBase64([FromBody] ImageUploadRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request?.ImageBase64))
                {
                    return BadRequest(new { message = "No image data provided" });
                }

                var base64Data = request.ImageBase64;
                if (base64Data.Contains(","))
                {
                    base64Data = base64Data.Split(',')[1];
                }

                var bytes = Convert.FromBase64String(base64Data);
                var fileName = $"{Guid.NewGuid():N}.jpg";
                var stream = new MemoryStream(bytes);
                var formFile = new FormFile(stream, 0, bytes.Length, "image", fileName)
                {
                    Headers = new HeaderDictionary(),
                    ContentType = "image/jpeg"
                };

                var result = await _imageService.SaveImageAsync(formFile);

                if (!result.Success)
                {
                    return BadRequest(new { message = result.ErrorMessage });
                }

                return Ok(new
                {
                    success = true,
                    imageUrl = result.ImageUrl,
                    fileName = result.FileName,
                    fileSize = result.FileSize,
                    message = "Image uploaded successfully"
                });
            }
            catch (FormatException ex)
            {
                _logger.LogError(ex, "Invalid base64 format");
                return BadRequest(new { message = "Invalid image data format" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading base64 image");
                return StatusCode(500, new { message = "Failed to upload image", error = ex.Message });
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
    }
}