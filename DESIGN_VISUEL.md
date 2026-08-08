# DESIGN_VISUEL.md
## Identité visuelle — Le Fanion

> À charger avec `CONTEXTE_ANTIGRAVITY.md` et `REGLES_TECHNIQUES.md`. Ce document fixe la direction visuelle. L'agent IA ne doit pas inventer de nouvelles couleurs, polices ou styles de composants en dehors de ce système sans le signaler.

---

## 1. Parti pris

C'est un **outil de travail quotidien** pour la secrétaire et le principal — pas une vitrine. La priorité absolue est la **lisibilité des données** (tableaux, montants, notes) et la **rapidité de repérage visuel** (qui a payé, qui n'a pas encore de notes complètes). On évite tout habillage décoratif qui ralentit la lecture.

L'identité vient du nom de l'école : **le fanion**, ce petit étendard triangulaire qui marque un rang, une équipe, une réussite (fanion de classement sportif, fanion de classe). C'est l'élément signature du système : une forme de pennant réutilisée comme **marqueur de statut** dans toute l'appli, à la place des badges ronds génériques.

Ambiance générale : **sobre, structurée, un peu "registre officiel"** — cohérent avec un bulletin scolaire et un reçu de paiement, qui sont eux-mêmes des documents formels.

---

## 2. Palette (jetons de couleur)

| Nom | Hex | Usage |
|---|---|---|
| `--ink` | `#1B2A4A` | Texte principal, titres, éléments de navigation actifs |
| `--paper` | `#FAF9F5` | Fond général (blanc cassé, effet papier registre) |
| `--slate` | `#5B6B82` | Texte secondaire, labels, texte désactivé |
| `--fanion-green` | `#1E7A4C` | Accent positif : payé, notes complètes, validation |
| `--fanion-gold` | `#C99A3B` | Accent de mise en avant : meilleur rang, mention, éléments actifs secondaires |
| `--signal-red` | `#B3432E` | Alerte : impayé, notes manquantes, erreur |
| `--line` | `#E4E0D6` | Bordures, séparateurs, lignes de tableau |

Règle stricte : **pas de dégradés, pas de couleurs hors de cette liste.** Le vert et l'or ne sont utilisés qu'en accents ponctuels (badge, icône, bordure gauche d'une carte) — jamais en grands aplats de fond.

---

## 3. Typographie

| Rôle | Police | Usage |
|---|---|---|
| Display (titres de page, en-têtes de bulletin) | **Source Serif 4** (serif institutionnel, sérieux, lisible en gras) | Titres de page, en-tête du dashboard |
| Corps de texte / UI | **Inter** (sans-serif humaniste, très lisible en petite taille) | Formulaires, tableaux, boutons, labels |
| Données chiffrées (montants, notes, matricules) | **IBM Plex Mono** | Colonnes de chiffres dans les tableaux — chiffres tabulaires alignés, essentiel pour scanner une colonne de montants ou de moyennes d'un coup d'œil |

Échelle type (base 16px) : `12 / 14 / 16 / 20 / 25 / 31 / 39px` (ratio ~1.25). Les titres de page utilisent 25–31px en Source Serif 4 medium/semibold ; le corps reste en 14–16px Inter regular.

---

## 4. Layout

Structure classique d'application métier, pas de page marketing :

```
┌───────────┬─────────────────────────────────────┐
│           │  PageHeader (titre + actions)         │
│  Sidebar  ├─────────────────────────────────────┤
│  (fixe,   │                                       │
│  icônes + │        Contenu de la page             │
│  labels)  │   (table, formulaire, cartes...)      │
│           │                                       │
└───────────┴─────────────────────────────────────┘
```

- Sidebar fixe à gauche, fond `--ink`, texte `--paper`, item actif marqué par un petit **fanion** (▸ triangle plein) devant le label plutôt qu'un simple surlignage.
- Contenu sur fond `--paper`, cartes/tableaux sur blanc pur avec bordure `--line` fine (1px), **coins très légèrement arrondis (4–6px)** — pas de neumorphism, pas d'ombres portées lourdes. Une ombre discrète seulement sur les modales.
- Densité : les tableaux (élèves, paiements, notes) doivent privilégier la **densité d'information** — lignes compactes (36–40px de hauteur), pas de gros espacements façon landing page.

---

## 5. Élément signature : le badge-fanion

Au lieu de badges ronds/rectangulaires classiques pour les statuts, on utilise une **petite forme de pennant** (triangle avec base légèrement concave, comme un vrai fanion en tissu) :

- Fanion vert plein = payé / notes complètes / validé
- Fanion or plein = premier de classe / mention / meilleur élève du trimestre
- Fanion rouge (contour seulement, pas plein) = impayé / notes manquantes / en retard
- Fanion gris contour = en attente / non applicable

Ce même symbole sert à la fois de **puce de statut dans les tableaux** et de **décoration discrète sur l'en-tête du bulletin PDF/Word** (rappel de marque cohérent entre l'outil et le document produit).

**Restriction** : ce motif est LE seul élément décoratif du système. Pas d'icônes fantaisistes, pas de mascotte, pas d'illustrations. Le reste de l'interface reste typographique et tabulaire.

---

## 6. Composants — règles de style

- **Boutons** : rectangulaires, coins 4px, fond `--ink` (action principale), contour `--slate` (action secondaire), fond `--signal-red` uniquement pour les actions destructrices (supprimer). Pas de bouton "ghost" flottant.
- **Tableaux** : en-tête sticky, fond légèrement teinté (`--paper` plus foncé de 3%), lignes séparées par `--line` 1px (pas de zébrage coloré — trop chargé visuellement pour des tableaux financiers denses).
- **Formulaires** : labels au-dessus des champs (jamais en placeholder seul), champs avec bordure `--line`, focus = bordure `--ink` 2px (accessibilité : jamais de focus invisible).
- **Modales** : fond blanc, ombre discrète, largeur max 480px pour les formulaires courts, 720px pour les grilles de saisie.
- **États vides** : toujours un texte d'action clair ("Aucun élève dans cette classe — Ajouter un élève"), jamais une illustration vide silencieuse.

---

## 7. Ton des textes d'interface

- Voix active, impérative pour les boutons : "Enregistrer le paiement", pas "Soumettre".
- Messages d'erreur factuels, jamais avec excuse : "Le montant dépasse le solde restant (12 500 FCFA)." — pas "Oups, une erreur est survenue".
- Cohérence bouton → confirmation : un bouton "Générer le bulletin" produit un toast "Bulletin généré", pas "Opération réussie".
- Langue : **français** dans toute l'interface (école bilingue, mais l'outil de gestion interne reste en français sauf indication contraire du principal).

---

## 8. Accessibilité minimale non négociable

- Contraste texte/fond conforme AA (vérifié : `--ink` sur `--paper` = contraste très large, `--slate` sur blanc à vérifier au montage).
- Focus clavier toujours visible.
- Toute action destructrice passe par une confirmation (`ConfirmDialog`), jamais d'action irréversible en un clic.
