import { Component, ViewChild } from "@angular/core";
import { Router } from "@angular/router";

import { MenuController, IonSlides } from "@ionic/angular";

import { Storage } from "@ionic/storage";
import { UserData } from "../../providers/user-data";

@Component({
  selector: "page-tutorial",
  templateUrl: "tutorial.html",
  styleUrls: ["./tutorial.scss"],
})
export class TutorialPage {
  showSkip = true;

  @ViewChild("slides", { static: true }) slides: IonSlides;

  constructor(
    public menu: MenuController,
    public router: Router,
    public storage: Storage,
    private userData:UserData
  ) {}

  startApp() {
    this.router
      .navigateByUrl("/app/tabs/log")
      .then(() => this.storage.set(this.userData.HAS_SEEN_TUTORIAL, true));
  }

  onSlideChangeStart(event) {
    event.target.isEnd().then((isEnd) => {
      this.showSkip = !isEnd;
    });
  }

  ionViewWillEnter() {
    this.storage.get(this.userData.HAS_SEEN_TUTORIAL).then((res) => {
      if (res === true) {
        this.router.navigateByUrl("/app/tabs/log");
      }
    });

    this.menu.enable(false);
  }

  ionViewDidLeave() {
    // enable the root left menu when leaving the tutorial page
    this.menu.enable(true);
  }
}
