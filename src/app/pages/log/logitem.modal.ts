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
import { HealthlogData } from "../../providers/healthlog-data";

@Component({
  selector: "logitem-modal",
  templateUrl: "./logitem.modal.html",
  styleUrls: ["./logitem.modal.scss"],
})
export class LogItemModal implements OnInit {
  formGroup: FormGroup;

  @Input() item: any;

  validationMessages = {
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

  constructor(
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private formBuilder: FormBuilder,
    private logData: HealthlogData
  ) {}

  ngOnInit(): void {
    const dNow = new Date();
    const tNow = firebase.firestore.Timestamp.fromDate(dNow);

    if (this.item) {
      console.log("modal edit mode");
      console.log(this.item);

      const data = this.item.data;

      // construct the object to build the formgroup with from the passed-in data
      const formInitData: any = {
        time: [data.time.toDate().toISOString()],
        notes: [data.notes || ""],
      };

      const mitigations = [];
      for (const mitigation of data.mitigations) {
        mitigations.push(this.formBuilder.control(mitigation));
      }
      formInitData.mitigations = this.formBuilder.array(mitigations);

      const symptoms = [];
      for (const key in data.symptoms) {
        symptoms.push(
          this.formBuilder.group({
            name: [key],
            value: [data.symptoms[key]],
          })
        );
      }
      formInitData.symptoms = this.formBuilder.array(symptoms);

      // build the form
      this.formGroup = this.formBuilder.group(formInitData);
    } else {
      this.formGroup = this.formBuilder.group({
        time: [dNow.toISOString()],
        symptoms: this.formBuilder.array([
          this.formBuilder.group({
            name: [""],
            value: [""],
          }),
        ]),
        mitigations: this.formBuilder.array([this.formBuilder.control("")]),
        notes: [""],
      });
    }
  }

  get symptoms() {
    return this.formGroup.get("symptoms") as FormArray;
  }

  get mitigations() {
    return this.formGroup.get("mitigations") as FormArray;
  }

  clickCopyFromPrevious(which: string) {
    const time = firebase.firestore.Timestamp.fromDate(
      new Date(this.formGroup.value.time)
    );
    this.logData.getPrevious(time).subscribe((doc) => {
      if (doc) {
        console.log("previous entry: " + doc.id);
        console.log(doc.data());

        if (which === "symptoms") {
          const symptoms = doc.data().symptoms;
          let symptomString = "<br />";
          Object.keys(symptoms).forEach((key) => {
            symptomString += "<br />" + key + ": " + symptoms[key];
          });
          this.alertCtrl
            .create({
              message: "Replace symptoms with this data?" + symptomString,
              buttons: [
                {
                  text: "Yes",
                  handler: (v) => {
                    this.replaceSymptomsFromDoc(doc);
                    console.log(v);
                  },
                },
                {
                  text: "No",
                  role: "cancel",
                },
              ],
            })
            .then((alert) => alert.present());
        }
      } else {
        console.log("no previous entry found");
        this.alertCtrl
          .create({
            message: "No previous log entry found",
            buttons: ["Ok"],
          })
          .then((alert) => alert.present());
      }
    });
  }

  replaceSymptomsFromDoc(doc) {
    const symptoms = doc.data().symptoms;
    this.symptoms.clear();
    Object.keys(symptoms).forEach((key) => {
      this.symptoms.push(
        this.formBuilder.group({
          name: [key],
          value: [symptoms[key]],
        })
      );
    });
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

    const data: any = {
      time: roundToNearestMinutes(new Date(this.formGroup.value.time), {
        nearestTo: 1,
      }),
      symptoms: {},
      mitigations: [],
      notes: this.formGroup.value.notes,
    };
    for (const symptom of this.formGroup.value.symptoms) {
      if (symptom.name) data.symptoms[symptom.name] = symptom.value;
    }
    for (const mitigation of this.formGroup.value.mitigations) {
      if (mitigation) data.mitigations.push(mitigation);
    }

    if (this.item) {
      this.logData.updateLogItem(this.item.id, data).then(() => {
        this.modalCtrl.dismiss({
          saved: true,
          msg:
            "Successfully updated entry " +
            format(data.time, "yyyy-MM-dd h:mm a"),
        });
      });
    } else {
      this.logData.addLogItem(data).then(() => {
        this.modalCtrl.dismiss({
          saved: true,
          msg:
            "Successfully added new entry " +
            format(data.time, "yyyy-MM-dd h:mm a"),
        });
      });
    }
  }

  onDeleteClick() {
    if (this.item) {
      this.logData.deleteLogItem(this.item.id).then(() => {
        this.modalCtrl.dismiss({
          saved: true,
          msg:
            "Successfully deleted entry " +
            format(new Date(this.formGroup.value.time), "yyyy-MM-dd h:mm a"),
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

  dismiss() {
    this.modalCtrl.dismiss({
      data: "hi there",
    });
  }
}
