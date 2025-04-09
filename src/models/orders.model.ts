import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Customer who placed the order
    pickupPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Partner assigned to the order
    mcpId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // MCP who manages the partner
    orderAmount: { type: Number, required: true },
    status: { type: String, enum: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], default: 'PENDING' },
    location: {
        address: { type: String, required: true },
        coordinates: {
          type: [Number],
          index: '2dsphere',
        }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    completedAt: { type: Date }
  });

const Orders = mongoose.model("Order",OrderSchema)

export default Orders