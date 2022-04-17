import { Vector2 } from "./vector.js";
import { CanvasWindow } from "./window.js";


$(async () => {
    const window = new CanvasWindow();
    window.canvas.DrawCircle({
        position: new Vector2(10, 10),
        radius: 50,
        fillColor: 0xFFFFFF,
    });
});
