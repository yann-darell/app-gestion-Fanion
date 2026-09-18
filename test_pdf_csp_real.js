const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("no-sandbox");

const ARTIFACTS_DIR = path.resolve("artifacts");
if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.whenReady().then(async () => {
  console.log("--> Initialisation fenêtre Electron pour test PDF...");

  const win = new BrowserWindow({
    width: 1366,
    height: 900,
    show: false,
    webPreferences: {
      offscreen: true,
      contextIsolation: false,
    },
  });

  const cspViolations = [];
  win.webContents.on("console-message", (event, level, message, line, sourceId) => {
    if (message.includes("violates") || message.includes("Refused to frame") || message.includes("Security Policy")) {
      console.log(`[CSP ERROR L${level}]:`, message);
      cspViolations.push(message);
    } else if (message.includes("Error") || message.includes("error")) {
      console.log(`[CONSOLE ERROR L${level}]:`, message);
    }
  });

  // 1. Connexion via API REST Supabase (fetch natif, sans realtime ni websocket)
  console.log("--> Authentification Principal via REST...");
  const authRes = await fetch("https://ahlydimsmldvufqnhdxc.supabase.co/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: {
      "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFobHlkaW1zbWxkdnVmcW5oZHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MjI2NDUsImV4cCI6MjEwMjA5ODY0NX0.pd7S7LbJJcjeGaLwFCe8DKGbrppMYRzbDCx4BciDlCA",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: "principal@lefanion.com",
      password: "r6QT?K$N#PW2LpG"
    })
  });
  const authData = await authRes.json();
  if (!authData.access_token) {
    console.error("Auth REST failed:", authData);
    app.quit();
    process.exit(1);
  }
  console.log("✓ Authentifié via REST ! Token reçu.");

  const sessionObj = {
    access_token: authData.access_token,
    refresh_token: authData.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + authData.expires_in,
    expires_in: authData.expires_in,
    token_type: authData.token_type,
    user: authData.user
  };

  await win.loadURL("http://localhost:5174/");
  await sleep(1500);

  const storageKey = "sb-ahlydimsmldvufqnhdxc-auth-token";
  await win.webContents.executeJavaScript(`
    localStorage.setItem('${storageKey}', '${JSON.stringify(sessionObj).replace(/'/g, "\\'")}');
  `);
  console.log("✓ Token injecté dans localStorage.");

  // 2. Naviguer vers /reports/bulletins ou /bulletins
  console.log("--> Navigation vers http://localhost:5174/bulletins...");
  await win.loadURL("http://localhost:5174/bulletins");
  await sleep(4000);

  // Vérifier le bouton 'Voir' et cliquer
  const clickedBulletin = await win.webContents.executeJavaScript(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const viewBtn = btns.find(b => b.textContent && b.textContent.includes('Voir'));
      if (viewBtn) {
        viewBtn.click();
        return { clicked: true, text: viewBtn.textContent.trim() };
      }
      return { clicked: false, totalBtns: btns.map(b => b.textContent.trim()) };
    })()
  `);
  console.log("Résultat clic bulletin:", clickedBulletin);
  await sleep(5000);

  // Vérifier la présence d'iframe
  const iframeInfo = await win.webContents.executeJavaScript(`
    (() => {
      const iframes = Array.from(document.querySelectorAll('iframe'));
      return iframes.map(f => ({
        src: f.src,
        title: f.title,
        width: f.offsetWidth,
        height: f.offsetHeight
      }));
    })()
  `);
  console.log("Iframes détectées (Bulletins):", iframeInfo);

  const shotBulletin = await win.webContents.capturePage();
  const fileBulletin = path.join(ARTIFACTS_DIR, "preview_bulletin_apres_csp.png");
  fs.writeFileSync(fileBulletin, shotBulletin.toPNG());
  console.log("✓ Capture bulletin enregistrée:", fileBulletin);

  // 3. Navigation vers /students pour le reçu
  console.log("--> Navigation vers http://localhost:5174/students...");
  await win.loadURL("http://localhost:5174/students");
  await sleep(3500);

  // Cliquer sur le premier élève
  const studentClicked = await win.webContents.executeJavaScript(`
    (() => {
      const link = document.querySelector('a[href^="/students/"]');
      if (link) {
        link.click();
        return link.getAttribute('href');
      }
      return null;
    })()
  `);
  console.log("Élève cliqué:", studentClicked);
  await sleep(4000);

  // Cliquer sur le bouton 'Voir' dans la fiche élève (historique des paiements)
  const receiptClicked = await win.webContents.executeJavaScript(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const viewBtn = btns.find(b => b.textContent && b.textContent.includes('Voir'));
      if (viewBtn) {
        viewBtn.click();
        return { clicked: true, text: viewBtn.textContent.trim() };
      }
      return { clicked: false, totalBtns: btns.map(b => b.textContent.trim()) };
    })()
  `);
  console.log("Résultat clic reçu:", receiptClicked);
  await sleep(5000);

  const iframeInfoReceipt = await win.webContents.executeJavaScript(`
    (() => {
      const iframes = Array.from(document.querySelectorAll('iframe'));
      return iframes.map(f => ({
        src: f.src,
        title: f.title,
        width: f.offsetWidth,
        height: f.offsetHeight
      }));
    })()
  `);
  console.log("Iframes détectées (Reçu):", iframeInfoReceipt);

  const shotReceipt = await win.webContents.capturePage();
  const fileReceipt = path.join(ARTIFACTS_DIR, "preview_recu_apres_csp.png");
  fs.writeFileSync(fileReceipt, shotReceipt.toPNG());
  console.log("✓ Capture reçu enregistrée:", fileReceipt);

  console.log("Nombre de violations CSP détectées:", cspViolations.length);
  if (cspViolations.length === 0) {
    console.log("✓ AUCUNE VIOLATION CSP DÉTECTÉE ! Les PDF s'affichent correctement.");
  } else {
    console.error("FAIL: Des violations CSP sont encore présentes:", cspViolations);
  }

  app.quit();
  process.exit(0);
});
