namespace EventBooking.API.Models
{
    public enum EventStatus { Draft, Published, Cancelled, Completed }
    public enum EventCategory { Music, Sports, Technology, Food, Art, Business, Health, Other }

    public class Event
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public EventCategory Category { get; set; }
        public EventStatus Status { get; set; } = EventStatus.Draft;
        public DateTime StartDateTime { get; set; }
        public DateTime EndDateTime { get; set; }
        public string Venue { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string? Address { get; set; }
        public string? ImageUrl { get; set; }
        public decimal TicketPrice { get; set; }
        public int TotalTickets { get; set; }
        public int BookedTickets { get; set; } = 0;
        public int AvailableTickets => TotalTickets - BookedTickets;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public int OrganizerId { get; set; }
        public User Organizer { get; set; } = null!;
        public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
    }
}
