import { Injectable } from "@angular/core";
import { CanLoad, Router } from "@angular/router";
import { Storage } from "@ionic/storage";
import { UserData } from "./user-data";
@Injectable({
  providedIn: "root",
})
export class CheckTutorial implements CanLoad {
  constructor(
    private storage: Storage,
    private router: Router,
    private userData: UserData
  ) {}

  canLoad() {
    return this.storage.get(this.userData.HAS_SEEN_TUTORIAL).then((res) => {
      console.log("checktutorial: " + res);
      if (res) {
        this.router.navigate(["/app/tabs/log"]);
        return false;
      } else {
        return true;
      }
    });
  }
}
