using QRCoder;
using System;

namespace EventBooking.API.Services
{
    public interface IQrCodeService
    {
        string? GenerateQrCodeBase64(string data);
        byte[]? GenerateQrCodeBytes(string data);
    }

    public class QrCodeService : IQrCodeService
    {
        public string? GenerateQrCodeBase64(string data)
        {
            try
            {
                using (var qrGenerator = new QRCodeGenerator())
                {
                    var qrCodeData = qrGenerator.CreateQrCode(data, QRCodeGenerator.ECCLevel.Q);
                    using (var qrCode = new PngByteQRCode(qrCodeData))
                    {
                        var qrCodeBytes = qrCode.GetGraphic(20);
                        var result = Convert.ToBase64String(qrCodeBytes);
                        Console.WriteLine($"QR Code Base64 generated for data: {data}, Length: {result.Length}");
                        return result;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"QR Code Base64 generation failed: {ex.Message}");
                return null;
            }
        }

        public byte[]? GenerateQrCodeBytes(string data)
        {
            try
            {
                using (var qrGenerator = new QRCodeGenerator())
                {
                    var qrCodeData = qrGenerator.CreateQrCode(data, QRCodeGenerator.ECCLevel.Q);
                    using (var qrCode = new PngByteQRCode(qrCodeData))
                    {
                        var result = qrCode.GetGraphic(20);
                        Console.WriteLine($"QR Code bytes generated for data: {data}, Length: {result.Length}");
                        return result;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"QR Code bytes generation failed: {ex.Message}");
                return null;
            }
        }
    }
}