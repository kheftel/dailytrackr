import {
  Component,
  ViewChild,
  OnInit,
  ElementRef,
  AfterViewInit,
} from "@angular/core";
import { Router } from "@angular/router";
import {
  AlertController,
  IonList,
  IonRouterOutlet,
  LoadingController,
  ModalController,
  ToastController,
  Config,
  IonInfiniteScroll,
  IonContent,
  IonRefresher,
} from "@ionic/angular";

import { ScheduleFilterPage } from "../schedule-filter/schedule-filter";
import { ConferenceData } from "../../providers/conference-data";
import { UserData } from "../../providers/user-data";
import {
  HealthlogData,
  LogItem,
  LogItemDisplay,
} from "../../providers/healthlog-data";
import { Observable } from "rxjs";
import { format } from "date-fns";

import firebase from "firebase/app";
import "firebase/firestore";
import { LogItemModal, LogItemModalResult } from "./logitem.modal";
import { TweenLite } from "gsap";
import {
  animate,
  keyframes,
  state,
  style,
  transition,
  trigger,
} from "@angular/animations";
import { AngularFireAuth } from "@angular/fire/auth";
import { th } from "date-fns/locale";

@Component({
  selector: "page-log",
  templateUrl: "log.html",
  styleUrls: ["./log.scss"],
  animations: [
    trigger("itemState", [
      state(
        "deleted",
        style({
          transform: "scale(0)",
          // opacity: 0,
        })
      ),
      state(
        "new",
        style({
          transform: "scale(0)",
          // opacity: 0,
        })
      ),
      state(
        "initial",
        style({
          transform: "scale(1)",
          filter: "none",
          // opacity: 1,
        })
      ),
      state(
        "edited",
        style({
          transform: "scale(1.05)",
          filter: "brightness(150%)",
        })
      ),
      transition("new => initial", [animate("500ms 250ms ease-out")]),
      transition("initial => deleted", [animate("500ms 250ms ease-in")]),
      transition("initial => edited", [animate("250ms 250ms ease-out")]),
      transition("edited => initial", [animate("250ms ease-out")]),
    ]),
  ],
})
export class LogPage implements OnInit, AfterViewInit {
  // Gets a reference to the list element
  @ViewChild("logList", { static: true }) logList: ElementRef;

  @ViewChild("infiniteScroll", {}) infiniteScroll: IonInfiniteScroll;

  @ViewChild("content", { static: true }) content: IonContent;

  @ViewChild("refresher", { static: true }) refresher: IonRefresher;

  scrollElement: HTMLElement;

  ios: boolean;
  dayIndex = 0;
  queryText = "";
  segment = "all";
  excludeTracks: any = [];
  shownSessions: any = [];
  groups: any = [];
  confDate: string;
  showSearchbar: boolean;

  dataList$: Observable<any[]>;
  dataList: LogItemDisplay[] = [];

  batchSize: number = 5;
  loading: boolean = false;
  noMoreData: boolean = false;

  // uid: string;

  constructor(
    public alertCtrl: AlertController,
    public confData: ConferenceData,
    public logData: HealthlogData,
    public loadingCtrl: LoadingController,
    public modalCtrl: ModalController,
    public router: Router,
    public routerOutlet: IonRouterOutlet,
    public toastCtrl: ToastController,
    public user: UserData,
    public config: Config,
    private auth: AngularFireAuth
  ) {}

  ngOnInit() {
    this.ios = this.config.get("mode") === "ios";

    this.auth.authState.subscribe((u) => {
      console.log("log: logged in: " + !!u);
      if (u) {
        this.refreshDataList();
      }
    });
  }

  ngAfterViewInit() {
    this.content.getScrollElement().then((scroll) => {
      this.scrollElement = scroll;
    });

    // this.refreshDataList();

    // this.user.getUserId().then((uid) => {
    //   console.log("log: uid " + uid);
    //   this.uid = uid;
    //   this.refreshDataList();
    // });
  }

  refreshDataList(fromRefresher: boolean = false) {
    // Close any open sliding items when the list updates
    // if (this.logList) {
    //   this.logList.closeSlidingItems();
    // }

    // if (!this.uid) throw new Error("missing uid");

    const tmpList: LogItemDisplay[] = [];
    if (this.infiniteScroll) this.infiniteScroll.disabled = false;
    this.noMoreData = false;
    this.loading = true;
    this.logData
      .getStream(this.queryText, null, this.batchSize)
      .subscribe((docs) => {
        this.loading = false;
        // first batch of items is loaded

        // no more? disable
        if (docs.length === 0) {
          if (this.infiniteScroll) {
            this.infiniteScroll.complete();
            this.infiniteScroll.disabled = true;
          }
          this.noMoreData = true;
          if (fromRefresher) {
            this.refresher.complete();
          }
          return;
        }

        console.log("loaded " + docs.length);
        docs.forEach((doc) => {
          tmpList.push(this.docToLogItem(doc));
        });
        this.prepList(tmpList);
        this.dataList = tmpList;
        console.log("data list length = " + this.dataList.length);

        if (fromRefresher) {
          this.refresher.complete();
        }

        // make it load more if needed because of a bug in infinite scroll
        if (this.infiniteScroll) {
          this.infiniteScroll.complete();
        }
        this.checkContentTooShortToScroll();
      });

    // this.dataList$ = this.logData.getDayList();

    // this.dataList$.subscribe(list => {
    //   console.log(list);
    // });

    this.confData
      .getTimeline(
        this.dayIndex,
        this.queryText,
        this.excludeTracks,
        this.segment
      )
      .subscribe((data: any) => {
        this.shownSessions = data.shownSessions;
        this.groups = data.groups;
      });
  }

  onRefresh() {
    this.refreshDataList(true);
  }

  checkContentTooShortToScroll() {
    // if (!this.infiniteScroll) return;
    // wait one tick to let list height update
    setTimeout(() => {
      if (!this.scrollElement) {
        console.log("log: checktooshorttoscroll: scrollElement is null");
        return;
      }
      const scrollHeight = this.scrollElement.scrollHeight;
      const offsetHeight = this.scrollElement.offsetHeight;

      if (scrollHeight > offsetHeight) {
        // scrolling is enabled
      } else {
        // scrolling is disabled, content is too short
        // load one more batch of docs b/c of infinite scroller bug
        this.handleInfiniteScroll();
      }
    }, 1);
  }

  prepList(list: LogItemDisplay[]) {
    list.sort((a, b) =>
      a.data.time.valueOf() > b.data.time.valueOf() ? -1 : 1
    );

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (i > 0) {
        const lastItem = list[i - 1];
        const curDate = this.formatDate(item.data.time);
        const lastDate = this.formatDate(lastItem.data.time);
        item.showDatetime = curDate !== lastDate;
      } else {
        item.showDatetime = true;
      }
    }

    // next tick, animate in any new items
    setTimeout(() => {
      for (const item of list) {
        if (item.state === "new") item.state = "initial";
      }
    }, 0);
  }

  docToLogItem(doc: firebase.firestore.QueryDocumentSnapshot): LogItemDisplay {
    const item: LogItemDisplay = {
      data: doc.data() as LogItem,
      doc: doc,
      showDatetime: false,
      state: "initial",
    };

    return item;
  }

  getItem(id: string) {
    return this.dataList.find((v) => v.doc.id === id);
  }

  getItemIndex(id: string) {
    return this.dataList.findIndex((v) => v.doc.id === id);
  }

  patchItem(item: LogItemDisplay) {
    const index: number = this.getItemIndex(item.doc.id);

    if (index >= 0) {
      this.dataList[index].data = item.data;
      this.prepList(this.dataList);
    }
  }

  edit(item: LogItemDisplay) {
    this.modalCtrl
      .create({
        component: LogItemModal,
        // cssClass: 'addlog-modal auto-height',
        componentProps: {
          doc: item.doc,
        },
      })
      .then((modal) => {
        modal.present();
        modal.onWillDismiss().then((result) => {
          this.onModalDismissed(result.data);
        });
      });
  }

  add() {
    // bring up the add box
    this.modalCtrl
      .create({
        component: LogItemModal,
        componentProps: {},
      })
      .then((modal) => {
        modal.present();
        modal.onWillDismiss().then((result) => {
          this.onModalDismissed(result.data);
        });
      });
  }

  onModalDismissed(data: LogItemModalResult) {
    if (data && data.saved) {
      this.toastCtrl
        .create({
          header: data.msg || "Successfully saved!",
          duration: 3000,
          buttons: [
            {
              text: "Close",
              role: "cancel",
            },
          ],
        })
        .then((toast) => {
          toast.present();

          console.log(data.action);
          let item: LogItemDisplay;
          switch (data.action) {
            case "add":
              item = this.docToLogItem(data.doc);
              item.state = "new";
              this.dataList.unshift(item);

              // sort the list, add headers
              this.prepList(this.dataList);
              break;
            case "update":
              console.log("log: updated item: " + data.doc.id);
              console.log(data.doc.data());

              item = this.getItem(data.doc.id);
              item.doc = data.doc;
              item.data = item.doc.data() as LogItem;
              item.state = "edited";
              break;
            case "delete":
              console.log("log: deleted:");
              console.log(data.deletedId);

              // remove from the list after animation
              item = this.getItem(data.deletedId);
              item.state = "deleted";
              break;
          }
        });
    }
  }

  onAnimationEnd(event) {
    // console.log("animation event");
    // console.log(event);
    // console.log(event.element.id);

    if (event.toState === "deleted") {
      console.log("deleted: " + event.element.id);
      // remove from array
      const index = this.getItemIndex(event.element.id);
      if (index >= 0) {
        this.dataList.splice(index, 1);
        this.prepList(this.dataList);
      }
    }

    // go back to initial state after editing
    if (event.toState === "edited") {
      const item = this.getItem(event.element.id);
      item.state = "initial";
    }
  }

  formatTime(t: Date | firebase.firestore.Timestamp) {
    if (t instanceof firebase.firestore.Timestamp) t = t.toDate();

    return format(t, "h:mm a");
  }

  formatDateTime(t: Date | firebase.firestore.Timestamp) {
    if (t instanceof firebase.firestore.Timestamp) t = t.toDate();

    return format(t, "yyyy-MM-dd h:mm a");
  }

  formatDate(t: Date | firebase.firestore.Timestamp) {
    if (t instanceof firebase.firestore.Timestamp) t = t.toDate();

    return format(t, "yyyy-MM-dd");
  }

  keys(obj: any) {
    return Object.keys(obj).sort();
  }

  hasKeys(obj?: any) {
    if(!obj) return false;
    return Object.keys(obj).length > 0;
  }

  prepSymptoms(symptoms: any) {
    const ret = [];
    for (const key of this.keys(symptoms)) {
      const item: any = {};
      item.value = symptoms[key];
      item.name = key;
      item.severity = "";
      if (item.value <= 2) item.severity = "s1";
      else if (item.value <= 4) item.severity = "s2";
      else if (item.value <= 6) item.severity = "s3";
      else if (item.value <= 8) item.severity = "s4";
      else item.severity = "s5";
      ret.push(item);
    }
    return ret;
  }

  prepGoodThings(goodThings: any) {
    const ret = [];
    for (const key of this.keys(goodThings)) {
      const item: any = {};
      item.value = goodThings[key];
      item.name = key;
      item.severity = "";
      if (item.value <= 2) item.severity = "s5";
      else if (item.value <= 4) item.severity = "s4";
      else if (item.value <= 6) item.severity = "s3";
      else if (item.value <= 8) item.severity = "s2";
      else item.severity = "s1";
      ret.push(item);
    }
    return ret;
  }

  handleInfiniteScroll() {
    if (this.infiniteScroll && this.infiniteScroll.disabled) {
      return;
    }

    console.log("handleInfiniteScroll");

    const last =
      this.dataList.length > 0
        ? this.dataList[this.dataList.length - 1].data.time
        : null;
    const tmpList = [];
    this.loading = true;
    this.logData
      .getStream(this.queryText, last, this.batchSize)
      .subscribe((docs) => {
        this.loading = false;
        console.log("loaded " + docs.length);

        // no more? disable
        if (docs.length === 0) {
          if (this.infiniteScroll) {
            this.infiniteScroll.complete();
            this.infiniteScroll.disabled = true;
          }
          this.noMoreData = true;
          return;
        }

        // add loaded documents to list
        docs.forEach((doc) => {
          tmpList.push(this.docToLogItem(doc));
        });
        this.dataList = this.dataList.concat(tmpList);
        this.prepList(this.dataList);
        console.log("data list length = " + this.dataList.length);
        if (this.infiniteScroll) {
          this.infiniteScroll.complete();
        }
        this.checkContentTooShortToScroll();
      });
  }

  async presentFilter() {
    const modal = await this.modalCtrl.create({
      component: ScheduleFilterPage,
      swipeToClose: true,
      presentingElement: this.routerOutlet.nativeEl,
      componentProps: { excludedTracks: this.excludeTracks },
    });
    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data) {
      this.excludeTracks = data;
      this.refreshDataList();
    }
  }

  async addFavorite(slidingItem: HTMLIonItemSlidingElement, sessionData: any) {
    if (this.user.hasFavorite(sessionData.name)) {
      // Prompt to remove favorite
      this.removeFavorite(slidingItem, sessionData, "Favorite already added");
    } else {
      // Add as a favorite
      this.user.addFavorite(sessionData.name);

      // Close the open item
      slidingItem.close();

      // Create a toast
      const toast = await this.toastCtrl.create({
        header: `${sessionData.name} was successfully added as a favorite.`,
        duration: 3000,
        buttons: [
          {
            text: "Close",
            role: "cancel",
          },
        ],
      });

      // Present the toast at the bottom of the page
      await toast.present();
    }
  }

  async removeFavorite(
    slidingItem: HTMLIonItemSlidingElement,
    sessionData: any,
    title: string
  ) {
    const alert = await this.alertCtrl.create({
      header: title,
      message: "Would you like to remove this session from your favorites?",
      buttons: [
        {
          text: "Cancel",
          handler: () => {
            // they clicked the cancel button, do not remove the session
            // close the sliding item and hide the option buttons
            slidingItem.close();
          },
        },
        {
          text: "Remove",
          handler: () => {
            // they want to remove this session from their favorites
            this.user.removeFavorite(sessionData.name);
            this.refreshDataList();

            // close the sliding item and hide the option buttons
            slidingItem.close();
          },
        },
      ],
    });
    // now present the alert on top of all other content
    await alert.present();
  }

  async openSocial(network: string, fab: HTMLIonFabElement) {
    const loading = await this.loadingCtrl.create({
      message: `Posting to ${network}`,
      duration: Math.random() * 1000 + 500,
    });
    await loading.present();
    await loading.onWillDismiss();
    fab.close();
  }
}
