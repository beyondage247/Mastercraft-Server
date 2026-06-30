import { Injectable } from '@nestjs/common';
import Stripe = require('stripe');

@Injectable()
export class StripeService {
  readonly stripe: Stripe;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    this.stripe = new Stripe(secretKey);
  }

  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
    }
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }
}
