import { Injectable } from "@angular/core";
import { AngularFireAuth } from "@angular/fire/auth";
import { Storage } from "@ionic/storage";
import { Router } from "@angular/router";

@Injectable({
  providedIn: "root",
})
export class UserData {
  favorites: string[] = [];
  HAS_LOGGED_IN = "hasLoggedIn";
  HAS_SEEN_TUTORIAL = "hasSeenTutorial";
  isInitialAuthLoad: boolean = true;

  constructor(
    public storage: Storage,
    public afAuth: AngularFireAuth,
    public router: Router
  ) {
    // react to firebase auth events
    this.afAuth.authState.subscribe((u) => {
      console.log("login: authState event: " + JSON.stringify(u, null, 2));

      if (u) {
        // user has logged in, or this is an initial auth load
        if (this.isInitialAuthLoad) {
          this.isInitialAuthLoad = false;
        } else {
          this.storage.set(this.HAS_LOGGED_IN, true).then(() => {
            this.setUsername(u.email);
            window.dispatchEvent(new CustomEvent("user:login"));

            this.router.navigateByUrl("/app/tabs/log");
          });
        }
      } else {
        // user has logged out, or this is an initial auth load
        this.storage
          .remove(this.HAS_LOGGED_IN)
          .then(() => {
            return this.storage.remove("username");
          })
          .then(() => {
            window.dispatchEvent(new CustomEvent("user:logout"));
            if (this.isInitialAuthLoad) {
              this.isInitialAuthLoad = false;
            } else {
              this.router.navigateByUrl("/login");
            }
          });
      }
    });
  }

  hasFavorite(sessionName: string): boolean {
    return this.favorites.indexOf(sessionName) > -1;
  }

  addFavorite(sessionName: string): void {
    this.favorites.push(sessionName);
  }

  removeFavorite(sessionName: string): void {
    const index = this.favorites.indexOf(sessionName);
    if (index > -1) {
      this.favorites.splice(index, 1);
    }
  }

  login(username: string): Promise<any> {
    return this.storage.set(this.HAS_LOGGED_IN, true).then(() => {
      this.setUsername(username);
      return window.dispatchEvent(new CustomEvent("user:login"));
    });
  }

  signup(username: string): Promise<any> {
    return this.storage.set(this.HAS_LOGGED_IN, true).then(() => {
      this.setUsername(username);
      return window.dispatchEvent(new CustomEvent("user:signup"));
    });
  }

  logout(): Promise<any> {
    return this.afAuth.signOut();

    // return this.storage
    //   .remove(this.HAS_LOGGED_IN)
    //   .then(() => {
    //     return this.storage.remove("username");
    //   })
    //   .then(() => {
    //     window.dispatchEvent(new CustomEvent("user:logout"));
    //   });
  }

  setUsername(username: string): Promise<any> {
    return this.storage.set("username", username);
  }

  getUsername(): Promise<string> {
    return this.storage.get("username").then((value) => {
      return value;
    });
  }

  isLoggedIn(): Promise<boolean> {
    return this.storage.get(this.HAS_LOGGED_IN).then((value) => {
      return value === true;
    });
  }

  checkHasSeenTutorial(): Promise<string> {
    return this.storage.get(this.HAS_SEEN_TUTORIAL).then((value) => {
      return value;
    });
  }
}
