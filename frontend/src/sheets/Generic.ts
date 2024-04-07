import { RegisterSheet, Sheet } from "./sheet.ts";
import GenericHtml from "./Generic.html?raw";
import GenericCss from "./Generic.css?raw";


export class GenericSheet extends Sheet { }
RegisterSheet(GenericSheet, GenericHtml, GenericCss);
