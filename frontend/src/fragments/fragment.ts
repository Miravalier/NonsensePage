import * as Templates from "../lib/templates.ts";

export const Fragments: { [name: string]: [string, CallableFunction] } = {};

export function RegisterFragment(name: string, content: string, callback: CallableFunction = null) {
    Fragments[name] = [content, callback];
}

export function RenderFragment(container: HTMLDivElement, name: string, data: any = {}) {
    const [fragmentTemplate, fragmentCallback] = Fragments[name];
    const template = Templates.loadTemplate("fragment-" + name, fragmentTemplate);
    container.innerHTML = template(data);
    fragmentCallback(container, data);
}
