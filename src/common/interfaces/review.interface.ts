export interface IReview {
  orderId: string;
  userId: string;
  targetType: string;
  targetId: string;
  rating: number;
  comment?: string;
}
