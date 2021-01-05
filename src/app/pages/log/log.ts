import { Component, ViewChild, OnInit } from "@angular/core";
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
export class LogPage implements OnInit {
  // Gets a reference to the list element
  @ViewChild("scheduleList", { static: true }) scheduleList: IonList;

  @ViewChild("infiniteScroll", null) infiniteScroll: IonInfiniteScroll;

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
    this.updateSchedule();

    this.ios = this.config.get("mode") === "ios";
  }

  updateSchedule() {
    // Close any open sliding items when the schedule updates
    if (this.scheduleList) {
      this.scheduleList.closeSlidingItems();
    }

    let tmpList = [];
    this.infiniteScroll.disabled = false;
    this.logData.getStream(this.queryText, null, 10).subscribe((docs) => {
      docs.forEach((doc) => {
        tmpList.push(this.prepDoc(doc));
      });
      this.prepList(tmpList);
      this.dataList = tmpList;
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

  prepList(list) {
    for (let i = 0; i < list.length; i++) {
      let item = list[i];
      if (i > 0) {
        let lastItem = list[i - 1];
        let curDate = this.formatDate(item.data.time);
        let lastDate = this.formatDate(lastItem.data.time);
        item.showDatetime = curDate != lastDate;
      }
      else {
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
        // cssClass: 'addlog-modal auto-height',
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
          this.updateSchedule();
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

  loadMore() {
    if (this.dataList.length < 1) return;
    let last = this.dataList[this.dataList.length - 1].data.time;
    let tmpList = [];
    this.logData.getStream(this.queryText, last, 10).subscribe((docs) => {
      docs.forEach((doc) => {
        tmpList.push(this.prepDoc(doc));
      });
      this.dataList.concat(tmpList);
      this.prepList(this.dataList);
      if (docs.length === 10) {
        this.infiniteScroll.complete();
      } else {
        this.infiniteScroll.disabled = true;
      }
    });
  }

  handleInfiniteScroll() {
    this.loadMore();
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
      this.updateSchedule();
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
            this.updateSchedule();

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
