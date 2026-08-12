import { getDb } from "../db/connection";
import { studentsRepository } from "./students.repository";
import { classesRepository } from "./classes.repository";
import { photoService } from "./photo.service";
import { Student, CreateStudentInput, UpdateStudentInput } from "../types/students";

export const studentsService = {
    list(filters: { classId?: number; search?: string } = {}): Student[] {
        return studentsRepository.list(filters);
    },

    get(id: number): Student {
        const student = studentsRepository.get(id);
        if (!student) {
            throw new Error(`Élève avec l'identifiant ${id} introuvable.`);
        }
        return student;
    },

    create(input: CreateStudentInput): Student {
        // Validation simple
        if (!input.first_name || !input.first_name.trim()) throw new Error("Le prénom est obligatoire.");
        if (!input.last_name || !input.last_name.trim()) throw new Error("Le nom de famille est obligatoire.");
        if (!input.birth_date) throw new Error("La date de naissance est obligatoire.");
        if (input.gender !== "M" && input.gender !== "F") throw new Error("Le genre doit être 'M' ou 'F'.");
        if (!input.class_id) throw new Error("La classe est obligatoire.");
        if (!input.guardian_name || !input.guardian_name.trim()) throw new Error("Le tuteur est obligatoire.");
        if (!input.guardian_phone || !input.guardian_phone.trim()) throw new Error("Le téléphone du tuteur est obligatoire.");

        const db = getDb();
        
        // 1. Déterminer le matricule final
        let matricule = input.matricule?.trim();
        if (matricule) {
            // Valider l'unicité
            if (studentsRepository.existsMatricule(matricule)) {
                throw new Error(`Le matricule '${matricule}' est déjà attribué.`);
            }
        } else {
            // Générer le matricule au format ANNEE-CLASSE-SEQUENCE
            const targetClass = classesRepository.get(input.class_id);
            if (!targetClass) {
                throw new Error("La classe sélectionnée n'existe pas.");
            }

            // ANNEE: Prendre l'année de début (ex: "2026-2027" -> "2026")
            const yearPart = targetClass.school_year_label
                ? targetClass.school_year_label.split("-")[0].trim()
                : new Date().getFullYear().toString();

            // CLASSE: Nettoyer le nom de la classe en majuscules sans caractères bizarres
            const classPart = targetClass.name
                .toUpperCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "") // Enlever les accents
                .replace(/[^A-Z0-9]/g, ""); // Garder uniquement lettres et chiffres

            // SEQUENCE: Obtenir le compteur total actuel et incrémenter
            let sequence = studentsRepository.getStudentCountForClass(input.class_id) + 1;
            let generatedMatricule = "";
            let exists = true;

            // S'assurer de l'unicité absolue
            while (exists) {
                const seqPart = sequence.toString().padStart(4, "0");
                generatedMatricule = `${yearPart}-${classPart}-${seqPart}`;
                exists = studentsRepository.existsMatricule(generatedMatricule);
                if (exists) {
                    sequence++;
                }
            }

            matricule = generatedMatricule;
        }

        // 2. Si photo temporaire présente, copier la photo de profil
        let photoFilename: string | null = null;
        if (input.photo_path) {
            photoFilename = photoService.copyPhoto(input.photo_path, matricule, null);
        }

        // 3. Exécuter l'insertion dans une transaction
        let createdId: number;
        try {
            const insertTx = db.transaction(() => {
                return studentsRepository.create({
                    matricule: matricule!,
                    first_name: input.first_name.trim(),
                    last_name: input.last_name.trim(),
                    birth_date: input.birth_date,
                    gender: input.gender,
                    class_id: input.class_id,
                    guardian_name: input.guardian_name.trim(),
                    guardian_phone: input.guardian_phone.trim(),
                    photo_filename: photoFilename,
                    birth_place: input.birth_place?.trim() || null,
                    nationality: input.nationality?.trim() || null,
                    is_repeating: input.is_repeating ?? 0
                });
            });
            createdId = insertTx();
        } catch (error) {
            // En cas d'échec SQL, nettoyer le fichier photo copié pour éviter les orphelins
            if (photoFilename) {
                photoService.deletePhoto(photoFilename);
            }
            throw error;
        }

        return this.get(createdId);
    },

    update(id: number, input: UpdateStudentInput): Student {
        const db = getDb();
        const existing = this.get(id);

        // Validation des modifications si fournies
        if (input.first_name !== undefined && !input.first_name.trim()) throw new Error("Le prénom ne peut pas être vide.");
        if (input.last_name !== undefined && !input.last_name.trim()) throw new Error("Le nom ne peut pas être vide.");
        if (input.gender !== undefined && input.gender !== "M" && input.gender !== "F") throw new Error("Le genre doit être 'M' ou 'F'.");
        if (input.class_id !== undefined && !input.class_id) throw new Error("La classe ne peut pas être vide.");

        // 1. Déterminer le matricule
        let matricule = existing.matricule;
        if (input.matricule !== undefined) {
            const trimmedMatricule = input.matricule.trim();
            if (trimmedMatricule !== existing.matricule) {
                if (studentsRepository.existsMatricule(trimmedMatricule, id)) {
                    throw new Error(`Le matricule '${trimmedMatricule}' est déjà attribué.`);
                }
                matricule = trimmedMatricule;
            }
        }

        // 2. Si nouvelle photo temporaire fournie
        let newPhotoFilename: string | null = null;
        let oldPhotoToDelete: string | null = null;

        if (input.photo_path) {
            // Copier la photo avec le matricule (possiblement mis à jour)
            newPhotoFilename = photoService.copyPhoto(input.photo_path, matricule, null);
            if (existing.photo_filename && existing.photo_filename !== newPhotoFilename) {
                // Noter l'ancienne photo pour suppression UNIQUEMENT après succès DB
                oldPhotoToDelete = existing.photo_filename;
            }
        } else if (input.photo_path === null && existing.photo_filename) {
            // La photo a été explicitement supprimée
            oldPhotoToDelete = existing.photo_filename;
        }

        // 3. Lancer la transaction d'écriture SQL
        try {
            const updateTx = db.transaction(() => {
                studentsRepository.update(id, {
                    matricule,
                    first_name: input.first_name?.trim(),
                    last_name: input.last_name?.trim(),
                    birth_date: input.birth_date,
                    gender: input.gender,
                    class_id: input.class_id,
                    guardian_name: input.guardian_name?.trim(),
                    guardian_phone: input.guardian_phone?.trim(),
                    photo_filename: input.photo_path === null ? null : (newPhotoFilename || existing.photo_filename),
                    birth_place: input.birth_place !== undefined ? (input.birth_place?.trim() || null) : undefined,
                    nationality: input.nationality !== undefined ? (input.nationality?.trim() || null) : undefined,
                    is_repeating: input.is_repeating !== undefined ? input.is_repeating : undefined
                });
            });
            updateTx();
        } catch (error) {
            // Rollback du système de fichiers en cas d'échec SQL
            if (newPhotoFilename) {
                photoService.deletePhoto(newPhotoFilename);
            }
            throw error;
        }

        // Si la transaction a réussi et qu'il y avait une ancienne photo à supprimer
        if (oldPhotoToDelete) {
            photoService.deletePhoto(oldPhotoToDelete);
        }

        return this.get(id);
    },

    delete(id: number): void {
        // Soft delete de l'élève
        studentsRepository.delete(id);
    }
};

export default studentsService;
