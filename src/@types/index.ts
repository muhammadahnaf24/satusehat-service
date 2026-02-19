export interface IApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  meta?: any;
}

export interface IServiceResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface ISatuSehatConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  baseUrl: string;
  organizationId: string;
}

export interface ILocalLabItem {
  kd_loinc: string;
  display_loinc: string;
  txt_list: string;
  value: number;
  unit: string;
}
export interface ILocalLab {
  noreg: string;
  norm: string;
  labsrid: string;
  id_pasien: string;
  nama_pasien: string;
  id_encounter: string;
  tgl_transaksi: string;
  id_practitioner: string;
  nama_practitioner: string;
  id_performer: string;
  nama_performer: string;
  items: ILocalLabItem[];
}

export interface ISatuSehatToken {
  refresh_token_expires_in: string;
  api_product_list: string;
  api_product_list_json: string[];
  organization_name: string;
  "developer.email": string;
  token_type: string;
  issued_at: string;
  client_id: string;
  access_token: string;
  application_name: string;
  scope: string;
  expires_in: string;
  refresh_count: string;
  status: string;
}

export interface ILisDataItem {
  nama_parameter: string;
  hasil: string;
  satuan: string;
  n_rujukan: string;
  metoda: string;
  grup: string;
  code_loinc: string;
  display_loinc: string;
}

export interface ILisResponse {
  no_trans: string;
  no_lab: string;
  nama: string;
  no_rm: string;
  Data: ILisDataItem[];
}

export interface IDataServiceRequest {
  id_service_request: string;
  id_encounter: string;
  nobukti: string;
  noreg: string;
  norm: string;
  authored_on: string;
  created_at: string;
}
