import { Toastify } from "./toastify.js";


export function InfoToast(message) {
    console.info(message);
    const toast = new Toastify({
        text: message,
        className: "info-toast",
    });
    toast.showToast();
    return toast;
}


export function WarningToast(message) {
    console.warn(message);
    const toast = new Toastify({
        text: message,
        className: "warning-toast",
    });
    toast.showToast();
    return toast;
}


export function ErrorToast(message) {
    console.error(message);
    const toast = new Toastify({
        text: message,
        className: "error-toast",
    });
    toast.showToast();
    return toast;
}
