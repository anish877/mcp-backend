import mongoose, { mongo } from "mongoose";

const MCPPartnerSchema = new mongoose.Schema({
    mcpId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    commissionRate: { type: Number, default: 0 }, // Percentage or fixed amount
    commissionType: { type: String, enum: ['PERCENTAGE', 'FIXED'], default: 'FIXED' },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  });

const PickupPartner = mongoose.model("PickupPartner", MCPPartnerSchema);

export default PickupPartner;
