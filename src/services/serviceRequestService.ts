import axios from "axios";
import { ILocalLab, IServiceResponse, ISatuSehatConfig } from "../@types";
import dotenv from "dotenv";

dotenv.config();

export class ServiceRequestService {
  private config: ISatuSehatConfig;
  constructor() {
    this.config = {
      clientId: process.env.CLIENT_ID as string,
      clientSecret: process.env.CLIENT_SECRET as string,
      authUrl: process.env.AUTH_URL_SATSET as string,
      baseUrl: process.env.BASE_URL_SATSET as string,
      organizationId: process.env.ORG_ID as string,
    };
    if (!this.config.baseUrl || !this.config.organizationId) {
      console.warn(
        "⚠️ FATAL: Environment Variable BASE_URL_SATSET atau ORG_ID tidak terbaca!",
      );
    }
  }

  async createServiceRequest(
    dataArray: ILocalLab[],
    token: string,
  ): Promise<IServiceResponse> {
    try {
      if (!token) {
        return {
          success: false,
          message: "Token Satu Sehat tidak valid (kosong).",
        };
      }

      const baseData = dataArray[0];

      const codingArray = dataArray.map((item) => ({
        system: "http://loinc.org",
        code: item.kd_loinc,
        display: item.display_loinc,
      }));

      const reasonCodeArray = [
        ...new Set(dataArray.map((item) => item.txt_list)),
      ]
        .filter((text) => text && text.trim() !== "")
        .map((text) => ({
          text: text,
        }));

      const payload = {
        resourceType: "ServiceRequest",
        identifier: [
          {
            system: `http://sys-ids.kemkes.go.id/servicerequest/${this.config.organizationId}`,
            value: baseData.labsrid,
          },
        ],
        status: "active",
        intent: "original-order",
        priority: "routine",
        category: [
          {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "108252007",
                display: "Laboratory procedure",
              },
            ],
          },
        ],
        code: {
          coding: codingArray,
          text: `${dataArray.length} pemeriksaan lab`,
        },
        subject: {
          reference: `Patient/${baseData.id_pasien}`,
        },
        encounter: {
          reference: `Encounter/${baseData.id_encounter}`,
        },
        occurrenceDateTime: baseData.tgl_transaksi,
        authoredOn: baseData.tgl_transaksi,
        requester: {
          reference: `Practitioner/${baseData.id_practitioner}`,
          display: baseData.nama_practitioner,
        },
        performer: [
          {
            reference: `Practitioner/${baseData.id_performer}`,
            display: baseData.nama_performer,
          },
        ],
        reasonCode: reasonCodeArray,
      };
      const url = `${this.config.baseUrl}/ServiceRequest`;

      console.log("==========================================");
      console.log(`📤 MENGIRIM SERVICEREQUEST (${dataArray.length} items)`);
      console.log("==========================================");
      console.log("Items yang dikirim:");
      dataArray.forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.txt_list} (LOINC: ${item.kd_loinc})`);
      });
      console.log("\nPayload Structure:");
      console.log(`  - resourceType: ${payload.resourceType}`);
      console.log(`  - labsrid: ${payload.identifier[0].value}`);
      console.log(`  - coding count: ${payload.code.coding.length}`);
      console.log(`  - reasonCode count: ${payload.reasonCode.length}`);
      console.log("\nFull Payload:");
      console.log(JSON.stringify(payload, null, 2));
      console.log("==========================================");

      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      return {
        success: true,
        message: "Berhasil mengirim ServiceRequest.",
        data: response.data,
      };
    } catch (error: any) {
      const baseData = dataArray?.[0];
      console.error(
        `[SATU SEHAT ERROR] Gagal kirim ServiceRequest (${baseData?.labsrid}):`,
      );

      let errorMessage = error.message;
      let errorDetail = null;

      if (error.response) {
        errorDetail = error.response.data;

        const issue = errorDetail?.issue?.[0];
        if (issue) {
          errorMessage = `[${issue.code}] ${issue.details?.text || issue.diagnostics}`;
        } else {
          errorMessage = `HTTP ${error.response.status} - ${error.response.statusText}`;
        }

        console.error("Detail Response:", JSON.stringify(errorDetail));
      }

      return {
        success: false,
        message: errorMessage,
        data: errorDetail,
      };
    }
  }
}
