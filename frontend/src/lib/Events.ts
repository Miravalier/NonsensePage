const registeredEvents: { [event: string]: CallableFunction[] } = {};


export async function register(event: string, callback: CallableFunction) {
    let callbackArray = registeredEvents[event]
    if (!callbackArray) {
        callbackArray = [];
        registeredEvents[event] = callbackArray;
    }
    callbackArray.push(callback);
}


export async function dispatch(event: string, ...data: any) {
    const callbackArray = registeredEvents[event];
    if (callbackArray) {
        for (const callback of callbackArray) {
            callback(...data);
        }
    }
}
