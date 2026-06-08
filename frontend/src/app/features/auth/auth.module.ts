import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent }    from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { ProfileComponent }  from './profile/profile.component';  // ✅ add
import { FormsModule } from '@angular/forms';

const routes: Routes = [
  { path: 'login',    component: LoginComponent    },
  { path: 'register', component: RegisterComponent },
  { path: 'profile',  component: ProfileComponent  }  // ✅ add
];

@NgModule({
  declarations: [
    LoginComponent,
    RegisterComponent,
    ProfileComponent    // add
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule.forChild(routes)
  ]
})
export class AuthModule {}