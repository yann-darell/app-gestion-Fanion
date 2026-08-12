import fs from "fs";
import path from "path";
import { app } from "electron";

export const photoService = {
    getPhotosDir(): string {
        const dir = path.join(app.getPath("userData"), "photos");
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return dir;
    },

    copyPhoto(
        tempPath: string,
        matricule: string,
        existingFilename: string | null
    ): string {
        const photosDir = this.getPhotosDir();

        // Extraire l'extension du fichier original
        const ext = path.extname(tempPath).toLowerCase();

        // Nettoyer le matricule pour le nom de fichier
        const safeMatricule = matricule.replace(/[^a-zA-Z0-9-_]/g, "_");
        const filename = `${safeMatricule}${ext}`;
        const destPath = path.join(photosDir, filename);

        // Supprimer l'ancienne photo si elle est différente
        if (existingFilename && existingFilename !== filename) {
            this.deletePhoto(existingFilename);
        }

        // Copie synchrone du fichier
        fs.copyFileSync(tempPath, destPath);

        return filename;
    },

    deletePhoto(filename: string): void {
        try {
            const filePath = path.join(this.getPhotosDir(), filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            console.error(
                `Erreur lors de la suppression de la photo ${filename} :`,
                error
            );
        }
    }
};

export default photoService;
