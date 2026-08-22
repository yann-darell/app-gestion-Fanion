# GABARIT_BULLETIN.md
## Structure exacte du bulletin PDF — extraite des documents réels du client

> Ce document remplace toute description approximative précédente. Chaque élément ci-dessous a été vérifié directement sur les bulletins PDF officiels déjà fournis par le client (ONANINA 6ème, MANGWA 3ème, MOUSSI 2ndeA, NZOKOU 5ème, PEKEKO 1èreA). L'agent doit reproduire EXACTEMENT cette structure, pas une version simplifiée.

---

## 0. Deux variantes de tableau selon le niveau — à gérer obligatoirement

| Niveau | Colonne "Compétences Évaluées" |
|---|---|
| 6ème, 5ème (et probablement Primaire) | **OUI** — présente entre "MATIÈRES" et les colonnes de notes |
| 3ème, 2nde, 1ère, Terminale | **NON** — pas de cette colonne |

Le service doit détecter le niveau de la classe et choisir la bonne variante de tableau. Ne jamais utiliser un seul template unique pour tous les niveaux.

---

## 0bis. Aspect visuel général (papier, filigrane, logo, couleurs) — NON dérivé de la charte de l'application

**Important** : le bulletin est un document administratif officiel, il NE doit PAS utiliser la palette `DESIGN_VISUEL.md` de l'application (bleu `--ink`, etc.). Il doit reproduire fidèlement l'esthétique du document réel ci-dessous, indépendante de l'identité visuelle de l'app.

- **Cadre Titre à effet 3D** : Rectangle centré contenant le titre en majuscules gras (ex: `BULLETIN DE LA 1ÈRE SÉQUENCE`), avec un trait fin noir et un **légers d'effet d'ombre interne / bordure double à droite et en bas** donnant un effet d'épaisseur 3D.
- **Filigrane (Zone restreinte)** : Le filigrane du logo n'occupe PAS toute la page. Il s'étend verticalement **uniquement de la 4ème ligne du tableau du Groupe I jusqu'au bas du bloc "Moyennes de l'Élève"**. Il ne monte ni jusqu'à l'en-tête/titre, ni ne descend dans le bloc Discipline tout en bas. Opacité très faible (~10-15%).
- **Logo net (non filigrane)** : une seule occurrence, en haut de page, **centré horizontalement entre les deux blocs de texte bilingues** (français à gauche, anglais à droite), taille modeste (~80-100px de large), fond transparent.
- **Photo de l'élève** : coin supérieur droit, rectangulaire, taille comparable à une photo d'identité, uniquement si `photo_path` existe.
- **Police** : police à empattements classique de type document administratif (Times New Roman ou équivalent), PAS la police "Source Serif 4"/"Inter" de l'application — c'est un document distinct de l'UI de l'app.
- **Couleur du texte** : noir (`#000000`) partout, sauf mentions spécifiques ci-dessous.
- **Nombres décimaux** : format français avec **virgule**, jamais de point (`13,00` — pas `13.00`). Toujours 2 décimales affichées, même pour un nombre entier (`16,00`, pas `16`).
- **Bande "Moyennes de l'Élève"** (résultats de synthèse) : fond teinté rose/saumon pâle (`#F5D5CE` approximatif — à ajuster visuellement par comparaison avec le PDF de référence), sur toute la largeur du tableau, bien distincte du reste en blanc.
- **Lignes "Total du GROUPE" et "Total Général"** : fond blanc pur (sans teinte), texte en gras.
- **Bordures** : traits fins noirs (~0.5pt), tableau à cellules bien délimitées, pas de bordures épaisses ni colorées.
- **Cellule matière** : nom de la matière en gras sur la 1ère ligne, nom de l'enseignant en italique sur la 2ème ligne, dans la même cellule (hauteur de ligne adaptée en conséquence).

---



```
[Colonne gauche - Français]             [Logo centré]         [Colonne droite - Anglais]
REPUBLIQUE DU CAMEROUN                                         REPUBLIC OF CAMEROON
Paix – Travail – Patrie                                        Peace – Work – Fatherland
----------------------- (pointillés)                           ------------------------- (pointillés)
MINISTERE DES ENSEIGNEMENTS SECONDAIRES                        MINISTRY OF SECONDARY EDUCATION
--------------------------------------- (pointillés)           ------------------------------- (pointillés)
COLLEGE PRIVE LE FANION                                        SECULAR PRIVATE COLLEGE LE FANION
Tel : 696 81 07 22 / 690 54 95 99
--------------------------------- (pointillés)
```

Photo de l'élève : coin supérieur droit, si `photo_path` existe pour l'élève (sinon espace vide, pas de placeholder).

Ligne suivante, encadrée : **"BULLETIN DU [N]IEME TRIMESTRE"** (+ **" ET ANNUEL"** uniquement si trimestre 3) — ou **"BULLETIN DE LA [N]IÈRE/ÈME SÉQUENCE"** si génération par séquence.

`Année Scolaire : YYYY/YYYY` (italique, juste au-dessus du bloc identité).

---

## 2. Bloc identité (une seule ligne dense, comme dans l'original)

```
CLASSE : [classe]      EFFECTIF : [nb élèves actifs de la classe]      PROFESSEUR PRINCIPAL : [head_teacher_name]
NOMS : [last_name]      PRENOMS : [first_name]      MAT : [matricule]      REDOUBLANT : [Oui/Non]
DATE ET LIEU DE NAISSANCE : [date] à [birth_place]      NAT : [nationality]
```

---

## 3. Tableau de notes, groupé par GROUPE I à IV (toujours dans cet ordre)

### Variante AVEC compétences (6ème, 5ème) — **9 Colonnes exactes**
Colonnes : `MATIÈRES` (+ enseignant) | `COMPÉTENCES ÉVALUÉES` | `TRIM` | `SEQ` | `COEF` | `MOY × COEF` | `MOY DE CLASSE` | `RANG` | `APPRÉCIATION`

### Variante SANS compétences (3ème, 2nde, 1ère, Terminale) — **8 Colonnes exactes**
Colonnes : `MATIÈRES` (+ enseignant) | `TRIM` | `SEQ` | `COEF` | `MOY × COEF` | `MOY DE CLASSE` | `RANG` | `APPRÉCIATION`

Après chaque groupe (I, II, III, IV) :
```
Total du GROUPE [N] :
   Moyenne du Groupe : [valeur]          Rang de l'élève : [valeur ou vide]
```

---

## 4. Pied de tableau — bloc récapitulatif

```
Total Général (GI + GII + GIII + GIV) = [Total Points]          Moy Gle Classe : [X]   Moy 1er : [Y]   Moy Dernier : [Z]
```

Puis un bloc récapitulatif découpé en **2 Colonnes principales** :
```
+-------------------------------------------------------------+------------------------------------+
| COLONNE 1 (Fond Saumon #E7B5B4 - MOYENNES DE L'ÉLÈVE)        | COLONNE 2 (RANGS DE L'ÉLÈVE)       |
| Ligne 1 : Moyenne Période (ex: Seq 1 / Trim 1) : 13,55 / 20 | Ligne 1 : Rang Période : 1er / 48  |
| Ligne 2 : Trim 1 [13,55]  Trim 2 [--]  Trim 3 [--]  ANNUEL [13,55/20] | Ligne 2 : Rang Annuel : 1er / 48 |
+-------------------------------------------------------------+------------------------------------+
```

Note italique juste en dessous : *"La moyenne Trimestrielle n'est pas égale à la moyenne arithmétique des séquences"*

**Important** : ces valeurs Trim1/Trim2/Trim3/Annuel ne s'affichent que si le bulletin est généré en mode trimestre ou annuel — pour un bulletin de séquence individuelle, n'afficher que la ligne "Moyennes de l'Élève" avec la valeur de la séquence, pas les 4 colonnes trimestrielles.

---

## 5. Bloc Discipline / Décisions / Observations (bas de page — 4 colonnes précises)

```
+------------------------+--------------------------+------------------------+------------------------------------------+
| Colonne 1 : DISCIPLINE | Colonne 2 : RECAP/LIGNES | Colonne 3 : APPREC.    | Colonne 4 : TRAVAIL & VISA (2 sous-cols)|
| (7 lignes)             | (4 lignes d'écriture)    | TRAVAIL ÉLÈVE (4 l.)   | Sous-col A (5 l.)  | Sous-col B (Visa) |
+------------------------+--------------------------+------------------------+--------------------+---------------------+
```

- **Colonne 1 : DISCIPLINE (7 Lignes)**
  1. Titre `DISCIPLINE / Discipline`
  2. `Nb d'Heures d'Absence / Absences Hours :`
  3. `Nb de journées / Days :`
  4. `Exclusions / Suspensions :`
  5. `Blâme / Blame :`
  6. `Avertissements / Warnings :`
  7. `Observations et Remarques du parent :`

- **Colonne 2 : ZONE D'ÉCRITURE MANUELLE (4 Lignes)**
  1. Ligne 1 (Entête / Marge)
  2. Ligne 2 (Contenant **3 sous-lignes en traits fins presque invisibles** pour saisie manuscrite)
  3. Ligne 3 (Contenant **2 sous-lignes en traits fins presque invisibles**)
  4. Ligne 4 (Pied de zone)

- **Colonne 3 : APPRÉCIATION DU TRAVAIL DE L'ÉLÈVE (4 Lignes)**
  1. Titre `Appréciation du travail de l'élève`
  2. Code d'appréciation automatique (`CTBA` / `CBA` / `CA` / `CMA` / `CNA`)
  3. **`Observations et remarques du professeur principal :`**
  4. Marge inférieure de validation

- **Colonne 4 : TRAVAIL (Grande ligne d'entête TRAVAIL puis division en 2 sous-colonnes)**
  - **Grande ligne supérieure** : `TRAVAIL / Academic Work` (s'étend sur toute la largeur de la Colonne 4).
  - **Sous-colonne A (5 Lignes)** :
    1. `[ ] Tableau d'honneur / Honour roll`
    2. `[ ] Encouragements / Encouragements`
    3. `[ ] Félicitations / Congratulations`
    4. `[ ] Décisions du Conseil de Classe`
    5. Mentions complémentaires
  - **Sous-colonne B (Observations et Visa du Principal)** :
    1. `Observations et Visa du Principal / Observations and Signature`
    2. `Yaoundé le, ...........................`
    3. `Le Principal / Headmaster`
    4. Espace réservé pour Signature & Cachet Officiel.

---

## 6. Note légale finale

```
NB : Les élèves ont un délai de 15 jours pour toutes revendications dès réception du bulletin.
```

---

## 7. Ce qui ne doit JAMAIS apparaître

- Pas de colonne "Moy Gle Classe" ou "Rang" laissée à "-" ou vide si les données existent — si elles existent, elles doivent être calculées et affichées (voir `classReportService.ts`).
- Pas de nom d'enseignant générique ou de test ("rod", "Enseignant de Test") sur un bulletin destiné à un usage réel — mais acceptable en phase de test tant que les vrais enseignants ne sont pas tous attribués.
- Pas de code d'appréciation en dur "NC" si les 2 séquences existent réellement en base pour ce trimestre — vérifier la vraie disponibilité des données avant d'afficher NC.