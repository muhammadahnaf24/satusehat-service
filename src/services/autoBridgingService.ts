import { getLocalLab, updateSatuSehatStatus } from "./localService";
import { ServiceRequestService } from "./serviceRequestService";
import { getToken } from "../utils/tokenManager";
import { ILocalLab, ILocalLabItem } from "../@types";
import { logger } from "../utils/logger";

export const processAutoBridging = async () => {
  logger.info("⏰ [CRON START] Memeriksa antrian bridging...");

  try {
    const token = await getToken();
    if (!token) {
      logger.error("❌ [CRON FATAL] Gagal mendapatkan token. Abort.");
      return;
    }

    const serviceRequest = new ServiceRequestService();

    try {
      const groupedData = await getLocalLab();

      if (!groupedData || groupedData.length === 0) {
        return;
      }

      logger.info(
        `🚀 [CRON ACTION] Memproses ${groupedData.length} transaksi pending.`,
      );

      for (const transaction of groupedData) {
        if (
          !transaction.id_pasien ||
          !transaction.id_encounter ||
          !transaction.id_practitioner
        ) {
          logger.warn(
            `⚠️ [SKIP] ${transaction.labsrid}: Data Header tidak lengkap (Pasien/Encounter/Dokter ID kosong). Cek Mapping.`,
          );
          continue;
        }

        const validItems = transaction.items.filter(
          (item: ILocalLabItem) => item.kd_loinc && item.kd_loinc.trim() !== "",
        );

        if (validItems.length === 0) {
          logger.warn(
            `⚠️ [SKIP] ${transaction.labsrid}: Tidak ada item lab dengan kode LOINC valid.`,
          );
          continue;
        }

        const transactionToSend: ILocalLab = {
          ...transaction,
          items: validItems,
        };

        const response = await serviceRequest.createServiceRequest(
          transactionToSend,
          token,
        );

        if (response.success && response.data?.id) {
          const idServiceRequest = response.data.id;

          logger.info(
            `✅ [SENT] ${transaction.labsrid} -> ID: ${idServiceRequest}`,
          );

          await updateSatuSehatStatus(transaction, idServiceRequest);
        } else {
          logger.error(
            `❌ [FAIL] ${transaction.labsrid} -> Msg: ${response.message}`,
          );
        }
      }
    } catch (err: any) {
      logger.error(`🔥 [EXCEPTION] Error di loop transaksi: ${err.message}`);
    }
  } catch (globalError: any) {
    logger.error(`🔥 [CRON ERROR] Fatal Crash: ${globalError.message}`);
  }

  logger.info("🏁 [CRON FINISH] Batch selesai.");
};
