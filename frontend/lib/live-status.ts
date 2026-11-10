// Whether the event stream is open (see features/live). While it is, news
// arrive by themselves and the site asks for them far less often.
let live = false;

export function isLive() {
  return live;
}

export function setLive(value: boolean) {
  live = value;
}
