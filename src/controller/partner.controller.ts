import { Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/user.model';
import MCPPartner from '../models/pickupPartner.model';
import Notification from '../models/notification.model';

// Define custom Request type to include the user property
interface AuthenticatedRequest extends Request {
  user: {
    _id: mongoose.Types.ObjectId;
  };
}

const getAllPartners = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const mcpId = req.user._id;
    
    const relationships = await MCPPartner.find({ mcpId })
      .populate('partnerId', 'fullName email phone status wallet');
    
    res.status(200).json({
      success: true,
      count: relationships.length,
      data: relationships.map(rel => ({
        relationshipId: rel._id,
        partner: rel.partnerId,
        commissionRate: rel.commissionRate,
        commissionType: rel.commissionType,
        status: rel.status,
        createdAt: rel.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching partners:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching partners',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

const addPartner = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const mcpId = req.user._id;
    
    const { 
      fullName, 
      email, 
      password, 
      phone, 
      commissionRate = 0, 
      commissionType = 'FIXED' 
    } = req.body;
    
    if (!fullName || !email || !password || !phone) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
      return;
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
      return;
    }
    
    const newPartner = new User({
      fullName,
      email,
      password, 
      phone,
      role: 'PICKUP_PARTNER',
      status: 'ACTIVE'
    });
    
    const savedPartner = await newPartner.save({ session });
    
    const relationship = new MCPPartner({
      mcpId,
      partnerId: savedPartner._id,
      commissionRate,
      commissionType,
      status: 'ACTIVE'
    });
    
    await relationship.save({ session });
    
    const notification = new Notification({
      userId: mcpId,
      title: 'New Pickup Partner Added',
      message: `You have successfully added ${fullName} as a pickup partner.`,
      type: 'PARTNER',
      referenceId: savedPartner._id
    });
    
    await notification.save({ session });
    
    await session.commitTransaction();
    
    res.status(201).json({
      success: true,
      message: 'Pickup partner added successfully',
      data: {
        partner: {
          _id: savedPartner._id,
          fullName: savedPartner.fullName,
          email: savedPartner.email,
          phone: savedPartner.phone,
          status: savedPartner.status
        },
        relationship: {
          _id: relationship._id,
          commissionRate: relationship.commissionRate,
          commissionType: relationship.commissionType,
          status: relationship.status
        }
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error adding partner:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding partner',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    session.endSession();
  }
};

// Get specific partner details
const getPartnerDetails = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const mcpId = req.user._id;
    
    const { partnerId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(partnerId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid partner ID format'
      });
      return;
    }
    
    // Find relationship
    const relationship = await MCPPartner.findOne({ 
      mcpId, 
      partnerId 
    }).populate('partnerId', 'fullName email phone status wallet');
    
    if (!relationship) {
      res.status(404).json({
        success: false,
        message: 'Partner not found or not associated with this MCP'
      });
      return;
    }
    
    res.status(200).json({
      success: true,
      data: {
        relationship: {
          _id: relationship._id,
          commissionRate: relationship.commissionRate,
          commissionType: relationship.commissionType,
          status: relationship.status,
          createdAt: relationship.createdAt
        },
        partner: relationship.partnerId
      }
    });
  } catch (error) {
    console.error('Error fetching partner details:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching partner details',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Define interface for partner update fields
interface PartnerUpdateFields {
  [key: string]: any;
  fullName?: string;
  phone?: string;
  status?: string;
  updatedAt?: Date;
}

// Update partner details
const updatePartner = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const mcpId = req.user._id;
    
    const { partnerId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(partnerId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid partner ID format'
      });
      return;
    }
    
    const { 
      commissionRate, 
      commissionType,
      status,
      fullName,
      phone 
    } = req.body;
    
    // Find relationship first
    const relationship = await MCPPartner.findOne({ mcpId, partnerId });
    
    if (!relationship) {
      res.status(404).json({
        success: false,
        message: 'Partner not found or not associated with this MCP'
      });
      return;
    }
    
    if (commissionRate !== undefined) relationship.commissionRate = commissionRate;
    if (commissionType !== undefined && ['PERCENTAGE', 'FIXED'].includes(commissionType)) {
      relationship.commissionType = commissionType;
    }
    if (status !== undefined && ['ACTIVE', 'INACTIVE'].includes(status)) {
      relationship.status = status;
    }
    relationship.updatedAt = new Date();
    
    await relationship.save({ session });
    
    let partnerUpdated = false;
    const updateFields: PartnerUpdateFields = {};
    
    if (fullName) updateFields.fullName = fullName;
    if (phone) updateFields.phone = phone;
    if (status && ['ACTIVE', 'INACTIVE'].includes(status)) {
      updateFields.status = status;
    }
    
    if (Object.keys(updateFields).length > 0) {
      updateFields.updatedAt = new Date();
      await User.findByIdAndUpdate(partnerId, updateFields, { session });
      partnerUpdated = true;
    }
    
    if (partnerUpdated || status) {
      const notification = new Notification({
        userId: partnerId,
        title: 'Account Updated',
        message: 'Your account details have been updated by your MCP.',
        type: 'PARTNER',
        referenceId: relationship._id
      });
      
      await notification.save({ session });
    }
    
    await session.commitTransaction();
    
    res.status(200).json({
      success: true,
      message: 'Partner details updated successfully',
      data: {
        relationshipId: relationship._id,
        partnerId,
        commissionRate: relationship.commissionRate,
        commissionType: relationship.commissionType,
        status: relationship.status
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error updating partner:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating partner',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    session.endSession();
  }
};

// Delete partner (remove relationship)
const deletePartner = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const mcpId = req.user._id;
    
    const { partnerId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(partnerId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid partner ID format'
      });
      return;
    }
    
    // Find relationship
    const relationship = await MCPPartner.findOne({ mcpId, partnerId });
    
    if (!relationship) {
      res.status(404).json({
        success: false,
        message: 'Partner not found or not associated with this MCP'
      });
      return;
    }
    
    await MCPPartner.findByIdAndDelete(relationship._id, { session });
    
    const notification = new Notification({
      userId: partnerId,
      title: 'Partnership Terminated',
      message: 'Your partnership with MCP has been terminated.',
      type: 'PARTNER',
      referenceId: mcpId
    });
    
    await notification.save({ session });
    
    await session.commitTransaction();
    
    res.status(200).json({
      success: true,
      message: 'Partner relationship removed successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error removing partner:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing partner',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    session.endSession();
  }
};

const PartnerController = {
  getAllPartners,
  getPartnerDetails,
  updatePartner,
  deletePartner,
  addPartner
};

export default PartnerController;