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
import { LogItem } from "../../interfaces/healthlog";
import {
  HealthlogData,
} from "../../providers/healthlog-data";

export interface LogItemModalResult {
  saved: boolean;
  action: string;
  id?: string;
  data?: LogItem;
  deletedId?: string;
  msg: string;
}

@Component({
  selector: "logitem-modal",
  templateUrl: "./logitem.modal.html",
  styleUrls: ["./logitem.modal.scss"],
})
export class LogItemModal implements OnInit {
  formGroup: FormGroup;

  @Input() logItem: LogItem;
  @Input() id: string;

  // validationMessages = {
  //   startTime: [
  //     { type: "nopast", message: "Start time cannot be in the past." },
  //   ],
  //   endTime: [
  //     {
  //       type: "nopast",
  //       message: "End time cannot be in the past.",
  //     },
  //     {
  //       type: "nostart",
  //       message: "End time cannot be the same as or before start time.",
  //     },
  //   ],
  // };

  constructor(
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private formBuilder: FormBuilder,
    private logData: HealthlogData
  ) {}

  ngOnInit(): void {
    const dNow = new Date();
    const tNow = firebase.firestore.Timestamp.fromDate(dNow);

    // edit mode - apply passed-in data to form
    if (this.logItem) {
      console.log("modal edit mode: " + this.id);
      console.log(this.logItem);

      // construct the object to build the formgroup with from the passed-in data
      const formInitData: any = {
        time: [this.logItem.time.toDate().toISOString()],
        notes: [this.logItem.notes || ""],
      };

      const symptoms = [];
      for (const key of Object.keys(this.logItem.symptoms).sort()) {
        symptoms.push(
          this.formBuilder.group({
            name: [key],
            value: [this.logItem.symptoms[key]],
          })
        );
      }
      formInitData.symptoms = this.formBuilder.array(symptoms);

      const goodThings = [];
      for (const key of Object.keys(this.logItem.goodThings).sort()) {
        goodThings.push(
          this.formBuilder.group({
            name: [key],
            value: [this.logItem.goodThings[key]],
          })
        );
      }
      formInitData.goodThings = this.formBuilder.array(goodThings);

      const mitigations = [];
      if(!this.logItem.mitigations) this.logItem.mitigations = [];
      for (const mitigation of this.logItem.mitigations.sort()) {
        mitigations.push(this.formBuilder.control(mitigation));
      }
      formInitData.mitigations = this.formBuilder.array(mitigations);

      const accomplishments = [];
      if(!this.logItem.accomplishments) this.logItem.accomplishments = [];
      for (const accomp of this.logItem.accomplishments.sort()) {
        accomplishments.push(this.formBuilder.control(accomp));
      }
      formInitData.accomplishments = this.formBuilder.array(accomplishments);

      // build the form
      this.formGroup = this.formBuilder.group(formInitData);
    } else {
      // add mode, create blank form
      this.formGroup = this.formBuilder.group({
        time: [dNow.toISOString()],
        symptoms: this.formBuilder.array([
          this.formBuilder.group({
            name: [""],
            value: [""],
          }),
        ]),
        goodThings: this.formBuilder.array([
          this.formBuilder.group({
            name: [""],
            value: [""],
          }),
        ]),
        mitigations: this.formBuilder.array([this.formBuilder.control("")]),
        accomplishments: this.formBuilder.array([this.formBuilder.control("")]),
        notes: [""],
      });
    }
  }

  get symptoms() {
    return this.formGroup.get("symptoms") as FormArray;
  }

  get goodThings() {
    return this.formGroup.get("goodThings") as FormArray;
  }

  get mitigations() {
    return this.formGroup.get("mitigations") as FormArray;
  }

  get accomplishments() {
    return this.formGroup.get("accomplishments") as FormArray;
  }

  formarrayGetName(which: string) {
    switch (which) {
      case "symptoms":
        return "symptoms";
      case "goodThings":
        return "good things";
      default:
        throw new Error("invalid formarray " + which);
    }
  }

  clickCopyFromPrevious(which: string) {
    if (which !== "symptoms" && which !== "goodThings") {
      throw new Error("clickCopyFromPrevious: invalid formArray " + which);
    }

    const time = firebase.firestore.Timestamp.fromDate(
      new Date(this.formGroup.value.time)
    );
    this.logData.getPrevious(time).subscribe((doc) => {
      if (doc) {
        console.log("previous entry: " + doc.id);
        console.log(doc.data());

        const formarrayData = doc.data()[which];
        const formarrayName: string = this.formarrayGetName(which);
        if (!formarrayData) {
          // none found in previous entry
          return this.alertCtrl
            .create({
              message: `No ${formarrayName} found in previous entry`,
              buttons: ["Ok"],
            })
            .then((alert) => alert.present());
        }

        let formarrayString = "";
        Object.keys(formarrayData).forEach((key) => {
          formarrayString += "<br />" + key + ": " + formarrayData[key];
        });
        return this.alertCtrl
          .create({
            message: `Replace ${formarrayName} with this data?<br />${formarrayString}`,
            buttons: [
              {
                text: "Yes",
                handler: () => this.replaceFormarrayFromDoc(which, doc),
              },
              {
                text: "No",
                role: "cancel",
              },
            ],
          })
          .then((alert) => alert.present());
      } else {
        console.log("no previous entry found");
        return this.alertCtrl
          .create({
            message: "No previous log entry found",
            buttons: ["Ok"],
          })
          .then((alert) => alert.present());
      }
    });
  }

  replaceFormarrayFromDoc(which: string, doc) {
    const subitem = doc.data()[which];
    const formArray: FormArray = this[which];
    formArray.clear();
    Object.keys(subitem).forEach((key) => {
      formArray.push(
        this.formBuilder.group({
          name: [key],
          value: [subitem[key]],
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

  clickAddGoodThing() {
    this.goodThings.push(
      this.formBuilder.group({
        name: [""],
        value: [""],
      })
    );
    console.log(this.goodThings.controls);
  }

  deleteFormarrayItem(which: string, i: number) {
    if (which !== "symptoms" && which !== "goodThings") {
      throw new Error("deleteFormarrayItem: invalid formArray " + which);
    }
    const formarray: FormArray = this[which];

    formarray.removeAt(i);

    // return this.alertCtrl
    //   .create({
    //     message: `Really delete?`,
    //     buttons: [
    //       {
    //         text: "Yes",
    //         handler: () => formarray.removeAt(i),
    //       },
    //       {
    //         text: "No",
    //         role: "cancel",
    //       },
    //     ],
    //   })
    //   .then((alert) => alert.present());
  }

  clickAddMitigation() {
    this.mitigations.push(this.formBuilder.control(""));
  }

  deleteMitigation(i) {
    this.mitigations.removeAt(i);
  }

  clickAddAccomplishment() {
    this.accomplishments.push(this.formBuilder.control(""));
  }

  deleteAccomplishment(i) {
    this.accomplishments.removeAt(i);
  }

  onSaveClick() {
    // console.log(this.formGroup.value);

    const data: LogItem = {
      time: firebase.firestore.Timestamp.fromDate(
        roundToNearestMinutes(new Date(this.formGroup.value.time), {
          nearestTo: 1,
        })
      ),
      symptoms: {},
      goodThings: {},
      mitigations: [],
      accomplishments: [],
      notes: this.formGroup.value.notes,
    };
    for (const symptom of this.formGroup.value.symptoms) {
      if (symptom.name) data.symptoms[symptom.name] = symptom.value;
    }
    for (const goodThing of this.formGroup.value.goodThings) {
      if (goodThing.name) data.goodThings[goodThing.name] = goodThing.value;
    }
    for (const mitigation of this.formGroup.value.mitigations) {
      if (mitigation) data.mitigations.push(mitigation);
    }
    data.mitigations.sort();
    for (const accomp of this.formGroup.value.accomplishments) {
      if (accomp) data.accomplishments.push(accomp);
    }
    data.accomplishments.sort();

    if (this.logItem) {
      data.uid = this.logItem.uid;
      this.logData.updateLogItem(this.id, data).then((doc) => {
        const result: LogItemModalResult = {
          saved: true,
          action: "update",
          data: data,
          id: this.id,
          msg:
            "Successfully updated entry " +
            format(data.time.toDate(), "yyyy-MM-dd h:mm a"),
        };
        this.modalCtrl.dismiss(result);
      });
    } else {
      this.logData.addLogItem(data).then((doc) => {
        const result: LogItemModalResult = {
          saved: true,
          action: "add",
          data: data,
          id: doc.id,
          msg:
            "Successfully added new entry " +
            format(data.time.toDate(), "yyyy-MM-dd h:mm a"),
        };
        this.modalCtrl.dismiss(result);
      });
    }
  }

  onDeleteClick() {
    if (this.logItem) {
      return this.alertCtrl
        .create({
          message: `Really delete this log item?`,
          buttons: [
            {
              text: "Yes",
              handler: () => this.deleteSelf(),
            },
            {
              text: "No",
              role: "cancel",
            },
          ],
        })
        .then((alert) => alert.present());
    }
  }

  deleteSelf() {
    const id: string = this.id;
    this.logData.deleteLogItem(id).then(() => {
      const result: LogItemModalResult = {
        saved: true,
        action: "delete",
        deletedId: id,
        msg:
          "Successfully deleted entry " +
          format(new Date(this.formGroup.value.time), "yyyy-MM-dd h:mm a"),
      };
      this.modalCtrl.dismiss(result);
    });
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
