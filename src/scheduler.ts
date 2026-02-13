import cron from "node-cron";
import { processAutoBridging } from "./services/autoBridgingService";

export const initScheduler = () => {
  cron.schedule("*/5 * * * *", () => {
    processAutoBridging();
  });

  console.log(
    "🕒 [SYSTEM] Scheduler aktif: Bridging otomatis berjalan tiap 5 menit.",
  );
};
