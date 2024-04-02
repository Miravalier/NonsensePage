import * as Sqrl from 'squirrelly'
import { TemplateFunction } from 'squirrelly/dist/types/compile';


const templateCache: { [url: string]: any } = {};


export async function init() {
    Sqrl.defaultConfig.useWith = true;
}


export async function loadCss(url: string) {
    let link: HTMLLinkElement = templateCache[url];
    if (link) {
        return link;
    }

    link = document.createElement("link");
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = url;
    link.media = 'all';
    document.querySelector("head").appendChild(link);
    templateCache[url] = link;
    return link;
}


export async function loadTemplate(url: string): Promise<TemplateFunction> {
    let template: TemplateFunction = templateCache[url];
    if (template) {
        return template;
    }

    const response = await fetch(url);
    const text = await response.text();
    template = Sqrl.compile(text);
    templateCache[url] = template;
    return template;
}
