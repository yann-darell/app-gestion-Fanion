# CONTEXTE_ANTIGRAVITY.md (v2)
## Plateforme de gestion scolaire — "Le Fanion"

> Document de référence à charger en tête de chaque session de développement. Remplace la version v1 (application de bureau mono-poste). Le cahier des charges complet (PDF) fait foi pour le contexte métier ; ce document traduit ce cahier des charges en contraintes techniques actionnables pour l'agent IA.

---

## 1. Résumé du projet

Plateforme de gestion scolaire pour un établissement bilingue à Yaoundé, composé de deux divisions strictement séparées (**Collège** et **Primaire**), accessible via une **application de bureau** (Electron, existante, adaptée) et une **plateforme web** (nouvelle, React, optimisée mobile). Les deux clients consomment la même base de données centrale hébergée sur **Supabase**.

Trois utilisateurs types : **Principal(e)/Directrice** (une seule personne, accès complet aux deux divisions), **Directeur des Études (DE)** (accès complet aux deux divisions, configure matières/coefficients/attributions), **Enseignant** (accès restreint à sa/ses matière(s) et classe(s) assignée(s)).

---

## 2. Stack technique (figée)

| Domaine | Choix | Rôle |
|---|---|---|
| Base de données | **PostgreSQL** (via Supabase) | Stockage central, remplace SQLite |
| Authentification | **Supabase Auth** | Comptes utilisateurs, sessions, invitation-only |
| Permissions | **Row Level Security (RLS) PostgreSQL** | Contrôle d'accès appliqué au niveau base de données, pas seulement affichage |
| Stockage fichiers | **Supabase Storage** | Photos élèves, reçus PDF, bulletins générés |
| App de bureau | **Electron + React 18 + TypeScript + Vite** (existant, adapté) | Client desktop |
| Plateforme web | **React 18 + TypeScript + Vite**, responsive mobile-first | Client web, priorité à la saisie de notes sur téléphone |
| Client API | **@supabase/supabase-js** | Utilisé identiquement par le bureau et le web — logique métier partagée au maximum |
| Génération PDF (reçus) | **pdf-lib** | Reçus avec logo officiel de l'école |
| Génération bulletins | **pdf-lib** | Génération PDF directe (pas de template Word — voir §9 point 4, le tableau de notes des fichiers Word réels est une image, pas du texte gabarisable) |
| Formulaires/validation | **react-hook-form** + **zod** | Identique v1 |
| Style UI | **Tailwind CSS** | Identique v1, tokens mis à jour (voir DESIGN_VISUEL.md v2) |
| Routing web | **react-router-dom** (BrowserRouter) | Web = URLs normales |
| Routing bureau | **react-router-dom** (HashRouter, contrainte Electron inchangée) | |

**Changement fondamental par rapport à v1** : plus d'accès direct à une base SQLite locale. Toute donnée transite par l'API Supabase (HTTPS), avec authentification systématique. Aucun fonctionnement hors-ligne n'est garanti.

---

## 3. Structure organisationnelle et modèle de rôles

Deux divisions (`College`, `Primaire`) totalement indépendantes en données. Trois rôles :

| Rôle | Périmètre | Droits |
|---|---|---|
| `principal` | Collège + Primaire | Accès complet aux deux divisions |
| `directeur_etudes` | Collège + Primaire | Accès complet aux deux divisions + configuration matières/coefficients/attributions enseignants |
| `enseignant` | Matière(s) + classe(s) assignée(s) uniquement | Saisie/consultation des notes de son périmètre uniquement, aucun accès finance/élèves hors notes |

**Comptes uniquement sur invitation** — jamais d'inscription publique. Le principal/DE crée le compte (email), Supabase Auth envoie un lien de définition de mot de passe.

---

## 4. Modèle de données (PostgreSQL)

```sql
-- Organisation
divisions (id, nom)  -- 'College' / 'Primaire'
school_years (id, label, start_date, end_date, is_active)
classes (id, name, level, division_id, school_year_id, head_teacher_name)

-- Comptes et rôles
profiles (id [= auth.users.id], full_name, role, division_scope)
  -- role: 'principal' | 'directeur_etudes' | 'enseignant'
  -- division_scope: null si accès aux deux divisions, sinon restreint (cas futur)

teacher_assignments (id, teacher_id, subject_id, class_id)  -- périmètre exact d'un enseignant

-- Élèves
students (id, matricule, last_name, first_name, birth_date, birth_place,
          gender, nationality, is_repeating, class_id, guardian_name,
          guardian_phone, status, photo_path, enrolled_at)
  -- status: 'active' | 'inactive' | 'pending_registration' (voir règle d'activation §6)

-- Notes
subjects (id, name, division_id)
subject_groups (id, label)  -- I à IV
class_subject_coefficients (id, class_id, subject_id, subject_group_id, coefficient)
terms (id, school_year_id, label, order_index)  -- trimestres
sequences (id, term_id, label, order_index)  -- 2 séquences par trimestre
grades (id, student_id, subject_id, sequence_id, score, appreciation_code)
competencies (id, subject_id, label)  -- niveaux APC
competency_grades (id, student_id, competency_id, sequence_id, level_achieved)
bulletin_generations (id, student_id, term_id, generated_at, docx_path, pdf_path)

-- Finance
fee_schedules (id, class_id, school_year_id, registration_fee, total_amount, installments_json)
  -- installments_json : [{label, amount, due_date}, ...] dans l'ordre officiel
student_fee_overrides (id, student_id, school_year_id, total_amount_override, reason, created_at)
payments (id, student_id, school_year_id, amount, payment_date, method, receipt_number,
          tranche_ciblee)  -- calculé automatiquement, voir §6
receipts (id, payment_id, pdf_path, generated_at)
receipt_counters (id, next_value)  -- séquence jamais réutilisée

-- Fournitures
supply_requirements (id, division_id, school_year_id, label, mode)  -- mode: 'physique' | 'monetaire'
student_supplies (id, student_id, supply_requirement_id, school_year_id, status)  -- 'donne' | 'manquant'
```

**Séparation des divisions** : chaque table métier porte (directement ou via sa classe) un `division_id`. Les policies RLS (voir `SECURITE.md`) filtrent automatiquement selon le rôle et la division de l'utilisateur connecté — **jamais de filtre uniquement côté application**.

---

## 5. Règles métier confirmées (issues de l'analyse des bulletins réels et du cahier des charges validé)

- **Moyenne de séquence** = `Σ(note × coefficient) / Σ(coefficient)` sur toutes les matières globalement (confirmé par calcul sur bulletins réels).
- **Moyenne trimestrielle** — **CONFIRMÉE**, extraite des formules réelles du classeur Excel de production de l'école (fichier "BORDEREAU et BULLETIN 6ème") :
  ```
  Pour chaque matière : score_trimestre = (score_séquence1 + score_séquence2) / 2
  moyenne_trimestre = Σ(score_trimestre_matière × coefficient) / Σ(coefficient), sur toutes les matières
  ```
  Vérifiée numériquement sur un élève réel (ONANINA, 6ème) : résultat exact `13,2155...` → arrondi affiché `13,22`, cohérent avec le bulletin PDF déjà analysé.
- **Barème lettre — CONFIRMÉ** (formule Excel exacte, plus seulement déduit par recoupement) :
  `< 10 → D | 10–11,99 → C | 12–13,99 → C+ | 14–14,99 → B | 15–15,99 → B+ | 16–17,99 → A | 18–20 → A+`
- **Codes d'appréciation — CONFIRMÉS**, calculés automatiquement à partir de la moyenne trimestrielle (formule Excel exacte) :
  `< 10 → CNA | 10–11,99 → CMA | 12–13,99 → CA | 14–15,99 → CBA | 16–20 → CTBA`
  (2 codes de plus que ce qu'on avait identifié sur les PDF seuls : CBA et CTBA existent aussi.)
- **Rang — périmètre CONFIRMÉ** : calculé uniquement sur les élèves ayant une moyenne renseignée (les élèves sans note sont exclus du classement, `RANK` sur la colonne des moyennes). Le dénominateur affiché ("1er/08") correspond au nombre d'élèves **notés**, pas à l'effectif total de la classe — confirmé par comparaison avec le bulletin PDF officiel (effectif 12, classement sur 8). Toujours recalculé à la génération, jamais stocké.
- **Moyenne de groupe** (par groupe I à IV) : `Σ(score_trimestre_matière × coefficient) / Σ(coefficient)` restreint aux matières du groupe — déjà notre hypothèse v1, confirmée.

---

## 6. Règles métier Finance (nouvelles, v2)

### 6.1 Répartition automatique des paiements par tranche

Tout paiement (hors inscription) est **alloué automatiquement à la première tranche non complétée**, dans l'ordre défini par `installments_json`. Un dépassement devient une avance sur la tranche suivante.

```
fonction allouerPaiement(eleve, montant):
  tranches = tranches de la classe de l'eleve, dans l'ordre
  reste = montant
  pour chaque tranche non completee (dans l'ordre):
    combler cette tranche avec min(reste, montant_manquant_tranche)
    reste -= montant_comble
    si reste == 0: arrêter
  si reste > 0 après la dernière tranche: excédent affiché comme avance globale
```

Cette fonction doit être **centralisée en un seul endroit** (service), jamais dupliquée.

### 6.2 Règle d'activation par inscription (hypothèse de travail, non figée)

Un élève est `status = 'pending_registration'` tant que les frais d'inscription ne sont pas intégralement payés, `status = 'active'` une fois payés. **Conséquences exactes non confirmées** (peut-il être rattaché à une classe/avoir des notes avant activation ?) — À valider avec le DE et la Principale avant implémentation définitive. Coder cette règle de façon isolée et documentée comme hypothèse.

### 6.3 Frais d'inscription jamais réduits individuellement

`student_fee_overrides` ne s'applique qu'à `total_amount` (scolarité), jamais à `registration_fee`.

### 6.4 Reçus

PDF généré via `pdf-lib`, doit intégrer le **logo officiel de l'école** (fichier fourni, à stocker dans le projet), numérotation strictement séquentielle via `receipt_counters`, jamais réutilisée même après suppression d'un paiement.

---

## 7. Fournitures — double mode

- `mode = 'physique'` → suivi par élève via `student_supplies` (donné/manquant), aucun lien avec le module Finance.
- `mode = 'monetaire'` → aucune ligne dans `student_supplies` ; le montant est directement intégré dans `fee_schedules` de la classe concernée, suit le circuit de paiement normal.

---

## 8. Contraintes non négociables (rappel du cahier des charges)

1. Connexion internet requise (assumé, pas de mode hors-ligne).
2. Séparation stricte des divisions — appliquée en base (RLS), pas juste en façade.
3. Permissions enseignant vérifiées en base, pas seulement à l'écran.
4. Traçabilité financière : numérotation de reçus jamais réutilisée.
5. Cohérence fichier/base : jamais de fichier orphelin (photo, PDF) sans référence, ni de référence sans fichier.
6. Une seule identité visuelle (logo officiel, une charte) dans toute la plateforme, quelle que soit la division.
7. Interface web adaptative mobile, priorité sur la saisie de notes par les enseignants.
8. Comptes uniquement sur invitation — jamais d'inscription publique (détails dans `SECURITE.md`).

---

## 9. Questions ouvertes restantes

~~Formule séquence → trimestre~~, ~~périmètre du classement~~, ~~codes CMA/CNA/CA~~, ~~barème lettre~~ : **résolues** par l'analyse des fichiers Excel de production réels (banque de bulletins fournie par le client). Voir §5.

Restent réellement ouvertes :
1. Niveau de détail attendu pour les états financiers (simples totaux ou document exportable détaillé).
2. Conséquences précises du statut `pending_registration` (§6.2).
3. Signification exacte en toutes lettres des acronymes CNA/CMA/CA/CBA/CTBA (les seuils numériques sont confirmés, l'intitulé complet reste à valider avec le client pour affichage correct).
4. ~~Approche de génération (Word vs Excel natif)~~ — **résolue par inspection technique directe**. Les fichiers Word réels contiennent un en-tête en texte éditable (identité élève, mail-merge classique, exploitable par `docxtemplater`), mais le **tableau de notes est une image collée depuis Excel** (capture plein format, pas du texte/tableau Word). `docxtemplater` ne peut pas remplir dynamiquement une image. **Décision technique** : abandonner l'approche "remplir le fichier Word existant", générer le bulletin directement en PDF (via `pdf-lib` ou génération HTML→PDF) en reproduisant fidèlement la mise en page déjà confirmée sur les bulletins PDF officiels analysés (en-tête, tableau par groupe de matières, moyennes, rang, décisions). C'est plus robuste et donne un contrôle total sur le rendu.

## 10. Structure du "Bordereau" (nouveau, ajout demandé par le client)

Les fichiers réels de l'école confirment un besoin déjà présent dans leur usage actuel : pour chaque classe, un **bordereau** récapitulatif (liste de tous les élèves, leurs notes par matière, moyenne, rang) distinct des bulletins individuels. Structure observée dans le classeur réel :
- Une feuille de saisie brute par séquence (une ligne par élève, une colonne par matière, aucune formule — juste les notes tapées).
- Une feuille "BORDEREAU" qui reprend les moyennes déjà calculées (collées en valeur, pas en formule live) et calcule le rang de classe (`RANK` sur la colonne des moyennes) et une moyenne générale de classe par matière.
- Une feuille par élève avec le détail complet (bulletin individuel), formules de calcul incluses.

**Fonctionnalité à ajouter au périmètre** (module Gestion des notes) :
- Écran "Bordereau de classe" : tableau de tous les élèves d'une classe/séquence/trimestre avec leurs notes par matière, moyenne, rang.
- **Classement** : liste triée par rang, sur les élèves notés uniquement (règle confirmée §5).
- **Graphique des moyennes** : représentation visuelle de la distribution des moyennes de la classe (ex. histogramme), à intégrer à l'écran Bordereau — nouveauté demandée par le client, non présente dans le cahier des charges initial, à ajouter au listing de fonctionnalités.