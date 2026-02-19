import axios from "axios";
import {
  ILocalLab,
  IServiceResponse,
  ISatuSehatConfig,
  IDataServiceRequest,
} from "../@types";
import dotenv from "dotenv";
import { Coding, Specimen } from "fhir/r4";

dotenv.config();

export class SpecimenService {
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

  async createSpecimen(
    transactionData: ILocalLab,
    serviceRequestData: IDataServiceRequest,
    token: string,
  ): Promise<IServiceResponse> {
    try {
      if (!token) {
        return {
          success: false,
          message: "Token Satu Sehat tidak valid (kosong).",
        };
      }

      //   const codingArraySnomed: Coding[] = transactionData.items.map((item) => ({
      //     system: "http://snomed.info/sct",
      //     code: item.kd_snomed,
      //     display: item.display_snomed,
      //   }));

      const payload: Specimen = {
        resourceType: "Specimen",
        identifier: [
          {
            system: `http://sys-ids.kemkes.go.id/specimen/${this.config.organizationId}`,
            value: transactionData.labsrid,
            assigner: {
              reference: `Organization/${this.config.organizationId}`,
            },
          },
        ],
        status: "available",
        type: {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: "119297000",
              display: "Blood specimen",
            },
          ],
        },
        collection: {
          collector: {
            reference: `Practitioner/${transactionData.id_practitioner}`,
            display: "Laboratory procedure",
          },
          collectedDateTime: transactionData.tgl_transaksi,
          quantity: {
            value: transactionData.items[0]?.value || 0,
            code: transactionData.items[0]?.unit,
            unit: transactionData.items[0]?.unit,
            system: "http://unitsofmeasure.org",
          },
          method: {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "82078001",
                display: "Collection of blood specimen for laboratory",
              },
            ],
          },
          bodySite: {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "280388002",
                display: "Structure of skin crease of elbow region",
              },
            ],
          },
          fastingStatusCodeableConcept: {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/v2-0916",
                code: "NF",
                display:
                  "The patient indicated they did not fast prior to the procedure.",
              },
            ],
          },
        },
        processing: [
          {
            procedure: {
              coding: [
                {
                  system: "http://snomed.info/sct",
                  code: "9265001",
                  display: "Specimen processing",
                },
              ],
            },
            timeDateTime: transactionData.tgl_transaksi,
          },
        ],
        subject: {
          reference: `Patient/${transactionData.id_pasien}`,
          display: transactionData.nama_pasien,
        },
        request: [
          {
            reference: `ServiceRequest/${serviceRequestData.id_service_request}`,
          },
        ],
        receivedTime: transactionData.tgl_transaksi,
      };

      const url = `${this.config.baseUrl}/ServiceRequest`;

      console.log("==========================================");
      console.log(
        `📤 MENGIRIM SERVICEREQUEST (${transactionData.items.length} items)`,
      );
      console.log(`🆔 NoBukti: ${transactionData.labsrid}`);
      console.log("==========================================");
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
      console.error(
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
