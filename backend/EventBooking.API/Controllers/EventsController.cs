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
        private readonly IEventService _eventService;

        public EventsController(IEventService eventService) => _eventService = eventService;

        [HttpGet]
        public async Task<IActionResult> GetEvents([FromQuery] EventFilterDto filter)
        {
            var result = await _eventService.GetEventsAsync(filter);
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetEvent(int id)
        {
            try
            {
                var ev = await _eventService.GetEventByIdAsync(id);
                return Ok(ev);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
        }

        [HttpPost]
        [Authorize(Roles = "Organizer,Admin")]
        public async Task<IActionResult> CreateEvent([FromBody] CreateEventDto dto)
        {
            var organizerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var ev = await _eventService.CreateEventAsync(dto, organizerId);
            return CreatedAtAction(nameof(GetEvent), new { id = ev.Id }, ev);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Organizer,Admin")]
        public async Task<IActionResult> UpdateEvent(int id, [FromBody] UpdateEventDto dto)
        {
            try
            {
                var organizerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                var ev = await _eventService.UpdateEventAsync(id, dto, organizerId);
                return Ok(ev);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Organizer,Admin")]
        public async Task<IActionResult> DeleteEvent(int id)
        {
            try
            {
                var organizerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                await _eventService.DeleteEventAsync(id, organizerId);
                return NoContent();
            }
            catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
        }

        [HttpGet("my-events")]
        [Authorize(Roles = "Organizer,Admin")]
        public async Task<IActionResult> GetMyEvents()
        {
            var organizerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var events = await _eventService.GetOrganizerEventsAsync(organizerId);
            return Ok(events);
        }

        [HttpGet("{id}/attendees")]
        [Authorize(Roles = "Organizer,Admin")]
        public async Task<IActionResult> GetAttendees(int id, [FromServices] IBookingService bookingService)
        {
            try
            {
                var organizerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
                var bookings = await bookingService.GetEventBookingsAsync(id, organizerId);
                return Ok(bookings);
            }
            catch (KeyNotFoundException ex) { return NotFound(new { message = ex.Message }); }
            catch (UnauthorizedAccessException ex) { return Forbid(ex.Message); }
        }
    }
}
