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
  valueToColor as valueToColor,
  valueToColorNegative,
  valueToColorPositive,
} from "../../interfaces/healthlog";
import { HealthlogData } from "../../providers/healthlog-data";

export interface DailyReport {
  symptoms?: NumberMapStats;
  goodThings?: NumberMapStats;
  mitigations?: string[];
  accomplishments?: string[];
}

export interface NumberMapStats {
  numberStats?: NumberStats[];
  entries?: any[];
}

export interface NumberStats {
  name: string;
  values: number[];
  maxValue: number;
  maxColor: string;
  minValue: number;
  minColor: string;
  avgValue: number;
  avgColor: string;
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
      this.report = {};

      const symptoms = this.calculateNumberMapStats("symptoms", false);
      this.report.symptoms = symptoms.entries.length > 0 ? symptoms : null;
      const goodThings = this.calculateNumberMapStats("goodThings", true);
      this.report.goodThings = goodThings.entries.length > 0 ? goodThings : null;
      this.report.mitigations = this.calculateStringArrayStats("mitigations");
      this.report.accomplishments = this.calculateStringArrayStats(
        "accomplishments"
      );

      console.log(this.report);

      if (this.refresher) this.refresher.complete();
    });
  }

  onRefresh() {
    this.loadDate();
  }

  ionViewWillEnter() {
    // if this isn't the first time we've been shown, reload data
    if (this.dataList != null) this.loadDate();
  }

  addToDay(increment: number) {
    this.curDate = add(this.curDate, { days: increment });
    this.loadDate();
  }

  calculateNumberMapStats(which: string, isPositive: boolean): NumberMapStats {
    const stats: NumberMapStats = {
      numberStats: [],
      entries: [],
    };

    // calculate the list of numbers across all items
    const numberList: string[] = [];
    for (const logItem of this.dataList) {
      const map: NumberMap = logItem[which] as NumberMap;
      if (!map) continue;

      // collect all the number names
      for (const numberName of Object.keys(map)) {
        if (!numberList.includes(numberName)) {
          numberList.push(numberName);
        }
      }
    }
    numberList.sort();

    // create starting stats for each number
    numberList.forEach((numberName) => {
      stats.numberStats.push({
        name: numberName,
        values: [],
        maxValue: -1,
        maxColor: "medium",
        minValue: 999,
        minColor: "medium",
        avgValue: -1,
        avgColor: "medium",
      });
    });

    for (const logItem of this.dataList) {
      const map: NumberMap = logItem[which] as NumberMap;
      if (!map) continue;

      // calculate the entries for the list
      const entry: any = {
        timeLabel: DateUtil.formatTime(logItem.time.toDate()),
        numbers: [],
      };
      numberList.forEach((numberName) => {
        // is there a value for it in this map?
        const value = map[numberName];
        if (value != null) {
          entry.numbers.push({
            name: numberName,
            value: value,
            color: valueToColor(value, isPositive),
          });
        } else {
          entry.numbers.push({
            name: numberName,
            value: "n/a",
            color: "medium",
            deemphasized: true,
          });
        }
      });
      stats.entries.push(entry);

      // collect all the values for each number in the number maps
      for (const numberName of Object.keys(map)) {
        const value: number = map[numberName];

        const data = stats.numberStats.find((v) => v.name === numberName);
        // add the value to the values
        data.values.push(value);
      }
    }

    // calculate min/max values etc
    for (const numberStats of stats.numberStats) {
      let sum = 0;
      if (numberStats.values.length > 0) {
        for (const value of numberStats.values) {
          if (numberStats.maxValue < value) numberStats.maxValue = value;
          if (numberStats.minValue > value) numberStats.minValue = value;
          sum += value;
        }
        numberStats.avgValue = sum / numberStats.values.length;
        this.numberStatsSetColor(numberStats, isPositive);
      }
    }

    return stats;
  }

  calculateStringArrayStats(which: string): string[] {
    const stats: string[] = [];
    const count: { [key: string]: number } = {};

    for (const logItem of this.dataList) {
      const stringArray: string[] = logItem[which];

      if (!stringArray) continue;

      for (const item of stringArray) {
        const str: string = item.trim();
        if (!stats.includes(str)) {
          stats.push(str);
        } else {
          // it's already in there, add a suffix
          if (count[str] == null) {
            count[str] = 2;
          } else {
            count[str]++;
          }
        }
      }
    }

    for (let i = 0; i < stats.length; i++) {
      const str = stats[i];
      if (count[str] != null) {
        stats[i] = str + ` (${count[str]}x)`;
      }
    }

    // sort stats
    stats.sort();
    return stats;
  }

  numberStatsSetColor(n: NumberStats, isPositive: boolean) {
    n.maxColor = valueToColor(n.maxValue, isPositive);
    n.minColor = valueToColor(n.minValue, isPositive);
    n.avgColor = valueToColor(n.avgValue, isPositive);
  }
}
