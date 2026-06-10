using EventBooking.API.DTOs;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using QuestPDFColor = QuestPDF.Infrastructure.Color;

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
                               .Background(QuestPDFColor.FromHex("#6c5ce7"))
                               .Padding(18)
                               .Row(row =>
                               {
                                   row.RelativeItem()
                                      .Text("🎫  EventBook")
                                      .FontSize(22)
                                      .Bold()
                                      .FontColor(QuestPDFColor.FromHex("#ffffff"));

                                   row.ConstantItem(160)
                                      .AlignRight()
                                      .Text("BOOKING CONFIRMATION")
                                      .FontSize(10)
                                      .Bold()
                                      .FontColor(QuestPDFColor.FromHex("#a29bfe"));
                               });

                            // Booking reference banner
                            col.Item()
                               .Background(QuestPDFColor.FromHex("#f0eeff"))
                               .Padding(10)
                               .Row(row =>
                               {
                                   row.RelativeItem()
                                      .Text(text =>
                                      {
                                          text.Span("Booking Reference:  ")
                                              .FontSize(11)
                                              .FontColor(QuestPDFColor.FromHex("#6c6f7e"));
                                          text.Span(booking.BookingReference)
                                              .FontSize(14)
                                              .Bold()
                                              .FontColor(QuestPDFColor.FromHex("#6c5ce7"));
                                      });

                                   row.ConstantItem(120)
                                      .AlignRight()
                                      .Text(text =>
                                      {
                                          text.Span("Status:  ")
                                              .FontColor(QuestPDFColor.FromHex("#6c6f7e"));
                                          text.Span(booking.Status)
                                              .Bold()
                                              .FontColor(
                                                  booking.Status == "Confirmed"
                                                      ? QuestPDFColor.FromHex("#00b894")
                                                      : QuestPDFColor.FromHex("#d63031")
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
                               .FontColor(QuestPDFColor.FromHex("#6c5ce7"));

                            col.Item()
                               .Border(1)
                               .BorderColor(QuestPDFColor.FromHex("#dee2e6"))
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
                                           ? QuestPDFColor.FromHex("#f8f9fa")
                                           : QuestPDFColor.FromHex("#ffffff");

                                       table.Cell()
                                            .Background(bg)
                                            .BorderBottom(1)
                                            .BorderColor(QuestPDFColor.FromHex("#dee2e6"))
                                            .Padding(9)
                                            .Text(label)
                                            .Bold()
                                            .FontColor(QuestPDFColor.FromHex("#6c6f7e"));

                                       table.Cell()
                                            .Background(bg)
                                            .BorderBottom(1)
                                            .BorderColor(QuestPDFColor.FromHex("#dee2e6"))
                                            .Padding(9)
                                            .Text(value)
                                            .FontColor(QuestPDFColor.FromHex("#2d3436"));
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
                               .FontColor(QuestPDFColor.FromHex("#6c5ce7"));

                            col.Item()
                               .Border(1)
                               .BorderColor(QuestPDFColor.FromHex("#dee2e6"))
                               .Table(table =>
                               {
                                   table.ColumnsDefinition(cols =>
                                   {
                                       cols.ConstantColumn(140);
                                       cols.RelativeColumn();
                                   });

                                   table.Cell()
                                        .Background(QuestPDFColor.FromHex("#f8f9fa"))
                                        .BorderBottom(1)
                                        .BorderColor(QuestPDFColor.FromHex("#dee2e6"))
                                        .Padding(9)
                                        .Text("Tickets")
                                        .Bold()
                                        .FontColor(QuestPDFColor.FromHex("#6c6f7e"));

                                   table.Cell()
                                        .Background(QuestPDFColor.FromHex("#f8f9fa"))
                                        .BorderBottom(1)
                                        .BorderColor(QuestPDFColor.FromHex("#dee2e6"))
                                        .Padding(9)
                                        .Text($"{booking.TicketCount} ticket(s)")
                                        .FontColor(QuestPDFColor.FromHex("#2d3436"));

                                   table.Cell()
                                        .Padding(9)
                                        .Text("Total Amount")
                                        .Bold()
                                        .FontColor(QuestPDFColor.FromHex("#6c6f7e"));

                                   table.Cell()
                                        .Padding(9)
                                        .Text($"₹{booking.TotalAmount:N2}")
                                        .Bold()
                                        .FontSize(14)
                                        .FontColor(QuestPDFColor.FromHex("#00b894"));
                               });

                            // ── Attendees / Tickets Section with QR Codes ─────────────
                            if (booking.Tickets != null && booking.Tickets.Count > 0)
                            {
                                col.Item()
                                   .Text("E-Tickets with QR Codes")
                                   .FontSize(13)
                                   .Bold()
                                   .FontColor(QuestPDFColor.FromHex("#6c5ce7"));

                                // Create a table for each ticket
                                for (int i = 0; i < booking.Tickets.Count; i++)
                                {
                                    var ticket = booking.Tickets[i];
                                    bool isEven = i % 2 == 0;
                                    int ticketIndex = i;

                                    col.Item()
                                       .Border(1)
                                       .BorderColor(QuestPDFColor.FromHex("#dee2e6"))
                                       .Background(isEven ? QuestPDFColor.FromHex("#f8f9fa") : QuestPDFColor.FromHex("#ffffff"))
                                       .Padding(12)
                                       .Row(row =>
                                       {
                                           // QR Code column
                                           row.ConstantItem(100)
                                              .AlignCenter()
                                              .Column(qrCol =>
                                              {
                                                  if (!string.IsNullOrEmpty(ticket.QrCodeBase64))
                                                  {
                                                      try
                                                      {
                                                          var qrBytes = Convert.FromBase64String(ticket.QrCodeBase64);
                                                          qrCol.Item()
                                                               .Width(80)
                                                               .Height(80)
                                                               .Image(qrBytes);
                                                      }
                                                      catch
                                                      {
                                                          qrCol.Item().Text("[QR Code]").FontSize(10).FontColor(QuestPDFColor.FromHex("#6c6f7e"));
                                                      }
                                                  }
                                                  else
                                                  {
                                                      qrCol.Item().Text("No QR").FontSize(10).FontColor(QuestPDFColor.FromHex("#6c6f7e"));
                                                  }
                                              });

                                           // Ticket details column
                                           row.RelativeItem()
                                              .Column(detailCol =>
                                              {
                                                  detailCol.Item()
                                                         .Text(text =>
                                                         {
                                                             text.Span($"Ticket #{ticketIndex + 1}: ").FontSize(11).Bold();
                                                             text.Span(ticket.TicketNumber).FontSize(10).FontColor(QuestPDFColor.FromHex("#6c6f7e"));
                                                         });

                                                  detailCol.Item()
                                                         .Text(text =>
                                                         {
                                                             text.Span("Attendee: ").FontSize(10).Bold();
                                                             text.Span(ticket.AttendeeName).FontSize(10);
                                                         });

                                                  detailCol.Item()
                                                         .Text(text =>
                                                         {
                                                             text.Span("Email: ").FontSize(10).Bold();
                                                             text.Span(ticket.AttendeeEmail).FontSize(10);
                                                         });

                                                  if (!string.IsNullOrEmpty(ticket.SeatNumber))
                                                  {
                                                      detailCol.Item()
                                                             .Text(text =>
                                                             {
                                                                 text.Span("Seat: ").FontSize(10).Bold();
                                                                 text.Span($"{ticket.SeatNumber} ({ticket.Tier})").FontSize(10);
                                                                 if (ticket.SeatPrice.HasValue)
                                                                 {
                                                                     text.Span($" - ₹{ticket.SeatPrice.Value}").FontSize(10);
                                                                 }
                                                             });
                                                  }

                                                  // Status badge (without BorderRadius)
                                                  detailCol.Item()
                                                         .PaddingTop(5)
                                                         .Element(container =>
                                                         {
                                                             container.Background(ticket.IsUsed ? QuestPDFColor.FromHex("#dc3545") : QuestPDFColor.FromHex("#28a745"))
                                                                     .PaddingVertical(2)
                                                                     .PaddingHorizontal(8)
                                                                     .Width(60)
                                                                     .AlignCenter()
                                                                     .Text(ticket.IsUsed ? "USED" : "VALID")
                                                                     .FontSize(8)
                                                                     .Bold()
                                                                     .FontColor(QuestPDFColor.FromHex("#ffffff"));
                                                         });
                                              });
                                       });
                                    
                                    // Add separator between tickets except after last
                                    if (i < booking.Tickets.Count - 1)
                                    {
                                        col.Item().PaddingTop(8).PaddingBottom(8).Text("");
                                    }
                                }
                            }

                            // ── Notice ──────────────────────────────────
                            col.Item()
                               .Background(QuestPDFColor.FromHex("#fff3cd"))
                               .Border(1)
                               .BorderColor(QuestPDFColor.FromHex("#ffc107"))
                               .Padding(10)
                               .Column(noticeCol =>
                               {
                                   noticeCol.Item()
                                          .Text("📌 Important Instructions")
                                          .FontSize(11)
                                          .Bold()
                                          .FontColor(QuestPDFColor.FromHex("#856404"));
                                   
                                   noticeCol.Item()
                                          .PaddingTop(5)
                                          .Text(
                                              "• Please carry this confirmation and a valid ID to the event.\n" +
                                              "• Each ticket has a unique QR code that will be scanned at the entrance.\n" +
                                              "• Tickets are non-transferable.\n" +
                                              "• Screenshots of QR codes are acceptable for entry."
                                          )
                                          .FontSize(9)
                                          .FontColor(QuestPDFColor.FromHex("#856404"));
                               });
                        });

                    // ─────────────────────────────────────────────
                    // FOOTER
                    // ─────────────────────────────────────────────
                    page.Footer()
                        .BorderTop(1)
                        .BorderColor(QuestPDFColor.FromHex("#dee2e6"))
                        .PaddingTop(10)
                        .Row(row =>
                        {
                            row.RelativeItem()
                               .Text($"© {DateTime.UtcNow.Year} EventBook")
                               .FontSize(9)
                               .FontColor(QuestPDFColor.FromHex("#6c6f7e"));

                            row.ConstantItem(200)
                               .AlignRight()
                               .Text(text =>
                               {
                                   text.Span("Page ")
                                       .FontSize(9)
                                       .FontColor(QuestPDFColor.FromHex("#6c6f7e"));
                                   text.CurrentPageNumber()
                                       .FontSize(9)
                                       .FontColor(QuestPDFColor.FromHex("#6c6f7e"));
                                   text.Span(" of ")
                                       .FontSize(9)
                                       .FontColor(QuestPDFColor.FromHex("#6c6f7e"));
                                   text.TotalPages()
                                       .FontSize(9)
                                       .FontColor(QuestPDFColor.FromHex("#6c6f7e"));
                               });
                        });
                });
            }).GeneratePdf();
        }
    }
}