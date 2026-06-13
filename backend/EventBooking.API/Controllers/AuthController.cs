using EventBooking.API.DTOs;
using EventBooking.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EventBooking.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        // ─────────────────────────────────────────────
        // POST api/auth/register
        // ─────────────────────────────────────────────
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            // [ApiController] automatically returns 400 if model annotations fail
            // This catch handles business logic errors from the service
            try
            {
                var result = await _authService.RegisterAsync(dto);
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                // Email already exists
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An unexpected error occurred.", detail = ex.Message });
            }
        }

        // ─────────────────────────────────────────────
        // POST api/auth/login
        // ─────────────────────────────────────────────
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            try
            {
                var result = await _authService.LoginAsync(dto);
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                // Wrong email or password
                return Unauthorized(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An unexpected error occurred.", detail = ex.Message });
            }
        }

        // ─────────────────────────────────────────────
        // GET api/auth/profile
        // ─────────────────────────────────────────────
        [HttpGet("profile")]
        [Authorize]
        public async Task<IActionResult> GetProfile()
        {
            try
            {
                // Safe parse — handle malformed token claim gracefully
                var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);

                if (string.IsNullOrWhiteSpace(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                    return Unauthorized(new { message = "Invalid token." });

                var profile = await _authService.GetProfileAsync(userId);
                return Ok(profile);
            }
            catch (KeyNotFoundException ex)
            {
                // User in token no longer exists in DB
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An unexpected error occurred.", detail = ex.Message });
            }
        }
    }
}