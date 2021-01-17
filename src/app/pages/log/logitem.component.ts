import {
  animate,
  state,
  style,
  transition,
  trigger,
} from "@angular/animations";
import {
  Component,
  Input,
  OnInit,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ElementRef,
} from "@angular/core";

import {
  ControlValueAccessor,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  NG_VALUE_ACCESSOR,
  Validators,
} from "@angular/forms";
import {
  AlertController,
  AnimationController,
  ModalController,
} from "@ionic/angular";

import {
  add,
  isAfter,
  parseISO,
  roundToNearestMinutes,
  format,
  formatISO,
} from "date-fns";
import firebase from "firebase/app";
import "firebase/firestore";
import {
  HealthlogData,
  LogItem,
  LogItemDisplay,
  NumberMap,
  NumberMapChange,
} from "../../providers/healthlog-data";
import { AnimUtil } from "../../util/AnimUtil";
import { DateUtil } from "../../util/DateUtil";
import { LogItemModal } from "./logitem.modal";

export interface LogItemModalResult {
  saved: boolean;
  action: string;
  doc?: firebase.firestore.QueryDocumentSnapshot;
  deletedId?: string;
  msg: string;
}

@Component({
  selector: "app-logitem",
  templateUrl: "./logitem.component.html",
  styleUrls: ["./logitem.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogItemComponent implements OnInit {
  formGroup: FormGroup;

  @Input() logItemId: string;

  _logItem: LogItem;
  @Input() set logItem(item) {
    console.log('logitem: set Logitem');
    const before: LogItem = this._logItem;
    const after: LogItem = item;

    this._logItem = item;
    this.title = DateUtil.formatDateTime(this.logItem.time);
    this.markForCheck();

    // check for changes
    this.processDataChanges(before, after);
  }
  get logItem(): LogItem {
    return this._logItem;
  }

  _state: string;
  @Input()
  set state(v: string) {
    this._state = v;
  }
  get state(): string {
    return this._state;
  }

  @Output()
  edit: EventEmitter<{ logItem: LogItem; id: string }> = new EventEmitter<{
    logItem: LogItem;
    id: string;
  }>();

  title: string;

  constructor(
    private change: ChangeDetectorRef,
    private elementRef: ElementRef,
    private animationCtrl: AnimationController
  ) {}

  ngOnInit() {
    this.title = DateUtil.formatDateTime(this.logItem.time);
  }

  getElementById(id: string): HTMLElement {
    return (this.elementRef.nativeElement as HTMLElement).querySelector(
      `[id="${id}"]`
    );
  }

  markForCheck() {
    this.change.markForCheck();
  }

  onClick() {
    this.edit.emit({ id: this.logItemId, logItem: this.logItem });
  }

  keys(obj: any) {
    return Object.keys(obj).sort();
  }

  hasKeys(obj?: any) {
    if (!obj) return false;
    return Object.keys(obj).length > 0;
  }

  valueToSeverityNegative(value: number) {
    if (value <= 2) return "s1";
    else if (value <= 4) return "s2";
    else if (value <= 6) return "s3";
    else if (value <= 8) return "s4";
    else return "s5";
  }

  valueToSeverityPositive(value: number) {
    if (value <= 1) return "s5";
    else if (value <= 2) return "s4";
    else if (value <= 4) return "s3";
    else if (value <= 7) return "s2";
    else return "s1";
  }

  prepSymptoms(symptoms: any) {
    const ret = [];
    for (const key of this.keys(symptoms)) {
      const item: any = {};
      item.value = symptoms[key];
      item.name = key;
      item.severity = "";
      item.severity = this.valueToSeverityNegative(item.value);
      // if (item.value <= 2) item.severity = "s1";
      // else if (item.value <= 4) item.severity = "s2";
      // else if (item.value <= 6) item.severity = "s3";
      // else if (item.value <= 8) item.severity = "s4";
      // else item.severity = "s5";
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
      item.severity = this.valueToSeverityPositive(item.value);
      // if (item.value <= 1) item.severity = "s5";
      // else if (item.value <= 2) item.severity = "s4";
      // else if (item.value <= 4) item.severity = "s3";
      // else if (item.value <= 7) item.severity = "s2";
      // else item.severity = "s1";
      ret.push(item);
    }
    return ret;
  }

  processDataChanges(before: LogItem, after: LogItem) {
    if (!before) {
      // initial data set, just care about updates
      return;
    }

    const updates: {
      symptom?: NumberMapChange[];
      goodThing?: NumberMapChange[];
    } = {};

    // check for changes
    const symptomUpdates = this.checkNumberMapChanges(
      before ? before.symptoms : {},
      after.symptoms
    );
    if (symptomUpdates.length > 0) updates.symptom = symptomUpdates;

    const goodThingUpdates = this.checkNumberMapChanges(
      before ? before.goodThings : {},
      after.goodThings
    );
    if (goodThingUpdates.length > 0) updates.goodThing = goodThingUpdates;

    if (Object.keys(updates).length > 0) {
      setTimeout(() => {
        console.log("logitem: updates:");
        console.log(updates);

        let count = 0;
        for (const key of ["symptom", "goodThing"]) {
          const changes: NumberMapChange[] = updates[key];
          if (!changes) continue;

          for (const change of changes) {
            if (change.value === "deleted") continue;

            // pulse the row
            const severityColor =
              key === "symptom"
                ? this.valueToSeverityNegative(change.value)
                : this.valueToSeverityPositive(change.value);
            setTimeout(() => {
              this.animationCtrl
                .create()
                .addElement(this.getElementById(key + "-" + change.key))
                .duration(500)
                .keyframes([
                  // {
                  //   offset: 0,
                  //   background: "none",
                  //   transform: "scale(1)",
                  // },
                  {
                    offset: 0,
                    background: `var(--ion-color-${severityColor})`,
                    transform: "scale(1)",
                  },
                  {
                    offset: 1,
                    background: "none",
                    transform: "scale(1)",
                  },
                ])
                .play();
              setTimeout(() => {
                // then pulse the badge
                this.animationCtrl
                  .create()
                  .addElement(
                    this.getElementById(key + "-badge" + "-" + change.key)
                  )
                  .duration(500)
                  .fromTo("transform", "scale(2)", "scale(1)")
                  .play();
              }, 0);
            }, 100 * count);

            count++;
          }
        }

        // if (updates.goodThings) {
        //   for (const change of updates.goodThings) {
        //     if (change.value === "deleted") continue;
        //     let el = this.getElementById("good-thing-badge" + "-" + change.key);
        //     if (el) {
        //       elems.push(el);
        //     }
        //   }
        // }

        // AnimUtil.createMultiple(
        //   this.animationCtrl,
        //   AnimUtil.ANIM_PULSE_2X,
        //   elems
        // ).then(() => {
        //   console.log(
        //     "logitem: animation finished: " + AnimUtil.ANIM_HALF_PULSE
        //   );
        // });
      }, 0);
    }
  }

  /**
   * check changes for NumberMap type items
   * @param before
   * @param after
   */
  checkNumberMapChanges(
    before?: NumberMap,
    after?: NumberMap
  ): NumberMapChange[] {
    const updates: NumberMapChange[] = [];
    const beforeKeys: string[] = before ? Object.keys(before) : [];
    const afterKeys: string[] = after ? Object.keys(after) : [];

    const beforeNotAfter = beforeKeys.filter((v) => !afterKeys.includes(v));
    beforeNotAfter.forEach((key) => {
      updates.push({ key: key, value: "deleted" });
    });

    const afterNotBefore = afterKeys.filter((v) => !beforeKeys.includes(v));
    afterNotBefore.forEach((key) => {
      updates.push({
        key: key,
        value: after[key],
      });
    });

    const both = afterKeys.filter((v) => beforeKeys.includes(v));
    both.forEach((key) => {
      if (before[key] !== after[key]) {
        updates.push({
          key: key,
          value: after[key],
        });
      }
    });

    return updates;
  }
}
