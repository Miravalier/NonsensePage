export function setStylePosition(style: React.CSSProperties, ev: React.MouseEvent): React.CSSProperties {
    const xPercentage = ev.clientX / document.body.clientWidth;
    const yPercentage = ev.clientY / document.body.clientHeight;
    if (xPercentage < 0.5) {
        style.left = ev.clientX;
    }
    else {
        style.right = document.body.clientWidth - ev.clientX;
    }
    if (yPercentage < 0.5) {
        style.top = ev.clientY;
    }
    else {
        style.bottom = document.body.clientHeight - ev.clientY;
    }
    return style;
}
