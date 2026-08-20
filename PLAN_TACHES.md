# PLAN_TACHES.md
## Feuille de route détaillée — Plateforme "Le Fanion" v2

> Reprend et détaille le plan de livraison itératif du cahier des charges (section 7). Chaque lot se termine par une vérification concrète avant de passer au suivant. Cocher au fur et à mesure.

---

## Lot A — Fondation technique

- [ ] Créer le projet Supabase (base + auth + storage)
- [ ] Écrire les migrations SQL de base : `divisions`, `school_years`, `classes`, `profiles`
- [ ] Créer manuellement 2 divisions (`College`, `Primaire`) et une année scolaire active
- [ ] Configurer Supabase Auth (invitation par email, pas d'inscription publique)
- [ ] Créer 3 comptes de test (un par rôle : `principal`, `directeur_etudes`, `enseignant`)
- [ ] Écrire les premières policies RLS sur `profiles` et `classes`
- [ ] Adapter le projet Electron existant pour se connecter à Supabase au lieu de SQLite (remplace `electron/db/connection.ts`)
- [ ] Initialiser le projet web (Vite + React + TypeScript + Tailwind, structure mobile-first dès le départ)

**Vérification avant de continuer** : connexion réussie avec chacun des 3 comptes de test, depuis le bureau ET depuis le web. Un compte `enseignant` ne doit voir aucune donnée tant qu'aucune permission n'est encore configurée (comportement attendu : accès vide, pas d'erreur).

---

## Lot B — Gestion des classes

- [ ] Vérifier/compléter la table `classes` existante (créée au Lot A) — colonnes déjà présentes : `name`, `level`, `division_id`, `school_year_id`, `head_teacher_name`
- [ ] Policies RLS : lecture pour tout utilisateur authentifié, écriture réservée `principal`/`directeur_etudes` (déjà posées au Lot A — vérifier qu'elles couvrent bien create/update/delete)
- [ ] Client API (`packages/shared/api/classes.ts`) partagé bureau/web
- [ ] Écran "Gestion des classes" : liste des classes par division, création, modification, (pas de suppression physique si des élèves y sont rattachés — cohérent avec la règle de soft-delete du projet)
- [ ] Formulaire de création : nom, niveau, division, année scolaire (celle active par défaut), professeur principal (texte libre pour l'instant, pourra devenir une vraie référence vers un compte enseignant plus tard)

**Vérification** : créer au moins une classe par division (ex : "6ème A" en Collège, "CM2 A" en Primaire) avec le compte `principal`, confirmer qu'un compte `enseignant` peut les lire mais pas en créer/modifier une nouvelle.

---

## Lot C — Élèves

- [ ] Migration `students` + policies RLS (lecture/écriture réservée `principal`/`directeur_etudes`)
- [ ] Bucket Supabase Storage pour les photos, avec policy d'accès par division
- [ ] Adapter la logique de matricule (fourni ou auto-généré) — reprise de la v1
- [ ] Client API (`packages/shared/api/students.ts`) partagé bureau/web
- [ ] Pages Élèves côté bureau (reprise et adaptation des composants v1 existants)
- [ ] Pages Élèves côté web (nouvelle interface, mobile-first)

**Vérification** : CRUD élève complet testé depuis le bureau ET le web, avec le compte `principal`. Tester explicitement qu'un compte `enseignant` ne peut PAS créer/modifier un élève (doit échouer proprement, erreur claire).

---

## Lot D — Gestion des notes (découpé en 4 sous-lots)

### D1 — Matières et coefficients

- [ ] Migrations `subjects`, `subject_groups`, `class_subject_coefficients`, `terms`, `sequences`
- [ ] Policies RLS : lecture pour tout authentifié, écriture réservée `principal`/`directeur_etudes`
- [ ] `packages/shared/api/subjects.ts` : CRUD matières, groupes, coefficients par classe
- [ ] Écran DE/Principal : gestion des matières par division (créer/lister/modifier)
- [ ] Écran DE/Principal : configuration des coefficients par classe (matière + groupe + coefficient)
- [ ] Seed des `terms`/`sequences` pour l'année active (3 trimestres × 2 séquences chacun)

**Vérification** : créer les matières et coefficients d'une classe réelle (ex : 6ème A), comparer avec la structure des fichiers Excel réels (groupes I à IV, mêmes coefficients que ONANINA/AYANGMA).

---

### D2 — Attribution des enseignants

- [ ] Migration `teacher_assignments` (enseignant → matière → classe)
- [ ] Policies RLS : lecture/écriture réservée `principal`/`directeur_etudes`
- [ ] `packages/shared/api/teacherAssignments.ts`
- [ ] Écran DE/Principal : attribuer un enseignant à une ou plusieurs matières/classes
- [ ] Écran DE/Principal : vue d'ensemble des attributions (qui enseigne quoi, où)

**Vérification** : attribuer 2 enseignants différents (le compte de test existant + un nouveau à créer) sur 2 matières/classes différentes.

---

### D2bis — Gestion des comptes utilisateurs (invitation enseignant)

> Ajout suite au cahier des charges v2 §4.5, identifié comme manquant après la construction de D2 : jusqu'ici, la création d'un compte enseignant nécessitait une manipulation manuelle du développeur dans le tableau de bord Supabase — la Principale/DE ne pouvait pas le faire elle-même. Ce sous-lot corrige ça.

**Contrainte technique impérative** : la création de compte nécessite la clé `service_role`, qui ne doit **jamais** être exposée côté client (bureau/web). Solution obligatoire : une **Supabase Edge Function**, qui seule détient cette clé côté serveur.

- [ ] Installer et configurer la CLI Supabase sur le poste de développement (nouvel outil, guidage pas à pas nécessaire)
- [ ] Créer la Edge Function `invite-teacher` : vérifie que l'appelant est `principal`/`directeur_etudes`, crée le compte via `auth.admin.inviteUserByEmail()`, insère le profil (`role = 'enseignant'`)
- [ ] Configurer le secret `SUPABASE_SERVICE_ROLE_KEY` côté Supabase (jamais dans le `.env` du projet client)
- [ ] Déployer la fonction (`supabase functions deploy invite-teacher`)
- [ ] `packages/shared/api/userManagement.ts` : `inviteTeacher(email, fullName)` appelant la Edge Function via `supabase.functions.invoke()`
- [ ] Écran "Gestion des comptes" (bureau + web) : formulaire d'invitation, liste des enseignants existants, réservé à `principal`/`directeur_etudes`
- [ ] **À ne pas oublier** : personnaliser l'écran affiché juste après le clic sur le lien d'invitation reçu par email (définition du mot de passe) — actuellement page générique par défaut de Supabase, à habiller avec le logo et la charte de l'école (`DESIGN_VISUEL.md`), pour une première impression cohérente

**Vérification** : inviter un 2ème enseignant de test depuis l'interface (pas depuis le tableau de bord Supabase), confirmer qu'il reçoit l'email et peut définir son mot de passe sur un écran à la charte de l'école, puis se connecter avec ce nouveau compte.

---

### D3 — Saisie des notes (le point de sécurité le plus sensible du projet)

- [x] Migration `grades`
- [x] Policy RLS stricte sur `grades` (voir `SECURITE.md` §3.2) — **priorité absolue** : un enseignant ne peut lire/écrire que les notes des élèves de sa classe, pour sa matière assignée (jointure via `teacher_assignments`)
- [x] `packages/shared/api/grades.ts`
- [x] Script `verify_rls_grades.js` avec 2 comptes enseignants différents, testant qu'aucun ne voit les notes de l'autre
- [x] Écran enseignant (web, mobile-first en priorité) : saisie des notes de son périmètre uniquement, par séquence
- [x] Fonction de calcul de moyenne de séquence (`Σ(note×coef)/Σ(coef)`, formule confirmée)
- [x] Fonction de moyenne trimestrielle (formule confirmée, voir `CONTEXTE_ANTIGRAVITY.md` §5)
- [x] Fonction de code d'appréciation (CNA/CMA/CA/CBA/CTBA, formule confirmée)
- [x] **Nouveau** : écran enseignant "Évolution de mes élèves" — graphique de tendance des moyennes de sa matière/classe, trimestre par trimestre (visible uniquement pour son périmètre assigné, jamais les autres matières/classes)

**Vérification** : avec 2 comptes enseignants réels, confirmer qu'aucun ne voit les notes de l'autre. Vérifier que la moyenne trimestrielle calculée reproduit exactement les valeurs des fichiers Excel réels (ex : ONANINA 6ème → 13,22). Vérifier que le graphique d'évolution d'un enseignant ne montre que sa propre matière.

---

### D4 — Bordereau, classement, graphique

- [x] Écran "Bordereau de classe" : tableau tous élèves × toutes matières pour une séquence/trimestre (voir `CONTEXTE_ANTIGRAVITY.md` §10)
- [x] Classement de classe (rang, élèves notés uniquement — règle confirmée)
- [x] Graphique de distribution des moyennes de la classe

**Vérification** : le bordereau et le classement générés pour une classe réelle correspondent aux valeurs des fichiers Excel de référence.

---
## Lot E — Bulletins

- [x] ~~Décider de l'approche de génération~~ — **tranché** : les fichiers Word réels contiennent le tableau de notes comme image collée depuis Excel (pas de texte éditable), `docxtemplater` n'est donc pas viable pour cette partie. Génération directe en PDF (via `pdf-lib`), reproduisant la mise en page des bulletins PDF officiels déjà analysés. Voir `CONTEXTE_ANTIGRAVITY.md` §9 point 4.
- [ ] Migration `bulletin_generations`
- [ ] Service de génération PDF (mise en page fidèle : en-tête établissement + logo, identité élève, tableau par groupe de matières, moyennes, rang, codes d'appréciation, décisions)
- [ ] Écran de génération (individuelle et par classe)
- [ ] Vérification de complétude des notes avant génération (avertissement si notes manquantes)

**Vérification** : un bulletin généré pour un élève réel (ex : reproduire ONANINA 6ème à partir des mêmes notes) doit correspondre exactement au bulletin PDF officiel déjà en notre possession, chiffre pour chiffre.

**Restent à demander au client avant finalisation** : signification en toutes lettres de CNA/CMA/CA/CBA/CTBA (les seuils sont confirmés, l'intitulé complet reste à valider).

---

## Lot F — Finance (révisée v2)

- [ ] Migrations `fee_schedules` (avec `registration_fee`), `student_fee_overrides`, `payments`, `receipts`, `receipt_counters`
- [ ] Fonction centralisée d'allocation par tranche (`CONTEXTE_ANTIGRAVITY.md` §6.1) — **à tester unitairement avant intégration UI**
- [ ] Service de génération de reçu PDF avec logo officiel
- [ ] Écran configuration des tarifs (reprise du concept v1, adapté aux vrais montants du client)
- [ ] Écran enregistrement de paiement, avec affichage de la répartition par tranche
- [ ] Écran bourse/réduction individuelle
- [ ] Implémentation provisoire de la règle d'activation par inscription (§6.2), documentée comme hypothèse
- [ ] États financiers (3 niveaux : complexe, Collège, Primaire) — contenu exact à confirmer avec le client avant de coder l'affichage détaillé

**Vérification** : saisir 3 paiements successifs pour un même élève avec des montants ne correspondant pas exactement aux tranches, confirmer que l'allocation (y compris les avances) est correcte à chaque étape. Ouvrir un reçu PDF, vérifier la présence du logo et la lisibilité des montants.

---

## Lot G — Fournitures

- [ ] Migrations `supply_requirements`, `student_supplies`
- [ ] Écran de configuration (définir si une fourniture est physique ou monétaire, par division)
- [ ] Écran de suivi physique (donné/manquant) par élève
- [ ] Pour le mode monétaire : vérifier l'intégration automatique dans `fee_schedules` sans écran de suivi séparé

**Vérification** : une fourniture "physique" au Collège et une fourniture "monétaire" au Primaire, configurées et fonctionnelles simultanément sans confusion entre les deux modes.

---

## Lot H — Web responsive complet

- [ ] Audit mobile de toutes les pages déjà construites (surtout saisie de notes, lot D)
- [ ] Ajustement des layouts non encore mobile-first
- [ ] Test réel sur téléphone (pas seulement redimensionnement de fenêtre desktop)

**Vérification** : un enseignant peut saisir un carnet de notes complet depuis son téléphone, sans blocage ni défilement horizontal gênant.

---

## Rappel — à chaque fin de lot

1. Committer avec un message clair.
2. Mettre à jour ce fichier (cocher les tâches terminées).
3. Si un point du cahier des charges s'avère faux ou incomplet à l'usage, le signaler avant de continuer plutôt que de coder autour du problème.