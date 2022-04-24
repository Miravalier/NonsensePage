import { Toastify } from "./toastify.js";


export function ErrorToast(message) {
    console.error(message);
    return new Toastify({
        text: message,
        className: "error-toast",
    });
}
