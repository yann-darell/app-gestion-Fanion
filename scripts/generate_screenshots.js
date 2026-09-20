const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URL = 'http://localhost:5174';
const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'images');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function takeScreenshots() {
  console.log('Lancement de Puppeteer...');
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1280, height: 800 }
  });
  
  const page = await browser.newPage();
  
  try {
    console.log(`Navigation vers ${URL}...`);
    await page.goto(`${URL}/login`, { waitUntil: 'networkidle0' });

    console.log('Connexion...');
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'principal@lefanion.com');
    await page.type('input[type="password"]', 'PrincipalPassword2026!');
    
    // On capture la page de connexion remplie
    await page.screenshot({ path: path.join(OUTPUT_DIR, '00_login.png') });
    console.log('✅ Screenshot sauvegardé: 00_login.png');

    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    console.log('Connecté !');
    
    // --- 1. Tableau de bord ---
    console.log(`Capture du tableau de bord...`);
    await page.goto(`${URL}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, '01_dashboard.png') });
    console.log(`✅ Screenshot sauvegardé: 01_dashboard.png`);
    
    // --- 2. Élèves ---
    console.log(`Capture de la liste des élèves...`);
    await page.goto(`${URL}/students`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02_students.png') });
    console.log(`✅ Screenshot sauvegardé: 02_students.png`);

    // Clic Inscription
    console.log(`Capture modale inscription...`);
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent && b.textContent.includes('+ Inscrire un élève'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02_students_modal_inscription.png') });
    console.log(`✅ Screenshot sauvegardé: 02_students_modal_inscription.png`);
    // Fermer modale (Escape)
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 500));

    // Clic Fournitures (sur le premier élève)
    console.log(`Capture modale fournitures...`);
    await page.evaluate(() => {
      const btn = document.querySelector('button[title="Cliquer pour pointer les fournitures"]');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02_students_modal_fournitures.png') });
    console.log(`✅ Screenshot sauvegardé: 02_students_modal_fournitures.png`);
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 500));

    // --- 3. Finances ---
    console.log(`Capture des finances...`);
    await page.goto(`${URL}/finance`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, '03_finance.png') });
    console.log(`✅ Screenshot sauvegardé: 03_finance.png`);
    
    // Aller sur une page de paiement (via le bouton Payer de la liste des élèves)
    await page.goto(`${URL}/students`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1500));
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent && b.textContent.includes('Payer'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, '03_finance_payment.png') });
    console.log(`✅ Screenshot sauvegardé: 03_finance_payment.png`);

    // --- 4. Classes ---
    console.log(`Capture des classes...`);
    await page.goto(`${URL}/classes`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, '04_classes.png') });
    console.log(`✅ Screenshot sauvegardé: 04_classes.png`);

    // Clic Nouvelle classe
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent && b.textContent.includes('+ Nouvelle classe'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, '04_classes_modal.png') });
    console.log(`✅ Screenshot sauvegardé: 04_classes_modal.png`);
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 500));
    
    // --- 5. Paramètres ---
    console.log(`Capture des paramètres...`);
    await page.goto(`${URL}/settings`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, '05_settings_school.png') });
    console.log(`✅ Screenshot sauvegardé: 05_settings_school.png`);

    // Aller sur l'onglet Utilisateurs (si possible)
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      const btn = btns.find(b => b.textContent && b.textContent.includes('Comptes Utilisateurs'));
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, '05_settings_users.png') });
    console.log(`✅ Screenshot sauvegardé: 05_settings_users.png`);

  } catch (error) {
    console.error('Erreur lors de la capture :', error);
  } finally {
    await browser.close();
    console.log('Terminé.');
  }
}

takeScreenshots();
