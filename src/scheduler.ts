import cron from "node-cron";
import { processAutoBridging } from "./services/autoBridgingService";

export const initScheduler = () => {
  // cron.schedule(" 0 23 * * * ", () => {
  //   processAutoBridging();
  // });

  cron.schedule(" * * * * * ", () => {
    processAutoBridging();
  });

  console.log("🕒 [SYSTEM] Scheduler aktif");
};
