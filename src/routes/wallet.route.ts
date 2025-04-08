import express from "express"
import authMiddleware from "../middleware/auth.middleware"
import WalletController from "../controller/wallet.controller"
import TransactionController from "../controller/transaction.controller"

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

export default router