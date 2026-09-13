import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ContactUs, ContactUsDocument, ContactUsStatus } from './entities/contact-us.entity';
import { CreateContactUsDto } from './dto/create-contact-us.dto';
import { UpdateContactUsDto } from './dto/update-contact-us.dto';
import { QueryContactUsDto } from './dto/query-contact-us.dto';
import { PaginationService } from '../../common/shared/pagination/pagination.service';

@Injectable()
export class ContactUsService {
  constructor(
    @InjectModel(ContactUs.name) private readonly contactUsModel: Model<ContactUsDocument>,
    private readonly paginationService: PaginationService,
  ) {}

  /**
   * Create a new support ticket (Restaurant Admin)
   */
  async createTicket(restaurantId: string, createDto: CreateContactUsDto): Promise<ContactUs> {
    try {
      const newTicket = new this.contactUsModel({
        ...createDto,
        restaurantId,
              });
      return await newTicket.save();
    } catch (error) {
      throw new BadRequestException('Failed to create ticket: ' + error.message);
    }
  }

  /**
   * Get a single ticket by its ticketId
   */
  async getTicketById(ticketId: string): Promise<ContactUs> {
    const ticket = await this.contactUsModel.findOne({ ticketId }).exec();
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
    }
    return ticket;
  }

  /**
   * Get paginated tickets for a specific restaurant
   */
  async getTicketsByRestaurantId(restaurantId: string, query: QueryContactUsDto) {
    const { skip = 0, limit = 10, status } = query;
    const filter: any = { restaurantId, isDeleted: { $in: [null, false] } };
    if (status) filter.status = status;

    return await this.paginationService.findAndPaginate(this.contactUsModel, {
      skip,
      limit,
      filter,
      sort: { createdAt: -1 }
    });
  }


  /**
   * Get all tickets with filters (Super Admin)
   */
  async getAllTickets(query: QueryContactUsDto) {
    const { skip = 0, limit = 10, status, restaurantId } = query;
    const filter: any = { isDeleted: { $in: [null, false] } };
    if (status) filter.status = status;
    if (restaurantId) filter.restaurantId = restaurantId;

    return await this.paginationService.findAndPaginate(this.contactUsModel, {
      skip,
      limit,
      filter,
      sort: { createdAt: -1 }
    });
  }

  /**
   * Update ticket status and admin notes (Super Admin)
   */
  async updateTicket(ticketId: string, updateDto: UpdateContactUsDto): Promise<ContactUs> {
    const ticket = await this.contactUsModel.findOneAndUpdate(
      { ticketId },
      { $set: updateDto },
      { new: true },
    );

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${ticketId} not found`);
    }

    return ticket;
  }
}
