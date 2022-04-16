// Main function
$(async () => {
    // Determine screen size
    const canvas_width = Math.max($(window).width(), 800);
    const canvas_height = Math.max($(window).height(), 800);
    console.log("Canvas Size", { width: canvas_width, height: canvas_height });

    // Create app
    const app = new PIXI.Application({ width: canvas_width, height: canvas_height, backgroundColor: 0x000000 });
    document.body.appendChild(app.view);
});
