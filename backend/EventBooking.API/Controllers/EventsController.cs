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
        // GET api/events/active  (public — no auth needed)
        // ─────────────────────────────────────────────
        [HttpGet("active")]
        [AllowAnonymous]
        public async Task<IActionResult> GetActiveEvents([FromQuery] EventFilterDto filter)
        {
            try
            {
                filter.OnlyActive = true;
                var result = await _eventService.GetEventsAsync(filter);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve active events");
                return StatusCode(500, new { message = "Failed to retrieve active events.", detail = ex.Message });
            }
        }

        // ─────────────────────────────────────────────
        // GET api/events/ending-soon  (public — no auth needed)
        // ─────────────────────────────────────────────
        [HttpGet("ending-soon")]
        [AllowAnonymous]
        public async Task<IActionResult> GetEventsEndingSoon([FromQuery] int thresholdMinutes = 15)
        {
            try
            {
                var events = await _eventService.GetEventsEndingSoonAsync(thresholdMinutes);
                return Ok(new EventsEndingSoonDto
                {
                    Events = events,
                    ThresholdMinutes = thresholdMinutes,
                    CheckedAt = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve events ending soon");
                return StatusCode(500, new { message = "Failed to retrieve events ending soon.", detail = ex.Message });
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
                _logger.LogInformation("📥 Creating event for user {OrganizerId}", organizerId);

                // ✅ Validate Start Date
                if (!DateTime.TryParse(dto.StartDateTime, out DateTime startDateTime))
                {
                    return BadRequest(new { message = "Invalid Start Date format." });
                }

                // ✅ Validate End Date
                if (!DateTime.TryParse(dto.EndDateTime, out DateTime endDateTime))
                {
                    return BadRequest(new { message = "Invalid End Date format." });
                }

                // ✅ Check if Start Date is in the past
                if (startDateTime < DateTime.UtcNow)
                {
                    return BadRequest(new { message = "Start date cannot be in the past. Please select a future date." });
                }

                // ✅ Check if End Date is in the past
                if (endDateTime <= DateTime.UtcNow)
                {
                    return BadRequest(new { message = "End date must be in the future." });
                }

                // ✅ Check if End Date is after Start Date
                if (endDateTime <= startDateTime)
                {
                    return BadRequest(new { message = "End date must be after Start date." });
                }

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

                // ✅ Get the existing event
                var existingEvent = await _eventService.GetEventByIdAsync(id);
                
                // ✅ Prevent editing if event is Completed
                if (existingEvent.Status == "Completed")
                {
                    return BadRequest(new { message = "Cannot edit a completed event." });
                }
                
                // ✅ Prevent editing if event is Cancelled
                if (existingEvent.Status == "Cancelled")
                {
                    return BadRequest(new { message = "Cannot edit a cancelled event." });
                }

                // ✅ Prevent editing if event has already started
                var startDateTime = DateTime.Parse(existingEvent.StartDateTime);
                if (startDateTime < DateTime.UtcNow)
                {
                    return BadRequest(new { message = "Cannot edit an event that has already started." });
                }

                // ✅ Check if dates are being updated and validate
                if (!string.IsNullOrEmpty(dto.StartDateTime))
                {
                    if (!DateTime.TryParse(dto.StartDateTime, out DateTime newStartDateTime))
                    {
                        return BadRequest(new { message = "Invalid Start Date format." });
                    }
                    
                    if (newStartDateTime < DateTime.UtcNow)
                    {
                        return BadRequest(new { message = "Start date cannot be in the past." });
                    }
                }

                if (!string.IsNullOrEmpty(dto.EndDateTime))
                {
                    if (!DateTime.TryParse(dto.EndDateTime, out DateTime newEndDateTime))
                    {
                        return BadRequest(new { message = "Invalid End Date format." });
                    }
                    
                    if (newEndDateTime <= DateTime.UtcNow)
                    {
                        return BadRequest(new { message = "End date must be in the future." });
                    }
                }

                // ✅ Proceed with update
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
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
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
                
                // ✅ Check if event can be deleted
                var existingEvent = await _eventService.GetEventByIdAsync(id);
                
                if (existingEvent.Status == "Completed")
                {
                    return BadRequest(new { message = "Cannot delete a completed event." });
                }
                
                if (existingEvent.Status == "Cancelled")
                {
                    return BadRequest(new { message = "Cannot delete a cancelled event." });
                }

                // ✅ Check if event has bookings
                var hasBookings = await _bookingService.HasBookingsAsync(id);
                if (hasBookings)
                {
                    return BadRequest(new { message = "Cannot delete an event with existing bookings." });
                }

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
        // POST api/events/cleanup-expired  (Admin only)
        // ─────────────────────────────────────────────
        [HttpPost("cleanup-expired")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> CleanupExpiredEvents()
        {
            try
            {
                _logger.LogInformation("🧹 Starting expired events cleanup");
                var updatedCount = await _eventService.UpdateExpiredEventsAsync();
                _logger.LogInformation("✅ Cleaned up {Count} expired events", updatedCount);

                return Ok(new ExpiredEventsCleanupResultDto
                {
                    UpdatedCount = updatedCount,
                    CleanupTime = DateTime.UtcNow,
                    Message = $"Successfully marked {updatedCount} expired events as 'Completed'"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Failed to cleanup expired events");
                return StatusCode(500, new { message = "Failed to cleanup expired events.", detail = ex.Message });
            }
        }

        // ─────────────────────────────────────────────
        // GET api/events/status-summary  (Admin/Owner)
        // ─────────────────────────────────────────────
        [HttpGet("status-summary")]
        [Authorize(Roles = "Admin,Organizer")]
        public async Task<IActionResult> GetStatusSummary()
        {
            try
            {
                var filter = new EventFilterDto
                {
                    IncludeExpired = true,
                    Page = 1,
                    PageSize = int.MaxValue
                };

                var result = await _eventService.GetEventsAsync(filter);
                var allEvents = result.Items ?? new List<EventDto>();

                var summary = new EventStatusSummaryDto
                {
                    TotalEvents = allEvents.Count,
                    ActiveEvents = allEvents.Count(e => e.IsActive),
                    UpcomingEvents = allEvents.Count(e => e.IsActive && DateTime.Parse(e.StartDateTime) > DateTime.UtcNow),
                    OngoingEvents = allEvents.Count(e => e.IsActive && DateTime.Parse(e.StartDateTime) <= DateTime.UtcNow),
                    EndedEvents = allEvents.Count(e => !e.IsActive && e.Status == "Completed"),
                    CancelledEvents = allEvents.Count(e => e.Status == "Cancelled"),
                    EventsEndingSoon = allEvents.Count(e => e.IsEndingSoon),
                    LastUpdated = DateTime.UtcNow
                };

                return Ok(summary);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to generate status summary");
                return StatusCode(500, new { message = "Failed to generate status summary.", detail = ex.Message });
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

        // ❌ REMOVED: GET api/events/{id}/seats
        // This endpoint is now handled by SeatsController
        // to avoid AmbiguousMatchException

        // ════════════════════════════════════════════════════════════════
        // IMAGE UPLOAD ENDPOINTS
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

        // ─────────────────────────────────────────────
        // GET api/events/debug/check-expired  (Debug only)
        // ─────────────────────────────────────────────
        [HttpGet("debug/check-expired")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DebugCheckExpired()
        {
            try
            {
                var filter = new EventFilterDto
                {
                    IncludeExpired = true,
                    Page = 1,
                    PageSize = 100
                };

                var result = await _eventService.GetEventsAsync(filter);
                var expiredEvents = result.Items?.Where(e => !e.IsActive).ToList() ?? new List<EventDto>();

                return Ok(new
                {
                    TotalEvents = result.Items?.Count ?? 0,
                    ExpiredEvents = expiredEvents.Count,
                    ExpiredEventDetails = expiredEvents.Select(e => new
                    {
                        e.Id,
                        e.Title,
                        e.EndDateTime,
                        e.Status,
                        TimeAgo = DateTime.UtcNow - DateTime.Parse(e.EndDateTime)
                    }),
                    Timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Debug check failed");
                return StatusCode(500, new { message = "Debug check failed", detail = ex.Message });
            }
        }
    }
}