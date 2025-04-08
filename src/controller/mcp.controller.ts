import { Request, Response } from 'express';
import mongoose, { Document, Types } from 'mongoose';
import User from '../models/user.model';
import MCPPartner from '../models/pickupPartner.model';
import Order from '../models/orders.model';
import Transaction from '../models/transaction.model';


  const getDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
      const mcpId = req.user._id;
      const mcp = await User.findById(mcpId, 'wallet fullName email');
      if (!mcp || mcp.role !== 'MCP') {
        res.status(403).json({ message: 'Unauthorized. User is not an MCP' });
        return
      }
      const partners = await MCPPartner.find({ mcpId })
        .populate('partnerId', 'fullName email phone status')
        .lean();
      const activePartners = partners.filter(p => p.status === 'ACTIVE').length;
      const inactivePartners = partners.filter(p => p.status === 'INACTIVE').length;
      const totalOrders = await Order.countDocuments({ mcpId });
      const completedOrders = await Order.countDocuments({ mcpId, status: 'COMPLETED' });
      const pendingOrders = await Order.countDocuments({ 
        mcpId, 
        status: { $in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS'] } 
      });
      const cancelledOrders = await Order.countDocuments({ mcpId, status: 'CANCELLED' });
      const orderRevenue = await Order.aggregate([
        { $match: { mcpId: new mongoose.Types.ObjectId(mcpId.toString()), status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$orderAmount' } } }
      ]);
      
      const totalRevenue = orderRevenue.length > 0 ? orderRevenue[0].total : 0;
      const recentTransactions = await Transaction.find(
        { $or: [{ fromUserId: mcpId }, { toUserId: mcpId }] }
      )
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('fromUserId', 'fullName')
        .populate('toUserId', 'fullName')
        .lean();

        res.status(200).json({
        mcp: {
          name: mcp.fullName,
          email: mcp.email,
          walletBalance: mcp.wallet
        },
        partners: {
          total: partners.length,
          active: activePartners,
          inactive: inactivePartners
        },
        orders: {
          total: totalOrders,
          completed: completedOrders,
          pending: pendingOrders,
          cancelled: cancelledOrders,
          totalRevenue
        },
        recentTransactions,
        recentPartners: partners.slice(0, 5)
      });
      return
    } catch (error) {
      console.error('Error getting MCP dashboard:', error);
        res.status(500).json({ 
        message: 'Error retrieving dashboard data', 
        error: error instanceof Error ? error.message : String(error)
      });
      return
    }
  }
  const getProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const mcpId = req.user._id;

      const mcp = await User.findById(mcpId, 'fullName email phone wallet status createdAt');
      if (!mcp || mcp.role !== 'MCP') {
        res.status(403).json({ message: 'Unauthorized. User is not an MCP' });
        return
      }
      const partnersCount = await MCPPartner.countDocuments({ mcpId });
      const ordersCount = await Order.countDocuments({ mcpId });
      const completedOrdersCount = await Order.countDocuments({ mcpId, status: 'COMPLETED' });

       res.status(200).json({
        profile: {
          fullName: mcp.fullName,
          email: mcp.email,
          phone: mcp.phone,
          walletBalance: mcp.wallet,
          status: mcp.status,
          memberSince: mcp.createdAt
        },
        stats: {
          partnersCount,
          ordersCount,
          completedOrdersCount
        }
      });
      return
    } catch (error) {
      console.error('Error getting MCP profile:', error);
      res.status(500).json({ 
        message: 'Error retrieving profile data', 
        error: error instanceof Error ? error.message : String(error)
      });
      return
    }
  }
  const updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const mcpId = req.user._id;
      const { fullName, phone } = req.body;
      if (!fullName && !phone) {
        res.status(400).json({ message: 'Nothing to update. Please provide fullName or phone' });
        return
      }
      const updateData: { fullName?: string; phone?: string; updatedAt: Date } = {
        updatedAt: new Date()
      };
      
      if (fullName) updateData.fullName = fullName;
      if (phone) updateData.phone = phone;
      const mcp = await User.findById(mcpId);
      if (!mcp || mcp.role !== 'MCP') {
        res.status(403).json({ message: 'Unauthorized. User is not an MCP' });
        return
      }

      const updatedMCP = await User.findByIdAndUpdate(
        mcpId, 
        { $set: updateData },
        { new: true, select: 'fullName email phone status updatedAt' }
      );

        res.status(200).json({
        message: 'Profile updated successfully',
        profile: updatedMCP
      });
      return
    } catch (error) {
      console.error('Error updating MCP profile:', error);
       res.status(500).json({ 
        message: 'Error updating profile data', 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

const MCPController = {getDashboard,updateProfile,getProfile}
export default MCPController;