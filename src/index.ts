"use client";
import e from "express"
import cors from "cors"
import mongoose from "mongoose"
import authRoutes from "./routes/auth.route"
import mcpRoutes from "./routes/mcp.route"
import orderRoutes from "./routes/order.route"
import partnerRoutes from "./routes/partner.route"
import walletRoutes from "./routes/wallet.route"
import notificationRoutes from "./routes/notification.route"
import cookieParser from "cookie-parser"

const app = e()
const PORT = 8000

app.use(cookieParser())
app.use(e.json())
app.use(cors({origin:"http://localhost:3000",credentials:true}))
mongoose.connect('mongodb+srv://anishsuman2305:iJuk2MPDEPECgScS@cluster0.76uatyj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
    .then(()=>{
        console.log("Databse connected")
    })
    .catch((err)=>{
        console.log(err)
    })

app.use("/auth", authRoutes);
app.use("/mcp",mcpRoutes)
app.use("/orders",orderRoutes)
app.use("/partners",partnerRoutes)
app.use("/wallet",walletRoutes)
app.use("/notifications",notificationRoutes)

app.listen(PORT, () => {
    console.log(`Server started at port ${PORT}`);
  }).on("error", (err) => {
    console.error("Failed to start server:", err);
  });
  