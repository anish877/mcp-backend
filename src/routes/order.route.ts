import express from "express"
import authMiddleware from "../middleware/auth.middleware"
import OrderController from "../controller/order.controller"

const router = express.Router()

router.get("/",authMiddleware,(req,res)=>OrderController.getAllOrders(req,res))
router.post("/",authMiddleware,(req,res)=>OrderController.createOrder(req,res))
router.get("/:orderId",authMiddleware,(req,res)=>OrderController.getOrderDetails(req,res))
router.put("/:orderId/assign",authMiddleware,(req,res)=>OrderController.assignOrder(req,res))
router.put("/:orderId/status",authMiddleware,(req,res)=>OrderController.updateOrderStatus(req,res))
router.put("/:orderId/cancel",authMiddleware,(req,res)=>OrderController.cancelOrder(req,res))

export default router