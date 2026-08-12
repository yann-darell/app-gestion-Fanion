import { app, BrowserWindow, protocol, net } from "electron";
import path from "path";
import { pathToFileURL } from "url";

const isDev = !app.isPackaged;

// Enregistrer le schéma de protocole pour les photos d'élèves
protocol.registerSchemesAsPrivileged([
    {
        scheme: "fanion-photo",
        privileges: { bypassCSP: true, secure: true, supportFetchAPI: true }
    }
]);

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (isDev) {
        win.loadURL("http://localhost:5173");
        win.webContents.openDevTools();
    } else {
        win.loadFile(path.join(__dirname, "../dist/index.html"));
    }
}

app.whenReady().then(() => {
    // Configurer le gestionnaire pour le protocole fanion-photo://
    protocol.handle("fanion-photo", (request) => {
        try {
            const url = new URL(request.url);
            // Déterminer le nom de fichier (soit hostname soit pathname)
            const filename = decodeURIComponent(url.hostname || url.pathname.replace(/^\/+/, ""));
            const filePath = path.join(app.getPath("userData"), "photos", filename);
            return net.fetch(pathToFileURL(filePath).toString());
        } catch (error) {
            console.error("Erreur protocole fanion-photo :", error);
            return new Response("Not Found", { status: 404 });
        }
    });

    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});