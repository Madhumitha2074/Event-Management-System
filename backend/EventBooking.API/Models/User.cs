namespace EventBooking.API.Models
{
    public enum UserRole { User, Organizer, Admin }

    public class User
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public UserRole Role { get; set; } = UserRole.User;
        public string? Phone { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsActive { get; set; } = true;

        // ✅ NEW - Soft delete fields
        public bool IsDeleted { get; set; } = false;
        public int? CreatedBy { get; set; }
        public int? ModifiedBy { get; set; }
        public DateTime? ModifiedAt { get; set; }
        public int? DeletedBy { get; set; }
        public DateTime? DeletedAt { get; set; }
        
        // ✅ NEW - Fields from frontend
        public bool PhoneVerified { get; set; } = false;
        public bool AcceptTerms { get; set; } = false;
        public DateTime? AcceptedTermsAt { get; set; }

        // Navigation properties
        public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
        public ICollection<Event> OrganizedEvents { get; set; } = new List<Event>();
    }
}