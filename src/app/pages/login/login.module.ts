import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { IonicModule } from "@ionic/angular";

import { LoginPage } from "./login";
import { LoginPageRoutingModule } from "./login-routing.module";
import { FirebaseUIModule } from "firebaseui-angular";

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    LoginPageRoutingModule,
    FirebaseUIModule,
  ],
  declarations: [LoginPage],
})
export class LoginModule {}
