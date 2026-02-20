import express, { Application } from "express";
import dotenv from "dotenv";
import cors from "cors";
import router from "./routes";
import { getPool } from "./config/db";
import { initScheduler } from "./scheduler";

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cors());
app.use("/api", router);

app.get("/", (req, res) => {
  res.json({
    message: "Bridging Satu Sehat Service is Running 🚀",
    version: "1.0.0",
    serverTime: new Date().toISOString(),
  });
});

const startServer = async () => {
  try {
    console.log("🔄 Menghubungkan ke SQL Server...");
    await getPool();
    console.log("✅ Koneksi SQL Server Berhasil!");

    app.listen(PORT, () => {
      console.log(`🚀 Server berjalan di: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Gagal menjalankan server:", error);
    process.exit(1);
  }
};
initScheduler();
startServer();
