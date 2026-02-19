import * as sql from "mssql";
import axios from "axios";
import { getPool } from "../config/db";
import { ILocalLab, ILisResponse, ILocalLabItem } from "../@types";
import { logger } from "../utils/logger";

export const getLocalLab = async (nobukti?: string): Promise<ILocalLab[]> => {
  try {
    const url_ws = process.env.BASE_URL_WS_LIS as string;
    if (!url_ws) {
      console.error(
        "⚠️ FATAL: Environment Variable BASE_URL_WS_LIST tidak terbaca!",
      );

      return [];
    }
    const pool = await getPool();

    let query = "";
    const request = pool.request();

    if (nobukti) {
      query = `
            SELECT 
                a.vc_noreg,
                a.vc_norm, 
                a.VC_NoBukti, 
                b.vc_idPatient,
                b.vc_namaPatient, 
                b.vc_idEncounter, 
                a.DT_TglTrans, 
                b.vc_idPractitioner, 
                b.vc_namaPractitioner, 
                '10014487449' as performerid,
                'Nanang Joniantono' as performername
            FROM LabNotaralan a
            INNER JOIN _SatSet_Encounter b ON a.VC_NoReg = b.vc_noReg
            INNER JOIN RMKUNJUNG c ON a.VC_NoReg = c.vc_no_regj
            WHERE a.VC_NoBukti = @nobukti
        `;
      request.input("nobukti", sql.VarChar, nobukti);
    } else {
      query = `
            SELECT 
                a.vc_noreg,
                a.vc_norm, 
                a.VC_NoBukti, 
                b.vc_idPatient,
                b.vc_namaPatient, 
                b.vc_idEncounter, 
                a.DT_TglTrans, 
                b.vc_idPractitioner, 
                b.vc_namaPractitioner, 
                '10014487449' as performerid,
                'Nanang Joniantono' as performername
            FROM LabNotaralan a
            INNER JOIN _SatSet_Encounter b ON a.VC_NoReg = b.vc_noReg
            INNER JOIN RMKUNJUNG c ON a.VC_NoReg = c.vc_no_regj
            LEFT JOIN _SatSet_Lab d ON a.VC_NoBukti = d.vc_nobukti 
            WHERE c.dt_tgl_reg >= '2025-05-01' AND d.vc_nobukti IS NULL
            ORDER BY a.DT_TglTrans
        `;
    }

    const result = await request.query(query);

    if (result.recordset.length === 0) return [];

    const finalData: ILocalLab[] = [];

    await Promise.all(
      result.recordset.map(async (row) => {
        try {
          const lisUrl = `${url_ws}${row.vc_norm}`;
          const apiRes = await axios.get<ILisResponse[]>(lisUrl, {
            timeout: 20000,
          });
          const lisHistory = apiRes.data;

          let matchedItem: ILisResponse | undefined = undefined;

          if (Array.isArray(lisHistory)) {
            logger.info(
              `📊 Jumlah data ditemukan dari API LIS ( ${row.vc_norm}): ${lisHistory.length}`,
            );
          }

          if (Array.isArray(lisHistory)) {
            const sqlNoBukti = String(row.VC_NoBukti).trim();

            matchedItem = lisHistory.find(
              (item) => String(item.no_trans).trim() === sqlNoBukti,
            );
          }

          if (matchedItem) {
            logger.info(`✅ MATCH FOUND! Transaksi: ${matchedItem.no_trans}`);
            if (matchedItem.Data && matchedItem.Data.length > 0) {
              const labItems: ILocalLabItem[] = matchedItem.Data.map(
                (labResult) => ({
                  kd_loinc: labResult.code_loinc || " ",
                  display_loinc: labResult.display_loinc || " ",
                  txt_list: labResult.nama_parameter || " ",
                  value: parseFloat(labResult.hasil) || 0,
                  unit: labResult.satuan || " ",
                }),
              );

              finalData.push({
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
              });

              logger.info(` 📋 Berhasil grouping ${labItems.length} item lab.`);
            }
          } else {
            logger.info(
              `⚠️ Tidak ada data di API LIS yang cocok dengan NoBukti: ${row.VC_NoBukti}`,
            );
          }
        } catch (apiError) {
          const errorMessage =
            apiError instanceof Error ? apiError.message : "Unknown Error";
          logger.error(
            `❌ API Error untuk vc_norm ${row.vc_norm}:`,
            errorMessage,
          );
        }
      }),
    );

    console.log(
      `📈 Total data yang diproses dari SQL berdasarkan no_reg: ${result.recordset.length}`,
    );
    console.log(
      `✨ Total data akhir yang berhasil diproses: ${finalData.length}`,
    );

    return finalData;
  } catch (error) {
    logger.error("Error getLocalLab:", error);
    throw error;
  }
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
          INSERT INTO _SatSet_Lab (
            vc_idServiceRequest, 
            vc_idEncounter, 
            vc_noBukti, 
            vc_noReg, 
            vc_noRm, 
            vc_authoredOn, 
            dt_created_at
          )
          VALUES (
            @ssid, 
            @id_encounter, 
            @nobukti, 
            @noreg, 
            @norm, 
            @authoredOn, 
            GETDATE()
          )
        `);

      for (const item of baseData.items) {
        if (!item.kd_loinc) continue;

        await transaction
          .request()
          .input("ssid", sql.VarChar, ssId)
          .input("nobukti", sql.VarChar, baseData.labsrid)
          .input("loinc", sql.VarChar, item.kd_loinc)
          .input("display", sql.VarChar, item.display_loinc).query(`
             INSERT INTO _SatSet_Lab_D
             (vc_idServiceRequest, vc_noBukti, vc_codeLoinc, vc_namaLoinc)
             VALUES 
             (@ssid, @nobukti, @loinc, @display)
          `);
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      logger.error(`❌ [DB ERROR] Gagal simpan detail ke _SatSet_Lab:`, error);
      throw error;
    }

    logger.info(
      `✅ Berhasil update status di database untuk labsrid: ${baseData.labsrid}`,
    );
  } catch (error) {
    logger.error(
      `❌ [DB ERROR] Gagal update status untuk labsrid: ${baseData.labsrid}`,
      error,
    );
    throw error;
  }
};

export const getDataServiceRequest = async () => {
  try {
    const pool = await getPool();
    const query = `
  aaa
    `;

    const result = await pool.request().query(query);

    return result.recordset;
  } catch (error) {
    logger.error("[DB ERROR] Gagal mencari data pending:", error);
    return [];
  }
};
