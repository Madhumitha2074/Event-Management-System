import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, OnInit } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { EventService } from '../../../core/services/event.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-image-upload',
  templateUrl: './image-upload.component.html',
  styleUrls: ['./image-upload.component.css']
})
export class ImageUploadComponent implements OnInit {
  @Input() imageUrl: string = '';
  @Input() imageControl?: AbstractControl | null;
  @Output() imageUploaded = new EventEmitter<{ url: string; file?: File }>();
  @Output() imageRemoved = new EventEmitter<void>();

  @ViewChild('fileInput') fileInput!: ElementRef;

  previewUrl: string | null = null;
  fileName: string = '';
  selectedFile: File | null = null;
  uploading = false;
  uploadProgress = 0;

  // Track which method is currently active
  isUrlMode = false;
  isFileMode = false;
  isDragging = false;
  imageLoadError = false;

  constructor(
    private eventService: EventService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    if (this.imageUrl) {
      // Store the FULL URL without truncation
      this.previewUrl = this.imageUrl;
      this.isUrlMode = true;
      this.isFileMode = false;
      this.imageLoadError = false;
      console.log('Initial image URL:', this.previewUrl);
    }
  }

  // ============= IMAGE LOAD HANDLERS =============
  onImageLoad(): void {
    this.imageLoadError = false;
    console.log('Image loaded successfully');
  }

  onImageError(): void {
    this.imageLoadError = true;
    console.error('Image failed to load. URL was:', this.previewUrl);
    
    if (this.isUrlMode && this.previewUrl) {
      this.toastr.warning('Could not load image from URL. The link may be broken or inaccessible.');
    }
  }

  // ============= URL MODE =============
  onUrlChange(event: Event): void {
    const url = (event.target as HTMLInputElement).value;
    
    if (url && url.startsWith('http')) {
      this.isUrlMode = true;
      this.isFileMode = false;
      this.previewUrl = url;  // Store FULL URL
      this.imageLoadError = false;
      this.imageUploaded.emit({ url });
      
      this.selectedFile = null;
      this.fileName = '';
      if (this.fileInput) {
        this.fileInput.nativeElement.value = '';
      }
      console.log('URL updated:', url);
    } else if (!url) {
      this.isUrlMode = false;
      if (!this.selectedFile) {
        this.previewUrl = null;
        this.imageLoadError = false;
      }
    }
  }

  // ============= FILE MODE =============
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      if (file.size > 5 * 1024 * 1024) {
        this.toastr.warning('Image size should be less than 5MB');
        this.resetFileInput();
        return;
      }

      this.isFileMode = true;
      this.isUrlMode = false;
      this.selectedFile = file;
      this.fileName = file.name;
      this.imageLoadError = false;
      
      if (this.imageControl) {
        this.imageControl.setValue('');
      }
      
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.previewUrl = e.target.result;
        console.log('File preview created');
      };
      reader.readAsDataURL(file);

      this.uploadImage(file);
    } else if (file) {
      this.toastr.warning('Please select a valid image file');
      this.resetFileInput();
    }
  }

  // ============= DRAG AND DROP =============
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        const mockEvent = { target: { files: [file] } };
        this.onFileSelected(mockEvent);
      } else {
        this.toastr.warning('Please drop an image file');
      }
    }
  }

  uploadImage(file: File): void {
    this.uploading = true;
    this.uploadProgress = 0;
    
    const formData = new FormData();
    formData.append('image', file);

    this.eventService.uploadImage(formData).subscribe({
      next: (response: any) => {
        this.uploading = false;
        this.uploadProgress = 100;
        if (response && response.imageUrl) {
          // Store the FULL URL from response
          this.imageUploaded.emit({ url: response.imageUrl, file });
          this.toastr.success('Image uploaded successfully');
          this.previewUrl = response.imageUrl;
          this.imageLoadError = false;
          console.log('Upload successful, URL:', response.imageUrl);
          if (this.imageControl) {
            this.imageControl.setValue(response.imageUrl);
          }
        } else {
          this.convertToBase64AndStore(file);
          this.toastr.warning('Upload processed but response was unexpected. Using local preview.');
        }
      },
      error: (error: any) => {
        this.uploading = false;
        this.uploadProgress = 0;
        console.error('Upload error:', error);
        this.toastr.error(error.message || 'Failed to upload image. Using local preview.');
        this.convertToBase64AndStore(file);
      }
    });

    this.simulateUploadProgress();
  }

  simulateUploadProgress(): void {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 10) + 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      this.uploadProgress = Math.min(progress, 100);
    }, 200);
  }

  convertToBase64AndStore(file: File): void {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const base64 = e.target.result;
      this.imageUploaded.emit({ url: base64, file });
      this.previewUrl = base64;
      this.imageLoadError = false;
      if (this.imageControl) {
        this.imageControl.setValue(base64);
      }
    };
    reader.readAsDataURL(file);
  }

  removeImage(): void {
    this.previewUrl = null;
    this.fileName = '';
    this.selectedFile = null;
    this.isUrlMode = false;
    this.isFileMode = false;
    this.isDragging = false;
    this.imageLoadError = false;
    
    if (this.imageControl) {
      this.imageControl.setValue('');
    }
    
    this.imageRemoved.emit();
    this.resetFileInput();
    this.uploadProgress = 0;
    this.uploading = false;
  }

  resetFileInput(): void {
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  get isUrlDisabled(): boolean {
    return this.isFileMode && this.selectedFile !== null;
  }

  get isFileDisabled(): boolean {
    return this.isUrlMode && this.previewUrl !== null && this.previewUrl.startsWith('http');
  }

  get activeModeLabel(): string {
    if (this.isFileMode) return 'File uploaded';
    if (this.isUrlMode) return 'URL provided';
    return 'No image';
  }
}