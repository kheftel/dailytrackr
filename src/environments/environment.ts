// The file contents for the current environment will overwrite these during build.
// The build system defaults to the dev environment which uses `environment.ts`, but if you do
// `ng build --env=prod` then `environment.prod.ts` will be used instead.
// The list of which env maps to which file can be found in `.angular-cli.json`.
export const environment = {
  production: false,
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  firebase: {
    apiKey: "AIzaSyBWKfwQav4HdEd0xwbKdIi03r0iA-O4mvk",
    authDomain: "dailytrackr.firebaseapp.com",
    projectId: "dailytrackr",
    storageBucket: "dailytrackr.appspot.com",
    messagingSenderId: "486370993385",
    appId: "1:486370993385:web:5b3f295db9155446e5fc78",
    measurementId: "G-4G6QQXKHQF",
  },
};

/*
 * In development mode, to ignore zone related error stack frames such as
 * `zone.run`, `zoneDelegate.invokeTask` for easier debugging, you can
 * import the following file, but please comment it out in production mode
 * because it will have performance impact when throw error
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
