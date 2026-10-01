# Plan d'Implémentation : Reçu et Bordereau de Paiement pour le Primaire

**Objectif :** Adapter automatiquement les reçus de paiement et les bordereaux financiers de classe au Primaire avec le logo officiel (« Complexe Scolaire Bilingue La Grâce »), la charte graphique (Vert forêt `#2D6A2D` et Cyan lagon `#00A6B4`), et intégrer le filtrage par division dans l'interface de l'état financier.

**Architecture :** 
- Détection dynamique de la division (`student.classes.division_id === 'primaire'` ou `report.divisionId === 'primaire'`).
- Embarquement de l'asset `LOGO_PRIMAIRE_BASE64` en JPEG base64 natif pour `pdf-lib`.
- Paramétrage modulaire des palettes de couleurs et textes d'en-tête (Collège Le Fanion vs Primaire La Grâce) dans les générateurs PDF.
- Ajout du composant de navigation par division `[Collège | Primaire]` dans la page d'état financier de classe.

**Technologies clés :** TypeScript, React, pdf-lib, Tailwind CSS, Supabase API.

---

### Tâche 1 : Asset du Logo Primaire
**Fichiers ciblés :**
- Créer / vérifier : `packages/shared/assets/logoPrimaireBase64.ts`
- Exporter : `packages/shared/index.ts`

- [x] **Étape 1 : Créer `logoPrimaireBase64.ts` contenant `LOGO_PRIMAIRE_BASE64`**
- [x] **Étape 2 : Exporter `LOGO_PRIMAIRE_BASE64` dans `packages/shared/index.ts`**
- [x] **Étape 3 : Vérifier la compilation TypeScript dans `packages/shared`**

---

### Tâche 2 : Adaptation du Reçu de Paiement (`receiptPdfService.ts`)
**Fichiers ciblés :**
- Modifier : `packages/shared/api/receiptPdfService.ts`

- [x] **Étape 1 : Récupérer `division_id` dans la requête élève/classe :**
  ```ts
  .select("*, classes(name, level, division_id)")
  ```
- [x] **Étape 2 : Définir la configuration de style selon la division :**
  ```ts
  const isPrimary = student?.classes?.division_id === "primaire";
  // Couleurs :
  // Ink : isPrimary ? rgb(0.176, 0.416, 0.176) : rgb(0.082, 0.039, 0.368)
  // Accent : isPrimary ? rgb(0.0, 0.651, 0.706) : slateColor
  // En-tête : isPrimary ? "COMPLEXE SCOLAIRE BILINGUE LA GRÂCE" : "COLLÈGE PRIVÉ LAÏQUE LE FANION"
  // Logo : logoPrimaire (embedJpg) ou logoFanion (embedPng)
  ```
- [x] **Étape 3 : Appliquer le bon logo, filigrane et les couleurs aux bordures et tableaux.**

---

### Tâche 3 : Adaptation du Bordereau Financier PDF de Classe (`classFinancialReportPdfService.ts`)
**Fichiers ciblés :**
- Modifier : `packages/shared/api/classFinancialReportPdfService.ts`

- [x] **Étape 1 : Identifier la division via `report.divisionId` :**
  ```ts
  const isPrimary = report.divisionId === "primaire";
  ```
- [x] **Étape 2 : Adapter le logo, les coordonnées d'en-tête, la couleur des titres et les cadres.**
- [x] **Étape 3 : Ajuster les couleurs de mise en valeur des colonnes de tranches.**

---

### Tâche 4 : Ajout du Filtre de Division sur la Page État Financier (`ClassFinancialReportPage.tsx`)
**Fichiers ciblés :**
- Modifier : `packages/web/src/pages/finance/ClassFinancialReportPage.tsx`

- [x] **Étape 1 : Ajouter l'état persistant de la division sélectionnée :**
  ```tsx
  const [selectedDivision, setSelectedDivision] = useSelectionPersistence("financialDivision", "college");
  ```
- [x] **Étape 2 : Filtrer les classes chargées selon `selectedDivision` lors de l'appel `listClasses(selectedDivision)`.**
- [x] **Étape 3 : Ajouter les boutons d'onglets de division `[Collège | Primaire]` dans la barre de filtres au-dessus du sélecteur de classe.**

---

### Tâche 5 : Validation & Tests
- [x] **Étape 1 : Compiler et valider les builds sans erreur de types (`@fanion/shared`, `@fanion/web`).**
- [ ] **Étape 2 : Tester la génération d'un reçu d'une classe du primaire et vérifier le rendu PDF.**
- [ ] **Étape 3 : Tester le téléchargement du bordereau de paiement pour une classe du primaire et du collège.**
