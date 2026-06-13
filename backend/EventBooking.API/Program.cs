using System.Text;
using System.Text.Json;
using EventBooking.API.Data;
using EventBooking.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// ─────────────────────────────────────────────────────
// SERVICES - REGISTRATION
// ─────────────────────────────────────────────────────

builder.Services.AddSingleton<DatabaseHelper>();     //AddSingleton - Creates ONE instance that lives for the entire application lifetime   
builder.Services.AddSingleton<PdfService>();            

builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IEventService, EventService>();
builder.Services.AddScoped<IBookingService, BookingService>();
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<ISeatService, SeatService>();
builder.Services.AddSingleton<IQrCodeService, QrCodeService>();

//  camelCase JSON output — matches Angular model property names
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });

builder.Services.AddEndpointsApiExplorer();

// ─────────────────────────────────────────────────────
// JWT AUTHENTICATION
// ─────────────────────────────────────────────────────

var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("JWT Key is not configured in appsettings.json.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),

            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],

            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"],

            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero    //  No grace period on token expiry
        };
    });

builder.Services.AddAuthorization();

// ─────────────────────────────────────────────────────
// CORS
// ─────────────────────────────────────────────────────

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins(
        "http://localhost:4200",
        "https://localhost:4200"
        )
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// ─────────────────────────────────────────────────────
// SWAGGER
// ─────────────────────────────────────────────────────

builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Event Booking API",
        Version = "v1",
        Description = "Local Event Booking Platform — ASP.NET Core Web API"
    });

    // Allow sending Bearer token from Swagger UI
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header,
        Description = "Enter: Bearer {your JWT token}",
        Name = "Authorization",
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id   = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// ─────────────────────────────────────────────────────
// BUILD APP
// ─────────────────────────────────────────────────────

var app = builder.Build();

// ─────────────────────────────────────────────────────
// GLOBAL EXCEPTION HANDLER  (must be first)
// ─────────────────────────────────────────────────────

app.UseExceptionHandler(appError =>
{
    appError.Run(async context =>
    {
        // ✅ Set actual HTTP status code to 500, not just the body
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";

        var error = context.Features.Get<IExceptionHandlerFeature>();

        if (error != null)
        {
            var response = new
            {
                statusCode = 500,
                message = "An unexpected server error occurred.",
                // Only expose detail in Development — hide in Production
                detail = app.Environment.IsDevelopment()
                                 ? error.Error.Message
                                 : null
            };

            await context.Response.WriteAsync(
                JsonSerializer.Serialize(response,
                    new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                    })
            );
        }
    });
});

// ─────────────────────────────────────────────────────
// MIDDLEWARE PIPELINE  (order matters)
// ─────────────────────────────────────────────────────

//  HTTPS redirection
//app.UseHttpsRedirection();

//  CORS before everything else that serves content
app.UseCors("AllowAngular");

//  Swagger only in Development — not exposed in Production
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Event Booking API v1");
        c.RoutePrefix = "swagger";   // Access at /swagger
    });
}

// Auth
app.UseAuthentication();
app.UseAuthorization();

// Controllers
app.MapControllers();

// ─────────────────────────────────────────────────────
// RUN
// ─────────────────────────────────────────────────────

app.Run();