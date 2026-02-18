import cron from "node-cron";
import { processAutoBridging } from "./services/autoBridgingService";

export const initScheduler = () => {
  cron.schedule("* * * * *", () => {
    processAutoBridging();
  });

  console.log(
    "🕒 [SYSTEM] Scheduler aktif: Bridging otomatis berjalan tiap 1 menit.",
  );
};
