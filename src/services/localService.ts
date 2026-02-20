import * as sql from "mssql";
import axios from "axios";
import { getPool } from "../config/db";
import { ILocalLab, ILisResponse, ILocalLabItem } from "../@types";
import { logger } from "../utils/logger";

export const getSqlQueue = async (nobukti?: string) => {
  try {
    const pool = await getPool();
    const request = pool.request();
    let query = "";

    if (nobukti) {
      query = `
            SELECT TOP 1
                a.vc_noreg, a.vc_norm, a.VC_NoBukti, b.vc_idPatient, b.vc_namaPatient, b.vc_idEncounter, 
                a.DT_TglTrans, b.vc_idPractitioner, b.vc_namaPractitioner, 
                '10014487449' as performerid, 'Nanang Joniantono' as performername
            FROM LabNotaralan a
            INNER JOIN _SatSet_Encounter b ON a.VC_NoReg = b.vc_noReg
            INNER JOIN RMKUNJUNG c ON a.VC_NoReg = c.vc_no_regj
            WHERE a.VC_NoBukti = @nobukti
        `;
      request.input("nobukti", sql.VarChar, nobukti);
    } else {
      query = `
            SELECT 
                a.vc_noreg, a.vc_norm, a.VC_NoBukti, b.vc_idPatient, b.vc_namaPatient, b.vc_idEncounter, 
                a.DT_TglTrans, b.vc_idPractitioner, b.vc_namaPractitioner, 
                '10014487449' as performerid, 'Nanang Joniantono' as performername
            FROM LabNotaralan a
            INNER JOIN _SatSet_Encounter b ON a.VC_NoReg = b.vc_noReg
            INNER JOIN RMKUNJUNG c ON a.VC_NoReg = c.vc_no_regj
            LEFT JOIN _SatSet_Lab d ON a.VC_NoBukti = d.vc_nobukti 
            WHERE c.dt_tgl_reg BETWEEN '2025-05-01' AND '2025-05-10' AND d.vc_nobukti IS NULL
            ORDER BY a.DT_TglTrans
        `;
    }

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    logger.error(
      `[SQL_QUERY_ERROR] Msg: ${error instanceof Error ? error.message : "Unknown Error"}`,
    );
    return [];
  }
};

export const getLisData = async (row: any): Promise<ILocalLab | null> => {
  const url_ws = process.env.BASE_URL_WS_LIS as string;
  if (!url_ws) return null;

  try {
    const lisUrl = `${url_ws}${row.vc_norm}`;
    const apiRes = await axios.get<ILisResponse[]>(lisUrl, { timeout: 30000 });
    const lisHistory = apiRes.data;

    let matchedItem: ILisResponse | undefined = undefined;

    if (Array.isArray(lisHistory)) {
      const sqlNoBukti = String(row.VC_NoBukti).trim();
      matchedItem = lisHistory.find(
        (item) => String(item.no_trans).trim() === sqlNoBukti,
      );
    }

    if (matchedItem && matchedItem.Data && matchedItem.Data.length > 0) {
      const labItems: ILocalLabItem[] = matchedItem.Data.map((labResult) => ({
        kd_loinc: labResult.code_loinc || " ",
        display_loinc: labResult.display_loinc || " ",
        txt_list: labResult.nama_parameter || " ",
        value: parseFloat(labResult.hasil) || 0,
        unit: labResult.satuan || " ",
      }));

      logger.info(
        `[LIS_MATCH] NoBukti: ${row.VC_NoBukti} | RM: ${row.vc_norm} | Items: ${labItems.length}`,
      );

      return {
        noreg: row.vc_noreg,
        norm: row.vc_norm,
        labsrid: row.VC_NoBukti,
        id_pasien: row.vc_idPatient,
        nama_pasien: row.vc_namaPatient,
        id_encounter: row.vc_idEncounter,
        tgl_transaksi: new Date(row.DT_TglTrans).toISOString(),
        id_practitioner: row.vc_idPractitioner,
        nama_practitioner: row.vc_namaPractitioner,
        id_performer: row.performerid,
        nama_performer: row.performername,
        items: labItems,
      };
    } else {
      logger.warn(`[LIS_MISS] NoBukti: ${row.VC_NoBukti} | RM: ${row.vc_norm}`);
      return null;
    }
  } catch (apiError) {
    const errorMessage =
      apiError instanceof Error ? apiError.message : "Unknown Error";
    logger.error(`[LIS_API_ERROR] RM: ${row.vc_norm} | Msg: ${errorMessage}`);
    return null;
  }
};

export const getLocalLab = async (nobukti?: string): Promise<ILocalLab[]> => {
  const rows = await getSqlQueue(nobukti);
  const finalData: ILocalLab[] = [];

  for (const row of rows) {
    const lisData = await getLisData(row);
    if (lisData) finalData.push(lisData);
  }
  return finalData;
};

export const updateSatuSehatStatus = async (
  baseData: ILocalLab,
  ssId: string,
): Promise<void> => {
  try {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      await transaction
        .request()
        .input("ssid", sql.VarChar, ssId)
        .input("id_encounter", sql.VarChar, baseData.id_encounter)
        .input("nobukti", sql.VarChar, baseData.labsrid)
        .input("noreg", sql.VarChar, baseData.noreg)
        .input("norm", sql.VarChar, baseData.norm)
        .input("authoredOn", sql.VarChar, baseData.tgl_transaksi).query(`
          INSERT INTO _SatSet_Lab (vc_idServiceRequest, vc_idEncounter, vc_noBukti, vc_noReg, vc_noRm, vc_authoredOn, dt_created_at)
          VALUES (@ssid, @id_encounter, @nobukti, @noreg, @norm, @authoredOn, GETDATE())
        `);

      for (const item of baseData.items) {
        if (!item.kd_loinc) continue;
        await transaction
          .request()
          .input("ssid", sql.VarChar, ssId)
          .input("nobukti", sql.VarChar, baseData.labsrid)
          .input("loinc", sql.VarChar, item.kd_loinc)
          .input("display", sql.VarChar, item.display_loinc).query(`
             INSERT INTO _SatSet_Lab_D (vc_idServiceRequest, vc_noBukti, vc_codeLoinc, vc_namaLoinc)
             VALUES (@ssid, @nobukti, @loinc, @display)
          `);
      }
      await transaction.commit();
      logger.info(
        `[DB_UPSERT_SUCCESS] NoBukti: ${baseData.labsrid} | SS_ID: ${ssId}`,
      );
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown Error";
    logger.error(
      `[DB_ERROR] NoBukti: ${baseData.labsrid} | Msg: ${errorMessage}`,
    );
    throw error;
  }
};
