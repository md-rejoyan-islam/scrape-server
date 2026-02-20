import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";
import YAML from "yaml";
import apiRoutes from "./routes/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ─── MIDDLEWARE ──────────────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "..", "public")));

// ─── SWAGGER DOCS ───────────────────────────────────────────

const swaggerFile = fs.readFileSync(
  path.join(__dirname, "..", "docs", "swagger.yaml"),
  "utf8",
);
const swaggerDocument = YAML.parse(swaggerFile);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// ─── API ROUTES ─────────────────────────────────────────────

app.use("/api", apiRoutes);

// ─── SERVE FRONTEND ─────────────────────────────────────────

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

export { app };
