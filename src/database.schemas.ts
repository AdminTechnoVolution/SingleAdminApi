import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'users', versionKey: false })
export class User {
  @Prop() email?: string;
  @Prop({ type: Object }) userInfo?: { fullName?: string; birthdate?: Date };
  @Prop({ type: Object }) location?: { country?: string; city?: string; coordinates?: number[] };
  @Prop() status?: string;
  @Prop() created_at?: Date;
  @Prop({ type: [Object] }) photos?: Array<{
    isProfile?: boolean;
    path?: string;
    sizes?: Array<{ size?: string; name?: string; url?: string }>;
  }>;
}
export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

@Schema({ collection: 'reports', versionKey: false })
export class Report {
  @Prop({ type: Types.ObjectId }) reporterUserId?: Types.ObjectId;
  @Prop({ type: Types.ObjectId }) reportedUserId?: Types.ObjectId;
  @Prop() reportReason?: string;
  @Prop() severity?: number;
  @Prop() status?: string;
  @Prop() message?: string;
  @Prop() createdAt?: Date;
}
export const ReportSchema = SchemaFactory.createForClass(Report);

@Schema({ collection: 'reportReasons', versionKey: false })
export class ReportReason {
  @Prop() _id?: string;
  @Prop({ type: [Object] }) language?: Array<{ iso6391: string; name: string; desc?: string }>;
  @Prop() severity?: number;
}
export const ReportReasonSchema = SchemaFactory.createForClass(ReportReason);

@Schema({ collection: 'subscriptions', versionKey: false })
export class Subscription {
  @Prop({ type: Types.ObjectId }) userId?: Types.ObjectId;
  @Prop() subscriptionId?: string;
  @Prop() packageName?: string;
  @Prop({ type: Object }) paymentInfo?: {
    fromDate?: Date; toDate?: Date; priceAmountMicros?: number;
    priceCurrencyCode?: string; countryCode?: string;
  };
}
export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
