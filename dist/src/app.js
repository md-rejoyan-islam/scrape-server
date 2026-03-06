import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import apiRoutes from "./routes/index.js";
const app = express();
// ─── MIDDLEWARE ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), "public")));
// ─── SWAGGER DOCS ───────────────────────────────────────────
const swaggerFile = fs.readFileSync(path.join(process.cwd(), "docs", "swagger.yaml"), "utf8");
const swaggerDocument = YAML.parse(swaggerFile);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// ─── API ROUTES ─────────────────────────────────────────────
app.use("/api", apiRoutes);
// ─── SERVE FRONTEND ─────────────────────────────────────────
app.get("/", (_req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "index.html"));
});
export { app };
