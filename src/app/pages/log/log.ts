import {
  Component,
  ViewChild,
  OnInit,
  ElementRef,
  AfterViewInit,
  ViewChildren,
  QueryList,
  Renderer2,
  NgZone,
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
  Animation,
  AnimationController,
} from "@ionic/angular";

import { ScheduleFilterPage } from "../schedule-filter/schedule-filter";
import { ConferenceData } from "../../providers/conference-data";
import { UserData } from "../../providers/user-data";
import {
  HealthlogData,
  LogItem,
  LogItemDisplay,
} from "../../providers/healthlog-data";
import { Observable, Subscription } from "rxjs";
import { format, startOfDay } from "date-fns";

import firebase from "firebase/app";
import "firebase/firestore";
import { LogItemModal, LogItemModalResult } from "./logitem.modal";
import { gsap } from "gsap";
import {
  animate,
  AnimationEvent,
  keyframes,
  state,
  style,
  transition,
  trigger,
} from "@angular/animations";
import { AngularFireAuth } from "@angular/fire/auth";
import { LogItemComponent } from "./logitem.component";
import { DateUtil } from "../../util/DateUtil";
import { fi } from "date-fns/locale";

@Component({
  selector: "page-log",
  templateUrl: "log.html",
  styleUrls: ["./log.scss"],
  // animations: [
  //   trigger("itemState", [
  //     state(
  //       "deleted",
  //       style({
  //         transform: "scale(0)",
  //         // opacity: 0,
  //       })
  //     ),
  //     state(
  //       "new",
  //       style({
  //         transform: "scale(0)",
  //         // opacity: 0,
  //       })
  //     ),
  //     state(
  //       "initial",
  //       style({
  //         transform: "none",
  //         filter: "none",
  //         // opacity: 1,
  //       })
  //     ),
  //     state(
  //       "edited",
  //       style({
  //         transform: "scale(1.05)",
  //         filter: "brightness(150%)",
  //       })
  //     ),
  //     transition("new => initial", [animate("500ms 500ms ease-out")]),
  //     transition("initial => deleted", [animate("500ms 500ms ease-in")]),
  //     transition("initial => edited", [animate("250ms 500ms ease-out")]),
  //     transition("edited => initial", [animate("250ms ease-out")]),
  //   ]),
  // ],
})
export class LogPage implements OnInit, AfterViewInit {
  // Gets a reference to the list element
  @ViewChild("logList", { static: true }) logList: IonList;

  @ViewChild("infiniteScroll", {}) infiniteScroll: IonInfiniteScroll;

  @ViewChild("content", { static: true }) content: IonContent;

  @ViewChild("refresher", { static: true }) refresher: IonRefresher;

  @ViewChildren(LogItemComponent) listItems!: QueryList<LogItemComponent>;

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
  dataList: LogItemDisplay[];

  batchSize: number = 20;
  loading: boolean = false;
  noMoreData: boolean = false;

  logSub: Subscription;
  unsub: (() => void)[] = [];
  numSnapshotEvents: number = 0;

  db: firebase.firestore.Firestore;
  user: firebase.User;

  changeQueue: firebase.firestore.DocumentChange[] = [];

  private _hasModal: boolean = false;

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
    public userData: UserData,
    public config: Config,
    private auth: AngularFireAuth,
    public renderer: Renderer2,
    public animationCtrl: AnimationController,
    private ngZone: NgZone,
    private elementRef: ElementRef
  ) {}

  ngOnInit() {
    this.ios = this.config.get("mode") === "ios";

    this.db = firebase.firestore();

    this.auth.authState.subscribe((u) => {
      console.log("log: logged in: " + !!u);
      this.user = u;
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

    // destroy old subscriptions
    if (this.logSub) {
      this.logSub.unsubscribe();
      this.logSub = null;
    }
    if (this.unsub) {
      for (const f of this.unsub) {
        f();
      }
      this.unsub = [];
    }

    // set state
    this.numSnapshotEvents = 0;
    if (this.infiniteScroll) this.infiniteScroll.disabled = false;
    this.noMoreData = false;
    this.loading = true;

    if (!this.queryText) {
      console.log("log: no search terms, subscribing to updates");

      // subscribe to updates
      this.unsub.push(
        this.db
          .collection("healthlog")
          .where("uid", "==", this.user.uid)
          .orderBy("time", "desc")
          .limit(this.batchSize)
          .onSnapshot((qs) => {
            // // no more? disable
            // if (docs.length === 0) {
            //   if (this.infiniteScroll) {
            //     this.infiniteScroll.complete();
            //     this.infiniteScroll.disabled = true;
            //   }
            //   this.noMoreData = true;
            //   if (fromRefresher) {
            //     this.refresher.complete();
            //   }
            //   return;
            // }

            this.numSnapshotEvents++;
            console.log(
              `log: batch listener 1, event #${this.numSnapshotEvents}`
            );

            this.loading = false;
            const tmpList: LogItemDisplay[] = [];

            // on intial load, just add everything to the list and be done
            if (this.numSnapshotEvents === 1) {
              qs.docChanges().forEach((change) => {
                tmpList.push(this.docToLogItem(change.doc));
              });
              this.prepList(tmpList);
              this.dataList = tmpList;
              if (fromRefresher) {
                this.refresher.complete();
              }
              return;
            }

            // on subsequent loads, process changes individually
            qs.docChanges().forEach((change) => {
              this.changeQueue.push(change);
            });

            // process the queue
            let processDelay: number = 0;
            if (this._hasModal) {
              // change is probably from a modal box, delay before processing
              // so the modal can animate off
              processDelay = 1000;
            }
            setTimeout(() => {
              this.processChangeQueue();
            }, processDelay);

            if (fromRefresher) {
              this.refresher.complete();
            }

            // make it load more if needed because of a bug in infinite scroll
            // if (this.infiniteScroll) {
            //   this.infiniteScroll.complete();
            // }
            // this.checkContentTooShortToScroll();
          })
      );

      // would love to use angularfire for this but it has
      // too many weird duplicate modification events
      // for my tastes. rather than dig any further
      // i'm just gonna use firebase sdk
      // this.logSub = this.logData
      //   .getStreamNoSearchQuery(null, this.batchSize)
      //   .stateChanges()
      //   .subscribe((changes) => {
      //     // first batch of items is loaded
      //     changes.forEach((change) => {
      //       let id = change.payload.doc.id;
      //       let data = change.payload.doc.data();
      //       let time = data.time.toDate().toISOString();
      //       let oldItem = this.getItem(id);
      //       let oldData = oldItem ? oldItem.data : null;

      //       let isRealChange = true;
      //       if (change.type === "modified") {
      //         if (JSON.stringify(data) == JSON.stringify(oldData)) {
      //           isRealChange = false;
      //         }
      //         if (
      //           change.payload.doc.metadata.fromCache ||
      //           change.payload.doc.metadata.hasPendingWrites
      //         ) {
      //           isRealChange = false;
      //         }
      //       }

      //       if (isRealChange) {
      //         console.log(
      //           `log: afs change: ${change.type} ${id} ${time} ${change.payload.oldIndex} ${change.payload.newIndex}:`
      //         );
      //         console.log(data);
      //         console.log(oldData);
      //       }
      //     });
      //   });
    }

    // this.logData
    //   .getStream(this.queryText, null, this.batchSize)
    //   .subscribe((docs) => {
    //     this.loading = false;
    //     // first batch of items is loaded

    //     // no more? disable
    //     if (docs.length === 0) {
    //       if (this.infiniteScroll) {
    //         this.infiniteScroll.complete();
    //         this.infiniteScroll.disabled = true;
    //       }
    //       this.noMoreData = true;
    //       if (fromRefresher) {
    //         this.refresher.complete();
    //       }
    //       return;
    //     }

    //     console.log("loaded " + docs.length);
    //     // let days:any = {};
    //     docs.forEach((doc) => {
    //       tmpList.push(this.docToLogItem(doc));

    //       // let curTime = doc.data().time.toDate();
    //       // let date = startOfDay(curTime);
    //       // let label = this.formatDate(date);
    //       // if(days[label] == null) days[label] = 0;
    //       // days[label]++;
    //     });

    //     this.prepList(tmpList);
    //     this.dataList = tmpList;
    //     console.log("data list length = " + this.dataList.length);

    //     // console.log(days);

    //     if (fromRefresher) {
    //       this.refresher.complete();
    //     }

    //     // make it load more if needed because of a bug in infinite scroll
    //     if (this.infiniteScroll) {
    //       this.infiniteScroll.complete();
    //     }
    //     this.checkContentTooShortToScroll();
    //   });

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

  scheduleNextQueueProcessing() {
    setTimeout(() => {
      this.processChangeQueue();
    }, 0);
  }

  processChangeQueue() {
    console.log("log: processChangeQueue");

    if (this.changeQueue.length === 0) {
      console.log("log: change queue is empty");
      return;
    }

    // process one queue item
    let change = this.changeQueue.shift();

    const id = change.doc.id;
    const data: LogItem = change.doc.data() as LogItem;
    const time = data.time.toDate().toISOString();
    const item = this.getItem(id);
    const oldIndex: number = change.oldIndex;
    const newIndex: number = change.newIndex;
    console.log(
      `log: change: ${change.type} ${id} ${time} ${oldIndex} ${newIndex}:`
    );
    console.log(data);

    switch (change.type) {
      case "added":
        // does it already exist in the list? (this shouldn't happen)
        // add it
        this.dataList.splice(
          change.newIndex,
          0,
          this.docToLogItem(change.doc, true)
        );
        // wait a frame for the item to be created, then animate it
        setTimeout(() => {
          this.doAnimAdd(id);
          this.scheduleNextQueueProcessing();
        }, 0);
        break;
      case "modified":
        // find it in list and modify it
        if (!item) throw new Error("could not find item " + id);
        // symptoms
        // let symptomUpdates = [];
        // let oldKeys: string[] = Object.keys(existingData.symptoms);
        // let newKeys: string[] = Object.keys(data.symptoms);

        // let oldNotNew = oldKeys.filter((v) => !newKeys.includes(v));
        // oldNotNew.forEach((key) => {
        //   symptomUpdates.push({ key: key, value: "deleted" });
        // });

        // let newNotOld = newKeys.filter((v) => !oldKeys.includes(v));
        // newNotOld.forEach((key) => {
        //   symptomUpdates.push({
        //     key: key,
        //     value: data.symptoms[key],
        //   });
        // });

        // let both = newKeys.filter((v) => oldKeys.includes(v));
        // both.forEach((key) => {
        //   if (existingData.symptoms[key] !== data.symptoms[key]) {
        //     symptomUpdates.push({
        //       key: key,
        //       value: data.symptoms[key],
        //     });
        //   }
        // });

        // console.log("log: symptom updates:");
        // console.log(symptomUpdates);

        // make sure that the data actually changed???

        // change the data to cause a re-calculation of height
        // this.dataList[oldIndex] = { ...item };
        item.data = { ...data };
        const c = this.getItemComponentById(id);
        c.markForCheck();

        // did it change order?
        if (oldIndex === newIndex) {
          this.doAnimEdit(item.doc.id);
          this.scheduleNextQueueProcessing();
          return;
        }

        // wait a frame for heights to be recalculated
        setTimeout(() => {
          if (oldIndex < 0 || newIndex < 0) {
            throw new Error("invalid indices");
          }
          console.log(`log: item moved from ${oldIndex} to ${newIndex}`);
          const duration = 500;
          const delta: number = newIndex - oldIndex;
          const sign = delta > 0 ? 1 : -1;
          // moved by 1
          if (Math.abs(delta) === 1) {
            const hOld = this.getItemHeightByIndex(oldIndex);
            const hNew = this.getItemHeightByIndex(newIndex);
            const elemOld = this.getItemElementByIndex(oldIndex);
            const elemNew = this.getItemElementByIndex(newIndex);
            this.shiftElementY(elemOld, sign * hNew, duration);
            this.shiftElementY(elemNew, -1 * sign * hOld, duration).then(() => {
              console.log("log: tween end");
              // re lay out the list
              this.prepList(this.dataList);
              this.scheduleNextQueueProcessing();
            });
          } else if (delta > 1) {
            // moved more than 1 position down
            // move all but 1 items up by the height of
            // the item at oldIndex
            const heightToMoveUp = this.getItemHeightByIndex(oldIndex);
            let heightToMoveDown = 0;
            for (let i = oldIndex + 1; i <= newIndex; i++) {
              const e = this.getItemElementByIndex(i);
              this.shiftElementY(e, -1 * heightToMoveUp, duration);
              heightToMoveDown += this.getItemHeightByIndex(i);
            }
            // move 1 item down by the height of the other elements
            this.shiftElementY(
              this.getItemElementByIndex(oldIndex),
              heightToMoveDown,
              duration
            ).then(() => {
              this.prepList(this.dataList);
              this.scheduleNextQueueProcessing();
            });
          } else if (delta < -1) {
            // moved by more than one position up
            // move all but 1 items down by the height of
            // the item at oldIndex
            const heightToMoveDown = this.getItemHeightByIndex(oldIndex);
            let heightToMoveUp = 0;
            for (let i = oldIndex - 1; i >= newIndex; i--) {
              const e = this.getItemElementByIndex(i);
              this.shiftElementY(e, heightToMoveDown, duration);
              heightToMoveUp += this.getItemHeightByIndex(i);
            }
            // move 1 item up by the height of the other elements
            this.shiftElementY(
              this.getItemElementByIndex(oldIndex),
              -1 * heightToMoveUp,
              duration
            ).then(() => {
              this.prepList(this.dataList);
              this.scheduleNextQueueProcessing();
            });
          }
        }, 0);
        break;
      case "removed":
        // it's been deleted! remove from list
        this.doAnimDelete(id).then(() => {
          // if not at end of list, move all remaining items up one slot
          if (oldIndex < this.dataList.length - 1) {
            const heightToMoveUp = this.getItemHeightByIndex(oldIndex);
            for (let i = oldIndex + 1; i < this.dataList.length; i++) {
              const elem = this.getItemElementByIndex(i);
              const p = this.shiftElementY(elem, -1 * heightToMoveUp, 500);
              if (i === this.dataList.length - 1) {
                p.then(() => {
                  // delete from list and re-layout
                  this.dataList.splice(oldIndex, 1);
                  this.prepList(this.dataList);
                  this.scheduleNextQueueProcessing();
                });
              }
            }
          } else {
            this.dataList.splice(oldIndex, 1);
            this.prepList(this.dataList);
            this.scheduleNextQueueProcessing();
          }
        });
        break;
    }
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

  sortByTime(a: LogItemDisplay, b: LogItemDisplay) {
    return a.data.time.valueOf() > b.data.time.valueOf() ? -1 : 1;
  }

  prepList(list: LogItemDisplay[]) {
    list.sort(this.sortByTime);

    // reset the weird bug caused by tweening
    list.forEach((item) => {
      const el = this.getItemElementById(item.doc.id);
      if (el) this.resetElementY(el);
    });

    this.listItems.forEach((c) => {
      c.markForCheck();
    });

    console.log("log: prepList");
    console.log(
      list.map((item) => item.data.time.toDate().toISOString()).join(", ")
    );

    // for (let i = 0; i < list.length; i++) {
    //   const item = list[i];
    //   if (i > 0) {
    //     const lastItem = list[i - 1];
    //     const curDate = DateUtil.formatDate(item.data.time);
    //     const lastDate = DateUtil.formatDate(lastItem.data.time);
    //     item.showDatetime = curDate !== lastDate;
    //   } else {
    //     item.showDatetime = true;
    //   }
    // }

    // next tick, animate in any new items
    // setTimeout(() => {
    //   for (const item of list) {
    //     if (item.state === "new") item.state = "initial";
    //   }
    // }, 0);
  }

  docToLogItem(
    doc: firebase.firestore.QueryDocumentSnapshot,
    shouldAnimate: boolean = false
  ): LogItemDisplay {
    const item: LogItemDisplay = {
      data: doc.data() as LogItem,
      doc: doc,
      showDatetime: false,
      state: shouldAnimate ? "new" : "initial",
    };

    return item;
  }

  getItem(id: string): LogItemDisplay {
    if (!this.dataList) return null;
    return this.dataList.find((v) => v.doc.id === id);
  }

  getItemIndex(id: string): number {
    if (!this.dataList) return -1;
    return this.dataList.findIndex((v) => v.doc.id === id);
  }

  getItemComponentById(id: string): LogItemComponent {
    return this.listItems.find((c) => c.logItemId === id);
  }

  getItemComponentByIndex(index: number): LogItemComponent {
    return this.listItems.find((c, i) => i === index);
  }

  getItemElementForComponent(c: LogItemComponent): HTMLElement {
    if (!c) return null;
    return this.getItemElementById(c.logItemId);
  }

  getItemElementById(id: string): HTMLElement {
    return (this.elementRef.nativeElement as HTMLElement).querySelector(
      `[id="${id}"]`
    );
  }

  getItemElementByIndex(index: number): HTMLElement {
    const c = this.getItemComponentByIndex(index);
    return this.getItemElementForComponent(c);
  }

  getItemElementHeightById(id: string) {
    const elem = this.getItemElementById(id);
    if (elem) return elem.clientHeight;
    return 0;
  }

  getItemHeightByIndex(index: number) {
    const c = this.getItemComponentByIndex(index);
    if (!c) return 0;
    const elem = this.getItemElementById(c.logItemId);
    if (!elem) return 0;
    return elem.clientHeight;
  }

  patchItem(item: LogItemDisplay) {
    const index: number = this.getItemIndex(item.doc.id);

    if (index >= 0) {
      this.dataList[index].data = item.data;
      this.prepList(this.dataList);
    }
  }

  onClickEdit(event: { id: string; logItem: LogItem }) {
    console.log("log: edit");
    console.log(event.id);
    console.log(event.logItem);

    // let el = this.getItemElementById(event.id);
    // this.ngZone.run(() => {
    //   this.shiftItemElementY(el, 10, 500).then(() => {
    //     // this.renderer.setStyle(el, "transform", "translateY(0)");
    //     // this.shiftItemElementY(el, 0, 10);
    //   });
    // });

    // return;

    const itemDisplay = this.getItem(event.id);
    this._hasModal = true;
    this.modalCtrl
      .create({
        component: LogItemModal,
        // cssClass: 'addlog-modal auto-height',
        componentProps: {
          id: event.id,
          logItem: event.logItem,
        },
      })
      .then((modal) => {
        console.log("log: presenting modal");
        modal.present();
        console.log("log: modal presented");
        modal.onWillDismiss().then((result) => {
          this._hasModal = false;
          this.onModalDismissed(result.data);
        });
      });
  }

  add() {
    // bring up the add box
    this._hasModal = true;
    this.modalCtrl
      .create({
        component: LogItemModal,
        componentProps: {},
      })
      .then((modal) => {
        modal.present();
        modal.onWillDismiss().then((result) => {
          this._hasModal = false;
          this.onModalDismissed(result.data);
        });
      });
  }

  onModalDismissed(data: LogItemModalResult) {
    console.log("log: modal dismissed");
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

          // console.log(data.action);
          //   let item: LogItemDisplay;
          //   switch (data.action) {
          //     case "add":
          //       item = this.docToLogItem(data.doc);
          //       item.state = "new";
          //       this.dataList.unshift(item);

          //       // sort the list, add headers
          //       this.prepList(this.dataList);
          //       break;
          //     case "update":
          //       console.log("log: updated item: " + data.doc.id);
          //       console.log(data.doc.data());

          //       item = this.getItem(data.doc.id);
          //       item.doc = data.doc;
          //       item.data = item.doc.data() as LogItem;
          //       item.state = "edited";
          //       break;
          //     case "delete":
          //       console.log("log: deleted:");
          //       console.log(data.deletedId);

          //       // remove from the list after animation
          //       item = this.getItem(data.deletedId);
          //       item.state = "deleted";
          //       break;
          //   }
        });
    }
  }

  keys(obj: any) {
    return Object.keys(obj).sort();
  }

  hasKeys(obj?: any) {
    if (!obj) return false;
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
        console.log("log: data list length = " + this.dataList.length);
        if (this.infiniteScroll) {
          this.infiniteScroll.complete();
        }
        this.checkContentTooShortToScroll();
      });

    const listenerId: number = this.unsub.length + 1;
    this.unsub.push(
      this.db
        .collection("healthlog")
        .where("uid", "==", this.user.uid)
        .orderBy("time", "desc")
        .startAfter(last)
        .limit(this.batchSize)
        .onSnapshot((qs) => {
          console.log("log: listener " + listenerId + " ------------------");
          qs.docChanges().forEach((change) => {
            const id = change.doc.id;
            const data = change.doc.data();
            const time = data.time.toDate().toISOString();
            console.log(
              `log: change: ${change.type} ${id} ${time} ${change.oldIndex} ${change.newIndex}:`
            );
            // console.log(data);
          });
        })
    );
  }

  doAnimDelete(id: string, duration: number = 500): Promise<void> {
    const elem = this.getItemElementById(id);
    return this.animationCtrl
      .create("onDelete")
      .addElement(elem)
      .duration(duration)
      .fromTo("transform", "scale(1)", "scale(0)")
      .play();
  }

  doAnimAdd(id: string, duration: number = 500): Promise<void> {
    const elem = this.getItemElementById(id);
    return this.animationCtrl
      .create("onAdd")
      .addElement(elem)
      .duration(duration)
      .fromTo("transform", "scale(0)", "scale(1)")
      .play();
  }

  doAnimEdit(id: string, duration: number = 1000): Promise<void> {
    const elem = this.getItemElementById(id);
    return this.animationCtrl
      .create("onEdit")
      .addElement(elem)
      .duration(duration / 2)
      .fromTo("transform", "scale(1)", "scale(1.05)")
      .fromTo("filter", "none", "brightness(150%)")
      .play()
      .then(() => {
        return this.animationCtrl
          .create("onEdit2")
          .addElement(elem)
          .duration(duration / 2)
          .fromTo("transform", "scale(1.05)", "scale(1)")
          .fromTo("filter", "brightness(150%)", "none")
          .play();
      });
  }

  shiftElementY(itemElement: HTMLElement, px: number, milliseconds: number) {
    const seconds: number = milliseconds / 1000;
    const elem = itemElement;

    // markForCheck??

    // zero out transform
    // gsap.set(elem, { y: 0 });

    // tween to desired end
    return (
      this.animationCtrl
        .create("shiftItemElementY")
        .addElement(elem)
        .duration(milliseconds)
        // .beforeClearStyles(["transform"])
        .fromTo("transform", "translateY(0px)", `translateY(${px}px)`)
        .afterStyles({ transform: "translateY(0px)" })
        .play()
    );
  }

  resetElementY(elem: HTMLElement) {
    return this.animationCtrl
      .create("resetAnimation")
      .addElement(elem)
      .duration(1)
      .fromTo("transform", "translateY(0)", `translateY(0)`)
      .play();
  }

  shiftListY(
    px: number,
    seconds: number,
    startIndex: number = 0,
    onComplete?: () => void
  ) {
    const cList = this.listItems.toArray();
    const subList = cList.filter((v, i) => i >= startIndex);

    subList.forEach((c) => {
      c.markForCheck();
      const elem = document.getElementById(c.logItemId);
      // this.renderer.setStyle(elem, "transform", "none");
      gsap.set(elem, { y: 0 });
      gsap.to(elem, { y: px, duration: seconds });
    });
    gsap.delayedCall(seconds, () => {
      // reset tween
      subList.forEach((c) => {
        const elem = document.getElementById(c.logItemId);
        gsap.set(elem, { y: 0 });
        // this.renderer.removeStyle(elem, "transform");
      });

      cList.forEach((c) => c.markForCheck());

      if (onComplete) {
        onComplete();
      }
    });
  }

  onAnimationEnd(event: AnimationEvent) {
    // console.log("animation event");
    // console.log(event);
    // console.log(event.element.id);

    console.log(
      "log: animationend: " +
        event.fromState +
        " => " +
        event.toState +
        ": " +
        event.element.id
    );
    // console.log(event);

    const el = event.element;
    const id = el ? el.id : null;
    const cList = this.listItems.toArray();
    const cIndex: number = cList.findIndex((c) => c.logItemId === id);
    const dataIndex: number = this.getItemIndex(id);

    switch (event.toState) {
      case "deleted":
        if (dataIndex >= 0 && cIndex < cList.length - 1) {
          // make everything below the deleted element move up to take its place
          const heightOfDeleted = document.getElementById(id).clientHeight;
          this.shiftListY(-1 * heightOfDeleted, 1, cIndex + 1, () => {
            // remove from model and view
            this.dataList.splice(dataIndex, 1);
            this.prepList(this.dataList);
          });
        }
        break;
      case "edited":
        // cList.forEach((c, i) => console.log(this.getItemHeightByIndex(i)));

        // go back to initial state after editing
        const item = this.getItem(event.element.id);
        item.state = "initial";
        break;
    }
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
    if (this.userData.hasFavorite(sessionData.name)) {
      // Prompt to remove favorite
      this.removeFavorite(slidingItem, sessionData, "Favorite already added");
    } else {
      // Add as a favorite
      this.userData.addFavorite(sessionData.name);

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
            this.userData.removeFavorite(sessionData.name);
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
