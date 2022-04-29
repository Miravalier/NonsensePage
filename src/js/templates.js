import { FetchHtml } from "./requests.js";

export class Templates {
    static cache = {};

    static async loadCss(url) {
        let link = Templates.cache[url];
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

    static async loadHtml(url) {
        // Try cached template
        let template = Templates.cache[url];
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


