const { contextBridge } = require("electron");
const fs = require("fs");

fs.readFile('package.json', 'utf8', (err, data) => {
    if (err) {
        console.error(err);
        return;
    }

    contextBridge.exposeInMainWorld("VERSION", JSON.parse(data).version);
});
