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
} from "@ionic/angular";

import { ScheduleFilterPage } from "../schedule-filter/schedule-filter";
import { ConferenceData } from "../../providers/conference-data";
import { UserData } from "../../providers/user-data";
import { HealthlogData } from "../../providers/healthlog-data";
import { Observable } from "rxjs";
import { format } from "date-fns";

import firebase from "firebase/app";
import "firebase/firestore";
import { LogItemModal } from "./logitem.modal";

@Component({
  selector: "page-log",
  templateUrl: "log.html",
  styleUrls: ["./log.scss"],
})
export class LogPage implements OnInit, AfterViewInit {
  // Gets a reference to the list element
  @ViewChild("logList", { static: true }) logList: ElementRef;

  @ViewChild("infiniteScroll", null) infiniteScroll: IonInfiniteScroll;

  @ViewChild("content", { static: true }) content: IonContent;

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
  dataList: any[] = [];

  batchSize: number = 5;

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
    public config: Config
  ) {}

  ngOnInit() {
    this.ios = this.config.get("mode") === "ios";
  }

  ngAfterViewInit() {
    this.content.getScrollElement().then((scroll) => {
      this.scrollElement = scroll;
    });

    this.refreshDataList();

    // let el = document.getElementById('ionInfinite');
    // console.log(el);
  }

  refreshDataList() {
    // Close any open sliding items when the list updates
    // if (this.logList) {
    //   this.logList.closeSlidingItems();
    // }

    let tmpList = [];
    if (this.infiniteScroll) this.infiniteScroll.disabled = false;
    this.logData
      .getStream(this.queryText, null, this.batchSize)
      .subscribe((docs) => {
        // first batch of items is loaded
        console.log("loaded " + docs.length);
        docs.forEach((doc) => {
          tmpList.push(this.prepDoc(doc));
        });
        this.prepList(tmpList);
        this.dataList = tmpList;
        console.log("data list length = " + this.dataList.length);

        // make it load more if needed because of a bug in infinite scroll
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

  checkContentTooShortToScroll() {
    // wait one tick to let list height update
    setTimeout(() => {
      let scrollHeight = this.scrollElement.scrollHeight;
      let offsetHeight = this.scrollElement.offsetHeight;

      if (scrollHeight > offsetHeight) {
        // scrolling is enabled
      } else {
        // scrolling is disabled, content is too short
        // load one more batch of docs b/c of infinite scroller bug
        this.handleInfiniteScroll();
      }
    }, 1);
  }

  prepList(list) {
    for (let i = 0; i < list.length; i++) {
      let item = list[i];
      if (i > 0) {
        let lastItem = list[i - 1];
        let curDate = this.formatDate(item.data.time);
        let lastDate = this.formatDate(lastItem.data.time);
        item.showDatetime = curDate != lastDate;
      } else {
        item.showDatetime = true;
      }
    }
  }

  prepDoc(doc) {
    let item: any = {
      data: doc.data(),
      ref: doc.ref,
      id: doc.id,
    };

    return item;
  }

  edit(item) {
    this.modalCtrl
      .create({
        component: LogItemModal,
        // cssClass: 'addlog-modal auto-height',
        componentProps: {
          item: item,
        },
      })
      .then((modal) => {
        modal.present();
        modal.onWillDismiss().then((value) => {
          this.onModalDismissed(value);
        });
      });
  }

  add() {
    // bring up the add box
    this.modalCtrl
      .create({
        component: LogItemModal,
        // cssClass: 'logitem-modal',
        componentProps: {
          // editMode: editMode,
        },
      })
      .then((modal) => {
        modal.present();
        modal.onWillDismiss().then((value) => {
          this.onModalDismissed(value);
        });
      });
  }

  onModalDismissed(value) {
    if (value.data && value.data.saved) {
      this.toastCtrl
        .create({
          header: value.data.msg || "Successfully saved!",
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
          this.refreshDataList();
        });
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

  prepSymptoms(symptoms: any) {
    let ret = [];
    for (const key of this.keys(symptoms)) {
      let item: any = {};
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

  handleInfiniteScroll() {
    if (!this.infiniteScroll) return;
    if (this.infiniteScroll.disabled) {
      return;
    }

    console.log("handleInfiniteScroll");

    let last =
      this.dataList.length > 0
        ? this.dataList[this.dataList.length - 1].data.time
        : null;
    let tmpList = [];
    this.logData
      .getStream(this.queryText, last, this.batchSize)
      .subscribe((docs) => {
        console.log("loaded " + docs.length);

        // no more? disable
        if (docs.length === 0) {
          this.infiniteScroll.complete();
          this.infiniteScroll.disabled = true;
          return;
        }

        // add loaded documents to list
        docs.forEach((doc) => {
          tmpList.push(this.prepDoc(doc));
        });
        this.dataList = this.dataList.concat(tmpList);
        this.prepList(this.dataList);
        console.log("data list length = " + this.dataList.length);
        this.infiniteScroll.complete();
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
