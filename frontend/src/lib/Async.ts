export class Future<T> {
    promise: Promise<T>;
    resolve_callback: (value: T | PromiseLike<T>) => void;
    reject_callback: (reason?: any) => void;

    constructor() {
        const self = this;
        self.promise = new Promise((resolve, reject) => {
            self.resolve_callback = resolve;
            self.reject_callback = reject;
        });
    }

    resolve(value: T | PromiseLike<T>) {
        this.resolve_callback(value);
    }

    reject(reason?: any) {
        this.reject_callback(reason);
    }

    then(onfulfilled?: (value: T) => T | PromiseLike<T>,
        onrejected?: (reason: any) => PromiseLike<never>) {
        return this.promise.then(onfulfilled, onrejected);
    }
}


export class TimedFuture<T> extends Future<T> {
    timeoutId: number;

    constructor(timeout: number) {
        super();
        const self = this;
        self.timeoutId = setTimeout(() => {
            self.reject(new Error("timeout"));
        }, timeout);
    }

    resolve(value: T | PromiseLike<T>): void {
        clearTimeout(this.timeoutId);
        super.resolve(value);
    }

    reject(reason?: any) {
        clearTimeout(this.timeoutId);
        super.reject(reason);
    }
}


export async function Sleep(timeoutMs: number) {
    await new Promise(resolve => setTimeout(resolve, timeoutMs));
}
