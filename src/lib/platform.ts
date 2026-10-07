/**
 * True inside the Mac app, whose web view adds "TEOFlowMac" to the user agent.
 * There the calendar is the first screen and the swipe pad (a phone way of writing) is not shown.
 */
export const isMacApp = typeof navigator !== "undefined" && /\bTEOFlowMac\b/.test(navigator.userAgent);

/** The screen the app rests on: the calendar in the Mac app, the home pad everywhere else. */
export const HOME_SCREEN = isMacApp ? "calendar" : "";
