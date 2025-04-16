import express, { Request, Response } from "express";
import AuthController from "../controller/auth.controller";
import authMiddleware from "../middleware/auth.middleware";
import mongoose from "mongoose";

const router = express.Router();

interface AuthenticatedRequest extends Request {
  user: {
    _id: mongoose.Types.ObjectId;
    role: string;
  };
}

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);

router.get(
  "/verify",
  authMiddleware,
  (req: Request, res: Response) =>
    AuthController.verify(req as AuthenticatedRequest, res)
);

export default router;
