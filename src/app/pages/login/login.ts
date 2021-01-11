import { Component, OnInit } from "@angular/core";
import { NgForm } from "@angular/forms";
import { Router } from "@angular/router";

import { UserData } from "../../providers/user-data";

import { UserOptions } from "../../interfaces/user-options";
import {
  FirebaseUISignInFailure,
  FirebaseUISignInSuccessWithAuthResult,
} from "firebaseui-angular";
import { AngularFireAuth } from "@angular/fire/auth";

@Component({
  selector: "page-login",
  templateUrl: "login.html",
  styleUrls: ["./login.scss"],
})
export class LoginPage implements OnInit {
  login: UserOptions = { username: "", password: "" };
  submitted = false;

  constructor(
    public userData: UserData,
    public router: Router,
  ) {}

  ngOnInit() {
    // this.afAuth.authState.subscribe((u) => {
    //   console.log("login: authState event: " + JSON.stringify(u, null, 2));
    // });
  }

  // onLogin(form: NgForm) {
  //   this.submitted = true;

  //   if (form.valid) {
  //     this.userData.login(this.login.username);
  //     this.router.navigateByUrl("/app/tabs/schedule");
  //   }
  // }

  // onSignup() {
  //   this.router.navigateByUrl("/signup");
  // }

  uiShownCallback() {
    console.log("login: fbui shown");
  }

  successCallback(data: FirebaseUISignInSuccessWithAuthResult) {
    console.log("login: fbui successCallback", data);
  }

  errorCallback(data: FirebaseUISignInFailure) {
    console.warn("login: fbui errorCallback", data);
  }
}
