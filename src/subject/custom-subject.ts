export class CustomSubject<T> {
  private cbs: Function[] = [];

  public next(value: T) {
    this.cbs.forEach((cb) => cb(value));
  }

  public subscribe(cb: (event: T) => void) {
    this.cbs.push(cb);
  }

	public destroy() {
		this.cbs = [];
	}
}
