export interface ILocation {
  type: 'Point';
  coordinates: [number, number];
}

export interface IAddress {
  addressId: string;
  userId: string;
  state: string;
  country: string;
  streetAddress: string[];
  city: string;
  zipCode: string;
  location: ILocation;
} 