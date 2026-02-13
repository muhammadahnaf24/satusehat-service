import axios from "axios";
import qs from "qs";
import dotenv from "dotenv";
import { ISatuSehatToken } from "../@types";

dotenv.config();

let cachedToken: string | null = null;
let tokenExpiryTime: number = 0;

export const getToken = async (): Promise<string | null> => {
  const currentTime = Date.now();

  if (cachedToken && currentTime < tokenExpiryTime - 300000) {
    console.log("[TOKEN MANAGER] Menggunakan Cached Token");
    return cachedToken;
  }

  console.log(
    "[TOKEN MANAGER] Token expired atau kosong. Meminta token baru...",
  );

  try {
    const authBaseUrl = process.env.AUTH_URL_SATSET;

    const url = `${authBaseUrl}/accesstoken?grant_type=client_credentials`;

    const body = qs.stringify({
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
    });

    const response = await axios.post(url, body, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const data = response.data as ISatuSehatToken;

    cachedToken = data.access_token;

    const expiresInMs = parseInt(data.expires_in, 10) * 1000;
    tokenExpiryTime = currentTime + expiresInMs;

    console.log(
      `[TOKEN MANAGER] ✅ Token baru didapatkan. Valid selama ${data.expires_in} detik.`,
    );

    return cachedToken;
  } catch (error: any) {
    console.error("[TOKEN MANAGER ERROR] Gagal auth ke Satu Sehat:");

    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Response:", JSON.stringify(error.response.data));
    } else {
      console.error("Message:", error.message);
    }

    return null;
  }
};
