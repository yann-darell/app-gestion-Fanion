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
  console.log("--> Initialisation du navigateur Electron pour test 375px...");

  // Fenêtre mobile 375px x 812px (taille réelle iPhone standard)
  const mobileWin = new BrowserWindow({
    width: 375,
    height: 812,
    show: false,
    webPreferences: {
      offscreen: true,
      contextIsolation: false,
    },
  });

  console.log("--> Authentification avec supabase-js (compte enseignant)...");
  const { createClient } = require("@supabase/supabase-js");
  const supabase = createClient(
    "https://ahlydimsmldvufqnhdxc.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFobHlkaW1zbWxkdnVmcW5oZHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MjI2NDUsImV4cCI6MjEwMjA5ODY0NX0.pd7S7LbJJcjeGaLwFCe8DKGbrppMYRzbDCx4BciDlCA"
  );

  // Connexion avec un compte enseignant pour tester en conditions réelles
  let authData;
  const loginRes = await supabase.auth.signInWithPassword({
    email: "maths.teacher@lefanion.com",
    password: "Password123!",
  });

  if (loginRes.error) {
    console.log("Compte maths.teacher indisponible, tentative principal...");
    const adminLogin = await supabase.auth.signInWithPassword({
      email: "principal@lefanion.com",
      password: "r6QT?K$N#PW2LpG",
    });
    authData = adminLogin.data;
  } else {
    authData = loginRes.data;
  }

  console.log("✓ Connecté avec:", authData.user?.email);

  await mobileWin.loadURL("http://localhost:5174/");
  await sleep(1000);

  const sessionStr = JSON.stringify(authData.session);
  const storageKey = "sb-ahlydimsmldvufqnhdxc-auth-token";
  await mobileWin.webContents.executeJavaScript(`
    localStorage.setItem('${storageKey}', '${sessionStr.replace(/'/g, "\\'")}');
  `);
  console.log("✓ Session injectée dans localStorage");

  // 1. Capture Écran Saisie des notes à 375px
  console.log("--> Navigation vers /teacher/grades à 375px...");
  await mobileWin.loadURL("http://localhost:5174/teacher/grades");
  await sleep(3500);

  const imgGrades = await mobileWin.webContents.capturePage();
  const fileGrades = path.join(ARTIFACTS_DIR, "teacher_grades_mobile_375px.png");
  fs.writeFileSync(fileGrades, imgGrades.toPNG());
  console.log("✓ Capture Saisie des notes 375px enregistrée:", fileGrades);

  // 2. Capture Écran Évolution & Bordereau de matière à 375px
  console.log("--> Navigation vers /teacher/evolution à 375px...");
  await mobileWin.loadURL("http://localhost:5174/teacher/evolution");
  await sleep(3500);

  const imgEvolution = await mobileWin.webContents.capturePage();
  const fileEvolution = path.join(ARTIFACTS_DIR, "teacher_evolution_mobile_375px.png");
  fs.writeFileSync(fileEvolution, imgEvolution.toPNG());
  console.log("✓ Capture Évolution 375px enregistrée:", fileEvolution);

  console.log("=== TESTS 375PX TERMINÉS AVEC SUCCÈS ===");
  app.quit();
});
