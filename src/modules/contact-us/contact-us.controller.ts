import { Controller, Post, Get, Patch, Body, Query, Param, Req, BadRequestException } from '@nestjs/common';
import { ContactUsService } from './contact-us.service';
import { CreateContactUsDto } from './dto/create-contact-us.dto';
import { UpdateContactUsDto } from './dto/update-contact-us.dto';
import { QueryContactUsDto } from './dto/query-contact-us.dto';

@Controller('contactus')
export class ContactUsController {
  constructor(private readonly contactUsService: ContactUsService) {}

  /**
   * Create a support ticket
   * Uses clientId from middleware for restaurant context
   */
  @Post()
  async createTicket(@Req() req, @Body() createDto: CreateContactUsDto) {
    const restaurantId = req['clientId'];
    if (!restaurantId) {
      throw new BadRequestException('Restaurant ID is required to create a ticket. Ensure proper Origin header or restaurantId query param.');
    }
    return await this.contactUsService.createTicket(restaurantId, createDto);
  }

  /**
   * View tickets for a specific restaurant
   */
  @Get('restaurant/:restaurantId')
  async getTicketsByRestaurant(
    @Param('restaurantId') restaurantId: string,
    @Query() query: QueryContactUsDto
  ) {
    return await this.contactUsService.getTicketsByRestaurantId(restaurantId, query);
  }

  /**
   * View a single ticket detail independently
   */
  @Get(':id')
  async getTicketDetail(@Param('id') ticketId: string) {
    return await this.contactUsService.getTicketById(ticketId);
  }

  /**
   * View all tickets with filters (Platform Level)
   */
  @Get()
  async getAllTickets(@Query() query: QueryContactUsDto) {
    return await this.contactUsService.getAllTickets(query);
  }

  /**
   * Update ticket status and add notes
   */
  @Patch(':id')
  async updateTicket(
    @Param('id') ticketId: string,
    @Body() updateDto: UpdateContactUsDto,
  ) {
    return await this.contactUsService.updateTicket(ticketId, updateDto);
  }
}
