import * as Sqrl from 'squirrelly';
import { Fragments } from './Fragments.ts';
import { Html } from './Elements.ts';
import { Session } from './Requests.ts';
import { IsDefined, RenderDescription } from './Utils.ts';


const fetchCache: { [url: string]: any } = {};
const loadCache: { [url: string]: any } = {};
const config = Sqrl.getConfig({ varName: "data" });


export async function init() {
    Sqrl.helpers.define("gm", function (content, blocks, _config): string {
        // Sort out parameters
        if (content.params.length != 0) {
            throw Error("@gm helper requires 0 parameters");
        }
        if (blocks.length != 0) {
            throw Error("@gm helper requires 0 blocks");
        }

        if (Session.gm) {
            return content.exec();
        }
        else {
            return "";
        }
    });

    Sqrl.helpers.define("fragment", function (content, _blocks, _config): string {
        // Sort out parameters
        if (content.params.length != 2) {
            throw Error("@fragment helper requires 2 parameters");
        }
        const fragment = content.params[0];
        const data = content.params[1];
        // Render output
        const [fragmentTemplate, fragmentCallback] = Fragments[fragment];
        const template = LoadTemplate("fragment-" + fragment, fragmentTemplate);
        if (fragmentCallback && data.helperData) {
            data.helperData.fragmentCallbacks.push(fragmentCallback);
        }
        return template(data);
    });

    Sqrl.helpers.define("description", function (content, _blocks, _config): string {
        // Sort out parameters
        if (content.params.length != 1) {
            throw Error("@description helper requires 1 parameter");
        }
        const description: string = content.params[0];
        return RenderDescription(description);
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
        let secondId = undefined;
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
            secondId = content.params[3];
        }
        if (content.params.length >= 5) {
            throw Error(`@input helper received too many parameters: ${content.params.length}`);
        }
        // Render output
        if (IsDefined(secondId)) {
            return `
                <div class="field">
                    <div class="label">${label}</div>
                    <input data-attr="${id}" class="${id} ${type}" type="${type}" ${attributes.join(" ")}>
                    /
                    <input data-attr="${secondId}" class="${secondId} ${type}" type="${type}" ${attributes.join(" ")}>
                </div>
            `;
        }
        else {
            return `
                <div class="field">
                    <div class="label">${label}</div>
                    <input data-attr="${id}" class="${id} ${type}" type="${type}" ${attributes.join(" ")}>
                </div>
            `;
        }
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


export async function FetchCss(url: string): Promise<HTMLLinkElement> {
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


export function LoadCss(key: string, content: string): HTMLStyleElement {
    let styleElement: HTMLStyleElement = loadCache["css-" + key];
    if (styleElement) {
        return styleElement;
    }

    styleElement = document.createElement("style");
    styleElement.textContent = content;
    document.head.appendChild(styleElement);

    loadCache["css-" + key] = styleElement;
    return styleElement;
}


export async function FetchTemplate(url: string): Promise<(data: any) => string> {
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


export function LoadTemplate(key: string, content: string): (data: any) => string {
    let template: (data: any) => string = loadCache["html-" + key];
    if (template) {
        return template;
    }

    const rawTemplate = Sqrl.compile(content, config);
    template = (data: any) => {
        return rawTemplate(data, config);
    }

    loadCache["html-" + key] = template;
    return template;
}

export function RenderFragment(container: HTMLDivElement, name: string, data: any = {}) {
    const [fragmentTemplate, fragmentCallback] = Fragments[name];
    const template = LoadTemplate("fragment-" + name, fragmentTemplate);
    container.innerHTML = template(data);
    if (fragmentCallback) {
        fragmentCallback(container, data);
    }
}

export function AppendFragment(container: HTMLDivElement, name: string, data: any = {}) {
    const [fragmentTemplate, fragmentCallback] = Fragments[name];
    const template = LoadTemplate("fragment-" + name, fragmentTemplate);
    const element = container.appendChild(Html(template(data)));
    if (fragmentCallback) {
        fragmentCallback(element, data);
    }
    return element;
}
