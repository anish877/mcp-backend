import express from "express"
import authMiddleware from "../middleware/auth.middleware"
import WalletController from "../controller/wallet.controller"
import TransactionController from "../controller/transaction.controller"
import RazorpayController from "../controller/razorpay.controller"

const router = express.Router()

//@ts-ignore
router.post("/add",authMiddleware,(req,res)=>WalletController.addMoney(req,res))
//@ts-ignore
router.post("/transfer",authMiddleware,(req,res)=>WalletController.transferMoney(req,res))
//@ts-ignore
router.post("/withdraw",authMiddleware,(req,res)=>WalletController.withdrawMoney(req,res))
//@ts-ignore
router.get("/balance",authMiddleware,(req,res)=>WalletController.getBalance(req,res))
//@ts-ignore
router.get("/transaction",authMiddleware,(req,res)=>TransactionController.getTransactions(req,res))
//@ts-ignore
router.get("/transaction/:transactionId",authMiddleware,(req,res)=>TransactionController.getTransactionDetails(req,res))
//@ts-ignore
router.get("/transaction/summary",authMiddleware,(req,res)=>TransactionController.getTransactionSummary(req,res))
//@ts-ignore
router.post("/razorpay/create-order",authMiddleware,(req,res)=>RazorpayController.createOrder(req,res))
//@ts-ignore
router.post("/razorpay/verify-payment",authMiddleware,(req,res)=>RazorpayController.verifyPayment(req,res))

export default router