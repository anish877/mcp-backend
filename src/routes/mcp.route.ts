import express from "express"
import authMiddleware from "../middleware/auth.middleware"
import MCPController from "../controller/mcp.controller"

const router = express.Router()

router.get("/dashboard",authMiddleware,(req,res)=>MCPController.getDashboard(req,res))
router.post("/profile",authMiddleware,(req,res)=>MCPController.getProfile(req,res))
router.put("/update",authMiddleware,(req,res)=>MCPController.updateProfile(req,res))

export default router