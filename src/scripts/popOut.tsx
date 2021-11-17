import "../styles/app.css";

console.log(`Canonhead pop-out version ${__VERSION__}`);

let initialized = false;
window.addEventListener("message", ev => {
    // Validate message
    if (ev.origin !== window.location.origin) {
        console.error(`Invalid message origin ${ev.origin}, expected ${window.location.origin}`);
        return;
    }
    if (initialized) {
        console.error("Window is already initialized.");
        return;
    }
    initialized = true;

    // Inform parent when we close
    window.addEventListener("beforeunload", () => {
        ev.source.postMessage({ type: "pop-out-closed", id: ev.data.id });
        return null;
    });

    // Render the pop out
    const popOutData = ev.data.data;
    console.log("POD:", popOutData);
});
