export type MouseEventHandler = (ctx: any, ev: MouseEvent) => void;


function touchEventToMouseEvent(ev: TouchEvent): MouseEvent {
    const touch = ev.changedTouches[0];
    const eventMap = {
        "touchstart": "mousedown",
        "touchend": "mouseup",
        "touchmove": "mousemove",
    };
    return new MouseEvent(eventMap[ev.type], {
        clientX: touch.clientX,
        clientY: touch.clientY,
        screenX: touch.screenX,
        screenY: touch.screenY,
    });
}


export type AddPositionalListenerOptions = {
    onStart?: MouseEventHandler,
    onMove?: MouseEventHandler,
    onEnd?: MouseEventHandler,
}

export function AddPositionalListener(element: HTMLElement, options: AddPositionalListenerOptions) {
    element.addEventListener("mousedown", ev => {
        const ctx = {};
        if (options.onStart) {
            options.onStart(ctx, ev);
        }

        const moveHandler = ev => {
            if (options.onMove) {
                options.onMove(ctx, ev);
            }
        };

        const endHandler = ev => {
            document.removeEventListener("mousemove", moveHandler);
            if (options.onEnd) {
                options.onEnd(ctx, ev);
            }
        };

        document.addEventListener("mousemove", moveHandler);
        document.addEventListener("mouseup", endHandler, { once: true });
    });

    element.addEventListener("touchstart", ev => {
        const ctx = {};
        if (options.onStart) {
            options.onStart(ctx, touchEventToMouseEvent(ev));
        }

        const moveHandler = ev => {
            if (options.onMove) {
                options.onMove(ctx, touchEventToMouseEvent(ev));
            }
        };

        const endHandler = ev => {
            document.removeEventListener("touchmove", moveHandler);
            if (options.onEnd) {
                options.onEnd(ctx, touchEventToMouseEvent(ev));
            }
        };

        document.addEventListener("touchmove", moveHandler);
        document.addEventListener("touchend", endHandler, { once: true });
    });
}


export function AddDragListener(element: HTMLElement, data: any) {
    element.draggable = true;
    element.addEventListener("dragstart", (ev) => {
        ev.dataTransfer.setData("application/nonsense", JSON.stringify(data));
        if (data.img) {
            const image = new Image();
            image.src = data.img;
            ev.dataTransfer.setDragImage(image, 16, 16);
        }
    });
}


export function AddDropListener(element: HTMLElement, fn: CallableFunction): AbortController {
    const abortController = new AbortController();

    element.addEventListener("dragover", (ev) => {
        ev.dataTransfer.dropEffect = "copy";
        ev.preventDefault();
    }, { signal: abortController.signal });

    element.addEventListener("drop", (ev) => {
        let dragData;
        try {
            dragData = JSON.parse(ev.dataTransfer.getData("application/nonsense"));
        } catch (error) {
            dragData = null;
        }

        if (dragData) {
            fn(dragData, ev);
        }
    }, { signal: abortController.signal });

    return abortController;
}
