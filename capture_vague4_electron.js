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
  console.log("--> Lancement Electron pour preuve UI Vague 4...");

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: {
      offscreen: true,
      contextIsolation: false,
    },
  });

  console.log("--> Authentification REST...");
  const authRes = await fetch("https://ahlydimsmldvufqnhdxc.supabase.co/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFobHlkaW1zbWxkdnVmcW5oZHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MjI2NDUsImV4cCI6MjEwMjA5ODY0NX0.pd7S7LbJJcjeGaLwFCe8DKGbrppMYRzbDCx4BciDlCA"
    },
    body: JSON.stringify({
      email: "principal@lefanion.com",
      password: "r6QT?K$N#PW2LpG"
    })
  });
  const authData = await authRes.json();
  const session = {
    access_token: authData.access_token,
    refresh_token: authData.refresh_token,
    expires_in: authData.expires_in,
    token_type: authData.token_type,
    user: authData.user
  };

  if (!session.access_token) {
    console.error("FAIL: Erreur login Principal:", authData);
    app.quit();
    return;
  }
  console.log("✓ Session obtenue pour:", session.user?.email);

  await win.loadURL("http://localhost:5174/");
  await sleep(1500);

  // Injecter la session complète
  const sessionStr = JSON.stringify(session);
  const storageKey = "sb-ahlydimsmldvufqnhdxc-auth-token";
  await win.webContents.executeJavaScript(`
    localStorage.setItem('${storageKey}', '${sessionStr.replace(/'/g, "\\'")}');
  `);
  console.log("✓ Session injectée dans localStorage");

  // Recharger sur la racine pour que App.tsx détecte la session
  console.log("--> Rechargement de l'application avec session...");
  await win.loadURL("http://localhost:5174/");
  await sleep(3500);

  // Naviguer sur la fiche élève (Landry James ONANINA)
  const studentId = "42b195c8-6dd5-4a74-a138-dcde590e66b3";
  console.log(`--> Navigation vers la fiche élève (/students/${studentId})...`);
  await win.loadURL(`http://localhost:5174/students/${studentId}`);
  await sleep(4000);

  // Capture 1 : Fiche élève avec Widget Bourse F5 et Cloche dans le Header
  const img1 = await win.webContents.capturePage();
  const file1 = path.join(ARTIFACTS_DIR, "vague4_fiche_eleve_widget_f5.png");
  fs.writeFileSync(file1, img1.toPNG());
  console.log("✓ Capture 1 enregistrée (Widget F5 + Header Cloche):", file1);

  // Clic sur "+ Définir une réduction" pour ouvrir le Modal F5
  console.log("--> Ouverture du modal F5...");
  await win.webContents.executeJavaScript(`
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.textContent.includes('Définir une réduction') || b.textContent.includes('Modifier la bourse'));
    if (btn) btn.click();
  `);
  await sleep(1500);

  // Capture 2 : Modal F5 Bourse & Réduction ouvert à l'écran
  const img2 = await win.webContents.capturePage();
  const file2 = path.join(ARTIFACTS_DIR, "vague4_modal_bourse_f5_ouvert.png");
  fs.writeFileSync(file2, img2.toPNG());
  console.log("✓ Capture 2 enregistrée (Modal Bourse F5):", file2);

  // Fermer le modal
  await win.webContents.executeJavaScript(`
    const closeButtons = Array.from(document.querySelectorAll('button'));
    const cancelBtn = closeButtons.find(b => b.textContent.includes('Annuler'));
    if (cancelBtn) cancelBtn.click();
  `);
  await sleep(800);

  // Clic sur la Cloche de Notifications pour ouvrir le Dropdown
  console.log("--> Ouverture de la cloche de notifications...");
  await win.webContents.executeJavaScript(`
    const bellBtn = document.querySelector('button[title*=\"notifications\"]') || document.querySelector('button[aria-label*=\"notifications\"]');
    if (bellBtn) bellBtn.click();
  `);
  await sleep(1500);

  // Capture 3 : Dropdown Notifications ouvert à l'écran
  const img3 = await win.webContents.capturePage();
  const file3 = path.join(ARTIFACTS_DIR, "vague4_dropdown_notifications_ouvert.png");
  fs.writeFileSync(file3, img3.toPNG());
  console.log("✓ Capture 3 enregistrée (Dropdown Notifications):", file3);

  console.log("=== TOUTES LES CAPTURES DE PREUVE VAGUE 4 SONT TERMINÉES ===");
  app.quit();
});
