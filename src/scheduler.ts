import cron from "node-cron";
import { processAutoBridging } from "./services/autoBridgingService";

export const initScheduler = () => {
  cron.schedule("* * * */1 *", () => {
    processAutoBridging();
  });

  console.log("🕒 [SYSTEM] Scheduler aktif");
};
