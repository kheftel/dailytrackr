import { Injectable } from "@angular/core";
import { CanLoad, Router } from "@angular/router";
import { Storage } from "@ionic/storage";
import { UserData } from "./user-data";
@Injectable({
  providedIn: "root",
})
export class CheckLoggedIn implements CanLoad {
  constructor(private storage: Storage, private router: Router, private userData:UserData) {}

  canLoad() {
    return this.userData.isLoggedIn().then((res) => {
      console.log('checkloggedin: ' + res);
      if (res) {
        return true;
      } else {
        this.router.navigate(["/login"]);
        return false;
      }
    });
  }
}
