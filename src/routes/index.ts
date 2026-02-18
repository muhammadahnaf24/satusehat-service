import { Router } from "express";
import * as localController from "../controllers/localController";
import * as serviceRequestController from "../controllers/serviceRequestController";
const router = Router();

router.get("/lab/:nobukti", localController.getPreviewData);
router.post("/lab/bridge", serviceRequestController.postLabToSatuSehat);

export default router;
