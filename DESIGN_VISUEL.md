# DESIGN_VISUEL.md (v2)
## Identité visuelle — Le Fanion

> Remplace la v1. Changement principal : utilisation du **vrai logo officiel** et de la **vraie couleur de l'école** (extraite du logo), plus les règles d'adaptation mobile pour la plateforme web.

---

## 1. Identité de marque

**Un seul logo, une seule charte, dans toute la plateforme**, quelle que soit la division consultée (confirmé par le client — malgré deux dénominations commerciales différentes entre Collège et Primaire en réalité).

Logo officiel : écusson en forme d'engrenage, toque de diplômé, livre ouvert, bandeau "le Fanion" — fichier fourni par le client, à intégrer tel quel (ne pas le redessiner). Utiliser une version détourée (fond transparent) pour l'intégration UI (en-tête, écran de connexion, reçus PDF, bulletins).

---

## 2. Palette (mise à jour avec la vraie couleur du logo)

| Nom | Hex | Usage | Changement vs v1 |
|---|---|---|---|
| `--ink` | `#150A5E` | Texte principal, en-têtes, navigation active | **Modifié** — bleu indigo extrait directement du logo officiel (v1 utilisait un bleu inventé `#1B2A4A`) |
| `--paper` | `#FAF9F5` | Fond général | Inchangé |
| `--slate` | `#5B6B82` | Texte secondaire | Inchangé |
| `--fanion-green` | `#1E7A4C` | Payé / validé | Inchangé |
| `--fanion-gold` | `#C99A3B` | Partiel / mention | Inchangé |
| `--signal-red` | `#B3432E` | Impayé / alerte | Inchangé |
| `--line` | `#E4E0D6` | Bordures | Inchangé |

**Le badge-fanion** (v1) reste comme convention interne d'interface pour les statuts (payé/partiel/impayé, mention) — usage distinct du logo officiel, pas de conflit : le logo identifie l'école, le badge-fanion est un élément fonctionnel d'UI.

---

## 3. Typographie (inchangée)

Source Serif 4 (titres) / Inter (corps) / IBM Plex Mono (données chiffrées) — voir v1 pour le détail. Prévoir un fournisseur de police local (fichiers `.woff2` embarqués) plutôt qu'un CDN, la plateforme n'étant pas garantie hors-ligne mais un chargement de police externe reste une dépendance évitable.

---

## 4. Adaptation mobile (nouveau, priorité pour le web)

La plateforme web doit être conçue **mobile-first**, en particulier les écrans de saisie de notes destinés aux enseignants sur téléphone.

### 4.1 Layout
- **Desktop/bureau** : sidebar fixe + contenu (inchangé v1).
- **Web mobile** : navigation par menu déroulant ou barre inférieure (à trancher en session, pas de sidebar fixe sur petit écran) ; le contenu occupe toute la largeur.

### 4.2 Densité
Les tableaux denses (v1, pour la richesse d'information sur desktop) doivent se transformer en **listes de cartes empilées** sur mobile plutôt que des tableaux à défilement horizontal illisibles — un tableau de notes avec 10 colonnes ne doit jamais forcer un défilement horizontal sur téléphone.

### 4.3 Saisie de notes sur mobile — attention particulière
- Champs numériques avec clavier adapté (`inputmode="decimal"`).
- Boutons de validation/sauvegarde toujours visibles sans défilement (zone fixe en bas d'écran si liste longue).
- Sauvegarde progressive recommandée (pas d'obligation de tout saisir avant de pouvoir enregistrer) — à confirmer en session selon la complexité d'implémentation.

### 4.4 Tests
Toute page destinée aux enseignants doit être testée sur une largeur d'écran réelle de téléphone (~375px), pas seulement redimensionnée depuis une fenêtre desktop.

---

## 5. Reçus et bulletins — logo obligatoire

Tout document PDF généré (reçu de paiement, bulletin) doit intégrer le logo officiel en en-tête, dans le respect de sa proportion d'origine (ne pas déformer). Couleur du texte du document : `--ink` (nouveau bleu du logo), cohérent avec l'identité visuelle de l'application.

---

## 6. Ce qui reste inchangé de la v1

- Style des composants (boutons rectangulaires, coins 4px, tableaux sans zébrage).
- Ton des textes d'interface (voix active, messages d'erreur factuels).
- Accessibilité minimale (contraste AA, focus clavier visible, confirmation avant action destructrice).