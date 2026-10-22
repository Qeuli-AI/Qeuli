/** Local calendar day as YYYY-MM-DD. Days roll over at the user's midnight, not UTC's. */
export const localDay = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Hours since local midnight, e.g. 14.5 for 14:30. */
export const hourOfDay = (t = Date.now()) => {
  const d = new Date(t);
  return d.getHours() + d.getMinutes() / 60;
};

/** Timestamp of `hour`:00 local on the same day as `t`. */
export const atHour = (hour, t = Date.now()) => {
  const d = new Date(t);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
};
