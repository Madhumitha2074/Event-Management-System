using Microsoft.AspNetCore.Http;

namespace EventBooking.API.Services
{
    public interface IImageService
    {
        Task<ImageUploadResult> SaveImageAsync(IFormFile file);
        Task<bool> DeleteImageAsync(string imageUrl);
        bool IsValidImage(IFormFile file);
    }

    public class ImageUploadResult
    {
        public bool Success { get; set; }
        public string? ImageUrl { get; set; }
        public string? FileName { get; set; }
        public long FileSize { get; set; }
        public string? ErrorMessage { get; set; }
    }
}