# Spécification de conception : Lot D3 — Saisie des notes, RLS & Évolution des élèves

- **Date** : 2026-08-17
- **Auteur** : Antigravity
- **Statut** : Validé

---

## 1. Objectif
Le **Lot D3** constitue le point le plus sensible du système sur le plan de la sécurité : il permet aux enseignants de saisir et de consulter les notes des élèves, tout en garantissant qu'aucun enseignant ne peut accéder aux notes d'un élève qui ne fait pas partie de ses attributions (`teacher_assignments`).

Cette spécification couvre :
1. La création du schéma SQL PostgreSQL pour la table `grades` avec contrainte `0 <= score <= 20` et unicité `(student_id, subject_id, sequence_id)`.
2. La politique de sécurité RLS PostgreSQL stricte pour isoler les notes au périmètre de chaque enseignant.
3. Les API partagées (`packages/shared/api/grades.ts`) et fonctions centralisées de calcul de moyenne et de codes d'appréciation.
4. L'utilisation d'un enregistrement atomique `UPSERT` (avec `ON CONFLICT DO UPDATE`).
5. Le script automatisé de vérification RLS `verify_rls_grades.js` gérant élégamment la présence ou l'absence d'un 2ème compte enseignant actif.
6. Les composants Frontend (Mobile-first pour le Web avec `recharts` pour l'évolution).

---

## 2. Modèle de données & RLS (PostgreSQL)

### 2.1 Schema SQL (`supabase/migrations/006_lot_d3_grades.sql`)
```sql
CREATE TABLE IF NOT EXISTS public.grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    sequence_id UUID NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
    score NUMERIC(4, 2) NOT NULL CHECK (score >= 0 AND score <= 20),
    appreciation_code VARCHAR(10),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_student_subject_sequence UNIQUE (student_id, subject_id, sequence_id)
);

ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;
```

### 2.2 Politiques RLS (Row Level Security)

#### Direction (`principal` & `directeur_etudes`) :
Accès complet (SELECT, INSERT, UPDATE, DELETE).

#### Enseignant (`enseignant`) :
Accès (SELECT, INSERT, UPDATE, DELETE) restreint aux lignes où l'élève appartient à une classe attribuée à l'enseignant pour la matière concernée dans `teacher_assignments`.

```sql
-- Policy SELECT Enseignant
CREATE POLICY "Enseignants can read grades of their assigned classes/subjects"
ON public.grades FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('principal', 'directeur_etudes')
    )
    OR EXISTS (
        SELECT 1 
        FROM public.students s
        JOIN public.teacher_assignments ta 
          ON ta.class_id = s.class_id AND ta.subject_id = public.grades.subject_id
        WHERE s.id = public.grades.student_id
          AND ta.teacher_id = auth.uid()
    )
);

-- Policy INSERT / UPDATE Enseignant
CREATE POLICY "Enseignants can insert/update grades of their assigned classes/subjects"
ON public.grades FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('principal', 'directeur_etudes')
    )
    OR EXISTS (
        SELECT 1 
        FROM public.students s
        JOIN public.teacher_assignments ta 
          ON ta.class_id = s.class_id AND ta.subject_id = public.grades.subject_id
        WHERE s.id = public.grades.student_id
          AND ta.teacher_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('principal', 'directeur_etudes')
    )
    OR EXISTS (
        SELECT 1 
        FROM public.students s
        JOIN public.teacher_assignments ta 
          ON ta.class_id = s.class_id AND ta.subject_id = public.grades.subject_id
        WHERE s.id = public.grades.student_id
          AND ta.teacher_id = auth.uid()
    )
);
```

---

## 3. Logique métier partagée (`packages/shared`)

### 3.1 Fonctions de calcul centralisées (`packages/shared/api/gradeCalculations.ts`)
1. **Code d'appréciation** à partir d'un score/moyenne :
   - `< 10` $\rightarrow$ `CNA`
   - `10 – 11.99` $\rightarrow$ `CMA`
   - `12 – 13.99` $\rightarrow$ `CA`
   - `14 – 15.99` $\rightarrow$ `CBA`
   - `16 – 20` $\rightarrow$ `CTBA`

2. **Moyenne de Séquence** :
   $$\text{Moyenne}_{\text{seq}} = \frac{\sum (\text{score} \times \text{coefficient})}{\sum \text{coefficient}}$$

3. **Moyenne Trimestrielle** (Formule officielle Excel Le Fanion) :
   - Par matière : $\text{score}_{\text{matière, trim}} = \frac{\text{score}_{\text{seq1}} + \text{score}_{\text{seq2}}}{2}$
   - Globalement : $\text{Moyenne}_{\text{trim}} = \frac{\sum (\text{score}_{\text{matière, trim}} \times \text{coefficient})}{\sum \text{coefficient}}$

### 3.2 API Supabase (`packages/shared/api/grades.ts`)
- `listGrades(filters: { classId?: string; subjectId?: string; sequenceId?: string; studentId?: string })`
- `upsertGrade(grade: { student_id: string; subject_id: string; sequence_id: string; score: number })` :
  Utilise `.upsert(data, { onConflict: 'student_id,subject_id,sequence_id' })` de Supabase JS client.
- `deleteGrade(id: string)`

---

## 4. Script de Vérification RLS (`scripts/verify_rls_grades.js`)
- Recherche de comptes avec `role = 'enseignant'`.
- Si **moins de 2 enseignants actifs** sont trouvés : affiche un message informatif indiquant qu'un 2ème enseignant actif est nécessaire pour exécuter le test RLS croisé complet, sans faire crasher le script de manière confuse.
- Si **2 enseignants actifs ou plus** sont disponibles :
  - L'enseignant 1 tente d'insérer/modifier une note dans sa classe attribuée $\rightarrow$ **Succès**.
  - L'enseignant 2 tente de lire ou modifier la note de cet élève (dont la classe ne lui est pas attribuée) $\rightarrow$ **Échec/Rejet RLS (0 ligne retournée ou exception RLS)**.

---

## 5. Interface Utilisateur (Mobile-first & Navigation)

### 5.1 Entrées de navigation dans `navigation.ts`
- `/teacher/grades` ("Saisie des notes") $\rightarrow$ `allowedRoles: ['enseignant']`
- `/teacher/evolution` ("Évolution des élèves") $\rightarrow$ `allowedRoles: ['enseignant']`
- Les routes administrateur (`/students`, `/classes`, etc.) restent réservées à `['principal', 'directeur_etudes']`.

### 5.2 Saisie de notes mobile-first (`TeacherGradesPage.tsx`)
- Sélecteur de classe/matière : restreint aux attributions réelles de l'enseignant connecté via `teacher_assignments`.
- Sélecteur de séquence.
- Grille par élève avec champ `<input type="number" step="0.5" min="0" max="20" inputmode="decimal">`.
- Sauvegarde au fil de l'eau (auto-save on blur ou lors de la saisie) avec retour visuel immédiat (badge enregistré/synchro).

### 5.3 Évolution des élèves (`TeacherEvolutionPage.tsx`)
- Intégration de la bibliothèque `recharts`.
- Graphique linéaire (LineChart) montrant la moyenne de la classe/matière de l'enseignant au fil des séquences/trimestres.
