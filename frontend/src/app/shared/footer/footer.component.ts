import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  template: `
    <footer class="mt-5 py-4 text-center text-white" style="background: #2d3436;">
      <div class="container">
        <p class="mb-1"><i class="fas fa-ticket-alt me-2"></i><strong>EventBook</strong> - Discover & Book Local Events</p>
        <p class="mb-0 text-muted small">&copy; {{ year }} EventBook. All rights reserved.</p>
      </div>
    </footer>
  `
})
export class FooterComponent {
  year = new Date().getFullYear();
}
