export const RulesRegistry: {
    callback: CallableFunction,
    html: string,
} = { callback: null, html: null };


export function RulesRegistryIsEmpty(): boolean {
    return RulesRegistry.html !== null;
}


export function RegisterRules(callback: CallableFunction, html: string) {
    RulesRegistry.callback = callback;
    RulesRegistry.html = html;
}
