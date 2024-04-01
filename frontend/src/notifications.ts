import { Toastify } from "toastify";


export function InfoToast(message: string) {
    console.info(message);
    const toast = new Toastify({
        text: message,
        className: "info-toast",
    });
    toast.showToast();
    return toast;
}


export function WarningToast(message: string) {
    console.warn(message);
    const toast = new Toastify({
        text: message,
        className: "warning-toast",
    });
    toast.showToast();
    return toast;
}


export function ErrorToast(message: string) {
    console.error(message);
    const toast = new Toastify({
        text: message,
        className: "error-toast",
    });
    toast.showToast();
    return toast;
}
