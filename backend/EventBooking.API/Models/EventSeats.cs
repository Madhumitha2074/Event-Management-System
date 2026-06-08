// backend\EventBooking.API\Models\EventSeat.cs

namespace EventBooking.API.Models
{
    public class EventSeat
    {
        public int Id { get; set; }
        public int EventId { get; set; }
        public string SeatNumber { get; set; } = string.Empty;  // e.g., "P-A1"
        public string Tier { get; set; } = string.Empty;        // 'Premium', 'Ordinary', 'Economy'
        public decimal Price { get; set; }
        public bool IsBooked { get; set; } = false;
        public int? TicketId { get; set; }  // References Ticket when booked
        
        // Navigation properties
        public Event Event { get; set; } = null!;
        public Ticket? Ticket { get; set; }
    }
}