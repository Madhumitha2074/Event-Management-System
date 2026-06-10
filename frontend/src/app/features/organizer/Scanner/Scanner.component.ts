import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

declare const Html5Qrcode: any;

@Component({
  selector: 'app-scanner',
  template: `
    <div class="container py-4">
      <div class="row justify-content-center">
        <div class="col-md-8">
          <div class="card shadow-sm">
            <div class="card-header bg-primary text-white">
              <h4 class="mb-0">
                <i class="fas fa-qrcode me-2"></i>Ticket Scanner
              </h4>
            </div>
            <div class="card-body">
              <div class="text-center mb-3">
                <div class="btn-group">
                  <button class="btn btn-primary" (click)="startScanner()" [disabled]="isScanning">
                    <i class="fas fa-play me-1"></i>Start Scanner
                  </button>
                  <button class="btn btn-danger" (click)="stopScanner()" [disabled]="!isScanning">
                    <i class="fas fa-stop me-1"></i>Stop
                  </button>
                </div>
              </div>

              <div id="qr-reader" style="width: 100%; max-width: 500px; margin: 0 auto;"></div>

              <!-- Result Panel -->
              <div class="mt-4" *ngIf="lastResult">
                <div class="alert" [ngClass]="{
                  'alert-success': lastResult.isValid,
                  'alert-danger': !lastResult.isValid
                }">
                  <div class="d-flex align-items-center">
                    <div class="flex-shrink-0">
                      <i class="fas" [ngClass]="{
                        'fa-check-circle fa-3x': lastResult.isValid,
                        'fa-times-circle fa-3x': !lastResult.isValid
                      }"></i>
                    </div>
                    <div class="flex-grow-1 ms-3">
                      <h5 class="mb-1">{{ lastResult.isValid ? '✅ VALID TICKET' : '❌ INVALID TICKET' }}</h5>
                      <p class="mb-0" *ngIf="lastResult.message">{{ lastResult.message }}</p>
                    </div>
                  </div>
                  
                  <div class="mt-3" *ngIf="lastResult.ticketNumber">
                    <table class="table table-sm mb-0">
                      <tr>
                        <td class="fw-bold">Ticket Number:</td>
                        <td>{{ lastResult.ticketNumber }}</td>
                      </tr>
                      <tr>
                        <td class="fw-bold">Attendee:</td>
                        <td>{{ lastResult.attendeeName }}</td>
                      </tr>
                      <tr>
                        <td class="fw-bold">Email:</td>
                        <td>{{ lastResult.attendeeEmail }}</td>
                      </tr>
                      <tr>
                        <td class="fw-bold">Event:</td>
                        <td>{{ lastResult.eventTitle }}</td>
                      </tr>
                      <tr>
                        <td class="fw-bold">Venue:</td>
                        <td>{{ lastResult.venue }}, {{ lastResult.city }}</td>
                      </tr>
                      <tr>
                        <td class="fw-bold">Status:</td>
                        <td>
                          <span class="badge" [ngClass]="lastResult.isUsed ? 'bg-danger' : 'bg-success'">
                            {{ lastResult.isUsed ? 'USED' : 'VALID' }}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </div>
                </div>
              </div>

              <div class="text-muted text-center mt-3 small">
                <i class="fas fa-info-circle me-1"></i>
                Position the QR code in front of the camera to scan
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    #qr-reader {
      border: 2px solid #dee2e6;
      border-radius: 12px;
      overflow: hidden;
    }
    .btn-group {
      gap: 10px;
    }
    table {
      margin-bottom: 0;
    }
    .alert {
      border-radius: 12px;
    }
  `]
})
export class ScannerComponent implements OnInit, OnDestroy {
  html5QrCode: any = null;
  isScanning = false;
  lastResult: any = null;
  private scriptLoaded = false;

  constructor(
    private http: HttpClient,
    private toastr: ToastrService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadHtml5QrcodeScript();
  }

  loadHtml5QrcodeScript(): void {
    if (this.scriptLoaded) return;
    
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
    script.onload = () => {
      this.scriptLoaded = true;
      console.log('Html5Qrcode loaded');
    };
    script.onerror = () => {
      console.error('Failed to load Html5Qrcode script');
      this.toastr.error('Failed to load scanner library', 'Error');
    };
    document.head.appendChild(script);
  }

  startScanner(): void {
    if (!this.scriptLoaded) {
      this.toastr.warning('Scanner is loading, please wait...', 'Loading');
      return;
    }

    if (this.html5QrCode) {
      this.stopScanner();
    }

    const Html5QrcodeLib = (window as any).Html5Qrcode;
    if (!Html5QrcodeLib) {
      this.toastr.error('Scanner library not loaded', 'Error');
      return;
    }

    this.html5QrCode = new Html5QrcodeLib('qr-reader');
    
    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    };

    this.html5QrCode.start(
      { facingMode: 'environment' },
      config,
      (decodedText: string) => {
        this.verifyTicket(decodedText);
      },
      (errorMessage: string) => {
        // Silent fail - just keep scanning
      }
    ).then(() => {
      this.isScanning = true;
      this.toastr.info('Scanner started', 'Ready');
    }).catch((err: any) => {
      console.error('Unable to start scanning:', err);
      this.toastr.error('Unable to access camera. Please check permissions.', 'Error');
    });
  }

  stopScanner(): void {
    if (this.html5QrCode && this.isScanning) {
      this.html5QrCode.stop().then(() => {
        this.isScanning = false;
        this.toastr.info('Scanner stopped', 'Info');
      }).catch((err: any) => {
        console.error('Error stopping scanner:', err);
      });
    }
  }

  verifyTicket(qrData: string): void {
    const token = this.authService.token;
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    this.http.post(`${environment.apiUrl}/bookings/verify-ticket`, { qrData }, { headers })
      .subscribe({
        next: (result: any) => {
          this.lastResult = result;
          
          if (result.isValid) {
            this.playBeep();
            this.toastr.success(`Ticket verified: ${result.attendeeName}`, 'Valid Ticket');
          } else {
            this.toastr.error('Invalid or already used ticket', 'Invalid Ticket');
          }
        },
        error: (error) => {
          this.lastResult = {
            isValid: false,
            message: error.error?.message || 'Ticket verification failed'
          };
          this.toastr.error(this.lastResult.message, 'Verification Failed');
        }
      });
  }

  playBeep(): void {
    try {
      const audio = new Audio();
      audio.src = 'data:audio/wav;base64,U3RlYWx0aCBiZWVw';
      audio.play().catch(e => console.log('Audio not supported'));
    } catch(e) {
      console.log('Beep not supported');
    }
  }

  ngOnDestroy(): void {
    this.stopScanner();
  }
}