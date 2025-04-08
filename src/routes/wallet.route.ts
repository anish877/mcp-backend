import express from "express"
import authMiddleware from "../middleware/auth.middleware"
import WalletController from "../controller/wallet.controller"
import TransactionController from "../controller/transaction.controller"

const router = express.Router()

router.post("/add",authMiddleware,(req,res)=>WalletController.addMoney(req,res))
router.post("/transfer",authMiddleware,(req,res)=>WalletController.transferMoney(req,res))
router.post("/withdraw",authMiddleware,(req,res)=>WalletController.withdrawMoney(req,res))
router.get("/balance",authMiddleware,(req,res)=>WalletController.getBalance(req,res))
router.get("/transaction",authMiddleware,(req,res)=>TransactionController.getTransactions(req,res))
router.get("/transaction/:transactionId",authMiddleware,(req,res)=>TransactionController.getTransactionDetails(req,res))

export default router