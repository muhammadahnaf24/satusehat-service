import { Request, Response } from "express";
import { ServiceRequestService } from "../services/serviceRequestService";
import { getLocalLab } from "../services/localService";
import { getToken } from "../utils/tokenManager";
import { IApiResponse } from "../@types";

export const postLabToSatuSehat = async (req: Request, res: Response) => {
  console.log("[postLabToSatuSehat] req.body:", req.body);
  const nobukti = req.body?.nobukti;

  if (!nobukti) {
    console.warn("[postLabToSatuSehat] nobukti tidak ditemukan");
    return res.status(400).json({
      success: false,
      message:
        "Parameter 'nobukti' wajib diisi dalam request body (Content-Type: application/json)",
    } as IApiResponse);
  }

  try {
    console.log(`[POST] 🔍 Mencari data lab dengan No Bukti: ${nobukti}`);

    const localDataArray = await getLocalLab(nobukti as string);

    if (!localDataArray || localDataArray.length === 0) {
      console.warn(`[POST] ⚠️ Data tidak ditemukan untuk: ${nobukti}`);
      return res.status(404).json({
        success: false,
        message: `Tidak ada data lab ditemukan dengan nomor bukti: ${nobukti}`,
        data: [],
      } as IApiResponse);
    }

    const token = await getToken();

    if (!token) {
      console.error("Token Satu Sehat tidak valid.");
      return res.status(500).json({
        success: false,
        message: "Token Satu Sehat tidak valid.",
      } as IApiResponse);
    }

    const serviceRequestService = new ServiceRequestService();

    const results: any[] = [];
    const errors: any[] = [];

    const groupedByLabsrid = localDataArray.reduce(
      (acc, item) => {
        if (!acc[item.labsrid]) {
          acc[item.labsrid] = [];
        }
        acc[item.labsrid].push(item);
        return acc;
      },
      {} as Record<string, typeof localDataArray>,
    );

    for (const labsrid in groupedByLabsrid) {
      const itemsGroup = groupedByLabsrid[labsrid];
      const invalidItems = itemsGroup.filter(
        (item) => !item.kd_loinc || item.kd_loinc.trim() === "",
      );

      if (invalidItems.length > 0) {
        console.warn(
          `[POST] ⚠️ Ada ${invalidItems.length} item tanpa LOINC code untuk labsrid: ${labsrid}`,
        );
        invalidItems.forEach((item) => {
          errors.push({
            labsrid: item.labsrid,
            item: item.txt_list || "Unknown",
            message: `Kode LOINC tidak ditemukan untuk pemeriksaan: ${item.txt_list}`,
          });
        });
      }

      const validItems = itemsGroup.filter(
        (item) => item.kd_loinc && item.kd_loinc.trim() !== "",
      );

      if (validItems.length === 0) {
        continue;
      }

      console.log(
        `[SENDING] Mengirim ${validItems.length} item untuk labsrid: ${labsrid}`,
      );

      const response = await serviceRequestService.createServiceRequest(
        validItems,
        token,
      );

      if (response.success) {
        results.push({
          labsrid: labsrid,
          itemCount: validItems.length,
          items: validItems.map((item) => ({
            name: item.txt_list,
            loinc: item.kd_loinc,
          })),
          id_satusehat: response.data?.id,
          message: response.message,
        });
      } else {
        errors.push({
          labsrid: labsrid,
          itemCount: validItems.length,
          message: response.message,
          detail: response.data,
        });
      }
    }
    const totalProcessed = localDataArray.length;
    const totalSuccess = results.length;
    const totalError = errors.length;
    if (totalSuccess === 0 && totalError > 0) {
      return res.status(500).json({
        success: false,
        message: "Semua item pemeriksaan gagal terkirim ke Satu Sehat.",
        meta: { total_processed: totalProcessed },
        data: { errors },
      } as IApiResponse);
    }

    if (totalSuccess > 0 && totalError > 0) {
      return res.status(207).json({
        success: true,
        message: `Berhasil sebagian: ${totalSuccess} sukses, ${totalError} gagal.`,
        meta: {
          total_processed: totalProcessed,
          success_count: totalSuccess,
          fail_count: totalError,
        },
        data: { results, errors },
      } as IApiResponse);
    }

    return res.status(200).json({
      success: true,
      message: "Semua item berhasil dikirim ke Satu Sehat.",
      meta: { total_processed: totalProcessed },
      data: { results },
    } as IApiResponse);
  } catch (error: any) {
    console.error("[CONTROLLER ERROR]", error);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan internal server saat bridging.",
      error: error.message,
    } as IApiResponse);
  }
};
