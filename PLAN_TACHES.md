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

## Lot D — Gestion des notes

- [ ] Migrations `subjects`, `subject_groups`, `class_subject_coefficients`, `terms`, `sequences`, `teacher_assignments`, `grades`
- [ ] Policies RLS strictes sur `grades` (voir `SECURITE.md` §3.2) — **priorité absolue de ce lot**
- [ ] Écran DE : gestion des matières par division
- [ ] Écran DE : configuration des coefficients par classe
- [ ] Écran DE : attribution enseignant → matière → classe
- [ ] Écran enseignant (web, mobile-first) : saisie des notes de son périmètre uniquement
- [ ] Fonction de calcul de moyenne de séquence (formule confirmée : `Σ(note×coef)/Σ(coef)`, voir `CONTEXTE_ANTIGRAVITY.md` §5)
- [ ] Fonction de moyenne trimestrielle : **formule désormais confirmée** (voir `CONTEXTE_ANTIGRAVITY.md` §5) — implémentation définitive possible, plus de TODO
- [ ] Fonction de calcul du code d'appréciation (CNA/CMA/CA/CBA/CTBA) à partir de la moyenne trimestrielle — formule confirmée
- [ ] **Nouveau** : écran "Bordereau de classe" — tableau tous élèves × toutes matières pour une séquence/trimestre donné (voir `CONTEXTE_ANTIGRAVITY.md` §10)
- [ ] **Nouveau** : classement de classe (liste triée par rang, élèves notés uniquement)
- [ ] **Nouveau** : graphique de distribution des moyennes de la classe

**Vérification** : avec 2 comptes enseignants différents, chacun assigné à une matière/classe différente, confirmer qu'aucun des deux ne voit les notes de l'autre — test réel avec les 2 comptes, pas une supposition basée sur le code. Vérifier aussi que le calcul de moyenne trimestrielle reproduit exactement les valeurs des fichiers Excel réels fournis par le client (ex : ONANINA 6ème → 13,22).

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