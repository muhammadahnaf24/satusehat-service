import { Router } from "express";
import * as localController from "../controllers/localController";
import * as satuSehatController from "../controllers/serviceRequestController";
const router = Router();

router.get("/lab/:nobukti", localController.getPreviewData);
router.post("/lab/bridge", satuSehatController.postLabToSatuSehat);

export default router;
