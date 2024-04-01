import { FetchHtml } from "./requests.ts";

export class Templates {
    static cache: { [url: string]: any } = {};

    static async loadCss(url: string) {
        let link: HTMLLinkElement = Templates.cache[url];
        if (link) {
            return link;
        }

        link = document.createElement("link");
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = url;
        link.media = 'all';
        document.querySelector("head").appendChild(link);
        Templates.cache[url] = link;
        return link;
    }

    static async loadHtml(url: string): Promise<DocumentFragment> {
        // Try cached template
        let template: HTMLTemplateElement = Templates.cache[url];
        if (template) {
            return document.importNode(template.content, true);
        }

        // Load template from URL
        const html = await FetchHtml(url);
        template = html.querySelector('template');
        document.head.append(template);
        Templates.cache[url] = template;
        return document.importNode(template.content, true);
    }
}


