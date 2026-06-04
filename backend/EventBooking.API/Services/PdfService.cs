using EventBooking.API.DTOs;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace EventBooking.API.Services
{
    public class PdfService
    {
        public PdfService()
        {
            // ✅ Required — without this QuestPDF throws LicenseException at runtime
            QuestPDF.Settings.License = LicenseType.Community;
        }

        public byte[] GenerateBookingPdf(BookingDto booking)
        {
            // ✅ Parse the ISO date strings back to DateTime for display formatting
            DateTime bookedAt = DateTime.TryParse(booking.BookedAt, out var b)
                ? b : DateTime.UtcNow;

            DateTime eventDate = DateTime.TryParse(booking.EventStartDateTime, out var e)
                ? e : DateTime.MinValue;

            return Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(35);
                    page.DefaultTextStyle(x => x.FontSize(11).FontFamily(Fonts.Arial));

                    // ─────────────────────────────────────────────
                    // HEADER
                    // ─────────────────────────────────────────────
                    page.Header()
                        .PaddingBottom(15)
                        .Column(col =>
                        {
                            // Top colour bar
                            col.Item()
                               .Background(Color.FromHex("#6c5ce7"))
                               .Padding(18)
                               .Row(row =>
                               {
                                   row.RelativeItem()
                                      .Text("🎫  EventBook")
                                      .FontSize(22)
                                      .Bold()
                                      .FontColor(Colors.White);

                                   row.ConstantItem(160)
                                      .AlignRight()
                                      .Text("BOOKING CONFIRMATION")
                                      .FontSize(10)
                                      .Bold()
                                      .FontColor(Color.FromHex("#a29bfe"));
                               });

                            // Booking reference banner
                            col.Item()
                               .Background(Color.FromHex("#f0eeff"))
                               .Padding(10)
                               .Row(row =>
                               {
                                   row.RelativeItem()
                                      .Text(text =>
                                      {
                                          text.Span("Booking Reference:  ")
                                              .FontSize(11)
                                              .FontColor(Colors.Grey.Darken2);
                                          text.Span(booking.BookingReference)
                                              .FontSize(14)
                                              .Bold()
                                              .FontColor(Color.FromHex("#6c5ce7"));
                                      });

                                   row.ConstantItem(120)
                                      .AlignRight()
                                      .Text(text =>
                                      {
                                          text.Span("Status:  ")
                                              .FontColor(Colors.Grey.Darken2);
                                          text.Span(booking.Status)
                                              .Bold()
                                              .FontColor(
                                                  booking.Status == "Confirmed"
                                                      ? Color.FromHex("#00b894")
                                                      : Color.FromHex("#d63031")
                                              );
                                      });
                               });
                        });

                    // ─────────────────────────────────────────────
                    // CONTENT
                    // ─────────────────────────────────────────────
                    page.Content()
                        .PaddingTop(10)
                        .Column(col =>
                        {
                            col.Spacing(14);

                            // ── Event Details Section ───────────────────
                            col.Item()
                               .Text("Event Details")
                               .FontSize(13)
                               .Bold()
                               .FontColor(Color.FromHex("#6c5ce7"));

                            col.Item()
                               .Border(1)
                               .BorderColor(Color.FromHex("#dee2e6"))
                               .Table(table =>
                               {
                                   table.ColumnsDefinition(cols =>
                                   {
                                       cols.ConstantColumn(140);
                                       cols.RelativeColumn();
                                   });

                                   // Row helper
                                   void AddRow(string label, string value, bool shaded = false)
                                   {
                                       var bg = shaded
                                           ? Color.FromHex("#f8f9fa")
                                           : Colors.White;

                                       table.Cell()
                                            .Background(bg)
                                            .BorderBottom(1)
                                            .BorderColor(Color.FromHex("#dee2e6"))
                                            .Padding(9)
                                            .Text(label)
                                            .Bold()
                                            .FontColor(Colors.Grey.Darken2);

                                       table.Cell()
                                            .Background(bg)
                                            .BorderBottom(1)
                                            .BorderColor(Color.FromHex("#dee2e6"))
                                            .Padding(9)
                                            .Text(value)
                                            .FontColor(Color.FromHex("#2d3436"));
                                   }

                                   AddRow("Event",    booking.EventTitle,  shaded: true);
                                   AddRow("Venue",    $"{booking.EventVenue}");
                                   AddRow("Date",
                                       eventDate == DateTime.MinValue
                                           ? "TBD"
                                           : eventDate.ToString("dddd, MMMM d yyyy 'at' h:mm tt"),
                                       shaded: true);
                                   AddRow("Booked On",
                                       bookedAt.ToString("dd MMM yyyy, hh:mm tt"));
                               });

                            // ── Payment Section ─────────────────────────
                            col.Item()
                               .Text("Payment Summary")
                               .FontSize(13)
                               .Bold()
                               .FontColor(Color.FromHex("#6c5ce7"));

                            col.Item()
                               .Border(1)
                               .BorderColor(Color.FromHex("#dee2e6"))
                               .Table(table =>
                               {
                                   table.ColumnsDefinition(cols =>
                                   {
                                       cols.ConstantColumn(140);
                                       cols.RelativeColumn();
                                   });

                                   table.Cell()
                                        .Background(Color.FromHex("#f8f9fa"))
                                        .BorderBottom(1)
                                        .BorderColor(Color.FromHex("#dee2e6"))
                                        .Padding(9)
                                        .Text("Tickets")
                                        .Bold()
                                        .FontColor(Colors.Grey.Darken2);

                                   table.Cell()
                                        .Background(Color.FromHex("#f8f9fa"))
                                        .BorderBottom(1)
                                        .BorderColor(Color.FromHex("#dee2e6"))
                                        .Padding(9)
                                        .Text($"{booking.TicketCount} ticket(s)")
                                        .FontColor(Color.FromHex("#2d3436"));

                                   table.Cell()
                                        .Padding(9)
                                        .Text("Total Amount")
                                        .Bold()
                                        .FontColor(Colors.Grey.Darken2);

                                   // ✅ Formatted with decimal places
                                   table.Cell()
                                        .Padding(9)
                                        .Text($"₹{booking.TotalAmount:N2}")
                                        .Bold()
                                        .FontSize(14)
                                        .FontColor(Color.FromHex("#00b894"));
                               });

                            // ── Attendees / Tickets Section ─────────────
                            if (booking.Tickets != null && booking.Tickets.Count > 0)
                            {
                                col.Item()
                                   .Text("Ticket Holders")
                                   .FontSize(13)
                                   .Bold()
                                   .FontColor(Color.FromHex("#6c5ce7"));

                                col.Item()
                                   .Border(1)
                                   .BorderColor(Color.FromHex("#dee2e6"))
                                   .Table(table =>
                                   {
                                       table.ColumnsDefinition(cols =>
                                       {
                                           cols.ConstantColumn(30);   // #
                                           cols.RelativeColumn(2);    // Name
                                           cols.RelativeColumn(3);    // Email
                                           cols.RelativeColumn(2);    // Ticket No.
                                       });

                                       // ── Table header ──────────────────
                                       void HeaderCell(string text)
                                       {
                                           table.Cell()
                                                .Background(Color.FromHex("#6c5ce7"))
                                                .Padding(8)
                                                .Text(text)
                                                .Bold()
                                                .FontColor(Colors.White);
                                       }

                                       HeaderCell("#");
                                       HeaderCell("Name");
                                       HeaderCell("Email");
                                       HeaderCell("Ticket No.");

                                       // ── Table rows ────────────────────
                                       for (int i = 0; i < booking.Tickets.Count; i++)
                                       {
                                           var ticket = booking.Tickets[i];
                                           bool shaded = i % 2 == 0;
                                           var  bg     = shaded
                                               ? Color.FromHex("#f8f9fa")
                                               : Colors.White;

                                           void DataCell(string value)
                                           {
                                               table.Cell()
                                                    .Background(bg)
                                                    .BorderBottom(1)
                                                    .BorderColor(Color.FromHex("#dee2e6"))
                                                    .Padding(8)
                                                    .Text(value)
                                                    .FontColor(Color.FromHex("#2d3436"));
                                           }

                                           DataCell((i + 1).ToString());
                                           DataCell(ticket.AttendeeName);
                                           DataCell(ticket.AttendeeEmail);
                                           DataCell(ticket.TicketNumber);
                                       }
                                   });
                            }

                            // ── Notice ──────────────────────────────────
                            col.Item()
                               .Background(Color.FromHex("#fff3cd"))
                               .Border(1)
                               .BorderColor(Color.FromHex("#ffc107"))
                               .Padding(10)
                               .Text(
                                   "Please carry this confirmation and a valid ID to the event. " +
                                   "Tickets are non-transferable."
                               )
                               .FontSize(10)
                               .FontColor(Color.FromHex("#856404"));
                        });

                    // ─────────────────────────────────────────────
                    // FOOTER
                    // ─────────────────────────────────────────────
                    page.Footer()
                        .BorderTop(1)
                        .BorderColor(Color.FromHex("#dee2e6"))
                        .PaddingTop(10)
                        .Row(row =>
                        {
                            row.RelativeItem()
                               .Text($"© {DateTime.UtcNow.Year} EventBook")
                               .FontSize(9)
                               .FontColor(Colors.Grey.Medium);

                            row.ConstantItem(200)
                               .AlignRight()
                               .Text(text =>
                               {
                                   text.Span("Page ")
                                       .FontSize(9)
                                       .FontColor(Colors.Grey.Medium);
                                   text.CurrentPageNumber()
                                       .FontSize(9)
                                       .FontColor(Colors.Grey.Medium);
                                   text.Span(" of ")
                                       .FontSize(9)
                                       .FontColor(Colors.Grey.Medium);
                                   text.TotalPages()
                                       .FontSize(9)
                                       .FontColor(Colors.Grey.Medium);
                               });
                        });
                });
            }).GeneratePdf();
        }
    }
}