namespace EventBooking.API.Models
{
    public class Ticket
    {
        public int Id { get; set; }
        public string TicketNumber { get; set; } = string.Empty;
        public int BookingId { get; set; }
        public Booking Booking { get; set; } = null!;
        public string AttendeeeName { get; set; } = string.Empty;
        public string AttendeeEmail { get; set; } = string.Empty;
        public bool IsUsed { get; set; } = false;
        public DateTime IssuedAt { get; set; } = DateTime.UtcNow;
        // NEW: Add this property for seat mapping
        public int? SeatId { get; set; }  // Nullable because not all tickets have assigned seats

        // Navigation property (optional)
        public EventSeat? Seat { get; set; }
    }
}
