import { format } from "date-fns";
import firebase from "firebase/app";
import "firebase/firestore";

export class DateUtil {
  static formatTime(t: Date | firebase.firestore.Timestamp) {
    if (t instanceof firebase.firestore.Timestamp) t = t.toDate();

    return format(t, "h:mm a");
  }

  static formatDateTime(t: Date | firebase.firestore.Timestamp) {
    if (t instanceof firebase.firestore.Timestamp) t = t.toDate();

    return format(t, "yyyy-MM-dd h:mm a");
  }

  static formatDate(t: Date | firebase.firestore.Timestamp) {
    if (t instanceof firebase.firestore.Timestamp) t = t.toDate();

    return format(t, "yyyy-MM-dd");
  }
}
