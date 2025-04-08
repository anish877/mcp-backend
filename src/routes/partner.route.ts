import express, { Request, Response } from "express";
import authMiddleware from "../middleware/auth.middleware";
import PartnerController from "../controller/partner.controller";
import mongoose from "mongoose";

interface AuthenticatedRequest extends Request {
  user: {
    _id: mongoose.Types.ObjectId;
  };
}

const router = express.Router();

router.post("/", authMiddleware, (req: Request, res: Response) => 
  PartnerController.addPartner(req as AuthenticatedRequest, res));

router.delete("/:partnerId", authMiddleware, (req: Request, res: Response) => 
  PartnerController.deletePartner(req as AuthenticatedRequest, res));

router.get("/", authMiddleware, (req: Request, res: Response) => 
  PartnerController.getAllPartners(req as AuthenticatedRequest, res));

router.get("/:partnerId", authMiddleware, (req: Request, res: Response) => 
  PartnerController.getPartnerDetails(req as AuthenticatedRequest, res));

router.put("/:partnerId", authMiddleware, (req: Request, res: Response) => 
  PartnerController.updatePartner(req as AuthenticatedRequest, res));

export default router;