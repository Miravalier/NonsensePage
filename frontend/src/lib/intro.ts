export const IntroRegistry: {
    callback: CallableFunction,
    html: string,
} = { callback: null, html: null };


export function RegisterIntro(callback: CallableFunction, html: string) {
    IntroRegistry.callback = callback;
    IntroRegistry.html = html;
}
