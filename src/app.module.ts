import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validationSchema } from './config';
import { AuthController, AdminGuard, AuthService } from './auth';
import { CountriesController } from './countries';
import { DashboardController, DashboardService } from './dashboard';
import {
  Report, ReportReason, ReportReasonSchema, ReportSchema,
  Subscription, SubscriptionSchema, User, UserSchema,
} from './database.schemas';
import { ReportsController, ReportsService } from './reports';
import { SubscriptionsController, SubscriptionsService } from './subscriptions';
import { UsersController, UsersService } from './users';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow('MONGO_URI'),
        autoIndex: false,
      }),
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Report.name, schema: ReportSchema },
      { name: ReportReason.name, schema: ReportReasonSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow('SESSION_SECRET'),
        signOptions: { expiresIn: config.get<number>('SESSION_TTL', 3600) },
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
  ],
  controllers: [
    AuthController, DashboardController, UsersController, CountriesController,
    ReportsController, SubscriptionsController,
  ],
  providers: [
    AuthService, AdminGuard, UsersService, ReportsService, SubscriptionsService, DashboardService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
