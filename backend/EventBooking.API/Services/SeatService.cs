using EventBooking.API.Data;
using EventBooking.API.DTOs;
using Microsoft.Data.SqlClient;

namespace EventBooking.API.Services
{
    public interface ISeatService
    {
        Task<List<EventSeatDto>> GetSeatsAsync(int eventId);
        Task GenerateSeatsAsync(int eventId, List<SeatTierConfigDto> tiers, SqlConnection conn, SqlTransaction tx);
        Task RegenerateSeatsAsync(int eventId, List<SeatTierConfigDto> tiers);
    }

    public class SeatService : ISeatService
    {
        private readonly DatabaseHelper _db;

        // Row label: 0→A, 1→B … 25→Z, 26→AA …
        private static string RowLabel(int i) =>
            i < 26
                ? ((char)('A' + i)).ToString()
                : "A" + ((char)('A' + i - 26)).ToString();

        // Tier → 1-char prefix for seat number
        private static string TierPrefix(string tier) => tier switch
        {
            "Premium"  => "P",
            "Standard" => "S",
            "Economy"  => "E",
            "Ordinary" => "O",
            _          => tier[..1].ToUpper()
        };

        public SeatService(DatabaseHelper db) => _db = db;

        // ─────────────────────────────────────────────
        // GET SEATS  (used by Angular seat map)
        // ─────────────────────────────────────────────
        public async Task<List<EventSeatDto>> GetSeatsAsync(int eventId)
        {
            var seats = new List<EventSeatDto>();

            using var conn = _db.CreateConnection();
            await conn.OpenAsync();

            const string sql = @"
                SELECT Id, SeatNumber, Tier, Price, IsBooked
                FROM   EventSeats
                WHERE  EventId = @EventId
                ORDER  BY
                    CASE Tier
                        WHEN 'Premium'  THEN 1
                        WHEN 'Standard' THEN 2
                        WHEN 'Ordinary' THEN 3
                        WHEN 'Economy'  THEN 4
                        ELSE 5
                    END,
                    SeatNumber";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@EventId", eventId);

            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                seats.Add(new EventSeatDto
                {
                    Id         = Convert.ToInt32(reader["Id"]),
                    SeatNumber = reader["SeatNumber"].ToString()!,
                    Tier       = reader["Tier"].ToString()!,
                    Price      = Convert.ToDecimal(reader["Price"]),
                    IsBooked   = Convert.ToBoolean(reader["IsBooked"])
                });
            }
            return seats;
        }

        // ─────────────────────────────────────────────
        // ✅ GENERATE SEATS (called inside CreateEvent transaction)
        // ─────────────────────────────────────────────
        public async Task GenerateSeatsAsync(
            int eventId,
            List<SeatTierConfigDto> tiers,
            SqlConnection conn,
            SqlTransaction tx)
        {
            if (tiers == null || !tiers.Any())
            {
                throw new ArgumentException("At least one seat tier is required.");
            }

            const string insertSql = @"
                INSERT INTO EventSeats (EventId, SeatNumber, Tier, Price, IsBooked)
                VALUES (@EventId, @SeatNumber, @Tier, @Price, 0)";

            int totalSeats = 0;

            foreach (var tier in tiers)
            {
                string prefix = TierPrefix(tier.Tier);

                for (int row = 0; row < tier.Rows; row++)
                {
                    string rowLabel = RowLabel(row);

                    for (int seatNo = 1; seatNo <= tier.SeatsPerRow; seatNo++)
                    {
                        string seatNumber = $"{prefix}-{rowLabel}{seatNo}";

                        using var cmd = new SqlCommand(insertSql, conn, tx);
                        cmd.Parameters.AddWithValue("@EventId",    eventId);
                        cmd.Parameters.AddWithValue("@SeatNumber", seatNumber);
                        cmd.Parameters.AddWithValue("@Tier",       tier.Tier);
                        cmd.Parameters.AddWithValue("@Price",      tier.Price);
                        await cmd.ExecuteNonQueryAsync();
                        totalSeats++;
                    }
                }
            }

            // Log the result
            Console.WriteLine($"✅ Generated {totalSeats} seats for event {eventId}");
        }

        // ─────────────────────────────────────────────
        // ✅ REGENERATE SEATS (called inside UpdateEvent)
        // Blocked if any seat is already booked
        // ─────────────────────────────────────────────
        public async Task RegenerateSeatsAsync(int eventId, List<SeatTierConfigDto> tiers)
        {
            if (tiers == null || !tiers.Any())
            {
                throw new ArgumentException("At least one seat tier is required.");
            }

            using var conn = _db.CreateConnection();
            await conn.OpenAsync();
            using var tx = conn.BeginTransaction();

            try
            {
                // Block if booked seats exist
                const string checkSql = @"
                    SELECT COUNT(1) FROM EventSeats
                    WHERE EventId = @EventId AND IsBooked = 1";

                using (var checkCmd = new SqlCommand(checkSql, conn, tx))
                {
                    checkCmd.Parameters.AddWithValue("@EventId", eventId);
                    int booked = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                    if (booked > 0)
                        throw new InvalidOperationException(
                            "Cannot change seat layout while bookings exist. Cancel all bookings first.");
                }

                // Delete old seats
                const string deleteSql = "DELETE FROM EventSeats WHERE EventId = @EventId";
                using (var delCmd = new SqlCommand(deleteSql, conn, tx))
                {
                    delCmd.Parameters.AddWithValue("@EventId", eventId);
                    await delCmd.ExecuteNonQueryAsync();
                }

                // Insert new seats
                await GenerateSeatsAsync(eventId, tiers, conn, tx);

                // Update TotalTickets to match
                int totalSeats = tiers.Sum(t => t.Rows * t.SeatsPerRow);
                decimal lowestPrice = tiers.Min(t => t.Price);

                const string updateSql = @"
                    UPDATE Events
                    SET TotalTickets = @Total,
                        TicketPrice  = @MinPrice,
                        SeatConfig   = @SeatConfig
                    WHERE Id = @EventId";

                using (var updCmd = new SqlCommand(updateSql, conn, tx))
                {
                    updCmd.Parameters.AddWithValue("@Total",      totalSeats);
                    updCmd.Parameters.AddWithValue("@MinPrice",   lowestPrice);
                    updCmd.Parameters.AddWithValue("@SeatConfig", System.Text.Json.JsonSerializer.Serialize(tiers));
                    updCmd.Parameters.AddWithValue("@EventId",    eventId);
                    await updCmd.ExecuteNonQueryAsync();
                }

                await tx.CommitAsync();
                Console.WriteLine($"✅ Regenerated {totalSeats} seats for event {eventId}");
            }
            catch
            {
                await tx.RollbackAsync();
                throw;
            }
        }

        // ─────────────────────────────────────────────
        // ✅ NEW: Check if seats exist for an event
        // ─────────────────────────────────────────────
        public async Task<bool> HasSeatsAsync(int eventId)
        {
            using var conn = _db.CreateConnection();
            await conn.OpenAsync();

            const string sql = "SELECT COUNT(1) FROM EventSeats WHERE EventId = @EventId";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@EventId", eventId);

            int count = Convert.ToInt32(await cmd.ExecuteScalarAsync());
            return count > 0;
        }

        // ─────────────────────────────────────────────
        // ✅ NEW: Get seat count for an event
        // ─────────────────────────────────────────────
        public async Task<int> GetSeatCountAsync(int eventId)
        {
            using var conn = _db.CreateConnection();
            await conn.OpenAsync();

            const string sql = "SELECT COUNT(1) FROM EventSeats WHERE EventId = @EventId";

            using var cmd = new SqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("@EventId", eventId);

            return Convert.ToInt32(await cmd.ExecuteScalarAsync());
        }
    }
}