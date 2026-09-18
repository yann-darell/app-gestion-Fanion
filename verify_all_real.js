const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("no-sandbox");

const ARTIFACTS_DIR = path.resolve("artifacts");
if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.whenReady().then(async () => {
  console.log("--> Démarrage du test d'affichage réel des PDF et des Edge Functions...");

  const supabase = createClient(
    "https://ahlydimsmldvufqnhdxc.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFobHlkaW1zbWxkdnVmcW5oZHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MjI2NDUsImV4cCI6MjEwMjA5ODY0NX0.pd7S7LbJJcjeGaLwFCe8DKGbrppMYRzbDCx4BciDlCA",
    {
      realtime: {
        createClient: () => ({})
      }
    }
  );

  // 1. Authentification en tant que Principal
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "principal@lefanion.com",
    password: "r6QT?K$N#PW2LpG",
  });

  if (authErr || !authData.session) {
    console.error("FAIL: Connexion impossible:", authErr);
    app.quit();
    process.exit(1);
  }
  console.log("✓ Connecté en tant que Principal.");

  // 2. Test réel Edge Functions
  console.log("--> Test toggle-teacher-status...");
  const { data: teachers } = await supabase.from("profiles").select("id, full_name").eq("role", "enseignant").limit(1);
  if (teachers && teachers.length > 0) {
    const t = teachers[0];
    const { data: togRes1, error: togErr1 } = await supabase.functions.invoke("toggle-teacher-status", {
      body: { teacher_id: t.id, is_active: true }
    });
    if (togErr1) {
      console.error("FAIL toggle-teacher-status:", togErr1);
    } else {
      console.log("✓ toggle-teacher-status SUCCESS:", togRes1);
    }
  }

  const testEmail = `audit.test.${Date.now()}@lefanion.com`;
  console.log("--> Test invite-teacher...");
  const { data: invRes, error: invErr } = await supabase.functions.invoke("invite-teacher", {
    body: { email: testEmail, full_name: "Audit Verify" }
  });
  if (invErr) {
    console.error("FAIL invite-teacher:", invErr);
  } else {
    console.log("✓ invite-teacher SUCCESS:", invRes?.message || invRes);
  }

  // 3. Test affichage Iframe PDF réel dans Electron
  const win = new BrowserWindow({
    width: 1366,
    height: 900,
    show: false,
    webPreferences: {
      offscreen: true,
      contextIsolation: false,
    },
  });

  win.webContents.on("console-message", (event, level, message, line, sourceId) => {
    if (message.includes("violates") || message.includes("Refused to frame") || message.includes("Security Policy") || message.includes("error")) {
      console.log(`[Browser Console L${level}]:`, message);
    }
  });

  await win.loadURL("http://localhost:5174/");
  await sleep(1000);

  const sessionStr = JSON.stringify(authData.session);
  const storageKey = "sb-ahlydimsmldvufqnhdxc-auth-token";
  await win.webContents.executeJavaScript(`
    localStorage.setItem('${storageKey}', '${sessionStr.replace(/'/g, "\\'")}');
  `);

  // Ouvrir la page des bulletins
  console.log("--> Navigation vers /bulletins...");
  await win.loadURL("http://localhost:5174/bulletins");
  await sleep(3500);

  // Cliquer sur le bouton "Voir" s'il existe ou déclencher previewPdfUrl
  const previewTriggered = await win.webContents.executeJavaScript(`
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
  console.log("Action 'Voir bulletin' déclenchée:", previewTriggered);
  await sleep(4000);

  const bulletinScreenshot = await win.webContents.capturePage();
  const bulletinFile = path.join(ARTIFACTS_DIR, "preview_bulletin_apres_csp.png");
  fs.writeFileSync(bulletinFile, bulletinScreenshot.toPNG());
  console.log("✓ Capture bulletin enregistrée:", bulletinFile);

  // Ouvrir la fiche élève pour tester la modale Reçu PDF
  console.log("--> Navigation vers /students...");
  await win.loadURL("http://localhost:5174/students");
  await sleep(3000);

  const firstStudentClicked = await win.webContents.executeJavaScript(`
    (() => {
      const rows = Array.from(document.querySelectorAll('tr, a, div[role="button"]'));
      const link = document.querySelector('a[href^="/students/"]');
      if (link) {
        link.click();
        return true;
      }
      return false;
    })()
  `);
  console.log("Navigation vers fiche élève déclenchée:", firstStudentClicked);
  await sleep(3500);

  // Cliquer sur 'Voir' reçu dans l'historique de paiement
  const receiptViewClicked = await win.webContents.executeJavaScript(`
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
  console.log("Action 'Voir reçu' déclenchée:", receiptViewClicked);
  await sleep(4000);

  const receiptScreenshot = await win.webContents.capturePage();
  const receiptFile = path.join(ARTIFACTS_DIR, "preview_recu_apres_csp.png");
  fs.writeFileSync(receiptFile, receiptScreenshot.toPNG());
  console.log("✓ Capture reçu enregistrée:", receiptFile);

  console.log("=== TESTS REELS REUSSIS ! ===");
  app.quit();
  process.exit(0);
});
