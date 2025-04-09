import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Order from '../models/orders.model';
import User from '../models/user.model';
import Transaction from '../models/transaction.model';
import Notification from '../models/notification.model';
import MCPPartner from '../models/pickupPartner.model';

// Define custom Request type to include the user property
interface AuthenticatedRequest extends Request {
  user: {
    _id: mongoose.Types.ObjectId;
    role: string;
  };
}

const getAllOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, startDate, endDate, mcpId, partnerId } = req.query;
    const filter: any = {};
    
    if (status) filter.status = status;
    if (mcpId) filter.mcpId = mcpId;
    if (partnerId) filter.pickupPartnerId = partnerId;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate as string);
      if (endDate) filter.createdAt.$lte = new Date(endDate as string);
    }
    
    const orders = await Order.find(filter)
      .populate('customerId', 'fullName email phone')
      .populate('pickupPartnerId', 'fullName phone')
      .populate('mcpId', 'fullName')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching orders'
    });
  }
}

const createOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderAmount, location } = req.body;
    const customerId = req.user._id;
    const mcpId = req.user._id;
    const order = await Order.create({
      customerId,
      mcpId,
      orderAmount,
      location,
      status: 'PENDING'
    });
    console.log(order);
    
    await Notification.create({
      userId: mcpId,
      title: 'New Order Received',
      message: `You have received a new order of amount ${orderAmount}`,
      type: 'ORDER',
      referenceId: order._id,
      priority: 'high',
      actionRequired: true
    });
    
    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: 'Error creating order'
    });
  }
}

const getOrderDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findById(orderId)
      .populate('customerId', 'fullName email phone')
      .populate('pickupPartnerId', 'fullName phone')
      .populate('mcpId', 'fullName');
    
    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }
    
    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching order details'
    });
  }
}

const assignOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { pickupPartnerId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }
    
    const partner = await User.findOne({ 
      _id: pickupPartnerId, 
      role: 'PICKUP_PARTNER',
      status: 'ACTIVE'
    });
    
    if (!partner) {
      res.status(404).json({
        success: false,
        message: 'Pickup partner not found or inactive'
      });
      return;
    }
    
    const partnerRelation = await MCPPartner.findOne({
      mcpId: order.mcpId,
      partnerId: pickupPartnerId,
      status: 'ACTIVE'
    });
    
    if (!partnerRelation) {
      res.status(400).json({
        success: false,
        message: 'Pickup partner is not associated with this MCP'
      });
      return;
    }
    
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        pickupPartnerId,
        status: 'ASSIGNED',
        updatedAt: new Date()
      },
      { new: true }
    );
    
    await Notification.create({
      userId: pickupPartnerId,
      title: 'New Order Assigned',
      message: `You have been assigned a new order #${orderId}`,
      type: 'ORDER',
      referenceId: order._id,
      priority: 'high',
      actionRequired: true
    });
    
    res.status(200).json({
      success: true,
      data: updatedOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error assigning order'
    });
  }
}

const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
      return;
    }
    
    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }
    
    const updateData: any = {
      status,
      updatedAt: new Date()
    };
    
    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
      
      if (order.pickupPartnerId && order.mcpId) {
        const partnerRelation = await MCPPartner.findOne({
          mcpId: order.mcpId,
          partnerId: order.pickupPartnerId
        });
        
        if (partnerRelation) {
          let commissionAmount;
          
          if (partnerRelation.commissionType === 'PERCENTAGE') {
            commissionAmount = (order.orderAmount * partnerRelation.commissionRate) / 100;
          } else {
            commissionAmount = partnerRelation.commissionRate;
          }
          
          const partnerAmount = order.orderAmount - commissionAmount;
          
          await Transaction.create({
            fromUserId: order.mcpId,
            toUserId: order.pickupPartnerId,
            amount: partnerAmount,
            type: 'PAYMENT',
            status: 'COMPLETED',
            orderId: order._id,
            description: `Payment for order #${order._id}`
          });
          
          await User.findByIdAndUpdate(
            order.pickupPartnerId,
            { $inc: { wallet: partnerAmount } }
          );
          
          await Notification.create({
            userId: order.pickupPartnerId,
            title: 'Payment Received',
            message: `You received ${partnerAmount} for completing order #${order._id}`,
            type: 'WALLET',
            referenceId: order._id,
            priority: 'medium',
            actionRequired: false
          });
        }
      }
    }
    
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      updateData,
      { new: true }
    );
    
    const notifyUsers = [order.customerId];
    if (order.mcpId) notifyUsers.push(order.mcpId);
    if (order.pickupPartnerId) notifyUsers.push(order.pickupPartnerId);
    
    // Set priority based on status
    let priority: 'low' | 'medium' | 'high' = 'medium';
    let actionRequired = true;
    
    if (status === 'COMPLETED' || status === 'CANCELLED') {
      priority = 'medium';
      actionRequired = false;
    } else if (status === 'IN_PROGRESS') {
      priority = 'high';
      actionRequired = true;
    }
    
    for (const userId of notifyUsers) {
      await Notification.create({
        userId,
        title: 'Order Status Updated',
        message: `Order #${order._id} status has been updated to ${status}`,
        type: 'ORDER',
        referenceId: order._id,
        priority,
        actionRequired
      });
    }
    
    res.status(200).json({
      success: true,
      data: updatedOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating order status'
    });
  }
}

const cancelOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { cancelReason } = req.body;
    
    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found'
      });
      return;
    }
    
    if (order.status === 'COMPLETED') {
      res.status(400).json({
        success: false,
        message: 'Cannot cancel completed orders'
      });
      return;
    }
    
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        status: 'CANCELLED',
        updatedAt: new Date(),
        cancelReason: cancelReason || 'No reason provided'
      },
      { new: true }
    );
    
    const notifyUsers = [order.customerId];
    if (order.mcpId) notifyUsers.push(order.mcpId);
    if (order.pickupPartnerId) notifyUsers.push(order.pickupPartnerId);
    
    for (const userId of notifyUsers) {
      await Notification.create({
        userId,
        title: 'Order Cancelled',
        message: `Order #${order._id} has been cancelled. Reason: ${cancelReason || 'No reason provided'}`,
        type: 'ORDER',
        referenceId: order._id,
        priority: 'medium',
        actionRequired: false
      });
    }
    
    res.status(200).json({
      success: true,
      data: updatedOrder
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error cancelling order'
    });
  }
}

const OrderController = {
  getAllOrders,
  getOrderDetails,
  cancelOrder,
  createOrder,
  assignOrder,
  updateOrderStatus
}

export default OrderController;