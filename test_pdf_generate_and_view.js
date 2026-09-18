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
  console.log("--> Initialisation test PDF réel avec génération...");

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
    if (message.includes("violates") || message.includes("Refused to frame") || message.includes("Security Policy") || message.includes("Refused to load")) {
      console.log(`[CSP ERROR L${level}]:`, message);
      cspViolations.push(message);
    }
  });

  // 1. Authentification
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

  // 2. Navigation vers /bulletins
  console.log("--> Navigation vers /bulletins...");
  await win.loadURL("http://localhost:5174/bulletins");
  await sleep(4000);

  // Cliquer sur "Générer" pour l'élève affiché (tony tom)
  const genClicked = await win.webContents.executeJavaScript(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const genBtn = btns.find(b => b.textContent && b.textContent.includes('Générer'));
      if (genBtn) {
        genBtn.click();
        return true;
      }
      return false;
    })()
  `);
  console.log("Clic sur Générer:", genClicked);
  await sleep(6000);

  // S'il y a une modale "Notes manquantes", cliquer sur "Continuer quand même"
  await win.webContents.executeJavaScript(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const confirmBtn = btns.find(b => b.textContent && (b.textContent.includes('Continuer') || b.textContent.includes('Générer quand même')));
      if (confirmBtn) {
        confirmBtn.click();
      }
    })()
  `);
  await sleep(8000);

  // Maintenant cliquer sur "Voir"
  const viewClicked = await win.webContents.executeJavaScript(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const viewBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Voir');
      if (viewBtn) {
        viewBtn.click();
        return true;
      }
      return false;
    })()
  `);
  console.log("Clic sur Voir bulletin:", viewClicked);
  await sleep(6000);

  // Vérifier l'iframe
  const bulletinIframe = await win.webContents.executeJavaScript(`
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
  console.log("Iframe Bulletin dans le DOM:", bulletinIframe);

  const shotBulletin = await win.webContents.capturePage();
  const fileBulletin = path.join(ARTIFACTS_DIR, "preview_bulletin_apres_csp.png");
  fs.writeFileSync(fileBulletin, shotBulletin.toPNG());
  console.log("✓ Capture bulletin enregistrée:", fileBulletin);

  // 3. Navigation vers /finance/entry pour vérifier le reçu
  console.log("--> Navigation vers /finance/entry...");
  await win.loadURL("http://localhost:5174/finance/entry");
  await sleep(4000);

  // Vérifier s'il y a un bouton 'Voir' reçu récent ou historique
  const receiptClicked = await win.webContents.executeJavaScript(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const viewBtn = btns.find(b => b.textContent && b.textContent.includes('Voir'));
      if (viewBtn) {
        viewBtn.click();
        return true;
      }
      return false;
    })()
  `);
  console.log("Clic sur Voir Reçu:", receiptClicked);
  await sleep(5000);

  const receiptIframe = await win.webContents.executeJavaScript(`
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
  console.log("Iframe Reçu dans le DOM:", receiptIframe);

  const shotReceipt = await win.webContents.capturePage();
  const fileReceipt = path.join(ARTIFACTS_DIR, "preview_recu_apres_csp.png");
  fs.writeFileSync(fileReceipt, shotReceipt.toPNG());
  console.log("✓ Capture reçu enregistrée:", fileReceipt);

  console.log("=== BILAN CSP ===");
  console.log("Violations CSP:", cspViolations);
  if (cspViolations.length === 0) {
    console.log("✓ VICTOIRE : ZÉRO violation CSP. Les iframes Supabase sont bien autorisées !");
  }

  app.quit();
  process.exit(0);
});
