export const Fragments: { [name: string]: [string, CallableFunction] } = {};

export function RegisterFragment(name: string, content: string, callback: CallableFunction = null) {
    Fragments[name] = [content, callback];
}
