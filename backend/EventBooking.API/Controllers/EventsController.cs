using EventBooking.API.DTOs;
using EventBooking.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EventBooking.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EventsController : ControllerBase
    {
        private readonly IEventService   _eventService;
        private readonly IBookingService _bookingService;

        // ✅ Both services injected via constructor — consistent and testable
        public EventsController(IEventService eventService, IBookingService bookingService)
        {
            _eventService   = eventService;
            _bookingService = bookingService;
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
                return StatusCode(500, new { message = "Failed to retrieve event.", detail = ex.Message });
            }
        }

        // ─────────────────────────────────────────────
        // POST api/events  (Organizer or Admin only)
        // ─────────────────────────────────────────────
        [HttpPost]
        [Authorize(Roles = "Organizer,Admin")]   // ✅ Admin can also create events
        public async Task<IActionResult> CreateEvent([FromBody] CreateEventDto dto)
        {
            if (!TryGetUserId(out int organizerId))
                return Unauthorized(new { message = "Invalid token." });

            try
            {
                var ev = await _eventService.CreateEventAsync(dto, organizerId);
                return CreatedAtAction(nameof(GetEvent), new { id = ev.Id }, ev);
            }
            catch (ArgumentException ex)
            {
                // Invalid date format or end before start
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to create event.", detail = ex.Message });
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
                var ev = await _eventService.UpdateEventAsync(id, dto, organizerId);
                return Ok(ev);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                // ✅ Forbid() doesn't accept a message — use StatusCode 403 instead
                return StatusCode(403, new { message = ex.Message });
            }
            catch (Exception ex)
            {
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
                await _eventService.DeleteEventAsync(id, organizerId);
                return NoContent();
            }
            catch (InvalidOperationException ex)
            {
                // Active bookings exist — cannot delete
                return BadRequest(new { message = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                // ✅ Correct 403 with message
                return StatusCode(403, new { message = ex.Message });
            }
            catch (Exception ex)
            {
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
            // ✅ No longer [FromServices] — uses constructor-injected _bookingService
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
                return StatusCode(500, new { message = "Failed to retrieve attendees.", detail = ex.Message });
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