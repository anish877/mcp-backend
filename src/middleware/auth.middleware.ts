import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import User from "../models/user.model";

const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    console.log(req.query)
  try {
    const token = req.cookies?.uuid;

    if (!token) {
      res.status(401).json({ message: "Authentication token missing" });
      return 
    }

    const decoded = jwt.verify(token,"123456") as JwtPayload;
    console.log(decoded)
    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(401).json({ message: "User not found" });
      return 
    }
    //@ts-ignore
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth Error:", error);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

export default authMiddleware;
