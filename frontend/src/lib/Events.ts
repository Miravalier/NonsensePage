const registeredEvents: { [event: string]: Set<CallableFunction> } = {};


export function deregister(event: string, callback: CallableFunction) {
    let callbackSet = registeredEvents[event]
    if (callbackSet) {
        return;
    }
    callbackSet.delete(callback);
}


export function register(event: string, callback: CallableFunction) {
    let callbackSet = registeredEvents[event]
    if (!callbackSet) {
        callbackSet = new Set();
        registeredEvents[event] = callbackSet;
    }
    callbackSet.add(callback);
}


export async function dispatch(event: string, ...data: any) {
    const callbackSet = registeredEvents[event];
    if (callbackSet) {
        for (const callback of callbackSet) {
            await callback(...data);
        }
    }
}
