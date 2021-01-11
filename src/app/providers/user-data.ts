import { Injectable } from "@angular/core";
import { AngularFireAuth } from "@angular/fire/auth";
import { Storage } from "@ionic/storage";
import { Router } from "@angular/router";
import { HealthlogData } from "./healthlog-data";

@Injectable({
  providedIn: "root",
})
export class UserData {
  favorites: string[] = [];
  readonly HAS_LOGGED_IN = "hasLoggedIn";
  readonly HAS_SEEN_TUTORIAL = "hasSeenTutorial";
  readonly USERNAME = "username";
  readonly UID = "uid";
  
  private _isInitialAuthLoad: boolean = true;
  private _isLoggedIn: boolean;
  private _uid: string;
  private _username: string;

  constructor(
    public storage: Storage,
    public afAuth: AngularFireAuth,
    public router: Router
  ) {
    // react to firebase auth events
    this.afAuth.authState.subscribe(async (u) => {
      console.log("userdata: logged in: " + !!u);

      if (u) {
        // user has logged in, or this is an initial auth load
        this._isLoggedIn = true;
        await this.storage.set(this.HAS_LOGGED_IN, true);
        await this.setUsername(u.email);
        await this.setUserId(u.uid);

        if (!this._isInitialAuthLoad) {
          window.dispatchEvent(new CustomEvent("user:login"));
          this.router.navigateByUrl("/app/tabs/log");
        } else {
          this._isInitialAuthLoad = false;
        }
      } else {
        // user has logged out, or this is an initial auth load
        this._uid = null;
        this._isLoggedIn = false;
        await this.storage.remove(this.HAS_LOGGED_IN);
        await this.storage.remove(this.USERNAME);
        await this.storage.remove(this.UID);
        window.dispatchEvent(new CustomEvent("user:logout"));

        if (!this._isInitialAuthLoad) {
          this.router.navigateByUrl("/login");
        } else {
          this._isInitialAuthLoad = false;
        }
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
    this._username = username;
    return this.storage.set(this.USERNAME, username);
  }

  setUserId(uid: string): Promise<any> {
    this._uid = uid;
    return this.storage.set(this.UID, uid);
  }

  getUsername(): Promise<string> {
    return this.storage.get(this.USERNAME).then((value) => {
      return value;
    });
  }

  getUserId(): Promise<string> {
    return this.storage.get(this.UID).then((value) => {
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
