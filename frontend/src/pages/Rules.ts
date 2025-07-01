import { RulesRegistry } from "../lib/Rules";
import { Rulesets } from "../rulesets/index.ts";
import { LoadTemplate } from "../lib/Templates.ts";

window.addEventListener("load", async () => {
    for (const ruleset of Rulesets) {
        await ruleset.init();
    }

    const { html, callback } = RulesRegistry;
    const template = LoadTemplate("rules", html);
    const data = {};
    document.body.innerHTML = template(data);
    callback(document.body);
});
