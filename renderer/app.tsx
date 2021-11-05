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

class ContextMenu extends React.Component {
    render() {
        return <div className="context-menu">
            WIP Context Menu
        </div>
    }
}

console.log(`Canonfire version ${window.VERSION}`);
$(() => {
    $("#desktop").on("contextmenu", ev => {
        ReactDOM.render(
            <ContextMenu />,
            document.getElementById('desktop')
        );
    });
});


