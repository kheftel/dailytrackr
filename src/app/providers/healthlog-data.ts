import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { AngularFirestore, QueryFn } from "@angular/fire/firestore";
import { format } from "date-fns";
import { Observable, of } from "rxjs";
import { map } from "rxjs/operators";

import { UserData } from "./user-data";

import firebase from "firebase/app";
import "firebase/firestore";
import { Key } from "protractor";

@Injectable({
  providedIn: "root",
})
export class HealthlogData {
  data: any;

  healthlogData: {
    [key: string]: Observable<any>;
  } = {};

  constructor(
    public firestore: AngularFirestore,
    public http: HttpClient,
    public user: UserData
  ) {
    // console.log("healthlog constructor");
    // this.firestore
    //   .collection("healthlog")
    //   .get()
    //   .subscribe((snap) => {
    //     console.log("loaded data:");
    //     snap.forEach((doc) => {
    //       console.log(doc.id);
    //       console.log(doc.data());
    //     });
    //   });
  }

  /**
   * get one previous log entry
   * @param time the timestamp to look before
   */
  getPrevious(time: firebase.firestore.Timestamp) {
    let qFn: QueryFn = (ref) =>
      ref.orderBy("time", "desc").startAfter(time).limit(1);

    return this.firestore
      .collection("healthlog", qFn)
      .get()
      .pipe(
        map((qs) => {
          if(qs.size === 1)
            return qs.docs[0];
          return null;
        })
      );
  }

  getStream(queryText = "", startAfter?: any, max: number = 10) {
    let qFn: QueryFn = startAfter
      ? (ref) => ref.orderBy("time", "desc").startAfter(startAfter).limit(max)
      : (ref) => ref.orderBy("time", "desc").limit(max);

    return this.firestore
      .collection("healthlog", qFn)
      .get()
      .pipe(
        map((qs) => {
          queryText = queryText.toLowerCase().replace(/,|\.|-/g, " ");
          const queryWords = queryText
            .split(" ")
            .filter((w) => !!w.trim().length);

          return qs.docs.filter((doc) => {
            if (queryWords.length === 0) return true;

            let matches = false;
            let symptoms = doc.data().symptoms;
            let mitigations = doc.data().mitigations;
            let time = format(doc.data().time.toDate(), "yyyy-MM-dd h:mm a");
            let notes = doc.data().notes || "";
            queryWords.forEach((word) => {
              for (const key in symptoms) {
                if (key.toLowerCase().indexOf(word) > -1) {
                  matches = true;
                  return;
                }
              }
              for (const mitigation of mitigations) {
                if (mitigation.toLowerCase().indexOf(word) > -1) {
                  matches = true;
                  return;
                }
              }
              if (time.toLowerCase().indexOf(word) > -1) {
                matches = true;
              }
              if (notes.toLowerCase().indexOf(word) > -1) {
                matches = true;
              }
            });

            return matches;
          });
        })
      );
  }

  addLogItem(data: any) {
    return this.firestore.collection("healthlog").add(data);
  }

  updateLogItem(id: string, data: any) {
    return this.firestore.doc("healthlog/" + id).update(data);
  }

  deleteLogItem(id: string) {
    return this.firestore.doc("healthlog/" + id).delete();
  }

  getDateKey(date?: string) {
    if (!date) {
      return format(Date.now(), "yyyy-MM-dd");
    }
    // validation?
    return date;
  }

  loadDate(date?: string) {
    let key: string = this.getDateKey(date);
    if (this.healthlogData[key]) {
      return this.healthlogData[key];
    } else {
      this.healthlogData[key] = this.firestore
        .doc("healthlog/" + key)
        .valueChanges();
      return this.healthlogData[key];
    }
  }

  load(): any {
    if (this.data) {
      return of(this.data);
    } else {
      return this.http
        .get("assets/data/data.json")
        .pipe(map(this.processData, this));
    }
  }

  processData(data: any) {
    // just some good 'ol JS fun with objects and arrays
    // build up the data by linking speakers to sessions
    this.data = data;

    // loop through each day in the schedule
    this.data.schedule.forEach((day: any) => {
      // loop through each timeline group in the day
      day.groups.forEach((group: any) => {
        // loop through each session in the timeline group
        group.sessions.forEach((session: any) => {
          session.speakers = [];
          if (session.speakerNames) {
            session.speakerNames.forEach((speakerName: any) => {
              const speaker = this.data.speakers.find(
                (s: any) => s.name === speakerName
              );
              if (speaker) {
                session.speakers.push(speaker);
                speaker.sessions = speaker.sessions || [];
                speaker.sessions.push(session);
              }
            });
          }
        });
      });
    });

    return this.data;
  }

  getDayList(date?: string): Observable<any[]> {
    return this.loadDate(date).pipe(
      map((doc) => {
        // filter for consumption
        return this.processDayList(doc.items);

        //   let data = doc.data;
        //   let processed: any[] = [];
        //   for (const item of data) {
        //     let processedItem: any = { symptoms: {} };
        //     for (const key in item) {
        //       if(key === 'timestamp') {
        //         processedItem.time = (item[key] as firebase.firestore.Timestamp).toDate();
        //         processedItem.timestamp = item[key];
        //       }
        //       else if(key === 'mitigations') {
        //         processedItem.mitigations = [...item[key]];
        //       }
        //       else {
        //         processedItem.symptoms[key] = item[key];
        //       }
        //     }

        //     processed.push(processedItem);
        //   }
        //   processed.sort(
        //     (a: any, b: any) =>
        //       (a.time as Date).valueOf() - (b.time as Date).valueOf()
        //   );
        //   return processed;
      })
    );
  }

  processDayList(list) {
    let processed: any[] = [];
    for (const item of list) {
      let processedItem: any = { ...item };
      for (const key in item) {
        // convert firebase timestamps to js dates
        if (item[key] instanceof firebase.firestore.Timestamp) {
          processedItem[key] = item[key].toDate();
        }
      }
      processed.push(processedItem);
    }
    processed.sort(
      (a: any, b: any) =>
        (a.time as Date).valueOf() - (b.time as Date).valueOf()
    );

    // for(const item of processed) {
    //   this.firestore.collection('healthlog').add(item);
    // }

    return processed;
  }

  getTimeline(
    dayIndex: number,
    queryText = "",
    excludeTracks: any[] = [],
    segment = "all"
  ) {
    return this.load().pipe(
      map((data: any) => {
        const day = data.schedule[dayIndex];
        day.shownSessions = 0;

        queryText = queryText.toLowerCase().replace(/,|\.|-/g, " ");
        const queryWords = queryText
          .split(" ")
          .filter((w) => !!w.trim().length);

        day.groups.forEach((group: any) => {
          group.hide = true;

          group.sessions.forEach((session: any) => {
            // check if this session should show or not
            this.filterSession(session, queryWords, excludeTracks, segment);

            if (!session.hide) {
              // if this session is not hidden then this group should show
              group.hide = false;
              day.shownSessions++;
            }
          });
        });

        return day;
      })
    );
  }

  filterSession(
    session: any,
    queryWords: string[],
    excludeTracks: any[],
    segment: string
  ) {
    let matchesQueryText = false;
    if (queryWords.length) {
      // of any query word is in the session name than it passes the query test
      queryWords.forEach((queryWord: string) => {
        if (session.name.toLowerCase().indexOf(queryWord) > -1) {
          matchesQueryText = true;
        }
      });
    } else {
      // if there are no query words then this session passes the query test
      matchesQueryText = true;
    }

    // if any of the sessions tracks are not in the
    // exclude tracks then this session passes the track test
    let matchesTracks = false;
    session.tracks.forEach((trackName: string) => {
      if (excludeTracks.indexOf(trackName) === -1) {
        matchesTracks = true;
      }
    });

    // if the segment is 'favorites', but session is not a user favorite
    // then this session does not pass the segment test
    let matchesSegment = false;
    if (segment === "favorites") {
      if (this.user.hasFavorite(session.name)) {
        matchesSegment = true;
      }
    } else {
      matchesSegment = true;
    }

    // all tests must be true if it should not be hidden
    session.hide = !(matchesQueryText && matchesTracks && matchesSegment);
  }

  getSpeakers() {
    return this.load().pipe(
      map((data: any) => {
        return data.speakers.sort((a: any, b: any) => {
          const aName = a.name.split(" ").pop();
          const bName = b.name.split(" ").pop();
          return aName.localeCompare(bName);
        });
      })
    );
  }

  getTracks() {
    return this.load().pipe(
      map((data: any) => {
        return data.tracks.sort();
      })
    );
  }

  getMap() {
    return this.load().pipe(
      map((data: any) => {
        return data.map;
      })
    );
  }
}
