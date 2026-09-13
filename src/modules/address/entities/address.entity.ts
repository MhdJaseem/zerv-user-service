import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { nanoid } from 'nanoid';
import { IAddress } from '../../../common/interfaces/address.interface';

export type AddressDocument = Address & Document;

export class Location {
  @Prop()
  type: 'Point';
  @Prop({
    type: [Number, Number],
  })
  coordinates: [number, number];
}

@Schema({ timestamps: true })
export class Address extends Document implements IAddress {
  @Prop({ type: String, unique: true, default: () => nanoid() })
  addressId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({})
  state: string;

  @Prop({  })
  streetAddress: string[];

  @Prop({})
  city: string;

  @Prop({})
  zipCode: string;

  @Prop({ type: Location})
  location: Location;

  @Prop({ })
  country: string;
}

export const AddressSchema = SchemaFactory.createForClass(Address);
AddressSchema.index({ location: '2dsphere' });
