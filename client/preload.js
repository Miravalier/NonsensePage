const { contextBridge } = require("electron");
const fs = require("fs");
const path = require('path');

fs.readFile(path.join(__dirname, '../package.json'), 'utf8', (err, data) => {
    if (err) {
        console.error(err);
        return;
    }

    contextBridge.exposeInMainWorld("VERSION", JSON.parse(data).version);
});
