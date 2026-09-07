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
  console.log("--> Initialisation du navigateur Electron pour captures réelles...");

  // Fenêtre Desktop
  const desktopWin = new BrowserWindow({
    width: 1366,
    height: 850,
    show: false,
    webPreferences: {
      offscreen: true,
      contextIsolation: false,
    },
  });

  // 1. Obtenir la session côté Node
  console.log("--> Authentification avec supabase-js...");
  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(
    "https://ahlydimsmldvufqnhdxc.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFobHlkaW1zbWxkdnVmcW5oZHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MjI2NDUsImV4cCI6MjEwMjA5ODY0NX0.pd7S7LbJJcjeGaLwFCe8DKGbrppMYRzbDCx4BciDlCA"
  );

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "principal@lefanion.com",
    password: "r6QT?K$N#PW2LpG",
  });

  if (authErr || !authData.session) {
    console.error("Erreur login Node:", authErr);
    app.quit();
    return;
  }
  console.log("✓ Session obtenue pour:", authData.user.email);

  await desktopWin.loadURL("http://localhost:5174/");
  await sleep(1000);

  // Injecter la session dans le localStorage de la fenêtre
  const sessionStr = JSON.stringify(authData.session);
  const storageKey = "sb-ahlydimsmldvufqnhdxc-auth-token";
  await desktopWin.webContents.executeJavaScript(`
    localStorage.setItem('${storageKey}', '${sessionStr.replace(/'/g, "\\'")}');
  `);
  console.log("✓ Session injectée dans localStorage");

  // Recharger pour activer la session
  await desktopWin.loadURL("http://localhost:5174/students");
  await sleep(2500);

  // 2. Capture Bloc A: Fiche de paiement de classe (Desktop)
  console.log("--> Navigation vers la fiche de paiement de classe (/finance/class-report)...");
  await desktopWin.loadURL("http://localhost:5174/finance/class-report");
  await sleep(3500);

  const imageA_Desktop = await desktopWin.webContents.capturePage();
  const fileA_Desktop = path.join(ARTIFACTS_DIR, "fiche_paiement_classe_desktop.png");
  fs.writeFileSync(fileA_Desktop, imageA_Desktop.toPNG());
  console.log("✓ Capture enregistrée:", fileA_Desktop);

  // 3. Capture Bloc B: Saisie des notes Direction (Desktop)
  console.log("--> Navigation vers la saisie des notes direction (/grades)...");
  await desktopWin.loadURL("http://localhost:5174/grades");
  await sleep(3500);

  const imageB_Desktop = await desktopWin.webContents.capturePage();
  const fileB_Desktop = path.join(ARTIFACTS_DIR, "saisie_notes_direction_desktop.png");
  fs.writeFileSync(fileB_Desktop, imageB_Desktop.toPNG());
  console.log("✓ Capture enregistrée:", fileB_Desktop);

  // 4. Captures Responsive Web & Mobile (Largeur 375px et 1024px)
  desktopWin.setSize(375, 812);
  await sleep(1500);

  // Vue Mobile Saisie Notes
  const imageB_Mobile = await desktopWin.webContents.capturePage();
  const fileB_Mobile = path.join(ARTIFACTS_DIR, "saisie_notes_direction_mobile.png");
  fs.writeFileSync(fileB_Mobile, imageB_Mobile.toPNG());
  console.log("✓ Capture mobile enregistrée:", fileB_Mobile);

  // Vue Mobile Fiche de paiement
  await desktopWin.loadURL("http://localhost:5174/finance/class-report");
  await sleep(3000);
  const imageA_Mobile = await desktopWin.webContents.capturePage();
  const fileA_Mobile = path.join(ARTIFACTS_DIR, "fiche_paiement_classe_mobile.png");
  fs.writeFileSync(fileA_Mobile, imageA_Mobile.toPNG());
  console.log("✓ Capture mobile enregistrée:", fileA_Mobile);

  console.log("=== TOUTES LES CAPTURES SONT COMPLÈTES ! ===");
  app.quit();
});
