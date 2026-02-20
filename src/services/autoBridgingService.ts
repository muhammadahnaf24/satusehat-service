import { getSqlQueue, getLisData, updateSatuSehatStatus } from "./localService";
import { ServiceRequestService } from "./serviceRequestService";
import { getToken } from "../utils/tokenManager";
import { ILocalLab, ILocalLabItem } from "../@types";
import { logger } from "../utils/logger";

export const processAutoBridging = async () => {
  logger.info("[CRON_START] Memeriksa antrian bridging");

  try {
    const token = await getToken();

    if (!token) {
      logger.error("[CRON_FATAL] Gagal mendapatkan token, proses dibatalkan");
      return;
    }

    const serviceRequest = new ServiceRequestService();

    try {
      const sqlRows = await getSqlQueue();

      if (!sqlRows || sqlRows.length === 0) {
        return;
      }

      logger.info(
        `[CRON_PROCESS] Ditemukan ${sqlRows.length} antrean di SQL. Memulai proses Pipeline...`,
      );

      for (const row of sqlRows) {
        const transaction = await getLisData(row);
        if (!transaction) continue;

        if (
          !transaction.id_pasien ||
          !transaction.id_encounter ||
          !transaction.id_practitioner
        ) {
          logger.warn(
            `[SKIP_INVALID_HEADER] NoBukti: ${transaction.labsrid} | Data ID tidak lengkap`,
          );
          continue;
        }

        const validItems = transaction.items.filter(
          (item: ILocalLabItem) => item.kd_loinc && item.kd_loinc.trim() !== "",
        );

        if (validItems.length === 0) {
          logger.warn(
            `[SKIP_INVALID_ITEMS] NoBukti: ${transaction.labsrid} | Tidak ada kode LOINC valid`,
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
            `[API_SEND_SUCCESS] NoBukti: ${transaction.labsrid} | SS_ID: ${idServiceRequest}`,
          );

          await updateSatuSehatStatus(transaction, idServiceRequest);
        } else {
          logger.error(
            `[API_SEND_FAILED] NoBukti: ${transaction.labsrid} | Msg: ${response.message}`,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown Error";
      logger.error(`[CRON_LOOP_EXCEPTION] Msg: ${errorMessage}`);
    }
  } catch (globalError) {
    const errorMessage =
      globalError instanceof Error ? globalError.message : "Unknown Error";
    logger.error(`[CRON_FATAL_CRASH] Msg: ${errorMessage}`);
  }

  logger.info("[CRON_FINISH] Batch selesai");
};
