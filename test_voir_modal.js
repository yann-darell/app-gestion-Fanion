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
  console.log("--> Test de la modale PDF (iframe Supabase)...");

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
  win.webContents.on("console-message", (event, level, message) => {
    if (message.includes("violates") || message.includes("Refused to frame") || message.includes("Security Policy")) {
      console.log(`[CSP VIOLATION]:`, message);
      cspViolations.push(message);
    }
  });

  const authRes = await fetch("https://ahlydimsmldvufqnhdxc.supabase.co/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: {
      "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFobHlkaW1zbWxkdnVmcW5oZHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MjI2NDUsImV4cCI6MjEwMjA5ODY0NX0.pd7S7LbJJcjeGaLwFCe8DKGbrppMYRzbDCx4BciDlCA",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email: "principal@lefanion.com", password: "r6QT?K$N#PW2LpG" })
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
  await win.webContents.executeJavaScript(`
    localStorage.setItem('sb-ahlydimsmldvufqnhdxc-auth-token', '${JSON.stringify(sessionObj).replace(/'/g, "\\'")}');
  `);

  // Aller sur /bulletins - le bulletin est déjà "Généré" depuis le test précédent
  await win.loadURL("http://localhost:5174/bulletins");
  await sleep(4000);

  // Vérifier le statut du bulletin
  const pageState = await win.webContents.executeJavaScript(`
    (() => {
      const statuts = Array.from(document.querySelectorAll('[class*="badge"], [class*="status"], span'));
      const genere = statuts.find(el => el.textContent.trim() === 'Généré');
      const btns = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
      return { isGenerated: !!genere, buttons: btns };
    })()
  `);
  console.log("État page bulletins:", pageState);

  // Cliquer "Voir"
  const voirClicked = await win.webContents.executeJavaScript(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.trim() === 'Voir' && !b.disabled);
      if (btn) { btn.click(); return true; }
      return false;
    })()
  `);
  console.log("Clic Voir:", voirClicked);
  await sleep(8000);

  // Vérifier la modale et l'iframe
  const modalState = await win.webContents.executeJavaScript(`
    (() => {
      const iframes = Array.from(document.querySelectorAll('iframe'));
      const modals = Array.from(document.querySelectorAll('[class*="fixed"], [class*="modal"]'));
      return {
        iframes: iframes.map(f => ({ src: f.src.substring(0, 100), visible: f.offsetWidth > 0 })),
        modalCount: modals.length,
        bodyHtml: document.body.innerHTML.substring(0, 500)
      };
    })()
  `);
  console.log("État modale:", JSON.stringify(modalState, null, 2));

  const shot1 = await win.webContents.capturePage();
  const file1 = path.join(ARTIFACTS_DIR, "bulletin_pdf_modal.png");
  fs.writeFileSync(file1, shot1.toPNG());
  console.log("✓ Capture modale bulletin:", file1);

  console.log("\n=== RÉSULTAT FINAL ===");
  console.log("Violations CSP:", cspViolations.length === 0 ? "AUCUNE ✓" : cspViolations);
  console.log("Iframes dans le DOM:", modalState.iframes.length);

  app.quit();
  process.exit(0);
});
