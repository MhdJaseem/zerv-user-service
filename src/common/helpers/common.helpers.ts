import * as momentTz from 'moment-timezone';
import { ASIA_CALCUTTA_TIMEZONE } from '../constants/common.constants';

export class Helpers {
  public static enumToArray = (enumObject: Record<string, unknown>): unknown[] => {
    const enumArray: unknown[] = [];
    for (const enumName in enumObject) {
      enumArray.push(enumObject[enumName]);
    }
    return enumArray;
  };

  public static convertUom(capacity: number, sourceUom: string, targetUom: string, density: number = 1): number {
    const conversionFactors = {
      'ml': { 'ml': 1, 'l': 0.001, 'g': 0.001 * density, 'kg': 0.000001 * density, 'mg': 1 * density },
      'l': { 'ml': 1000, 'l': 1, 'g': 1000 * density, 'kg': 1 * density, 'mg': 1000000 * density },
      'g': { 'ml': 1 / (density * 1000), 'l': 1 / density, 'g': 1, 'kg': 0.001, 'mg': 1000 },
      'kg': { 'ml': 1 / (density * 1000000), 'l': 1 / density, 'g': 1000, 'kg': 1, 'mg': 1000000 },
      'mg': { 'ml': 1 / (density * 1000000), 'l': 1 / (density * 1000), 'g': 0.001, 'kg': 0.000001, 'mg': 1 }
    };

    if (!conversionFactors[sourceUom] || !conversionFactors[sourceUom][targetUom]) {
      return capacity
    }

    return Number((capacity * conversionFactors[sourceUom][targetUom]).toFixed(2));
  }

  public static generateDateRange(startDate: Date, endDate: Date): Date[] {
    const dateRange: Date[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      dateRange.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dateRange;
  }

  public static getLastNumber = (str: string): string => {
    const matches = str.match(/\d+/g);
    return matches ? matches[matches.length - 1] : '';
  };

  public static generateQrCodeForFlask(
    deliveryDate: string,
    session: string,
    productId: string,
    zoneName: string,
    userId: string
  ): string {

    // Format the delivery date to "DDMM"
    const formattedDate = momentTz.tz(deliveryDate, ASIA_CALCUTTA_TIMEZONE).format('DDMM');

    // Extract and format the session (first 3 characters, uppercase)
    const formattedSession = session.slice(0, 3).toUpperCase();

    // Extract the last numeric part of the product ID
    const productNumber = Helpers.getLastNumber(productId);

    // Extract and format the zone name (first 3 characters, uppercase)
    const formattedZone = zoneName.slice(0, 3).toUpperCase();

    // Extract the last numeric part of the user ID
    const userNumber = Helpers.getLastNumber(userId);

    // Combine all parts into the final QR code
    return `${formattedDate}${formattedSession}-${productNumber}-${formattedZone}${userNumber}`;
  }

  public static ceilToTwoDecimals(num) {
    return Math.ceil(num * 100) / 100;
  }

  public static processQueryParams(query: Record<string, any>): Record<string, any> {
    const filter: Record<string, any> = {};

    // Loop through the query parameters and build the filter object
    for (const key in query) {
      const value = query[key];

      // Check if the value is a string and contains commas (indicating multiple values)
      if (typeof value === 'string' && value.includes(',')) {
        filter[key] = value.split(',');  // Convert comma-separated values into an array
      } else if (Array.isArray(value)) {
        filter[key] = value;  // If it's already an array, use the array
      } else {
        filter[key] = value;  // Otherwise, use the value as is
      }
    }

    return filter;
  }

  public static generateTempPassword(): string {
    return Math.random().toString(36).slice(-8) + 'aA1!';
  }

  public static maximumOccurrences(inputArray: Array<string> = []) {
    if (inputArray.length === 0) return '';
    let modeMap = {};
    let maxEl = inputArray[0],
      maxCount = 1;
    for (let i = 0; i < inputArray.length; i++) {
      let el = inputArray[i];
      if (modeMap[el] == null) modeMap[el] = 1;
      else modeMap[el]++;
      if (modeMap[el] > maxCount) {
        maxEl = el;
        maxCount = modeMap[el];
      }
    }
    return maxEl;
  }

  public static removePlusCode(address: string): string {
    if (address.includes('+')) {
      const addressSet = address.split(' ');
      addressSet.forEach((elem) => {
        if (elem.includes('+')) {
          let index = addressSet.indexOf(elem);
          addressSet.splice(index, 1);
        }
      });
      address = addressSet.join(' ');
    }
    return address;
  }

  public static secondsToMinutes(time: number): number {
    return Math.floor(time / 60);
  };

  public static parseAddress(address: string) {
    const addressParts = address?.split(", ");//17 W 33rd St, New York, NY 10118, USA
    if (addressParts?.length < 3) {
      throw new Error("Invalid address format");
    }

    const street = addressParts?.length > 0 ? addressParts[0] : "";
    const city = addressParts?.length > 1 ? addressParts[1] : "";
    const stateZipCountry = addressParts?.length > 2 ? addressParts[2]?.split(" ") : [];

    const state = stateZipCountry?.length > 0 ? stateZipCountry[0] : "";
    const zipCode = stateZipCountry?.length > 1 ? stateZipCountry[1] : "";
    const country = stateZipCountry?.length > 2 ? stateZipCountry[2] : "US";

    return {
      streetAddress: [street],
      city: city,
      state: state,
      zipCode: zipCode,
      country: country
    };
  }

}