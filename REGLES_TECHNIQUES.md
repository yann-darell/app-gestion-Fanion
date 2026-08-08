# REGLES_TECHNIQUES.md
## Règles de développement — École "Le Fanion"

> À charger avec `CONTEXTE_ANTIGRAVITY.md`. Ce document fixe **l'ordre de travail** et **les conventions de code**. L'agent IA doit refuser d'écrire une page tant que sa couche back correspondante n'existe pas, et refuser de créer un fichier hors de la structure imposée ci-dessous.

---

## 1. Règle d'or : toujours Back → IPC → Front, jamais l'inverse

Pour **chaque fonctionnalité**, l'ordre est **non négociable** :

1. **Schéma de données** (migration SQL si nouvelle table/colonne)
2. **Repository** (requêtes SQL brutes, une méthode = une opération)
3. **Service** (logique métier, validation, transactions)
4. **Handler IPC** (expose le service au preload, gère les erreurs)
5. **Types partagés** (requête/réponse du canal IPC)
6. **Preload** (ajout du canal dans `window.api`)
7. **Front** : hook de données (`useStudents`, `usePayments`...) qui appelle `window.api`
8. **Front** : composants et page qui consomment le hook

**Pourquoi** : coder le front avant que la donnée existe produit du mock, des types inventés, et des allers-retours inutiles. Une fonctionnalité n'est "commençable côté UI" que si son canal IPC répond déjà (même avec des données de test en base).

**Exception tolérée** : maquettage visuel pur (voir doc `DESIGN_VISUEL.md`) sur données statiques, uniquement pour valider un layout — ce code est jetable et explicitement commenté `// MAQUETTE TEMPORAIRE`, jamais branché sur un vrai state applicatif.

---

## 2. Convention de dossier : une feature = un dossier autonome

Chaque page/fonctionnalité du renderer vit dans **son propre dossier sous `src/pages/`**, avec cette structure fixe :

```
src/pages/students/
├── StudentsListPage.tsx        # page = composant exporté par défaut
├── StudentsListPage.module.css # si CSS Modules (sinon classes Tailwind inline)
├── components/                 # composants UTILISÉS UNIQUEMENT par cette page
│   ├── StudentRow.tsx
│   ├── StudentFilters.tsx
│   └── NewStudentModal.tsx
├── hooks/                      # hooks spécifiques à cette feature
│   └── useStudentsList.ts
└── types.ts                    # types locaux à la page (si non partagés)
```

Règles associées :

- **Un composant utilisé par une seule page reste dans `components/` de cette page.** Il ne monte dans `src/components/` global que le jour où une **deuxième page** en a besoin (règle "rule of two" — pas d'anticipation prématurée).
- **`src/components/ui/`** est réservé aux briques génériques sans connaissance métier (`Button`, `Table`, `Modal`...) — jamais de logique métier ni d'appel `window.api` dedans.
- **`src/components/layout/`** = éléments de structure globale (Sidebar, Header) uniquement.
- Chaque dossier de feature peut avoir un sous-dossier `components/` mais **jamais plus d'un niveau d'imbrication** (pas de `components/components/`).
- Le nom du fichier page = `NomDeLaPage.tsx` en PascalCase, suffixé `Page` (`StudentsListPage.tsx`, pas `page.tsx` générique — on n'est pas sur du Next.js App Router, la convention `page.tsx` n'a pas de sens ici).

Côté `electron/`, même logique de regroupement **par domaine métier**, pas par type technique global :

```
electron/
├── students/
│   ├── students.repository.ts
│   ├── students.service.ts
│   └── students.handlers.ts
├── finance/
│   ├── finance.repository.ts
│   ├── finance.service.ts
│   ├── receipt.service.ts
│   └── finance.handlers.ts
└── bulletins/
    ├── bulletins.repository.ts
    ├── bulletins.service.ts
    ├── docx-generator.service.ts
    └── bulletins.handlers.ts
```

(Ceci remplace la séparation par couches techniques horizontales proposée initialement dans `CONTEXTE_ANTIGRAVITY.md` — on regroupe **par domaine** pour que tout le code d'une feature soit trouvable au même endroit, back compris.)

---

## 3. Règles de qualité obligatoires (à chaque PR/lot de travail)

- **Zéro `any`** sans commentaire justifiant pourquoi.
- **Zéro logique métier dans un composant `.tsx`** — un composant appelle un hook, affiche un état (`loading` / `error` / `data`), ne calcule rien de significatif lui-même.
- **Zéro requête SQL en dehors d'un repository.**
- **Toute mutation DB multi-tables = transaction explicite.**
- **Tout canal IPC testé manuellement avant de passer au front** (via un script Node ou la console Electron) — ne pas découvrir un bug SQL en cliquant dans l'UI.
- **Un commit = une feature ou un fix, jamais un mélange.**

---

## 4. Ordre de développement global du projet (macro)

Reprend et précise l'ordre déjà fixé dans `CONTEXTE_ANTIGRAVITY.md`, avec le détail back/front à chaque étape :

| Lot | Back | Front |
|---|---|---|
| 0. Socle | DB + migrations + connexion + script de seed de test | Design system `ui/` (section design), layout Sidebar/Router |
| 1. Élèves | students repository/service/handlers | Liste, fiche, formulaire création/édition |
| 2. Bulletins (notes) | grades + subjects repository/service/handlers | Grille de saisie des notes par classe |
| 3. Bulletins (génération) | bulletin.service (calcul provisoire) + docx-generator | Écran génération, statut de complétude |
| 4. Finance | payments/fee_schedules repository/service + receipt PDF | Vue élève, vue d'ensemble, bouton paiement |
| 5. Tableau de bord | agrégation de requêtes existantes, pas de nouvelle table | Dashboard |
| 6. Paramètres | backup/restore DB, gestion année scolaire active | Écran paramètres |

**Règle d'arrêt** : on ne commence jamais le "Front" d'un lot tant que la ligne "Back" du même lot n'est pas terminée et testée.

---

## 5. Ce que l'agent IA doit faire si une instruction contredit ce document

Signaler explicitement la contradiction et proposer un choix, plutôt que de trancher silencieusement. Exemple : si on lui demande "crée vite fait la page Finance" alors que le back Finance n'existe pas encore, il doit répondre qu'il faut d'abord faire le repository/service/handler, et demander confirmation avant de faire une maquette temporaire.
