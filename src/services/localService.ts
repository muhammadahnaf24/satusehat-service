import * as sql from "mssql";
import axios from "axios";
import { getPool } from "../config/db";
import { ILocalLab, ILisResponse, ILocalLabItem } from "../@types";

export const getLocalLab = async (nobukti: string): Promise<ILocalLab[]> => {
  try {
    const url_ws = process.env.BASE_URL_WS_LIS as string;
    console.log("URL : ", url_ws);
    if (!url_ws) {
      console.error(
        "⚠️ FATAL: Environment Variable BASE_URL_WS_LIST tidak terbaca!",
      );

      return [];
    }
    const pool = await getPool();

    const query = `
        SELECT 
            a.vc_noreg,
            a.vc_norm, 
            a.VC_NoBukti, 
            b.vc_idPatient, 
            b.vc_idEncounter, 
            a.DT_TglTrans, 
            b.vc_idPractitioner, 
            b.vc_namaPractitioner, 
            '10014487449' as performerid,
            'Nanang Joniantono' as performername
        FROM LabNotaralan a
        INNER JOIN _SatSet_Encounter b ON a.VC_NoReg = b.vc_noReg
        INNER JOIN RMKUNJUNG c on a.VC_NoReg = c.vc_no_regj
        where a.VC_NoBukti = @nobukti
    `;

    const result = await pool
      .request()
      .input("nobukti", sql.VarChar, nobukti)
      .query(query);

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
            console.log(
              `📊 Jumlah data ditemukan dari API LIS ( ${row.vc_norm}): ${lisHistory.length}`,
            );
          }

          if (Array.isArray(lisHistory)) {
            const sqlNoBukti = String(row.VC_NoBukti || "").trim();

            matchedItem = lisHistory.find(
              (item) => String(item.no_trans).trim() === sqlNoBukti,
            );
          }

          if (matchedItem) {
            console.log(`✅ MATCH FOUND! Transaksi: ${matchedItem.no_trans}`);
            if (matchedItem.Data && matchedItem.Data.length > 0) {
              const labItems: ILocalLabItem[] = matchedItem.Data.map(
                (labResult) => ({
                  kd_loinc: labResult.code_loinc || " ",
                  display_loinc: labResult.display_loinc || " ",
                  txt_list: labResult.nama_parameter || " ",
                }),
              );

              finalData.push({
                noreg: row.vc_noreg,
                norm: row.vc_norm,
                labsrid: row.VC_NoBukti,
                id_pasien: row.vc_idPatient,
                id_encounter: row.vc_idEncounter,
                tgl_transaksi: new Date(row.DT_TglTrans).toISOString(),
                id_practitioner: row.vc_idPractitioner,
                nama_practitioner: row.vc_namaPractitioner,
                id_performer: row.performerid,
                nama_performer: row.performername,

                items: labItems,
              });

              console.log(` 📋 Berhasil grouping ${labItems.length} item lab.`);
            }
          } else {
            console.log(
              `⚠️ Tidak ada data di API LIS yang cocok dengan NoBukti: ${row.VC_NoBukti}`,
            );
          }
        } catch (apiError) {
          const errorMessage =
            apiError instanceof Error ? apiError.message : "Unknown Error";
          console.error(
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
    console.error("Error getLocalLab:", error);
    throw error;
  }
};

export const getUnsentLab = async () => {
  try {
    const pool = await getPool();
    const query = `
      SELECT TOP 3 a.VC_NoBukti
      FROM LabNotaralan a
      LEFT JOIN _SatSet_Lab b ON a.VC_NoBukti = b.vc_nobukti
      WHERE b.vc_nobukti IS NULL
      
      and a.VC_NoBukti = '25010607010129'
      ORDER BY a.DT_TglTrans;
    `;

    const result = await pool.request().query(query);

    return result.recordset.map((row) => row.VC_NoBukti);
  } catch (error) {
    console.error("[DB ERROR] Gagal mencari data pending:", error);
    return [];
  }
};

export const updateSatuSehatStatus = async (
  baseData: ILocalLab,
  ssId: string,
): Promise<void> => {
  try {
    const pool = await getPool();

    const query = `     
      INSERT INTO _SatSet_Lab (
        vc_id_service_request, 
        vc_id_encounter, 
        vc_nobukti, 
        vc_noreg, 
        vc_norm, 
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
    `;

    await pool
      .request()
      .input("ssid", sql.VarChar, ssId)
      .input("id_encounter", sql.VarChar, baseData.id_encounter)
      .input("nobukti", sql.VarChar, baseData.labsrid)
      .input("noreg", sql.VarChar, baseData.noreg)
      .input("norm", sql.VarChar, baseData.norm)
      .input("authoredOn", sql.VarChar, baseData.tgl_transaksi)
      .query(query);

    console.log(
      `💾 [DB SAVED] Data tersimpan di _SatSet_Lab untuk NoBukti: ${baseData.labsrid}`,
    );
  } catch (error) {
    console.error(`❌ [DB ERROR] Gagal simpan ke _SatSet_Lab:`, error);
  }
};
