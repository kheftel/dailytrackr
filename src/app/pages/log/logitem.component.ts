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
import { AlertController, ModalController } from "@ionic/angular";

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
} from "../../providers/healthlog-data";
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
export class LogItemComponent {
  formGroup: FormGroup;

  @Input() logItemId: string;

  @Input() logItem: LogItem;

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

  constructor(private cdr: ChangeDetectorRef) {}

  markForCheck() {
    this.cdr.markForCheck();
  }

  onClick() {
    this.edit.emit({ id: this.logItemId, logItem: this.logItem });
  }

  formatTime(t: Date | firebase.firestore.Timestamp) {
    if (t instanceof firebase.firestore.Timestamp) t = t.toDate();

    return format(t, "h:mm a");
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
}
