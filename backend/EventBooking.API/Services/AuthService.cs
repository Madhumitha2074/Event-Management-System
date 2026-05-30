using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
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
        private readonly IConfiguration _config;

        public AuthService(IConfiguration config)
        {
            _config = config;
        }

        private SqlConnection GetConnection()
        {
            return new SqlConnection(
                _config.GetConnectionString("DefaultConnection")
            );
        }

        public async Task<AuthResponseDto> RegisterAsync(RegisterDto dto)
        {
            using var connection = GetConnection();

            await connection.OpenAsync();

            // Check email
            var checkCmd = new SqlCommand(
                "SELECT COUNT(*) FROM Users WHERE Email=@Email",
                connection
            );

            checkCmd.Parameters.AddWithValue("@Email", dto.Email);

            var exists = (int)await checkCmd.ExecuteScalarAsync();

            if (exists > 0)
                throw new Exception("Email already exists");

            var passwordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);

            var insertCmd = new SqlCommand(@"
INSERT INTO Users (Name, Email, PasswordHash, Role)
VALUES (@Name, @Email, @PasswordHash, @Role);

SELECT SCOPE_IDENTITY();
", connection);

            insertCmd.Parameters.AddWithValue("@Name", dto.Name);
            insertCmd.Parameters.AddWithValue("@Email", dto.Email);
            insertCmd.Parameters.AddWithValue("@PasswordHash", passwordHash);
            insertCmd.Parameters.AddWithValue("@Role", dto.Role.ToString());

            var result = await insertCmd.ExecuteScalarAsync();
            int userId = Convert.ToInt32(result);

            var user = new User
            {
                Id = userId,
                Name = dto.Name,
                Email = dto.Email,
                Role = dto.Role,
                PasswordHash = passwordHash
            };

            return BuildAuthResponse(user);
        }

        public async Task<AuthResponseDto> LoginAsync(LoginDto dto)
        {
            using var connection = GetConnection();

            await connection.OpenAsync();

            var cmd = new SqlCommand(@"
SELECT Id, Name, Email, PasswordHash, Role
FROM Users
WHERE Email=@Email
", connection);

            cmd.Parameters.AddWithValue("@Email", dto.Email);

            using var reader = await cmd.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
                throw new Exception("Invalid credentials");

            var passwordHash = reader["PasswordHash"].ToString();

            if (!BCrypt.Net.BCrypt.Verify(dto.Password, passwordHash))
                throw new Exception("Invalid credentials");

            var user = new User
            {
                Id = Convert.ToInt32(reader["Id"]),
                Name = reader["Name"].ToString()!,
                Email = reader["Email"].ToString()!,
                PasswordHash = passwordHash!,
                Role = Enum.Parse<UserRole>(
                    reader["Role"].ToString()!
                )
            };

            return BuildAuthResponse(user);
        }

        public async Task<UserProfileDto> GetProfileAsync(int userId)
        {
            using var connection = GetConnection();

            await connection.OpenAsync();

            var cmd = new SqlCommand(@"
SELECT Id, Name, Email, Role
FROM Users
WHERE Id=@Id
", connection);

            cmd.Parameters.AddWithValue("@Id", userId);

            using var reader = await cmd.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
                throw new Exception("User not found");

            return new UserProfileDto
            {
                Id = Convert.ToInt32(reader["Id"]),
                Name = reader["Name"].ToString()!,
                Email = reader["Email"].ToString()!,
                Role = reader["Role"].ToString()!
            };
        }

        private AuthResponseDto BuildAuthResponse(User user)
        {
            var token = GenerateJwt(user);

            return new AuthResponseDto
            {
                Token = token,
                Name = user.Name,
                Email = user.Email,
                Role = user.Role.ToString(),
                UserId = user.Id
            };
        }

        private string GenerateJwt(User user)
        {
            var key = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(
                    _config["Jwt:Key"]!
                )
            );

            var creds = new SigningCredentials(
                key,
                SecurityAlgorithms.HmacSha256
            );

            var claims = new[]
            {
                new Claim(
                    ClaimTypes.NameIdentifier,
                    user.Id.ToString()
                ),

                new Claim(
                    ClaimTypes.Email,
                    user.Email
                ),

                new Claim(
                    ClaimTypes.Name,
                    user.Name
                ),

                new Claim(
                    ClaimTypes.Role,
                    user.Role.ToString()
                )
            };

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddDays(7),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler()
                .WriteToken(token);
        }
    }
}