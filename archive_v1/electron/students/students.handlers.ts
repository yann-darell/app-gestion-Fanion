import { ipcMain, dialog } from "electron";
import fs from "fs";
import path from "path";
import studentsService from "./students.service";
import classesRepository from "./classes.repository";
import {
    CreateStudentInput,
    UpdateStudentInput,
    CreateClassInput,
    IpcResponse
} from "../types/students";

export function registerStudentHandlers(): void {
    // students:list
    ipcMain.handle(
        "students:list",
        async (_, filters): Promise<IpcResponse<any>> => {
            try {
                const data = studentsService.list(filters);
                return { ok: true, data };
            } catch (error: any) {
                return {
                    ok: false,
                    error:
                        error.message ||
                        "Erreur lors de la récupération des élèves"
                };
            }
        }
    );

    // students:get
    ipcMain.handle(
        "students:get",
        async (_, id: number): Promise<IpcResponse<any>> => {
            try {
                const data = studentsService.get(id);
                return { ok: true, data };
            } catch (error: any) {
                return {
                    ok: false,
                    error:
                        error.message ||
                        "Erreur lors de la récupération de l'élève"
                };
            }
        }
    );

    // students:create
    ipcMain.handle(
        "students:create",
        async (_, input: CreateStudentInput): Promise<IpcResponse<any>> => {
            try {
                const data = studentsService.create(input);
                return { ok: true, data };
            } catch (error: any) {
                return {
                    ok: false,
                    error:
                        error.message ||
                        "Erreur lors de l'inscription de l'élève"
                };
            }
        }
    );

    // students:update
    ipcMain.handle(
        "students:update",
        async (
            _,
            { id, input }: { id: number; input: UpdateStudentInput }
        ): Promise<IpcResponse<any>> => {
            try {
                const data = studentsService.update(id, input);
                return { ok: true, data };
            } catch (error: any) {
                return {
                    ok: false,
                    error:
                        error.message || "Erreur lors de la mise à jour de l'élève"
                };
            }
        }
    );

    // students:delete
    ipcMain.handle(
        "students:delete",
        async (_, id: number): Promise<IpcResponse<void>> => {
            try {
                studentsService.delete(id);
                return { ok: true, data: undefined };
            } catch (error: any) {
                return {
                    ok: false,
                    error:
                        error.message ||
                        "Erreur lors de la désactivation de l'élève"
                };
            }
        }
    );

    // students:pickPhoto
    ipcMain.handle(
        "students:pickPhoto",
        async (): Promise<IpcResponse<{ path: string; base64: string } | null>> => {
            try {
                const result = await dialog.showOpenDialog({
                    title: "Sélectionner une photo de profil",
                    properties: ["openFile"],
                    filters: [
                        { name: "Images", extensions: ["jpg", "jpeg", "png"] }
                    ]
                });

                if (result.canceled || result.filePaths.length === 0) {
                    return { ok: true, data: null };
                }

                const filePath = result.filePaths[0];

                // Validation de la taille du fichier (max 5 Mo)
                const stats = fs.statSync(filePath);
                const maxSize = 5 * 1024 * 1024; // 5 Mo
                if (stats.size > maxSize) {
                    return {
                        ok: false,
                        error:
                            "Le fichier sélectionné dépasse la taille maximale autorisée (5 Mo)."
                    };
                }

                // Générer la chaîne Base64 pour l'affichage en prévisualisation
                const base64Data = fs.readFileSync(filePath).toString("base64");
                const ext = path.extname(filePath).toLowerCase();
                const mimeType = ext === ".png" ? "image/png" : "image/jpeg";
                const base64 = `data:${mimeType};base64,${base64Data}`;

                return { ok: true, data: { path: filePath, base64 } };
            } catch (error: any) {
                return {
                    ok: false,
                    error:
                        error.message ||
                        "Erreur lors de la sélection de la photo"
                };
            }
        }
    );

    // classes:list
    ipcMain.handle("classes:list", async (): Promise<IpcResponse<any>> => {
        try {
            const data = classesRepository.list();
            return { ok: true, data };
        } catch (error: any) {
            return {
                ok: false,
                error:
                    error.message ||
                    "Erreur lors de la récupération des classes"
            };
        }
    });

    // classes:create
    ipcMain.handle(
        "classes:create",
        async (_, input: CreateClassInput): Promise<IpcResponse<number>> => {
            try {
                const data = classesRepository.create(input);
                return { ok: true, data };
            } catch (error: any) {
                return {
                    ok: false,
                    error:
                        error.message || "Erreur lors de la création de la classe"
                };
            }
        }
    );
}
