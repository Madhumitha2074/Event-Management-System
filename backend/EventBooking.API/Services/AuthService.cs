using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using EventBooking.API.Data;
using EventBooking.API.DTOs;
using EventBooking.API.Models;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;

namespace EventBooking.API.Services
{
    public interface IAuthService
    {
        Task<AuthResponseDto> RegisterAsync(RegisterDto dto);
        Task<AuthResponseDto> LoginAsync(LoginDto dto);
        Task<UserProfileDto> GetProfileAsync(int userId);
    }

    public class AuthService : IAuthService
    {
        private readonly DatabaseHelper _db;
        private readonly IConfiguration _config;

        public AuthService(DatabaseHelper db, IConfiguration config)
        {
            _db = db;
            _config = config;
        }

        // ─────────────────────────────────────────────
        // REGISTER
        // ─────────────────────────────────────────────
        public async Task<AuthResponseDto> RegisterAsync(RegisterDto dto)
        {
            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            // 1. Check if email is already taken
            using var checkCmd = new SqlCommand(
                "SELECT COUNT(1) FROM Users WHERE Email = @Email",
                connection
            );
            checkCmd.Parameters.AddWithValue("@Email", dto.Email.Trim().ToLower());

            int exists = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
            if (exists > 0)
                throw new InvalidOperationException("An account with this email already exists.");

            // 2. Map role index from Angular (0=User, 1=Organizer, 2=Admin)
            string roleString = dto.Role switch
            {
                1 => "Organizer",
                2 => "Admin",
                _ => "User"
            };

            // 3. Hash password
            string passwordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);

            // 4. Insert and get new Id using OUTPUT INSERTED.Id
            using var insertCmd = new SqlCommand(@"
                INSERT INTO Users (Name, Email, PasswordHash, Role, Phone)
                OUTPUT INSERTED.Id
                VALUES (@Name, @Email, @PasswordHash, @Role, @Phone)",
                connection
            );

            insertCmd.Parameters.AddWithValue("@Name",         dto.Name.Trim());
            insertCmd.Parameters.AddWithValue("@Email",        dto.Email.Trim().ToLower());
            insertCmd.Parameters.AddWithValue("@PasswordHash", passwordHash);
            insertCmd.Parameters.AddWithValue("@Role",         roleString);
            insertCmd.Parameters.AddWithValue("@Phone",
                string.IsNullOrWhiteSpace(dto.Phone) ? (object)DBNull.Value : dto.Phone.Trim());

            // ✅ Fix 1: Use Convert.ToInt32 to safely unbox the scalar result
            var scalarResult = await insertCmd.ExecuteScalarAsync();
            int newUserId = Convert.ToInt32(scalarResult);

            // 5. Build and return JWT response
            return BuildAuthResponse(newUserId, dto.Name.Trim(), dto.Email.Trim().ToLower(), roleString);
        }

        // ─────────────────────────────────────────────
        // LOGIN
        // ─────────────────────────────────────────────
        public async Task<AuthResponseDto> LoginAsync(LoginDto dto)
        {
            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            using var cmd = new SqlCommand(@"
                SELECT Id, Name, Email, PasswordHash, Role
                FROM Users
                WHERE Email = @Email AND IsActive = 1",
                connection
            );
            cmd.Parameters.AddWithValue("@Email", dto.Email.Trim().ToLower());

            using var reader = await cmd.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
                throw new UnauthorizedAccessException("Invalid email or password.");

            string storedHash = reader["PasswordHash"].ToString()!;

            if (!BCrypt.Net.BCrypt.Verify(dto.Password, storedHash))
                throw new UnauthorizedAccessException("Invalid email or password.");

            int    userId = Convert.ToInt32(reader["Id"]);
            string name   = reader["Name"].ToString()!;
            string email  = reader["Email"].ToString()!;
            string role   = reader["Role"].ToString()!;

            return BuildAuthResponse(userId, name, email, role);
        }

        // ─────────────────────────────────────────────
        // GET PROFILE
        // ─────────────────────────────────────────────
        public async Task<UserProfileDto> GetProfileAsync(int userId)
        {
            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            using var cmd = new SqlCommand(@"
                SELECT Id, Name, Email, Role, Phone, CreatedAt
                FROM Users
                WHERE Id = @Id AND IsActive = 1",
                connection
            );
            cmd.Parameters.AddWithValue("@Id", userId);

            using var reader = await cmd.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
                throw new KeyNotFoundException("User not found.");

            return new UserProfileDto
            {
                Id        = Convert.ToInt32(reader["Id"]),
                Name      = reader["Name"].ToString()!,
                Email     = reader["Email"].ToString()!,
                Role      = reader["Role"].ToString()!,
                Phone     = reader["Phone"] == DBNull.Value
                                ? null
                                : reader["Phone"].ToString(),

                // ✅ Fix 2: Cast reader value directly to DateTime, then format
                CreatedAt = reader["CreatedAt"] == DBNull.Value
                                ? string.Empty
                                : ((DateTime)reader["CreatedAt"]).ToString("o")
            };
        }

        // ─────────────────────────────────────────────
        // PRIVATE: Build AuthResponseDto
        // ─────────────────────────────────────────────
        private AuthResponseDto BuildAuthResponse(int userId, string name, string email, string role)
        {
            return new AuthResponseDto
            {
                Token  = GenerateJwt(userId, name, email, role),
                Name   = name,
                Email  = email,
                Role   = role,
                UserId = userId
            };
        }

        // ─────────────────────────────────────────────
        // PRIVATE: Generate JWT
        // ─────────────────────────────────────────────
        private string GenerateJwt(int userId, string name, string email, string role)
        {
            var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Email,          email),
                new Claim(ClaimTypes.Name,           name),
                new Claim(ClaimTypes.Role,           role)
            };

            var token = new JwtSecurityToken(
                issuer:             _config["Jwt:Issuer"],
                audience:           _config["Jwt:Audience"],
                claims:             claims,
                expires:            DateTime.UtcNow.AddDays(7),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}