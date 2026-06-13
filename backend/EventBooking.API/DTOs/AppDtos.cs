using System.ComponentModel.DataAnnotations;

namespace EventBooking.API.DTOs
{
    // ─────────────────────────────────────────────
    // AUTH DTOs
    // ─────────────────────────────────────────────

    public class RegisterDto
    {
        [Required(ErrorMessage = "Name is required.")]
        [StringLength(150, MinimumLength = 2, ErrorMessage = "Name must be between 2 and 150 characters.")]
        public string Name { get; set; } = string.Empty;

        [Required(ErrorMessage = "Email is required.")]
        [EmailAddress(ErrorMessage = "Invalid email format.")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required.")]
        [MinLength(6, ErrorMessage = "Password must be at least 6 characters.")]
        public string Password { get; set; } = string.Empty;

        [StringLength(30, ErrorMessage = "Phone number cannot exceed 30 characters.")]
        public string? Phone { get; set; }

        [Range(0, 2, ErrorMessage = "Role must be 0 (User), 1 (Organizer), or 2 (Admin).")]
        public int Role { get; set; } = 0;
    }

    public class LoginDto
    {
        [Required(ErrorMessage = "Email is required.")]
        [EmailAddress(ErrorMessage = "Invalid email format.")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required.")]
        public string Password { get; set; } = string.Empty;
    }

    public class AuthResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public int UserId { get; set; }
        public bool AutoLogin { get; set; } = false;  // ← Add this property
    }

    public class UserProfileDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string Role { get; set; } = string.Empty;
        public string CreatedAt { get; set; } = string.Empty;
    }

    // ─────────────────────────────────────────────
    // EVENT DTOs
    // ─────────────────────────────────────────────

    public class SeatTierConfigDto
    {
        [Required]
        public string Tier { get; set; } = string.Empty;  // Premium | Ordinary | Economy
        [Range(1, 50)]
        public int Rows { get; set; }
        [Range(1, 50)]
        public int SeatsPerRow { get; set; }
        [Range(0, 99999)]
        public decimal Price { get; set; }
    }

    public class CreateEventDto
    {
        [Required(ErrorMessage = "Title is required.")]
        [StringLength(255, MinimumLength = 3, ErrorMessage = "Title must be between 3 and 255 characters.")]
        public string Title { get; set; } = string.Empty;

        [Required(ErrorMessage = "Description is required.")]
        [StringLength(5000, MinimumLength = 10, ErrorMessage = "Description must be between 10 and 5000 characters.")]
        public string Description { get; set; } = string.Empty;

        [Range(0, 7, ErrorMessage = "Category must be between 0 and 7.")]
        public int Category { get; set; }

        [Required(ErrorMessage = "Start date is required.")]
        public string StartDateTime { get; set; } = string.Empty;

        [Required(ErrorMessage = "End date is required.")]
        public string EndDateTime { get; set; } = string.Empty;

        [Required(ErrorMessage = "Venue is required.")]
        [StringLength(255, MinimumLength = 2)]
        public string Venue { get; set; } = string.Empty;

        [Required(ErrorMessage = "City is required.")]
        [StringLength(100, MinimumLength = 2)]
        public string City { get; set; } = string.Empty;

        public string? Address { get; set; }
        public string? ImageUrl { get; set; }

        [Range(0, 99999.99, ErrorMessage = "Ticket price must be between 0 and 99,999.")]
        public decimal TicketPrice { get; set; }

        [Range(1, 100000, ErrorMessage = "Total tickets must be between 1 and 100,000.")]
        public int TotalTickets { get; set; }

        // ✅ NEW — optional seat tier configuration
        public List<SeatTierConfigDto>? SeatTiers { get; set; }

        // ✅ NEW — Google Maps URL for location
        public string? GoogleMapsUrl { get; set; }
    }

    public class UpdateEventDto : CreateEventDto
    {
        public string Status { get; set; } = string.Empty;
    }

    public class EventDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public int CategoryIndex { get; set; }
        public string Status { get; set; } = string.Empty;
        public string StartDateTime { get; set; } = string.Empty;
        public string EndDateTime { get; set; } = string.Empty;
        public string Venue { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string? Address { get; set; }
        public string? ImageUrl { get; set; }
        public decimal TicketPrice { get; set; }
        public decimal MinPrice { get; set; }
        public decimal MaxPrice { get; set; }
        public int TotalTickets { get; set; }
        public int BookedTickets { get; set; }
        public int AvailableTickets { get; set; }
        public string OrganizerName { get; set; } = string.Empty;
        public int OrganizerId { get; set; }
        public string CreatedAt { get; set; } = string.Empty;
        public bool HasSeatMap { get; set; }
        public string? SeatConfig { get; set; }
        public string? GoogleMapsUrl { get; set; }  // ✅ NEW - Google Maps URL
    }

    public class EventFilterDto
    {
        public string? Search { get; set; }
        public string? City { get; set; }
        public int? Category { get; set; }
        public string? StartDate { get; set; }
        public string? EndDate { get; set; }
        public decimal? MinPrice { get; set; }
        public decimal? MaxPrice { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 9;
    }

    public class PagedResultDto<T>
    {
        public List<T> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    }

    // ─────────────────────────────────────────────
    // SEAT DTOs
    // ─────────────────────────────────────────────

    public class EventSeatDto
    {
        public int Id { get; set; }
        public string SeatNumber { get; set; } = string.Empty;
        public string Tier { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public bool IsBooked { get; set; }
    }

    // ─────────────────────────────────────────────
    // BOOKING DTOs
    // ─────────────────────────────────────────────

    public class CreateBookingDto
    {
        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "EventId must be a valid event.")]
        public int EventId { get; set; }

        [Required]
        [Range(1, 10, ErrorMessage = "You can book between 1 and 10 tickets at a time.")]
        public int TicketCount { get; set; }

        [Required(ErrorMessage = "Attendee details are required.")]
        [MinLength(1, ErrorMessage = "At least one attendee is required.")]
        public List<AttendeeDto> Attendees { get; set; } = new();
    }

    public class CreateBookingWithSeatsDto
    {
        [Required]
        [Range(1, int.MaxValue)]
        public int EventId { get; set; }

        [Required]
        [MinLength(1, ErrorMessage = "Select at least one seat.")]
        public List<int> SeatIds { get; set; } = new();

        [Required]
        [MinLength(1)]
        public List<AttendeeDto> Attendees { get; set; } = new();
    }

    public class AttendeeDto
    {
        [Required(ErrorMessage = "Attendee name is required.")]
        [StringLength(150, MinimumLength = 2)]
        public string Name { get; set; } = string.Empty;

        [Required(ErrorMessage = "Attendee email is required.")]
        [EmailAddress(ErrorMessage = "Invalid attendee email.")]
        public string Email { get; set; } = string.Empty;
    }

    public class BookingDto
    {
        public int Id { get; set; }
        public string BookingReference { get; set; } = string.Empty;
        public int EventId { get; set; }
        public string EventTitle { get; set; } = string.Empty;
        public string EventVenue { get; set; } = string.Empty;
        public string EventStartDateTime { get; set; } = string.Empty;
        public int TicketCount { get; set; }
        public decimal TotalAmount { get; set; }
        public string Status { get; set; } = string.Empty;
        public string BookedAt { get; set; } = string.Empty;
        public List<TicketDto> Tickets { get; set; } = new();
    }

    public class TicketDto
    {
        public int Id { get; set; }
        public string TicketNumber { get; set; } = string.Empty;
        public string AttendeeName { get; set; } = string.Empty;
        public string AttendeeEmail { get; set; } = string.Empty;
        public bool IsUsed { get; set; }
        public string? SeatNumber { get; set; }
        public string? Tier { get; set; }
        public decimal? SeatPrice { get; set; }
        public string? QrCodeBase64 { get; set; }
        public byte[]? QrCodeBytes { get; set; }
    }
}