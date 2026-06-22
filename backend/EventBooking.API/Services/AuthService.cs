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
        // REGISTER - WITH LOGGING
        // ─────────────────────────────────────────────
        public async Task<AuthResponseDto> RegisterAsync(RegisterDto dto)
        {
            try
            {
                Console.WriteLine("========================================");
                Console.WriteLine("REGISTER METHOD CALLED!");
                Console.WriteLine($"Name: {dto.Name}");
                Console.WriteLine($"Email: {dto.Email}");
                Console.WriteLine($"Phone: {dto.Phone}");
                Console.WriteLine($"PhoneNumber: {dto.PhoneNumber}");
                Console.WriteLine($"Role: {dto.Role}");
                Console.WriteLine($"AcceptTerms: {dto.AcceptTerms}");
                Console.WriteLine($"PhoneVerified: {dto.PhoneVerified}");
                Console.WriteLine($"AcceptedTermsAt: {dto.AcceptedTermsAt}");
                Console.WriteLine("========================================");

                using var connection = _db.CreateConnection();
                await connection.OpenAsync();
                Console.WriteLine("✅ Database connection opened.");

                // 1. Check if email is already taken
                using var checkCmd = new SqlCommand(
                    "SELECT COUNT(1) FROM Users WHERE Email = @Email AND IsDeleted = 0",
                    connection
                );
                checkCmd.Parameters.AddWithValue("@Email", dto.Email.Trim().ToLower());

                int exists = Convert.ToInt32(await checkCmd.ExecuteScalarAsync());
                Console.WriteLine($"Email exists check: {exists}");

                if (exists > 0)
                    throw new InvalidOperationException("An account with this email already exists.");

                // 2. Map role index (0=User, 1=Organizer, 2=Admin)
                string roleString = dto.Role switch
                {
                    1 => "Organizer",
                    2 => "Admin",
                    _ => "User"
                };
                Console.WriteLine($"Role mapped to: {roleString}");

                // 3. Hash password
                string passwordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
                Console.WriteLine("✅ Password hashed.");

                // 4. Get phone number from either field
                string phoneValue = string.Empty;
                if (!string.IsNullOrWhiteSpace(dto.Phone))
                    phoneValue = dto.Phone;
                else if (!string.IsNullOrWhiteSpace(dto.PhoneNumber))
                    phoneValue = dto.PhoneNumber;
                Console.WriteLine($"Phone value: '{phoneValue}'");

                // 5. Insert user with all fields
                using var insertCmd = new SqlCommand(@"
                    INSERT INTO Users (
                        Name, Email, PasswordHash, Role, Phone, 
                        IsActive, IsDeleted, CreatedAt,
                        PhoneVerified, AcceptTerms, AcceptedTermsAt
                    )
                    OUTPUT INSERTED.Id
                    VALUES (
                        @Name, @Email, @PasswordHash, @Role, @Phone,
                        @IsActive, @IsDeleted, @CreatedAt,
                        @PhoneVerified, @AcceptTerms, @AcceptedTermsAt
                    )",
                    connection
                );

                insertCmd.Parameters.AddWithValue("@Name", dto.Name.Trim());
                insertCmd.Parameters.AddWithValue("@Email", dto.Email.Trim().ToLower());
                insertCmd.Parameters.AddWithValue("@PasswordHash", passwordHash);
                insertCmd.Parameters.AddWithValue("@Role", roleString);
                
                if (string.IsNullOrWhiteSpace(phoneValue))
                    insertCmd.Parameters.AddWithValue("@Phone", DBNull.Value);
                else
                    insertCmd.Parameters.AddWithValue("@Phone", phoneValue.Trim());
                
                insertCmd.Parameters.AddWithValue("@IsActive", true);
                insertCmd.Parameters.AddWithValue("@IsDeleted", false);
                insertCmd.Parameters.AddWithValue("@CreatedAt", DateTime.UtcNow);
                insertCmd.Parameters.AddWithValue("@PhoneVerified", dto.PhoneVerified);
                insertCmd.Parameters.AddWithValue("@AcceptTerms", dto.AcceptTerms);
                
                if (!string.IsNullOrWhiteSpace(dto.AcceptedTermsAt))
                    insertCmd.Parameters.AddWithValue("@AcceptedTermsAt", DateTime.Parse(dto.AcceptedTermsAt));
                else
                    insertCmd.Parameters.AddWithValue("@AcceptedTermsAt", DBNull.Value);

                Console.WriteLine("✅ Executing INSERT...");
                var scalarResult = await insertCmd.ExecuteScalarAsync();
                int newUserId = Convert.ToInt32(scalarResult);
                Console.WriteLine($"✅ New User ID: {newUserId}");

                // 6. Build and return JWT response
                Console.WriteLine("✅ Building JWT response...");
                return BuildAuthResponse(newUserId, dto.Name.Trim(), dto.Email.Trim().ToLower(), roleString);
            }
            catch (Exception ex)
            {
                Console.WriteLine("❌❌❌ ERROR ❌❌❌");
                Console.WriteLine($"Message: {ex.Message}");
                Console.WriteLine($"Stack Trace: {ex.StackTrace}");
                throw;
            }
        }

        // ─────────────────────────────────────────────
        // LOGIN - UPDATED with IsDeleted check
        // ─────────────────────────────────────────────
        public async Task<AuthResponseDto> LoginAsync(LoginDto dto)
        {
            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            using var cmd = new SqlCommand(@"
                SELECT Id, Name, Email, PasswordHash, Role, PhoneVerified
                FROM Users
                WHERE Email = @Email AND IsActive = 1 AND IsDeleted = 0",
                connection
            );
            cmd.Parameters.AddWithValue("@Email", dto.Email.Trim().ToLower());

            using var reader = await cmd.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
                throw new UnauthorizedAccessException("Invalid email or password.");

            string storedHash = reader["PasswordHash"].ToString()!;

            if (!BCrypt.Net.BCrypt.Verify(dto.Password, storedHash))
                throw new UnauthorizedAccessException("Invalid email or password.");

            int userId = Convert.ToInt32(reader["Id"]);
            string name = reader["Name"].ToString()!;
            string email = reader["Email"].ToString()!;
            string role = reader["Role"].ToString()!;

            return BuildAuthResponse(userId, name, email, role);
        }

        // ─────────────────────────────────────────────
        // GET PROFILE - UPDATED with new fields
        // ─────────────────────────────────────────────
        public async Task<UserProfileDto> GetProfileAsync(int userId)
        {
            using var connection = _db.CreateConnection();
            await connection.OpenAsync();

            using var cmd = new SqlCommand(@"
                SELECT Id, Name, Email, Role, Phone, CreatedAt,
                       PhoneVerified, AcceptTerms, AcceptedTermsAt
                FROM Users
                WHERE Id = @Id AND IsActive = 1 AND IsDeleted = 0",
                connection
            );
            cmd.Parameters.AddWithValue("@Id", userId);

            using var reader = await cmd.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
                throw new KeyNotFoundException("User not found.");

            return new UserProfileDto
            {
                Id = Convert.ToInt32(reader["Id"]),
                Name = reader["Name"].ToString()!,
                Email = reader["Email"].ToString()!,
                Role = reader["Role"].ToString()!,
                Phone = reader["Phone"] == DBNull.Value
                    ? null
                    : reader["Phone"].ToString(),
                CreatedAt = reader["CreatedAt"] == DBNull.Value
                    ? string.Empty
                    : ((DateTime)reader["CreatedAt"]).ToString("o"),
                PhoneVerified = Convert.ToBoolean(reader["PhoneVerified"]),
                AcceptTerms = Convert.ToBoolean(reader["AcceptTerms"]),
                AcceptedTermsAt = reader["AcceptedTermsAt"] == DBNull.Value
                    ? null
                    : ((DateTime)reader["AcceptedTermsAt"]).ToString("o")
            };
        }

        // ─────────────────────────────────────────────
        // PRIVATE: Build AuthResponseDto
        // ─────────────────────────────────────────────
        private AuthResponseDto BuildAuthResponse(int userId, string name, string email, string role)
        {
            return new AuthResponseDto
            {
                Token = GenerateJwt(userId, name, email, role),
                Name = name,
                Email = email,
                Role = role,
                UserId = userId,
                AutoLogin = false
            };
        }

        // ─────────────────────────────────────────────
        // PRIVATE: Generate JWT
        // ─────────────────────────────────────────────
        private string GenerateJwt(int userId, string name, string email, string role)
        {
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Email, email),
                new Claim(ClaimTypes.Name, name),
                new Claim(ClaimTypes.Role, role)
            };

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddDays(7),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}