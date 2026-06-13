import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { ToastrModule } from 'ngx-toastr';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { FooterComponent } from './shared/footer/footer.component';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { LocationSelectorComponent } from './shared/location-selector/location-selector.component';

@NgModule({
  declarations: [
    AppComponent, 
    NavbarComponent, 
    FooterComponent
    // Note: LocationSelectorComponent is NOT in declarations because it's standalone
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    AppRoutingModule,
    LocationSelectorComponent, //  Standalone component goes in imports
    ToastrModule.forRoot({ positionClass: 'toast-top-right', timeOut: 3000 })
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }