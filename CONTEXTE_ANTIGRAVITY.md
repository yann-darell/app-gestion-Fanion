# CONTEXTE_ANTIGRAVITY.md
## Application de gestion scolaire — École "Le Fanion" (Yaoundé)

> **But de ce document** : c'est le contexte de référence à charger en tête de chaque session de développement dans l'agent IA. Il fixe l'architecture, les règles, les écrans, les bibliothèques et les priorités. L'agent doit s'y conformer strictement et signaler toute contradiction plutôt que d'improviser.

---

## 1. Contexte projet

- **Client** : école privée bilingue "Le Fanion", Yaoundé. Le principal est un proche du développeur — exigences transmises directement, pas de cahier des charges formel figé.
- **Déploiement** : application de bureau, **un seul PC Windows**, fonctionnement **100% local, sans connexion internet obligatoire**.
- **Évolution future (hors v1, à ne pas coder maintenant)** : partage en réseau local. Décision retenue : **on ne construit PAS de couche client-serveur**. Le futur partage se fera via un fichier SQLite placé dans un dossier réseau Windows partagé, avec un seul poste en écriture à la fois (verrouillage manuel/organisationnel, pas applicatif). Donc :
  - Pas d'API HTTP, pas de serveur Express, pas de sync multi-poste à prévoir en v1.
  - Seule précaution utile dès maintenant : ouvrir la base SQLite avec des options tolérantes à un chemin réseau (éviter les verrous agressifs, activer `journal_mode = WAL` avec prudence — WAL est déconseillé sur partage réseau SMB, donc **prévoir un mode `journal_mode = DELETE` ou `TRUNCATE` commutable** si un jour la base est déplacée sur un partage réseau). Ne pas complexifier davantage.

- **3 modules v1** :
  1. **Gestion des élèves** (fiches, classes, années scolaires)
  2. **Gestion financière** (frais de scolarité, paiements, reçus PDF)
  3. **Bulletins de notes** (priorité n°1 du client) — génération Word à partir du template officiel de l'école

---

## 2. Stack technique (figée, ne pas dévier sans discussion explicite)

| Domaine | Choix | Rôle |
|---|---|---|
| Shell applicatif | **Electron** | packaging desktop Windows |
| UI | **React 18 + TypeScript** | interface |
| Build | **Vite** | dev server + bundling du renderer |
| Base de données | **SQLite** via **better-sqlite3** | stockage local, synchrone, simple |
| Génération PDF (reçus) | **pdf-lib** | reçus de paiement |
| Génération Word (bulletins) | **docxtemplater** + **pizzip** | remplissage du template `.docx` officiel |
| Packaging | **electron-builder** | exécutable Windows (.exe/installeur) |
| Style UI | à définir en session (recommandé : CSS Modules ou Tailwind — **Tailwind conseillé** pour rapidité, pas de dépendance externe) |
| Formulaires/validation | **react-hook-form** + **zod** (léger, TypeScript-first, pas de sur-ingénierie) |
| Dates | **date-fns** (léger, pas moment.js) |
| Routing interne renderer | **react-router-dom** (HashRouter obligatoire sous Electron, pas BrowserRouter) |

**Interdits explicites** : pas de framework backend HTTP, pas d'ORM lourd (Prisma/TypeORM — better-sqlite3 en accès direct suffit et reste debuggable), pas de state manager global type Redux (le state est simple : Context API + hooks suffisent), pas de dépendance cloud (auth cloud, Firebase, etc.).

---

## 3. Architecture applicative

Architecture Electron standard à 3 couches, avec **contextIsolation activée** et **aucun accès Node direct depuis le renderer** (sécurité de base même en local, pour éviter les bugs de sérialisation IPC et garder une séparation propre).

```
┌─────────────────────────────┐
│  Renderer (React/TS/Vite)   │  UI uniquement, aucun accès fichier/DB direct
│  - pages/, components/      │
│  - appelle window.api.xxx() │
└──────────────┬───────────────┘
               │ IPC (contextBridge, canaux typés)
┌──────────────▼───────────────┐
│  Preload script               │  expose une API restreinte et typée
└──────────────┬───────────────┘
               │
┌──────────────▼───────────────┐
│  Main process (Node)          │
│  - handlers IPC (ipcMain)     │
│  - services/ (logique métier) │
│  - repositories/ (SQL)        │
│  - db/ (connexion, migrations)│
│  - pdf/, docx/ (génération)   │
└───────────────────────────────┘
```

Règle de circulation stricte : **Renderer → Preload (typé) → Main handler → Service → Repository → SQLite**. Le renderer ne connaît jamais le SQL ni les chemins de fichiers.

---

## 4. Arborescence des dossiers

```
le-fanion-app/
├── electron/
│   ├── main.ts                    # point d'entrée process main
│   ├── preload.ts                 # contextBridge, API exposée
│   ├── ipc/
│   │   ├── students.handlers.ts
│   │   ├── finance.handlers.ts
│   │   ├── bulletins.handlers.ts
│   │   └── system.handlers.ts     # backup, chemins, version
│   ├── db/
│   │   ├── connection.ts          # ouverture better-sqlite3
│   │   ├── migrations/
│   │   │   ├── 001_init.sql
│   │   │   ├── 002_finance.sql
│   │   │   └── 003_bulletins.sql
│   │   └── migrate.ts             # runner de migrations séquentiel
│   ├── repositories/
│   │   ├── student.repository.ts
│   │   ├── class.repository.ts
│   │   ├── payment.repository.ts
│   │   ├── grade.repository.ts
│   │   └── subject.repository.ts
│   ├── services/
│   │   ├── student.service.ts
│   │   ├── finance.service.ts     # calcul soldes, échéances
│   │   ├── receipt.service.ts     # génération PDF (pdf-lib)
│   │   └── bulletin.service.ts    # calcul moyennes, rangs, génération docx
│   └── types/                     # types partagés main
├── src/                            # renderer (React)
│   ├── main.tsx
│   ├── App.tsx
│   ├── router.tsx
│   ├── pages/
│   │   ├── students/
│   │   ├── finance/
│   │   ├── bulletins/
│   │   └── settings/
│   ├── components/
│   │   ├── ui/                    # composants génériques réutilisables
│   │   ├── layout/                # Sidebar, Header, PageContainer
│   │   ├── students/               # composants spécifiques élèves
│   │   ├── finance/
│   │   └── bulletins/
│   ├── hooks/
│   ├── context/                   # AppContext (année scolaire active, etc.)
│   ├── api/                       # wrapper typé autour de window.api
│   ├── types/                     # types partagés renderer (miroir de electron/types)
│   └── styles/
├── templates/
│   └── bulletin_officiel.docx     # template fourni par le client (à venir)
├── resources/                     # icônes, assets electron-builder
├── electron-builder.yml
├── vite.config.ts
├── tsconfig.json
└── CONTEXTE_ANTIGRAVITY.md        # ce fichier
```

**Règle de nommage** : `PascalCase` pour composants React, `camelCase` pour fonctions/variables, `snake_case` réservé aux colonnes SQL uniquement (mappées en `camelCase` dans les repositories — ne jamais laisser du snake_case fuiter jusqu'au renderer).

---

## 5. Modèle de données (SQLite)

Schéma cible v1 (types simplifiés, à raffiner en migration SQL réelle) :

```sql
-- Années scolaires
school_years (id, label, start_date, end_date, is_active)

-- Classes (ex: 6ème A, 5ème B)
classes (id, name, level, school_year_id, apc_enabled BOOLEAN)

-- Élèves
students (id, matricule, last_name, first_name, birth_date, gender,
          class_id, guardian_name, guardian_phone, status, enrolled_at)

-- Matières
subjects (id, name, code)

-- Groupes de matières (I à IV) avec coefficient par niveau de classe
subject_groups (id, label)              -- I, II, III, IV
class_subject_coefficients (id, class_level, subject_id, subject_group_id, coefficient)

-- Trimestres
terms (id, school_year_id, label, order_index)  -- Trimestre 1/2/3

-- Notes
grades (id, student_id, subject_id, term_id, score, appreciation_code)
        -- appreciation_code = CMA / CNA / CA (légende à confirmer)

-- Compétences APC (pour niveaux en évaluation par compétences)
competencies (id, subject_id, label)
competency_grades (id, student_id, competency_id, term_id, level_achieved)

-- Finance
fee_schedules (id, class_id, school_year_id, total_amount, installments_json)
payments (id, student_id, school_year_id, amount, payment_date, method, receipt_number)
receipts (id, payment_id, pdf_path, generated_at)

-- Bulletins générés (traçabilité)
bulletin_generations (id, student_id, term_id, generated_at, docx_path, pdf_path)
```

Points structurants :
- **Un élève appartient à une classe pour une année scolaire donnée** → si un élève redouble ou change de classe, on garde l'historique (table de liaison `student_class_history` à ajouter si besoin réel, ne pas sur-anticiper en v1).
- Les coefficients sont **rattachés au niveau de classe**, pas à la classe elle-même (6ème A et 6ème B partagent les mêmes coefficients) — confirmé par l'analyse des bulletins PDF fournis.
- Les moyennes et rangs **ne sont jamais stockés en dur** : ils sont **recalculés à la génération du bulletin** à partir des notes brutes, pour éviter toute désynchronisation. Seule la génération elle-même (le fichier produit) est tracée dans `bulletin_generations`.

---

## 6. Contrat IPC (canaux exposés par le preload)

Convention de nommage : `domaine:action`. Tous les handlers retournent soit `{ ok: true, data }` soit `{ ok: false, error }` — **jamais d'exception non gérée traversant l'IPC**.

```
students:list / students:get / students:create / students:update / students:delete
classes:list / classes:create
finance:getBalance(studentId) / finance:recordPayment / finance:generateReceipt
bulletins:computeAverages(classId, termId)   # calcul à blanc, sans génération de fichier
bulletins:generate(studentId, termId)        # génère le .docx (et PDF si demandé)
bulletins:generateForClass(classId, termId)  # génération en masse
system:pickBackupFolder / system:runBackup / system:getAppVersion
```

Chaque canal a un type de requête/réponse défini dans `types/ipc.ts`, partagé (via chemin relatif ou duplication contrôlée) entre `electron/` et `src/`.

---

## 7. Règles métier

### 7.1 Élèves
- Matricule unique par élève, généré ou saisi manuellement (à trancher — proposer une génération automatique `ANNEE-CLASSE-SEQ` par défaut, modifiable).
- Un élève est rattaché à une classe et une année scolaire active.

### 7.2 Finance
- Un `fee_schedule` définit le montant total dû par classe/année, avec un échéancier (tranches).
- Chaque paiement génère un reçu PDF (numéroté séquentiellement, non modifiable après génération — traçabilité).
- Le solde d'un élève = total dû − somme des paiements enregistrés.

### 7.3 Bulletins (module prioritaire) — état des lieux

**Confirmé par l'analyse des bulletins PDF (6ème, 5ème, 3ème, 2nde, 1ère)** :
- Matières groupées en **4 groupes (I à IV)**, coefficients définis par niveau de classe.
- Certains niveaux utilisent l'**évaluation par compétences (APC)** en plus/à la place de la notation chiffrée classique.
- Les **rangs et moyennes de classe nécessitent que toutes les notes de tous les élèves de la classe soient saisies** avant génération — le système doit bloquer ou avertir si des notes manquent.

**⚠️ 3 questions bloquantes non résolues — ne pas coder la logique de calcul tant qu'elles ne sont pas tranchées par le principal :**
1. **Formule exacte de la moyenne trimestrielle** — confirmée non-arithmétique (donc pas une simple moyenne pondérée par coefficient), mais formule précise inconnue.
2. **Périmètre du classement** — sur les seuls élèves notés dans la matière/le trimestre, ou sur l'effectif complet de la classe ?
3. **Légende des codes d'appréciation du travail** (CMA / CNA / CA) — signification exacte à confirmer pour affichage correct sur le bulletin.

**Directive à l'agent IA** : implémenter la saisie des notes, le stockage, et l'intégration du template docx **peuvent avancer dès maintenant**. La **fonction de calcul de moyenne/rang doit être isolée dans une seule fonction pure et clairement marquée `// TODO: formule à confirmer avec le client`**, avec une implémentation provisoire (moyenne pondérée simple) explicitement documentée comme temporaire, pour ne pas bloquer le reste du développement.

---

## 8. Cartographie des écrans (v1)

| Écran | Route | Contenu |
|---|---|---|
| Tableau de bord | `/` | Résumé : effectifs, paiements du jour, bulletins en attente |
| Liste des élèves | `/students` | Table filtrable par classe, recherche |
| Fiche élève | `/students/:id` | Infos, historique paiements, notes, actions |
| Nouvelle inscription | `/students/new` | Formulaire création |
| Gestion des classes | `/classes` | Liste classes, coefficients par niveau |
| Finance — Vue élève | `/finance/:studentId` | Solde, échéancier, historique, bouton "Enregistrer un paiement" |
| Finance — Vue d'ensemble | `/finance` | Liste des soldes par classe, relances impayés |
| Saisie des notes | `/grades/:classId/:termId` | Grille de saisie par matière, tous élèves de la classe |
| Génération bulletins | `/bulletins/:classId/:termId` | Statut de complétude des notes, bouton génération individuelle/masse |
| Paramètres | `/settings` | Année scolaire active, sauvegarde/restauration DB, template bulletin |

---

## 9. Composants réutilisables (design system léger)

À construire dans `src/components/ui/` en tout premier, avant les pages :

- `Button`, `IconButton`
- `Input`, `Select`, `DatePicker`, `NumberInput`
- `Table` (avec tri, pagination simple — pas de librairie lourde type react-table sauf besoin avéré)
- `Modal`, `ConfirmDialog`
- `Badge` (statuts : payé/partiel/impayé, notes complètes/incomplètes)
- `Toast` (retours succès/erreur après actions IPC)
- `PageHeader`, `PageContainer`, `Sidebar`, `EmptyState`, `LoadingSpinner`

Règle : **aucune page ne doit contenir de style ad hoc dupliqué** — tout élément visuel répété (carte élève, ligne de tableau de paiement, etc.) devient un composant dans le dossier du module concerné (`components/students/`, `components/finance/`...).

---

## 10. Conventions de code

- TypeScript strict (`strict: true`), pas de `any` sauf frontière IPC brute justifiée.
- Validation des entrées utilisateur avec `zod`, au plus près du formulaire (renderer) **et** revalidation côté service (main) avant écriture DB — ne jamais faire confiance au renderer seul.
- Toute écriture DB multi-tables passe par une transaction `better-sqlite3` (`db.transaction(...)`).
- Erreurs métier = classes d'erreur typées (`InsufficientDataError`, `DuplicateMatriculeError`...) interceptées au niveau du handler IPC et traduites en message utilisateur clair.
- Pas de logique métier dans les composants React — les pages orchestrent, les hooks/services encapsulent la logique.

---

## 11. Sécurité & robustesse (contexte local mais sérieux)

- `contextIsolation: true`, `nodeIntegration: false` dans `BrowserWindow`.
- Sauvegarde de la base : fonction "Exporter une sauvegarde" copiant le fichier `.sqlite` vers un dossier choisi par l'utilisateur (bouton dans Paramètres), à faire tôt car c'est la seule protection contre la perte de données sur un poste unique.
- Numérotation des reçus et bulletins : séquentielle et non réutilisable, même en cas d'erreur/annulation (traçabilité comptable).

---

## 12. Ordre d'implémentation recommandé

1. Scaffolding DB + migrations (schéma section 5) + connexion main process
2. Design system minimal (section 9) + layout (Sidebar/Router)
3. Module Élèves (CRUD complet) — valide toute la chaîne IPC de bout en bout
4. Module Bulletins — saisie des notes + intégration template docx dès réception (priorité client), avec formule de moyenne provisoire clairement marquée TODO
5. Module Finance — paiements + reçus PDF
6. Tableau de bord + Paramètres (sauvegarde DB)

---

## 13. Questions ouvertes à trancher avec le principal (rappel, bloquant pour le calcul des bulletins)

1. Formule exacte de la moyenne trimestrielle (non-arithmétique, formule précise manquante).
2. Périmètre du classement : élèves notés uniquement, ou effectif complet de la classe.
3. Légende des codes CMA / CNA / CA.

Tant que ces réponses ne sont pas obtenues, ne pas figer la fonction de calcul de moyenne/rang en dur dans plusieurs endroits du code — la garder centralisée pour un remplacement en un seul point.
