import { Component, Input, OnInit, Output, EventEmitter } from "@angular/core";

import {
  ControlValueAccessor,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  NG_VALUE_ACCESSOR,
  Validators,
} from "@angular/forms";
import { ModalController } from "@ionic/angular";

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
import { HealthlogData } from "../../providers/healthlog-data";

@Component({
  selector: "add-modal",
  templateUrl: "./add.modal.html",
  styleUrls: ["./add.modal.scss"],
})
export class AddLogModal implements OnInit {
  formGroup: FormGroup;

  @Input() item: any;

  constructor(
    private modalCtrl: ModalController,
    private formBuilder: FormBuilder,
    private logData: HealthlogData
  ) {}

  ngOnInit(): void {
    if (this.item) {
      console.log("modal edit mode");
      console.log(this.item);

      let data = this.item.data;

      let formInitData: any = {
        time: [data.time.toDate().toISOString()],
      };

      let mitigations = [];
      for (const mitigation of data.mitigations) {
        mitigations.push(this.formBuilder.control(mitigation));
      }
      formInitData.mitigations = this.formBuilder.array(mitigations);

      let symptoms = [];
      for (const key in data.symptoms) {
        symptoms.push(
          this.formBuilder.group({
            name: [key],
            value: [data.symptoms[key]],
          })
        );
      }
      formInitData.symptoms = this.formBuilder.array(symptoms);

      this.formGroup = this.formBuilder.group(formInitData);
    } else {
      this.formGroup = this.formBuilder.group({
        time: [new Date().toISOString()],
        symptoms: this.formBuilder.array([
          this.formBuilder.group({
            name: [""],
            value: [""],
          }),
        ]),
        mitigations: this.formBuilder.array([this.formBuilder.control("")]),
      });
    }
  }

  get symptoms() {
    return this.formGroup.get("symptoms") as FormArray;
  }

  get mitigations() {
    return this.formGroup.get("mitigations") as FormArray;
  }

  clickAddSymptom() {
    this.symptoms.push(
      this.formBuilder.group({
        name: [""],
        value: [""],
      })
    );
    console.log(this.symptoms.controls);
  }

  deleteSymptom(i) {
    this.symptoms.removeAt(i);
  }

  clickAddMitigation() {
    this.mitigations.push(this.formBuilder.control(""));
  }

  deleteMitigation(i) {
    this.mitigations.removeAt(i);
  }

  onSaveClick() {
    console.log(this.formGroup.value);

    let data: any = {
      symptoms: {},
      mitigations: [],
    };
    for (const symptom of this.formGroup.value.symptoms) {
      if (symptom.name) data.symptoms[symptom.name] = symptom.value;
    }
    for (const mitigation of this.formGroup.value.mitigations) {
      if (mitigation) data.mitigations.push(mitigation);
    }
    data.time = roundToNearestMinutes(new Date(this.formGroup.value.time), {
      nearestTo: 1,
    });

    if (this.item) {
      this.logData.updateLogItem(this.item.id, data).then(() => {
        this.modalCtrl.dismiss({
          saved: true,
          msg: 'Successfully updated entry ' + format(data.time, "yyyy-MM-dd h:mm a")
        });
      });
    } else {
      this.logData.addLogItem(data).then(() => {
        this.modalCtrl.dismiss({
          saved: true,
          msg: 'Successfully added new entry ' + format(data.time, "yyyy-MM-dd h:mm a")
        });
      });
    }
  }

  //   onSaveClick() {
  //     // grab the values
  //     console.log('modal-timeslot: save');
  //     let start = firebase.firestore.Timestamp.fromDate(
  //       parseISO(this.formGroup.value['startTime'])
  //     );
  //     let end = firebase.firestore.Timestamp.fromDate(
  //       parseISO(this.formGroup.value['endTime'])
  //     );

  //     let slotData: any[] = this.serviceInfo.activeSameDay || [];
  //     if (!this.editMode) {
  //       slotData.push({
  //         start: start,
  //         end: end,
  //       });
  //     } else {
  //       slotData[this.whichSlot].start = start;
  //       slotData[this.whichSlot].end = end;
  //     }
  //     slotData.sort(sortByStartTime);

  //     let updateData: any = {
  //       [this.serviceInfo.serviceId + '.activeSameDay']: slotData,
  //     };

  //     console.log(updateData);

  //     // update the backend
  //     this.backendService
  //       .docRef<BizServices>('biz_services', this.business.businessID)
  //       .update(updateData)
  //       .then(() => {
  //         console.log('modal-timeslot: updated data');
  //         this.dismiss();
  //       });
  //   }

  //   onDeleteClick() {
  //     if (!this.editMode) return;
  //     this.backendService.genericConfirm('Really delete this timeslot?', () => {
  //       this.serviceInfo.activeSameDay.splice(this.whichSlot, 1);

  //       let updateData: any = {
  //         [this.serviceInfo.serviceId + '.activeSameDay']: this.serviceInfo
  //           .activeSameDay,
  //       };

  //       this.backendService
  //         .docRef<BizServices>('biz_services', this.business.businessID)
  //         .update(updateData)
  //         .then(() => {
  //           console.log('modal-timeslot: updated data');
  //           this.dismiss();
  //         });
  //     });
  //   }

  //   soonestValidStarttime(): Date {
  //     // determine the soonest start time for this timeslot
  //     // start with now, round to desired granularity
  //     // if that rounded date is now in the past, bump forward one granularity unit

  //     let start = this.roundDate(new Date());
  //     if (isAfter(Date.now(), start)) {
  //       // add 1 unit of granularity if rounded datetime is in the past
  //       start = add(start, {
  //         minutes: this.granularity,
  //       });
  //     }
  //     return start;
  //   }

  //   soonestValidEndtime(start?: Date): Date {
  //     if (!start) {
  //       start = this.soonestValidStarttime();
  //     }

  //     return add(start, {
  //       minutes: this.granularity,
  //     });
  //   }

  //   formatDate(d: Date): string {
  //     return formatISO(d);
  //   }

  //   formatFirebaseTimestampAsTime(t: firebase.firestore.Timestamp): string {
  //     return this.formatTime(t.toDate());
  //   }

  //   formatTime(d: Date): string {
  //     return format(d, 'h:mm a');
  //   }

  //   roundDate(d: Date) {
  //     return roundToNearestMinutes(d, {
  //       nearestTo: this.granularity,
  //     });
  //   }

  validation_messages = {
    startTime: [
      { type: "nopast", message: "Start time cannot be in the past." },
    ],
    endTime: [
      {
        type: "nopast",
        message: "End time cannot be in the past.",
      },
      {
        type: "nostart",
        message: "End time cannot be the same as or before start time.",
      },
    ],
  };

  dismiss() {
    this.modalCtrl.dismiss({
      data: "hi there",
    });
  }
}
