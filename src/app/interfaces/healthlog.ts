import firebase from "firebase/app";
import "firebase/firestore";

export interface LogItem {
  time: firebase.firestore.Timestamp;
  symptoms: NumberMap;
  goodThings?: NumberMap;
  mitigations?: string[];
  accomplishments?: string[];
  notes?: string;
  uid?: string;
}

export interface LogItemChange {
  time?: firebase.firestore.Timestamp;
  symptoms?: NumberMapChange[];
  goodThings?: NumberMapChange[];
  mitigations?: string[];
  accomplishments?: string[];
  notes?: string;
}

export interface NumberMap {
  [key: string]: number;
}

export interface NumberMapChange {
  key: string;
  value: number | "deleted";
}

export interface LogItemDisplay {
  data: LogItem;
  doc: firebase.firestore.QueryDocumentSnapshot;
  showDatetime: boolean;
  state: "new" | "initial" | "edited" | "deleted";
}

export function calculateStringArrayChanges(
  before?: string[],
  after?: string[]
): string[] {
  if (!before) return after.sort();
  if (!after) return [];
  return after.filter((v) => !before.includes(v)).sort();
}

/**
 * check changes for NumberMap type items
 * @param before
 * @param after
 */
export function calculateNumberMapChanges(
  before?: NumberMap,
  after?: NumberMap
): NumberMapChange[] {
  const updates: NumberMapChange[] = [];
  const beforeKeys: string[] = before ? Object.keys(before).sort() : [];
  const afterKeys: string[] = after ? Object.keys(after).sort() : [];

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

  return updates.sort((a, b) => (a.key < b.key ? -1 : 1));
}

export function valueToSeverity(value: number, isPositive: boolean) {
  return isPositive
    ? valueToSeverityPositive(value)
    : valueToSeverityNegative(value);
}

export function valueToSeverityNegative(value: number) {
  if (value <= 2) return "s1";
  else if (value <= 4) return "s2";
  else if (value <= 6) return "s3";
  else if (value <= 8) return "s4";
  else return "s5";
}

export function valueToSeverityPositive(value: number) {
  if (value <= 1) return "s5";
  else if (value <= 2) return "s4";
  else if (value <= 4) return "s3";
  else if (value <= 7) return "s2";
  else return "s1";
}
