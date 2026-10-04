export const DAY_DURATION = 30;
// Horizon crossings for Sky.sunDirectionFromTime's 24° latitude / 6° declination.
const halfDay = Math.acos(-Math.tan(24 * Math.PI / 180) * Math.tan(6 * Math.PI / 180)) * 12 / Math.PI;
export const SUNRISE_HOUR = 12 - halfDay;
export const SUNSET_HOUR = 12 + halfDay;

export function daylightAt(seconds) {
  const progress = Math.max(0, Math.min(1, seconds / DAY_DURATION));
  return SUNRISE_HOUR + (SUNSET_HOUR - SUNRISE_HOUR) * progress;
}
