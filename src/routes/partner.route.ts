import express from "express"
import authMiddleware from "../middleware/auth.middleware"
import PartnerController from "../controller/partner.controller"

const router = express.Router()

router.post("/",authMiddleware,(req,res)=>PartnerController.addPartner(req,res))
router.delete("/:partnerId",authMiddleware,(req,res)=>PartnerController.deletePartner(req,res))
router.get("/",authMiddleware,(req,res)=>PartnerController.getAllPartners(req,res))
router.get("/:partnerId",authMiddleware,(req,res)=>PartnerController.getPartnerDetails(req,res))
router.put("/:partnerId",authMiddleware,(req,res)=>PartnerController.updatePartner(req,res))

export default router