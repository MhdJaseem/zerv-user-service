export interface ICarouselImage {
  imageUrl: string;
  heading1: string;
  heading2: string;
}

export interface IContactInfo {
  name: string;
  phone: string;
  title: string;
  email: string;
  url: string;
}

export interface IHeroContent {
  carouselImages: ICarouselImage[];
}

export interface IRestaurant {
  restaurantId: string;
  restaurantName: string;
  restaurantOriginUrl: string;
  contactInfo: IContactInfo;
  heroContent: IHeroContent;
  isDeleted?: boolean;
}