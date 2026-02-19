import { Request, Response } from "express";
import { getLocalLab } from "../services/localService";
import { IApiResponse } from "../@types";

export const getPreviewData = async (
  req: Request,
  res: Response,
): Promise<Response> => {
  const { nobukti } = req.params;

  if (!nobukti) {
    return res.status(400).json({
      success: false,
      message: "Parameter 'nobukti' wajib diisi.",
    } as IApiResponse);
  }

  try {
    console.log(`[PREVIEW] 🔍 Mencari data lab dengan No. Bukti: ${nobukti}`);

    const groupedData = await getLocalLab(nobukti as string);

    if (!groupedData || groupedData.length === 0) {
      console.warn(`[PREVIEW] ⚠️ Data tidak ditemukan untuk: ${nobukti}`);
      return res.status(404).json({
        success: false,
        message: `Tidak ada data lab ditemukan dengan nomor bukti: ${nobukti}`,
        data: [],
      } as IApiResponse);
    }

    const transaction = groupedData[0];
    const allItems = transaction.items;
    const validCount = allItems.filter(
      (item) => item.kd_loinc && item.kd_loinc.trim() !== "",
    ).length;

    const invalidCount = allItems.length - validCount;

    console.log(
      `[PREVIEW] ✅ Ditemukan ${allItems.length} items. Valid: ${validCount}, Invalid: ${invalidCount}`,
    );

    return res.status(200).json({
      success: true,
      message: `Preview Berhasil. Data Valid: ${validCount}`,
      meta: {
        total_items: allItems.length,
        filter_param: nobukti,
      },
      data: groupedData,
    } as IApiResponse);
  } catch (error: any) {
    console.error("[PREVIEW ERROR] ❌:", error);

    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan internal saat mengambil data preview.",
      error: error.message || "Internal Server Error",
    } as IApiResponse);
  }
};
