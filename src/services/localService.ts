import * as sql from "mssql";
import axios from "axios";
import { getPool } from "../config/db";
import { ILocalLab, ILisResponse } from "../@types";

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
            timeout: 10000,
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
              matchedItem.Data.forEach((labResult) => {
                const loincCode = labResult.code_loinc || " ";
                const loincDisplay = labResult.display_loinc || " ";
                const txtList = labResult.nama_parameter || " ";

                console.log(`  📋 Item: ${txtList} | LOINC: ${loincCode}`);

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

                  kd_loinc: loincCode,
                  display_loinc: loincDisplay,
                  txt_list: txtList,
                });
              });
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
      SELECT TOP 10 a.VC_NoBukti 
      FROM LabNotaralan a
      LEFT JOIN BridgingLog b ON a.VC_NoBukti = b.no_bukti
      WHERE b.no_bukti IS NULL 
      AND a.DT_TglTrans >= CAST(GETDATE() AS DATE
      ORDER BY a.DT_TglTrans DESC
    `;

    const result = await pool.request().query(query);

    return result.recordset.map((row) => row.VC_NoBukti);
  } catch (error) {
    console.error("[DB ERROR] Gagal mencari data pending:", error);
    return [];
  }
};
