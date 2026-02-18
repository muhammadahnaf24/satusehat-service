import {
  getUnsentLab,
  getLocalLab,
  updateSatuSehatStatus,
} from "./localService";
import { ServiceRequestService } from "./serviceRequestService";
import { getToken } from "../utils/tokenManager";
import { ILocalLab } from "../@types";

export const processAutoBridging = async () => {
  console.log("\n⏰ [CRON START] Memeriksa antrian bridging...");

  try {
    const pendingList = await getUnsentLab();

    if (pendingList.length === 0) {
      console.log("✅ [CRON INFO] Tidak ada data antrian. System Idle.");
      return;
    }

    console.log(
      `🚀 [CRON ACTION] Ditemukan ${pendingList.length} transaksi pending.`,
    );

    const token = await getToken();
    if (!token) {
      console.error("❌ [CRON FATAL] Gagal mendapatkan token. Abort.");
      return;
    }

    const serviceRequest = new ServiceRequestService();

    for (const nobukti of pendingList) {
      console.log(`👉 Processing NoBukti: ${nobukti}`);

      try {
        const groupedData = await getLocalLab(nobukti);

        if (!groupedData || groupedData.length === 0) {
          console.warn(`⚠️ Data detail kosong untuk ${nobukti}, skip.`);
          continue;
        }

        for (const transaction of groupedData) {
          const validItems = transaction.items.filter(
            (item) => item.kd_loinc && item.kd_loinc.trim() !== "",
          );

          if (validItems.length === 0) {
            console.warn(
              `⚠️ Skip ${nobukti}: Tidak ada item lab dengan kode LOINC valid.`,
            );
            continue;
          }

          const transactionToSend: ILocalLab = {
            ...transaction,
            items: validItems,
          };

          console.log(
            `📤 Sending ${validItems.length} items for ${transaction.labsrid}...`,
          );

          const response = await serviceRequest.createServiceRequest(
            transactionToSend,
            token,
          );

          if (response.success && response.data?.id) {
            const idServiceRequest = response.data.id;

            console.log(
              `✅ [SUCCESS] ID: ${idServiceRequest} untuk NoBukti: ${transaction.labsrid}`,
            );

            await updateSatuSehatStatus(transaction, idServiceRequest);
          } else {
            console.error(
              `❌ [FAIL] Gagal kirim ${transaction.labsrid}: ${response.message}`,
            );
          }
        }
      } catch (err) {
        console.error(`🔥 [EXCEPTION] Error pada ${nobukti}:`, err);
      }
    }
  } catch (globalError) {
    console.error("🔥 [CRON ERROR] Terjadi kesalahan fatal:", globalError);
  }

  console.log("🏁 [CRON FINISH] Batch selesai.\n");
};
