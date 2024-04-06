import * as Sqrl from 'squirrelly';
import { SheetResources } from '../sheets';
import { Fragments } from '../fragments';


const fetchCache: { [url: string]: any } = {};
const loadCache: { [url: string]: any } = {};
const config = Sqrl.getConfig({ varName: "data" });


export async function init() {
    Sqrl.helpers.define("fragment", function (content, _blocks, _config): string {
        // Sort out parameters
        if (content.params.length != 2) {
            throw Error("@fragment helper requires 2 parameters");
        }
        const fragment = content.params[0];
        const data = content.params[1];
        // Render output
        const [fragmentTemplate, fragmentCallback] = Fragments[fragment];
        const template = loadTemplate(fragment + ".fragment.html", fragmentTemplate);
        if (fragmentCallback && data.helperData) {
            data.helperData.fragmentCallbacks.push(fragmentCallback);
        }
        return template(data);
    });

    Sqrl.helpers.define("sheet", function (content, _blocks, _config): string {
        // Sort out parameters
        if (content.params.length != 2) {
            throw Error("@sheet helper requires 2 parameters");
        }
        const sheet = content.params[0];
        const data = content.params[1];
        // Render output
        const { html, css } = SheetResources[sheet + "Sheet"];
        loadCss(sheet + ".css", css);
        const template = loadTemplate(sheet + ".html", html);
        if (data.helperData) {
            data.helperData.sheet.container.classList.add(sheet);
        }
        return template(data);
    });

    Sqrl.helpers.define("textarea", function (content, _blocks, _config): string {
        // Sort out parameters
        if (content.params.length != 1) {
            throw Error("@textarea helper requires 1 parameter");
        }
        const id = content.params[0];
        // Render output
        return `<textarea class="${id}" data-attr="${id}"></textarea>`;
    });

    Sqrl.helpers.define("image", function (content, _blocks, _config): string {
        // Sort out parameters
        if (content.params.length != 1) {
            throw Error("@image helper requires 1 parameter");
        }
        const id = content.params[0];
        // Render output
        return `<img class="${id}" data-attr="${id}">`;
    });

    Sqrl.helpers.define("input", function (content, _blocks, _config): string {
        // Sort out parameters
        let label: string;
        let type = "text";
        let id = "";
        let attributes = [];
        if (content.params.length == 0) {
            throw Error("@input helper requires at least 1 parameter");
        }
        if (content.params.length >= 1) {
            label = content.params[0];
        }
        if (content.params.length >= 2) {
            type = content.params[1];
            let typeParams: string[];
            [type, ...typeParams] = type.split(/ *: */);
            if (type == "number") {
                if (typeParams.length >= 1) {
                    attributes.push(`min="${typeParams[0]}"`);
                }
                if (typeParams.length >= 2) {
                    attributes.push(`max="${typeParams[1]}"`);
                }
                if (typeParams.length >= 3) {
                    attributes.push(`step="${typeParams[2]}"`);
                }
                if (typeParams.length >= 4) {
                    throw Error(`@input helper, number type received too many parameters: ${typeParams.length}`);
                }
            }
        }
        if (content.params.length >= 3) {
            id = content.params[2];
        }
        if (content.params.length >= 4) {
            throw Error(`@input helper received too many parameters: ${content.params.length}`);
        }
        // Render output
        return `
            <div class="field">
                <div class="label">${label}</div>
                <input data-attr="${id}" class="${id} ${type}" type="${type}" ${attributes.join(" ")}>
            </div>
        `;
    });

    Sqrl.helpers.define("select", function (content, _blocks, _config): string {
        // Sort out parameters
        let options: { [key: string]: any } = {};
        let label: string;
        let type = "text";
        let id = "";
        if (content.params.length <= 1) {
            throw Error("@select helper requires at least 2 parameters");
        }
        if (content.params.length >= 2) {
            options = content.params[0];
            label = content.params[1];
        }
        if (content.params.length >= 3) {
            type = content.params[2];
        }
        if (content.params.length >= 4) {
            id = content.params[3];
        }
        if (content.params.length >= 5) {
            throw Error(`@select helper received too many parameters: ${content.params.length}`);
        }
        let optionElements: string[] = [];
        for (const [key, value] of Object.entries(options)) {
            optionElements.push(`<option value="${value}">${key}</option>`);
        }
        // Render output
        return `
            <div class="field">
                <div class="label">${label}</div>
                <select data-attr="${id}" class="${id} ${type}">
                    ${optionElements.join(" ")}
                </select>
            </div>
        `;
    });
}


export async function fetchCss(url: string): Promise<HTMLLinkElement> {
    let link: HTMLLinkElement = fetchCache[url];
    if (link) {
        return link;
    }

    link = document.createElement("link");
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = url;
    link.media = 'all';
    document.head.appendChild(link);
    fetchCache[url] = link;
    return link;
}


export function loadCss(key: string, content: string): HTMLStyleElement {
    let styleElement: HTMLStyleElement = loadCache[key];
    if (styleElement) {
        return styleElement;
    }

    styleElement = document.createElement("style");
    styleElement.textContent = content;
    document.head.appendChild(styleElement);

    loadCache[key] = styleElement;
    return styleElement;
}


export async function fetchTemplate(url: string): Promise<(data: any) => string> {
    let template: (data: any) => string = fetchCache[url];
    if (template) {
        return template;
    }

    const response = await fetch(url);
    const content = await response.text();

    const rawTemplate = Sqrl.compile(content, config);
    template = (data: any) => {
        return rawTemplate(data, config);
    }

    fetchCache[url] = template;
    return template;
}


export function loadTemplate(key: string, content: string): (data: any) => string {
    let template: (data: any) => string = loadCache[key];
    if (template) {
        return template;
    }

    const rawTemplate = Sqrl.compile(content, config);
    template = (data: any) => {
        return rawTemplate(data, config);
    }

    loadCache[key] = template;
    return template;
}
