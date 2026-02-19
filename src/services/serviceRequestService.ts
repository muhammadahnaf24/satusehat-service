import axios from "axios";
import { ILocalLab, IServiceResponse, ISatuSehatConfig } from "../@types";
import dotenv from "dotenv";
import { ServiceRequest, CodeableConcept, Coding } from "fhir/r4";
import { logger } from "../utils/logger";

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
    transactionData: ILocalLab,
    token: string,
  ): Promise<IServiceResponse> {
    try {
      if (!token) {
        return {
          success: false,
          message: "Token Satu Sehat tidak valid (kosong).",
        };
      }

      const codingArray: Coding[] = transactionData.items.map((item) => ({
        system: "http://loinc.org",
        code: item.kd_loinc,
        display: item.display_loinc,
      }));

      const reasonCodeArray: CodeableConcept[] = [
        ...new Set(transactionData.items.map((item) => item.txt_list)),
      ]
        .filter((text) => text && text.trim() !== "")
        .map((text) => ({
          text: text,
        }));

      const payload: ServiceRequest = {
        resourceType: "ServiceRequest",
        identifier: [
          {
            system: `http://sys-ids.kemkes.go.id/servicerequest/${this.config.organizationId}`,
            value: transactionData.labsrid,
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
          text: `${transactionData.items.length} pemeriksaan lab`,
        },
        subject: {
          reference: `Patient/${transactionData.id_pasien}`,
        },
        encounter: {
          reference: `Encounter/${transactionData.id_encounter}`,
        },
        occurrenceDateTime: transactionData.tgl_transaksi,
        authoredOn: transactionData.tgl_transaksi,
        requester: {
          reference: `Practitioner/${transactionData.id_practitioner}`,
          display: transactionData.nama_practitioner,
        },
        performer: [
          {
            reference: `Practitioner/${transactionData.id_performer}`,
            display: transactionData.nama_performer,
          },
        ],
        reasonCode: reasonCodeArray,
      };

      const url = `${this.config.baseUrl}/ServiceRequest`;

      console.log("==========================================");
      logger.info(
        `📤 MENGIRIM SERVICEREQUEST (${transactionData.items.length} items)`,
      );
      logger.info(`🆔 NoBukti: ${transactionData.labsrid}`);
      logger.info("==========================================");
      logger.info(JSON.stringify(payload, null, 2));
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
      logger.error(
        `[SATU SEHAT ERROR] Gagal kirim ServiceRequest (${transactionData.labsrid}):`,
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
        logger.error("Detail Response:", JSON.stringify(errorDetail));
      }

      return {
        success: false,
        message: errorMessage,
        data: errorDetail,
      };
    }
  }
}
