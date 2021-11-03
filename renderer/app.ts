import { PcgRandom } from "./pcg-random.js";
import { CRC32C } from "./crc.js";

declare global {
    interface Window {
        VERSION: string;
        PcgRandom: any;
        CRC32C: any;
    }
}
window.PcgRandom = PcgRandom;
window.CRC32C = CRC32C;

console.log(`Townhall version ${window.VERSION}`);
