import { Sleep } from "./Async.ts";
import { Html } from "./Elements.ts";

let notificationContainer: HTMLDivElement = null;

export async function init() {
    notificationContainer = document.body.appendChild(Html(
        `<div id="notifications"></div>`
    )) as HTMLDivElement;
}


async function displayToast(toast: HTMLDivElement) {
    // Wait 100ms for element to render with opacity 0
    await Sleep(100);

    // Fade toast in
    toast.style.opacity = "1";

    // Wait 5 seconds
    await Sleep(5000);

    // Fade toast out
    toast.style.opacity = "0";

    // Wait for the fade out to complete
    await Sleep(600);

    // Destroy toast
    toast.remove();
}


export function InfoToast(message: string) {
    console.info(message);
    const toast = notificationContainer.appendChild(Html(`
        <div class="info toast">
            ${message}
        </div>
    `)) as HTMLDivElement;
    displayToast(toast);
    return toast;
}


export function WarningToast(message: string) {
    console.warn(message);
    const toast = notificationContainer.appendChild(Html(`
        <div class="warning toast">
            <i class="fas fa-triangle-exclamation"></i>
            ${message}
        </div>
    `)) as HTMLDivElement;
    displayToast(toast);
    return toast;
}


export function ErrorToast(message: string) {
    console.error(message);
    const toast = notificationContainer.appendChild(Html(`
        <div class="error toast">
            <i class="fas fa-circle-exclamation"></i>
            ${message}
        </div>
    `)) as HTMLDivElement;
    displayToast(toast);
    return toast;
}
