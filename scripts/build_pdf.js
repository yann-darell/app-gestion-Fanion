const { mdToPdf } = require('md-to-pdf');
const path = require('path');
const fs = require('fs');

const DOCS_DIR = path.join(__dirname, '..', 'docs');
const IMAGES_DIR = path.join(DOCS_DIR, 'images');
const INPUT_FILE = path.join(DOCS_DIR, 'MANUEL_UTILISATEUR.md');
const OUTPUT_FILE = path.join(__dirname, '..', 'Le_Fanion_Manuel_Utilisation.pdf');

// Convertit toutes les images en base64 pour un PDF autonome
function inlineImages(markdownContent) {
  return markdownContent.replace(/!\[([^\]]*)\]\(\.\/images\/([^)]+)\)/g, (match, alt, filename) => {
    const imgPath = path.join(IMAGES_DIR, filename);
    if (fs.existsSync(imgPath)) {
      const ext = path.extname(filename).slice(1).toLowerCase();
      const mime = ext === 'jpg' ? 'jpeg' : ext;
      const base64 = fs.readFileSync(imgPath).toString('base64');
      return `![${alt}](data:image/${mime};base64,${base64})`;
    } else {
      console.warn(`Image non trouvée : ${imgPath}`);
      return match;
    }
  });
}

(async () => {
  try {
    console.log('Lecture du manuel...');
    let content = fs.readFileSync(INPUT_FILE, 'utf8');

    console.log('Intégration des images en base64...');
    content = inlineImages(content);

    console.log('Génération du PDF en cours...');

    const pdf = await mdToPdf(
      { content },
      {
        dest: OUTPUT_FILE,
        pdf_options: {
          format: 'A4',
          margin: { top: '22mm', bottom: '22mm', left: '18mm', right: '18mm' },
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate: `<div style="width:100%; font-size:8px; color:#9ca3af; padding:0 18mm; display:flex; justify-content:space-between; align-items:center; box-sizing:border-box;">
            <span>Le Fanion — Manuel d'Utilisation</span>
            <span>Confidentiel — Usage interne</span>
          </div>`,
          footerTemplate: `<div style="width:100%; font-size:8px; color:#9ca3af; padding:0 18mm; display:flex; justify-content:space-between; align-items:center; box-sizing:border-box;">
            <span>Plateforme Le Fanion v2.0</span>
            <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
          </div>`,
        },
        css: `
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          body {
            font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
            font-size: 11pt;
            color: #111827;
            line-height: 1.75;
          }
          h1 {
            font-size: 26pt;
            color: #111827;
            border-bottom: 3px solid #4f46e5;
            padding-bottom: 10px;
            margin-top: 50px;
          }
          h2 {
            font-size: 17pt;
            color: #4f46e5;
            margin-top: 40px;
            border-left: 5px solid #4f46e5;
            padding-left: 12px;
          }
          h3 {
            font-size: 13pt;
            color: #374151;
            margin-top: 28px;
          }
          h4 {
            font-size: 11pt;
            color: #6b7280;
            font-weight: 700;
          }
          img {
            max-width: 100%;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
            box-shadow: 0 2px 10px rgba(0,0,0,0.10);
            display: block;
            margin: 18px auto;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 10pt;
          }
          th {
            background-color: #4f46e5;
            color: white;
            padding: 9px 12px;
            text-align: left;
            font-weight: 700;
          }
          td {
            border: 1px solid #e5e7eb;
            padding: 8px 12px;
            vertical-align: top;
          }
          tr:nth-child(even) td { background-color: #f9fafb; }
          blockquote {
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            margin: 16px 0;
            padding: 12px 16px;
            border-radius: 4px;
            font-size: 10pt;
            color: #1e40af;
          }
          code {
            background: #f1f5f9;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 9.5pt;
            font-family: 'Consolas', 'Courier New', monospace;
            color: #be185d;
          }
          ul, ol { margin: 10px 0 10px 22px; }
          li { margin-bottom: 5px; }
          hr { border: none; border-top: 2px solid #e5e7eb; margin: 35px 0; }
          strong { color: #1e40af; }
          p { margin: 10px 0; }
        `
      }
    );

    if (pdf) {
      fs.writeFileSync(OUTPUT_FILE, pdf.content);
      const sizeMB = (pdf.content.length / 1024 / 1024).toFixed(2);
      console.log('✅ PDF généré avec succès !');
      console.log('   Fichier : ' + OUTPUT_FILE);
      console.log('   Taille  : ' + sizeMB + ' MB');
    }
  } catch (error) {
    console.error('Erreur lors de la génération du PDF :', error);
    process.exit(1);
  }
})();
