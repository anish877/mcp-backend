// auth.controller.ts
import { Request, Response, NextFunction } from "express";
import User from "../models/user.model";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import mongoose from "mongoose";

interface RegisterRequestBody {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  role: "MCP" | "PICKUP_PARTNER";
}

// Define custom Request type to include the user property
interface AuthenticatedRequest extends Request {
    user: {
      _id: mongoose.Types.ObjectId;
      role: string;
    };
  }

const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    console.log(req.body)
    const { fullName, email, password, phone, role }: RegisterRequestBody = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({ message: "Email already taken" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      fullName,
      email,
      password: hashedPassword,
      phone,
      role,
    });

    res.status(201).json({ message: "User created successfully", userId: newUser._id });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      res.status(400).json({ message: "Invalid email or password" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(400).json({ message: "Invalid email or password" });
      return;
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      "123456",
      { expiresIn: "1d" }
    );

    res
      .cookie("uuid", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: true,
      })
      .status(200)
      .json({ message: "User logged in", token });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const verify = (req:AuthenticatedRequest,res:Response)=>{
    try {
        res.status(200).json({success:true,user:req.user})
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).json({ message: "Server error" });
    }
}

const AuthController = { register, login, verify };
export default AuthController;