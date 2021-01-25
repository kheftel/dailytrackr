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
import { Observable, Subscription } from "rxjs";
import { add, format, startOfDay } from "date-fns";

import firebase from "firebase/app";
import "firebase/firestore";
import gsap from "gsap";
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
import { DateUtil } from "../../util/DateUtil";
import { fi } from "date-fns/locale";
import { AnimUtil } from "../../util/AnimUtil";
import {
  LogItem,
  LogItemDisplay,
  NumberMap,
  valueToSeverity,
  valueToSeverityNegative,
  valueToSeverityPositive,
} from "../../interfaces/healthlog";
import { HealthlogData } from "../../providers/healthlog-data";

export interface DailyReport {
  symptoms: NumberMapStats[];
  goodThings: NumberMapStats[];
}

export interface NumberMapStats {
  name: string;
  values: number[];
  maxValue: number;
  maxSeverity: string;
  minValue: number;
  minSeverity: string;
  avgValue: number;
  avgSeverity: string;
  [key: string]: any;
}

@Component({
  selector: "page-report-daily",
  templateUrl: "report-daily.html",
  styleUrls: ["./report-daily.scss"],
})
export class ReportDailyPage implements OnInit {
  // // Gets a reference to the list element
  // @ViewChild("logList", { static: true }) logList: IonList;

  // @ViewChild("infiniteScroll", {}) infiniteScroll: IonInfiniteScroll;

  // @ViewChild("content", { static: true }) content: IonContent;

  @ViewChild("refresher", { static: true }) refresher: IonRefresher;

  // @ViewChildren(LogItemComponent) listItems!: QueryList<LogItemComponent>;

  // scrollElement: HTMLElement;

  ios: boolean;
  dayIndex = 0;

  dataList: LogItem[];

  batchSize: number = 20;
  loading: boolean = false;
  noMoreData: boolean = false;

  logSub: Subscription;
  unsub: (() => void)[] = [];
  numSnapshotEvents: number = 0;

  db: firebase.firestore.Firestore;
  user: firebase.User;

  dateLabel: string;
  curDate: Date;

  report: DailyReport;

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
    this.loading = true;

    this.db = firebase.firestore();

    this.auth.authState.subscribe((u) => {
      console.log("log: logged in: " + !!u);
      this.user = u;
      if (u) {
        this.curDate = new Date();
        this.updateLabel();
        this.loadDate();
      }
    });
  }

  updateLabel() {
    this.dateLabel = DateUtil.formatDate(this.curDate);
  }

  loadDate() {
    this.updateLabel();
    this.loading = true;
    this.dataList = null;

    this.logData.getDayOnce(this.curDate).subscribe((qs) => {
      this.loading = false;
      console.log(
        "daily: " +
          qs.docs.map((v) => v.data().time.toDate().toLocaleString()).join(", ")
      );
      this.dataList = [];
      for (const doc of qs.docs) {
        this.dataList.push(doc.data() as LogItem);
      }

      // process log items... how?
      this.report = { symptoms: [], goodThings: [] };

      this.report.symptoms = this.calculateNumberMapStats('symptoms', false);
      this.report.goodThings = this.calculateNumberMapStats('goodThings', true);
    });
  }

  addToDay(increment: number) {
    this.curDate = add(this.curDate, { days: increment });
    this.loadDate();
  }

  calculateNumberMapStats(which: string, isPositive:boolean): NumberMapStats[] {
    const stats: NumberMapStats[] = [];

    for (const item of this.dataList) {
      const map: NumberMap = item[which];

      if (!map) continue;

      for (const key of Object.keys(map)) {
        // create stats object if it doesn't exist yet
        let data = stats.find((v) => v.name === key);

        if (!data) {
          data = {
            name: key,
            values: [],
            maxValue: -1,
            maxSeverity: "medium",
            minValue: 999,
            minSeverity: "medium",
            avgValue: -1,
            avgSeverity: "medium",
          };
          stats.push(data);
        }

        // add the object
        data.values.push(map[key]);
      }
    }

    // calculate min/max values etc
    for (const item of stats) {
      let sum = 0;
      if (item.values.length > 0) {
        for (const value of item.values) {
          if (item.maxValue < value) item.maxValue = value;
          if (item.minValue > value) item.minValue = value;
          sum += value;
        }
        item.avgValue = sum / item.values.length;
        this.numberMapStatsSetSeverity(item, isPositive);
      }
    }

    // sort stats
    stats.sort((a, b) => (a.name < b.name ? -1 : 1));

    return stats;
  }

  numberMapStatsSetSeverity(n: NumberMapStats, isPositive: boolean) {
    n.maxSeverity = valueToSeverity(n.maxValue, isPositive);
    n.minSeverity = valueToSeverity(n.minValue, isPositive);
    n.avgSeverity = valueToSeverity(n.avgValue, isPositive);
  }
}
