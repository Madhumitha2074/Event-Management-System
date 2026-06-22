using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using SixLabors.ImageSharp.Formats.Jpeg;

namespace EventBooking.API.Services
{
    public class ImageService : IImageService  // ← Make sure it implements IImageService
    {
        private readonly IWebHostEnvironment _webHostEnvironment;
        private readonly IConfiguration _configuration;
        private readonly ILogger<ImageService> _logger;
        private readonly string _uploadFolder;
        private readonly string _baseUrl;
        private readonly int _maxFileSize;
        private readonly string[] _allowedExtensions;
        private readonly int _maxWidth;
        private readonly int _maxHeight;
        private readonly int _quality;

        public ImageService(
            IWebHostEnvironment webHostEnvironment,
            IConfiguration configuration,
            ILogger<ImageService> logger)
        {
            _webHostEnvironment = webHostEnvironment;
            _configuration = configuration;
            _logger = logger;

            // Load configuration
            var imageSettings = _configuration.GetSection("ImageSettings");
            _uploadFolder = imageSettings.GetValue<string>("UploadPath") ?? "uploads/events";
            _baseUrl = imageSettings.GetValue<string>("BaseUrl") ?? "https://localhost:5001";
            _maxFileSize = imageSettings.GetValue<int>("MaxFileSize", 5 * 1024 * 1024);
            _allowedExtensions = imageSettings.GetValue<string[]>("AllowedExtensions") ?? 
                new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp" };
            _maxWidth = imageSettings.GetValue<int>("MaxWidth", 1920);
            _maxHeight = imageSettings.GetValue<int>("MaxHeight", 1080);
            _quality = imageSettings.GetValue<int>("Quality", 80);
        }

        public async Task<ImageUploadResult> SaveImageAsync(IFormFile file)
        {
            try
            {
                // Validate file
                if (!IsValidImage(file))
                {
                    return new ImageUploadResult
                    {
                        Success = false,
                        ErrorMessage = "Invalid image file. Please check file type and size."
                    };
                }

                // Generate unique filename
                var extension = Path.GetExtension(file.FileName);
                var fileName = $"{Guid.NewGuid():N}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}{extension}";

                // Create directory if not exists
                var uploadPath = Path.Combine(_webHostEnvironment.WebRootPath, _uploadFolder);
                if (!Directory.Exists(uploadPath))
                {
                    Directory.CreateDirectory(uploadPath);
                }

                // Optimize and save image
                var filePath = Path.Combine(uploadPath, fileName);
                await OptimizeAndSaveImage(file, filePath);

                // Return URL
                var imageUrl = $"{_baseUrl.TrimEnd('/')}/{_uploadFolder}/{fileName}";

                return new ImageUploadResult
                {
                    Success = true,
                    ImageUrl = imageUrl,
                    FileName = fileName,
                    FileSize = file.Length
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving image: {ErrorMessage}", ex.Message);
                return new ImageUploadResult
                {
                    Success = false,
                    ErrorMessage = "Failed to save image. Please try again."
                };
            }
        }

        public async Task<bool> DeleteImageAsync(string imageUrl)
        {
            try
            {
                if (string.IsNullOrEmpty(imageUrl))
                    return false;

                // Extract filename from URL
                var uri = new Uri(imageUrl);
                var fileName = Path.GetFileName(uri.LocalPath);
                var filePath = Path.Combine(_webHostEnvironment.WebRootPath, _uploadFolder, fileName);

                if (File.Exists(filePath))
                {
                    await Task.Run(() => File.Delete(filePath));
                    _logger.LogInformation("Image deleted: {FileName}", fileName);
                    return true;
                }

                _logger.LogWarning("Image not found: {FileName}", fileName);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting image: {ErrorMessage}", ex.Message);
                return false;
            }
        }

        private async Task OptimizeAndSaveImage(IFormFile file, string filePath)
        {
            using var image = await Image.LoadAsync(file.OpenReadStream());

            // Resize if too large
            if (image.Width > _maxWidth || image.Height > _maxHeight)
            {
                image.Mutate(x => x.Resize(new ResizeOptions
                {
                    Mode = ResizeMode.Max,
                    Size = new Size(_maxWidth, _maxHeight)
                }));
            }

            // Save with optimization
            var extension = Path.GetExtension(filePath).ToLower();
            if (extension == ".jpg" || extension == ".jpeg")
            {
                await image.SaveAsync(filePath, new JpegEncoder
                {
                    Quality = _quality
                });
            }
            else
            {
                // Save as original format
                await image.SaveAsync(filePath);
            }

            _logger.LogInformation("Image saved: {FilePath}, Size: {FileSize} bytes", 
                filePath, new FileInfo(filePath).Length);
        }

        public bool IsValidImage(IFormFile file)
        {
            // Check if file exists
            if (file == null || file.Length == 0)
            {
                _logger.LogWarning("Empty file provided");
                return false;
            }

            // Check file size
            if (file.Length > _maxFileSize)
            {
                _logger.LogWarning("File too large: {FileSize} bytes, Max: {MaxSize} bytes", 
                    file.Length, _maxFileSize);
                return false;
            }

            // Check file extension
            var extension = Path.GetExtension(file.FileName).ToLower();
            if (!_allowedExtensions.Contains(extension))
            {
                _logger.LogWarning("Invalid file extension: {Extension}, Allowed: {AllowedExtensions}", 
                    extension, string.Join(", ", _allowedExtensions));
                return false;
            }

            // Check content type
            var allowedContentTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp" };
            if (!allowedContentTypes.Contains(file.ContentType.ToLower()))
            {
                _logger.LogWarning("Invalid content type: {ContentType}", file.ContentType);
                return false;
            }

            return true;
        }
    }
}