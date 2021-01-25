import { HttpClientModule } from "@angular/common/http";
import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { InAppBrowser } from "@ionic-native/in-app-browser/ngx";
import { SplashScreen } from "@ionic-native/splash-screen/ngx";
import { StatusBar } from "@ionic-native/status-bar/ngx";
import { IonicModule } from "@ionic/angular";
import { IonicStorageModule } from "@ionic/storage";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { ServiceWorkerModule } from "@angular/service-worker";
import { environment } from "../environments/environment";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import { AngularFireModule } from "@angular/fire";
import { AngularFireAnalyticsModule } from "@angular/fire/analytics";
import { AngularFirestoreModule } from "@angular/fire/firestore";

import { firebase, firebaseui, FirebaseUIModule } from "firebaseui-angular";
import { AngularFireAuthModule } from "@angular/fire/auth";
import { CommonModule } from "@angular/common";

const firebaseUiAuthConfig: firebaseui.auth.Config = {
  signInFlow: "popup",
  signInOptions: [firebase.auth.EmailAuthProvider.PROVIDER_ID],
  tosUrl: "",
  privacyPolicyUrl: "",
};

@NgModule({
  imports: [
    AngularFireModule.initializeApp(environment.firebase),
    AngularFireAnalyticsModule,
    AngularFirestoreModule,
    AngularFireAuthModule,
    AppRoutingModule,
    BrowserModule,
    BrowserAnimationsModule,
    CommonModule,
    FirebaseUIModule.forRoot(firebaseUiAuthConfig),
    FormsModule,
    HttpClientModule,
    IonicModule.forRoot(),
    IonicStorageModule.forRoot(),
    ReactiveFormsModule,
    ServiceWorkerModule.register("ngsw-worker.js", {
      enabled: environment.production,
    }),
  ],
  declarations: [AppComponent],
  providers: [InAppBrowser, SplashScreen, StatusBar],
  bootstrap: [AppComponent],
})
export class AppModule {}
