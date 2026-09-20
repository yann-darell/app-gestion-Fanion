import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const isTeacherBuild = mode === "teacher" || process.env.VITE_APP_TARGET === "teacher";

  return {
    plugins: [react()],
    envDir: path.resolve(__dirname, "../../"),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@fanion/shared": path.resolve(__dirname, "../shared"),
        ...(isTeacherBuild
          ? {
              "./App": path.resolve(__dirname, "./src/AppTeacher.tsx"),
              "../App": path.resolve(__dirname, "./src/AppTeacher.tsx"),
              "/src/App": path.resolve(__dirname, "./src/AppTeacher.tsx"),
            }
          : {}),
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
    server: {
      port: 5174,
      strictPort: true,
    },
  };
});
