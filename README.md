# Local Event Booking Platform

A full-stack platform for discovering and booking local events, built with **ASP.NET Core 8**, **Angular 17**, and **MySQL**.

---

## Project Structure

```
Madhu-Project/
├── backend/
│   └── EventBooking.API/        # ASP.NET Core Web API
│       ├── Controllers/         # AuthController, EventsController, BookingsController
│       ├── Data/                
│       ├── DTOs/                # Data Transfer Objects
│       ├── Models/              # Domain entities (User, Event, Booking, Ticket)
│       ├── Services/            # AuthService, EventService, BookingService, EmailService
│       ├── Program.cs           # App entry point & DI configuration
│       └── appsettings.json     # Configuration (DB, JWT, SMTP)
├── frontend/
│   └── src/app/
│       ├── core/                # Models, Services, Guards, Interceptors
│       ├── features/
│       │   ├── auth/            # Login, Register
│       │   ├── events/          # Event List, Event Detail + Booking Form
│       │   ├── bookings/        # Booking History, Booking Detail
│       │   └── organizer/       # Dashboard, Event Form, Attendees
│       └── shared/              # Navbar, Footer
└── database/
    └── schema.sql               # MySQL schema + sample data
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| .NET SDK | 8.0+ |
| Node.js | 18+ |
| Angular CLI | 17+ |
| MySQL | 8.0+ |

---

## Setup & Run

### 1. Database

```sql
-- In MySQL Workbench or CLI:
source database/schema.sql
```

Or let Entity Framework auto-migrate on first startup (configured in `Program.cs`).

### 2. Backend

```bash
cd backend/EventBooking.API

# Edit appsettings.json — update connection string & SMTP settings
# "DefaultConnection": "Server=localhost;Database=EventBookingDb;User=root;Password=YOUR_PASSWORD;"

dotnet restore
dotnet ef migrations add InitialCreate   # First time only
dotnet run
```

API will start at: `http://localhost:5000`  
Swagger UI: `http://localhost:5000/swagger`

### 3. Frontend

```bash
cd frontend
npm install
ng serve
```

App will start at: `http://localhost:4200`

---

## Configuration

### `backend/EventBooking.API/appsettings.json`

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=EventBookingDb;User=root;Password=yourpassword;"
  },
  "Jwt": {
    "Key": "YourSuperSecretKeyThatIsAtLeast32CharsLong!",
    "Issuer": "EventBookingAPI",
    "Audience": "EventBookingClient"
  },
  "Smtp": {
    "Host": "smtp.gmail.com",
    "Port": "587",
    "Username": "your-email@gmail.com",
    "Password": "your-app-password"
  }
}
```

> **Tip:** For Gmail SMTP, enable 2FA and generate an App Password.

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/profile` | Get current user profile |

### Events
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | List events (filter/search/paginate) |
| GET | `/api/events/{id}` | Get event details |
| POST | `/api/events` | Create event (Organizer) |
| PUT | `/api/events/{id}` | Update event (Organizer) |
| DELETE | `/api/events/{id}` | Delete event (Organizer) |
| GET | `/api/events/my-events` | Organizer's events |
| GET | `/api/events/{id}/attendees` | Event attendee list |

### Bookings
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bookings` | Create booking |
| GET | `/api/bookings` | My booking history |
| GET | `/api/bookings/{id}` | Booking details |
| POST | `/api/bookings/{id}/cancel` | Cancel booking |

---

## Features

### User Features
- ✅ Browse & search events with filters (city, category, date, price)
- ✅ Paginated event listing
- ✅ Detailed event view with booking form
- ✅ Multi-attendee ticket booking
- ✅ Booking history with status
- ✅ Booking cancellation
- ✅ Email confirmation (MailKit + SMTP)

### Organizer Features
- ✅ Create, edit, delete events
- ✅ Set ticket limits and pricing
- ✅ Dashboard with revenue stats
- ✅ View attendee lists per event

### Technical Features
- ✅ JWT Authentication with role-based authorization
- ✅ Concurrent booking protection (DB transactions)
- ✅ Entity Framework Core with MySQL (Pomelo)
- ✅ Angular lazy-loaded feature modules
- ✅ HTTP interceptor for auth headers
- ✅ Route guards for protected pages
- ✅ Responsive Bootstrap 5 UI

---

## Database Schema

```
Users ──< Events (Organizer)
Users ──< Bookings
Events ──< Bookings
Bookings ──< Tickets
```

---

## Roles

| Role | Permissions |
|------|-------------|
| User | Browse events, book tickets, view/cancel own bookings |
| Organizer | All User permissions + create/manage events, view attendees |
| Admin | All permissions |

---

## Deployment

### Backend (Azure App Service / any .NET host)
```bash
dotnet publish -c Release -o ./publish
# Deploy ./publish folder
```

### Frontend (Netlify / Vercel / Azure Static Web Apps)
```bash
ng build --configuration production
# Deploy ./dist/event-booking-frontend folder
```

Update `src/environments/environment.ts` with your production API URL before building.
