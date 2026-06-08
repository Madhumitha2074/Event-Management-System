// Controllers/SeatsController.cs  — NEW FILE, add to Controllers folder
using EventBooking.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace EventBooking.API.Controllers
{
    [ApiController]
    [Route("api/events/{eventId}/seats")]
    public class SeatsController : ControllerBase
    {
        private readonly ISeatService _seatService;

        public SeatsController(ISeatService seatService) => _seatService = seatService;

        // GET api/events/{eventId}/seats  — public, no auth needed
        [HttpGet]
        public async Task<IActionResult> GetSeats(int eventId)
        {
            try
            {
                var seats = await _seatService.GetSeatsAsync(eventId);
                return Ok(seats);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Failed to load seats.", detail = ex.Message });
            }
        }
    }
}