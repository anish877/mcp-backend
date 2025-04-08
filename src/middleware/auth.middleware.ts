import { NextFunction, Request, Response } from "express"
import jwt, { JwtPayload } from "jsonwebtoken"
import User from "../models/user.model"

const authMiddleware = async (req:Request,res:Response,next:NextFunction)=>{
    const cookie = req.cookies.uuid
    const token = jwt.verify(cookie,process.env.JWT_SECRET||"123456") as JwtPayload
    const user = await User.findById(token._id)
    if(!user){
        res.status(400).json({message: "User not authenticated"})
        return
    }
    req.user = user
    next()
}

export default authMiddleware